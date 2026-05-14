import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../models/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateAccessCode, hashPassword, verifyPassword } from '../utils/encryption.js';
import { auditLog } from '../middleware/audit.js';
import { sendEmail } from '../services/email.js';

const router = Router();

// --- Owner: List nominees ---
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const nominees = db.prepare(
    'SELECT id, name, email, relationship, access_level, allowed_categories, is_active, created_at FROM nominees WHERE user_id = ?'
  ).all(req.userId);

  res.json({
    nominees: nominees.map(n => ({
      ...n,
      allowed_categories: JSON.parse(n.allowed_categories || '[]'),
    })),
  });
});

// --- Owner: Add nominee ---
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, relationship, accessLevel, allowedCategories } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const accessCode = generateAccessCode();
    const accessCodeHash = await hashPassword(accessCode);
    const id = uuid();
    const db = getDb();

    db.prepare(`
      INSERT INTO nominees (id, user_id, name, email, relationship, access_code_hash, access_level, allowed_categories)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.userId, name, email, relationship || '', accessCodeHash, accessLevel || 'full', JSON.stringify(allowedCategories || []));

    auditLog(req.userId, req.userId, 'nominee_added', { nomineeId: id, name, email }, req.ip);

    res.status(201).json({
      id,
      name,
      email,
      accessCode,
      message: `Share this access code with ${name}: ${accessCode}. This code will not be shown again.`,
    });
  } catch (err) {
    console.error('Add nominee error:', err);
    res.status(500).json({ error: 'Failed to add nominee' });
  }
});

// --- Owner: Remove nominee ---
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.prepare(
    'UPDATE nominees SET is_active = 0 WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Nominee not found' });

  auditLog(req.userId, req.userId, 'nominee_removed', { nomineeId: req.params.id }, req.ip);
  res.json({ message: 'Nominee deactivated' });
});

// --- Public: Nominee activates access (Dead Man's Switch trigger) ---
router.post('/activate', async (req, res) => {
  try {
    const { accessCode, email } = req.body;
    if (!accessCode || !email) {
      return res.status(400).json({ error: 'Access code and email are required' });
    }

    const db = getDb();
    const nominees = db.prepare(
      'SELECT n.*, u.email as owner_email, u.name as owner_name, u.id as owner_id FROM nominees n JOIN users u ON n.user_id = u.id WHERE n.email = ? AND n.is_active = 1'
    ).all(email);

    let matchedNominee = null;
    for (const nominee of nominees) {
      const valid = await verifyPassword(nominee.access_code_hash, accessCode);
      if (valid) {
        matchedNominee = nominee;
        break;
      }
    }

    if (!matchedNominee) {
      return res.status(401).json({ error: 'Invalid access code or email' });
    }

    // Check for existing pending request
    const existingRequest = db.prepare(
      "SELECT id FROM access_requests WHERE nominee_id = ? AND status = 'pending'"
    ).get(matchedNominee.id);

    if (existingRequest) {
      return res.status(409).json({ error: 'An access request is already pending', requestId: existingRequest.id });
    }

    // Create access request
    const totalWaitDays = parseInt(process.env.DMS_TOTAL_WAIT_DAYS || '21');
    const expiresAt = new Date(Date.now() + totalWaitDays * 24 * 60 * 60 * 1000).toISOString();
    const requestId = uuid();

    db.prepare(`
      INSERT INTO access_requests (id, nominee_id, user_id, status, expires_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(requestId, matchedNominee.id, matchedNominee.owner_id, expiresAt);

    auditLog(matchedNominee.owner_id, matchedNominee.email, 'access_requested', {
      nomineeId: matchedNominee.id,
      nomineeName: matchedNominee.name,
      requestId,
    }, req.ip);

    // Send notification email to owner
    try {
      await sendEmail({
        to: matchedNominee.owner_email,
        subject: '⚠️ SecureVault: Nominee Access Requested',
        html: `
          <h2>Nominee Access Request</h2>
          <p><strong>${matchedNominee.name}</strong> (${matchedNominee.email}) has requested access to your SecureVault.</p>
          <p>If this was not expected, please <strong>log in immediately</strong> to deny the request.</p>
          <p><a href="${process.env.APP_URL}/access-requests">Review Access Requests</a></p>
          <p>If you do not respond within <strong>${totalWaitDays} days</strong>, access will be automatically granted.</p>
          <p><em>— SecureVault</em></p>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr);
    }

    res.json({
      message: 'Access request submitted. The vault owner has been notified.',
      requestId,
      expiresAt,
    });
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ error: 'Activation failed' });
  }
});

// --- Owner: List access requests ---
router.get('/access-requests', authMiddleware, (req, res) => {
  const db = getDb();
  const requests = db.prepare(`
    SELECT ar.*, n.name as nominee_name, n.email as nominee_email, n.relationship
    FROM access_requests ar
    JOIN nominees n ON ar.nominee_id = n.id
    WHERE ar.user_id = ?
    ORDER BY ar.requested_at DESC
  `).all(req.userId);

  res.json({ requests });
});

// --- Owner: Respond to access request ---
router.post('/access-requests/:id/respond', authMiddleware, async (req, res) => {
  const { response } = req.body; // 'approve' or 'deny'
  if (!['approve', 'deny'].includes(response)) {
    return res.status(400).json({ error: 'Response must be "approve" or "deny"' });
  }

  const db = getDb();
  const request = db.prepare(
    "SELECT * FROM access_requests WHERE id = ? AND user_id = ? AND status = 'pending'"
  ).get(req.params.id, req.userId);

  if (!request) return res.status(404).json({ error: 'Pending request not found' });

  const status = response === 'approve' ? 'approved' : 'denied';
  db.prepare(
    "UPDATE access_requests SET status = ?, responded_at = datetime('now'), response = ? WHERE id = ?"
  ).run(status, response, req.params.id);

  auditLog(req.userId, req.userId, `access_${status}`, { requestId: req.params.id }, req.ip);

  // Notify nominee
  const nominee = db.prepare('SELECT * FROM nominees WHERE id = ?').get(request.nominee_id);
  if (nominee) {
    try {
      await sendEmail({
        to: nominee.email,
        subject: `SecureVault: Access ${status === 'approved' ? 'Granted' : 'Denied'}`,
        html: `
          <h2>Access ${status === 'approved' ? 'Granted' : 'Denied'}</h2>
          <p>Your request to access the SecureVault has been <strong>${status}</strong> by the owner.</p>
          ${status === 'approved' ? `<p><a href="${process.env.APP_URL}/nominee-access">Access Vault</a></p>` : ''}
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send nominee notification:', emailErr);
    }
  }

  res.json({ message: `Request ${status}`, status });
});

export default router;
