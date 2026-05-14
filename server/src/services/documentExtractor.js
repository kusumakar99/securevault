import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function renderPdfPagesToImages(buffer, maxPages = 5) {
  const { pdf: pdfToImg } = await import('pdf-to-img');
  const document = await pdfToImg(buffer, { scale: 2 });
  const pages = [];
  let count = 0;
  for await (const pageBuffer of document) {
    pages.push(pageBuffer);
    count += 1;
    if (count >= maxPages) break;
  }
  return pages;
}

const EXTRACTABLE_FIELDS = [
  'propertyType',
  'description',
  'address',
  'area',
  'registrationNumber',
  'registrationDate',
  'purchaseValue',
  'ownershipType',
  'coOwners',
];

const PROPERTY_TYPE_OPTIONS = ['House', 'Apartment', 'Land/Plot', 'Commercial', 'Farm Land'];
const OWNERSHIP_OPTIONS = ['Self', 'Joint', 'Family', 'Inherited'];

const EXTRACTION_PROMPT = `You are a document parser specialized in Indian property/real estate documents (sale deeds, registration documents, property tax receipts, encumbrance certificates, etc.).

Extract the following fields from the provided document(s). Return ONLY a JSON object with these keys:
- propertyType: one of [House, Apartment, Land/Plot, Commercial, Farm Land] or null
- description: brief description of the property (e.g., "3BHK Apartment in Whitefield")
- address: full address of the property
- area: area with unit (e.g., "1200 sq ft" or "2.5 acres")
- registrationNumber: document/property registration number
- registrationDate: in YYYY-MM-DD format if found
- purchaseValue: numeric value in rupees (just the number, no symbols/text)
- ownershipType: one of [Self, Joint, Family, Inherited] or null
- coOwners: names of co-owners if any, comma separated

Rules:
- Return null for any field you cannot confidently extract
- Do NOT invent or guess values
- For purchaseValue, convert "lakhs"/"crores" to full numbers (e.g., "45 lakhs" = 4500000)
- For dates, use YYYY-MM-DD format
- Return ONLY valid JSON, no markdown, no explanation

JSON:`;

function getAzureConfig() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT in .env');
  }
  const base = endpoint.replace(/\/+$/, '');
  return {
    apiKey,
    url: `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
  };
}

async function callAzureChat(messages, { maxTokens = 1024, temperature = 0.1 } = {}) {
  const { apiKey, url } = getAzureConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure OpenAI error: ${response.status} - ${err}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Extract real estate details from uploaded documents using Azure OpenAI (gpt-4o-mini).
 */
export async function extractPropertyDetails(files) {
  // Build content parts: text from PDFs is sent as text; images sent as image_url for vision.
  const contentParts = [{ type: 'text', text: EXTRACTION_PROMPT }];

  for (const file of files) {
    if (file.mimetype === 'application/pdf') {
      const text = await extractPdfText(file.buffer);
      if (text && text.trim().length > 50) {
        contentParts.push({
          type: 'text',
          text: `\n\n--- Document: ${file.originalname} ---\n${text}`,
        });
      } else {
        // Scanned PDF — render pages to images and use vision OCR
        let pageImages;
        try {
          pageImages = await renderPdfPagesToImages(file.buffer, 5);
        } catch (e) {
          throw new Error(`Failed to render "${file.originalname}" for OCR: ${e.message}`);
        }
        if (!pageImages.length) {
          throw new Error(`Could not read any pages from "${file.originalname}".`);
        }
        contentParts.push({
          type: 'text',
          text: `\n\n--- Document: ${file.originalname} (scanned PDF, ${pageImages.length} page${pageImages.length > 1 ? 's' : ''}) ---`,
        });
        for (const pageBuf of pageImages) {
          const base64 = pageBuf.toString('base64');
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64}` },
          });
        }
      }
    } else if (file.mimetype.startsWith('image/')) {
      const base64 = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64}`;
      contentParts.push({
        type: 'text',
        text: `\n\n--- Document: ${file.originalname} (image) ---`,
      });
      contentParts.push({ type: 'image_url', image_url: { url: dataUrl } });
    } else {
      throw new Error(`Unsupported file type for "${file.originalname}". Use PDF or image.`);
    }
  }

  const content = await callAzureChat(
    [
      { role: 'system', content: 'You are a precise document parser. Return only valid JSON, no markdown fences.' },
      { role: 'user', content: contentParts },
    ],
    { maxTokens: 2048, temperature: 0.1 }
  );

  if (!content) {
    throw new Error('Empty response from Azure OpenAI');
  }

  const parsed = parseJsonResponse(content);
  return normalizeExtractedData(parsed);
}

async function extractPdfText(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch {
    return '';
  }
}

function parseJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse extraction response');
  }
}

function normalizeExtractedData(data) {
  const result = {};

  for (const field of EXTRACTABLE_FIELDS) {
    const value = data[field];
    if (value === null || value === undefined || value === '') {
      result[field] = '';
      continue;
    }

    switch (field) {
      case 'propertyType':
        result[field] = PROPERTY_TYPE_OPTIONS.includes(value) ? value : '';
        break;
      case 'ownershipType':
        result[field] = OWNERSHIP_OPTIONS.includes(value) ? value : '';
        break;
      case 'purchaseValue':
        result[field] = String(value).replace(/[^0-9.]/g, '') || '';
        break;
      case 'registrationDate':
        result[field] = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
        break;
      default:
        result[field] = String(value).trim();
    }
  }

  return result;
}
