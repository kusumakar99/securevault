import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import { getDb } from '../models/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSessionDEK } from './auth.js';
import { encryptVaultData, decryptVaultData } from '../utils/encryption.js';
import { CATEGORIES } from '../models/categories.js';
import { auditLog } from '../middleware/audit.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const router = Router();

// Multer for document uploads (memory storage, encrypted before DB storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10,
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

// Ensure DEK is available
function requireDEK(req, res, next) {
  const dek = getSessionDEK(req.userId);
  if (!dek) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
  req.dek = dek;
  next();
}

router.use(authMiddleware, requireDEK);

// --- Get all categories metadata ---
router.get('/categories', (req, res) => {
  const list = Object.entries(CATEGORIES).map(([key, val]) => ({
    key,
    label: val.label,
    icon: val.icon,
    fieldCount: val.fields.length,
  }));
  res.json({ categories: list });
});

// --- Get category schema ---
router.get('/categories/:category/schema', (req, res) => {
  const cat = CATEGORIES[req.params.category];
  if (!cat) return res.status(404).json({ error: 'Unknown category' });
  res.json({ category: req.params.category, ...cat });
});

// --- List entries for a category ---
router.get('/entries/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES[category]) return res.status(404).json({ error: 'Unknown category' });

  const db = getDb();
  const entries = db.prepare(
    'SELECT id, category, title, tags, created_at, updated_at FROM vault_entries WHERE user_id = ? AND category = ? ORDER BY updated_at DESC'
  ).all(req.userId, category);

  res.json({ entries });
});

// --- Get single entry (decrypted) ---
router.get('/entries/:category/:id', (req, res) => {
  const db = getDb();
  const entry = db.prepare(
    'SELECT * FROM vault_entries WHERE id = ? AND user_id = ? AND category = ?'
  ).get(req.params.id, req.userId, req.params.category);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const data = decryptVaultData(entry.encrypted_data, req.dek);
  auditLog(req.userId, req.userId, 'vault_entry_viewed', { entryId: entry.id, category: entry.category }, req.ip);

  res.json({
    id: entry.id,
    category: entry.category,
    title: entry.title,
    data,
    tags: JSON.parse(entry.tags || '[]'),
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  });
});

// --- Create entry ---
router.post('/entries/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES[category]) return res.status(404).json({ error: 'Unknown category' });

  const { title, data, tags } = req.body;
  if (!title || !data) return res.status(400).json({ error: 'Title and data are required' });

  const encrypted = encryptVaultData(data, req.dek);
  const id = uuid();
  const db = getDb();

  db.prepare(
    'INSERT INTO vault_entries (id, user_id, category, title, encrypted_data, tags) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.userId, category, title, encrypted, JSON.stringify(tags || []));

  auditLog(req.userId, req.userId, 'vault_entry_created', { entryId: id, category }, req.ip);

  res.status(201).json({ id, category, title, message: 'Entry created' });
});

// --- Update entry ---
router.put('/entries/:category/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare(
    'SELECT id FROM vault_entries WHERE id = ? AND user_id = ? AND category = ?'
  ).get(req.params.id, req.userId, req.params.category);

  if (!existing) return res.status(404).json({ error: 'Entry not found' });

  const { title, data, tags } = req.body;
  const encrypted = encryptVaultData(data, req.dek);

  db.prepare(
    `UPDATE vault_entries SET title = ?, encrypted_data = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, encrypted, JSON.stringify(tags || []), req.params.id);

  auditLog(req.userId, req.userId, 'vault_entry_updated', { entryId: req.params.id, category: req.params.category }, req.ip);

  res.json({ id: req.params.id, message: 'Entry updated' });
});

// --- Delete entry ---
router.delete('/entries/:category/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM vault_entries WHERE id = ? AND user_id = ? AND category = ?'
  ).run(req.params.id, req.userId, req.params.category);

  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });

  auditLog(req.userId, req.userId, 'vault_entry_deleted', { entryId: req.params.id, category: req.params.category }, req.ip);

  res.json({ message: 'Entry deleted' });
});

// --- Dashboard summary ---
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const counts = db.prepare(
    'SELECT category, COUNT(*) as count FROM vault_entries WHERE user_id = ? GROUP BY category'
  ).all(req.userId);

  const total = counts.reduce((sum, c) => sum + c.count, 0);

  const nominees = db.prepare(
    'SELECT COUNT(*) as count FROM nominees WHERE user_id = ? AND is_active = 1'
  ).get(req.userId);

  const pendingRequests = db.prepare(
    "SELECT COUNT(*) as count FROM access_requests WHERE user_id = ? AND status = 'pending'"
  ).get(req.userId);

  res.json({
    totalEntries: total,
    categoryCounts: counts,
    activeNominees: nominees.count,
    pendingAccessRequests: pendingRequests.count,
  });
});

// --- Upload documents to an entry ---
router.post('/entries/:category/:id/documents', (req, res, next) => {
  upload.array('documents', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum 10MB per file.' });
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files. Maximum 10 files.' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const db = getDb();
  const entry = db.prepare(
    'SELECT id FROM vault_entries WHERE id = ? AND user_id = ? AND category = ?'
  ).get(req.params.id, req.userId, req.params.category);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const insertStmt = db.prepare(
    'INSERT INTO vault_documents (id, entry_id, user_id, file_name, mime_type, file_size, encrypted_data) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const docs = [];
  const insertMany = db.transaction(() => {
    for (const file of req.files) {
      const docId = uuid();
      const encryptedFile = encrypt(file.buffer.toString('base64'), req.dek);
      insertStmt.run(docId, req.params.id, req.userId, file.originalname, file.mimetype, file.size, encryptedFile);
      docs.push({ id: docId, fileName: file.originalname, mimeType: file.mimetype, fileSize: file.size });
    }
  });
  insertMany();

  auditLog(req.userId, req.userId, 'documents_uploaded', { entryId: req.params.id, count: docs.length }, req.ip);
  res.status(201).json({ documents: docs, message: `${docs.length} document(s) uploaded` });
});

// --- List documents for an entry ---
router.get('/entries/:category/:id/documents', (req, res) => {
  const db = getDb();
  const entry = db.prepare(
    'SELECT id FROM vault_entries WHERE id = ? AND user_id = ? AND category = ?'
  ).get(req.params.id, req.userId, req.params.category);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const docs = db.prepare(
    'SELECT id, file_name, mime_type, file_size, created_at FROM vault_documents WHERE entry_id = ? AND user_id = ?'
  ).all(req.params.id, req.userId);

  res.json({ documents: docs });
});

// --- Download a specific document ---
router.get('/documents/:docId', (req, res) => {
  const db = getDb();
  const doc = db.prepare(
    'SELECT * FROM vault_documents WHERE id = ? AND user_id = ?'
  ).get(req.params.docId, req.userId);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const decryptedBase64 = decrypt(doc.encrypted_data, req.dek);
  const buffer = Buffer.from(decryptedBase64, 'base64');

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// --- Delete a document ---
router.delete('/documents/:docId', (req, res) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM vault_documents WHERE id = ? AND user_id = ?'
  ).run(req.params.docId, req.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });

  auditLog(req.userId, req.userId, 'document_deleted', { docId: req.params.docId }, req.ip);
  res.json({ message: 'Document deleted' });
});

export default router;
