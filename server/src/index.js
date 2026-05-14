import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import nomineeRoutes from './routes/nominees.js';
import documentExtractRoutes from './routes/documentExtract.js';
import { startDMSScheduler } from './services/dmsScheduler.js';
import { authMiddleware as auditAuth } from './middleware/auth.js';
import { getDb as getAuditDb } from './models/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust Azure proxy for rate limiting & IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

if (!isProduction) {
  app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173', credentials: true }));
}
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts. Try again later.' } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/vault', apiLimiter, vaultRoutes);
app.use('/api/nominees', apiLimiter, nomineeRoutes);
app.use('/api/extract', apiLimiter, documentExtractRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV }));

// Audit log endpoint (owner only)
app.get('/api/audit', apiLimiter, auditAuth, (req, res) => {
  const db = getAuditDb();
  const limit = Math.min(parseInt(req.query.limit || '50'), 200);
  const logs = db.prepare(
    'SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(req.userId, limit);
  res.json({ logs });
});

// --- Production: Serve React frontend ---
if (isProduction) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n🔐 SecureVault server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Production mode: ${isProduction}\n`);
  startDMSScheduler();
});
