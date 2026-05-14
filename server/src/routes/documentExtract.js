import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { getSessionDEK } from './auth.js';
import { extractPropertyDetails } from '../services/documentExtractor.js';
import { auditLog } from '../middleware/audit.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Strict rate limit for extraction (expensive API calls)
const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many extraction requests. Try again later.' },
});

// Multer config - memory only, strict limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (JPEG, PNG, WebP) are allowed'));
    }
  },
});

router.use(authMiddleware);

// POST /api/extract/real_estate - Extract property details from documents
router.post('/real_estate', extractLimiter, (req, res, next) => {
  upload.array('documents', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum 10MB per file.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum 5 files.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Document extraction not configured. GEMINI_API_KEY is required.' });
    }

    const extracted = await extractPropertyDetails(req.files);

    // Return files metadata so frontend can attach them to the entry after saving
    const filesInfo = req.files.map(f => ({
      name: f.originalname,
      size: f.size,
      type: f.mimetype,
    }));

    // Audit log (metadata only, no document content)
    auditLog(req.userId, req.userId, 'document_extraction', {
      category: 'real_estate',
      fileCount: req.files.length,
      fileNames: req.files.map(f => f.originalname),
      fieldsExtracted: Object.keys(extracted).filter(k => extracted[k]),
    }, req.ip);

    res.json({
      success: true,
      extracted,
      files: filesInfo,
      message: 'Fields extracted successfully. Please review and edit before saving.',
    });
  } catch (err) {
    console.error('Document extraction error:', err.message);
    res.status(500).json({
      error: 'Failed to extract details from documents. Please try again or fill in manually.',
    });
  }
});

export default router;
