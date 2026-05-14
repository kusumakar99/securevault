import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../models/database.js';
import {
  deriveKeyFromPassword,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  hashPassword,
  verifyPassword,
  generateRecoveryKey,
  deriveRecoveryKEK,
  encrypt,
  decrypt,
} from '../utils/encryption.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { sendEmail } from '../services/email.js';

const router = Router();

// In-memory session key store (DEK held only in memory per session)
const sessionKeys = new Map();

export function getSessionDEK(userId) {
  return sessionKeys.get(userId);
}

export function clearSessionDEK(userId) {
  sessionKeys.delete(userId);
}

// Server-side recovery key (derived from JWT_SECRET + fixed salt)
function getServerRecoveryKey() {
  const secret = process.env.JWT_SECRET || 'default-secret';
  return crypto.createHash('sha256').update('sv-server-recovery-' + secret).digest();
}

// --- Register ---
router.post('/register', async (req, res) => {
  try {
    const { email, name, masterPassword } = req.body;
    if (!email || !name || !masterPassword) {
      return res.status(400).json({ error: 'Email, name, and master password are required' });
    }

    if (masterPassword.length < 8) {
      return res.status(400).json({ error: 'Master password must be at least 8 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Derive master KEK from password
    const { key: masterKEK, salt: masterSalt } = await deriveKeyFromPassword(masterPassword);

    // Generate DEK and wrap with master KEK
    const dek = generateDEK();
    const wrappedDEK = wrapDEK(dek, masterKEK);

    // Generate recovery key and wrap DEK with recovery KEK
    const recoveryKey = generateRecoveryKey();
    const recoveryKEK = await deriveRecoveryKEK(recoveryKey);
    const recoveryWrappedDEK = wrapDEK(dek, recoveryKEK);

    // Server-assisted recovery: wrap DEK with server key
    const serverKey = getServerRecoveryKey();
    const serverWrappedDEK = encrypt(dek.toString('hex'), serverKey);

    // Hash password for auth verification
    const passwordHash = await hashPassword(masterPassword);

    const userId = uuid();
    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, master_salt, wrapped_dek, recovery_wrapped_dek, server_wrapped_dek)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email, name, passwordHash, masterSalt, wrappedDEK, recoveryWrappedDEK, serverWrappedDEK);

    // Store DEK in session memory
    const token = generateToken(userId);
    sessionKeys.set(userId, dek);

    auditLog(userId, userId, 'user_registered', { email }, req.ip);

    res.status(201).json({
      token,
      user: { id: userId, email, name },
      recoveryKey, // Show ONCE — user must save this
      message: 'IMPORTANT: Save your recovery key securely. It cannot be shown again.',
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --- Login ---
router.post('/login', async (req, res) => {
  try {
    const { email, masterPassword, totpCode } = req.body;
    if (!email || !masterPassword) {
      return res.status(400).json({ error: 'Email and master password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(user.password_hash, masterPassword);
    if (!valid) {
      auditLog(user.id, 'anonymous', 'login_failed', { email }, req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check TOTP if enabled
    if (user.totp_enabled) {
      if (!totpCode) {
        return res.status(200).json({ requires2FA: true });
      }
      const { OTPAuth } = await import('otpauth');
      const totp = new OTPAuth.TOTP({ secret: user.totp_secret, algorithm: 'SHA1', digits: 6, period: 30 });
      const delta = totp.validate({ token: totpCode, window: 1 });
      if (delta === null) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    // Derive KEK and unwrap DEK
    const { key: masterKEK } = await deriveKeyFromPassword(masterPassword, user.master_salt);
    const { unwrapDEK } = await import('../utils/encryption.js');
    const dek = unwrapDEK(user.wrapped_dek, masterKEK);

    // Store DEK in session memory
    const token = generateToken(user.id);
    sessionKeys.set(user.id, dek);

    // Migration: store server-wrapped DEK for email recovery if not already set
    if (!user.server_wrapped_dek) {
      try {
        const serverKey = getServerRecoveryKey();
        const serverWrappedDek = encrypt(dek.toString('hex'), serverKey);
        db.prepare('UPDATE users SET server_wrapped_dek = ? WHERE id = ?').run(serverWrappedDek, user.id);
      } catch (migErr) {
        console.error('Server DEK migration warning:', migErr.message);
      }
    }

    auditLog(user.id, user.id, 'login_success', { email }, req.ip);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, totp_enabled: !!user.totp_enabled },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- Logout ---
router.post('/logout', authMiddleware, (req, res) => {
  clearSessionDEK(req.userId);
  auditLog(req.userId, req.userId, 'logout', {}, req.ip);
  res.json({ message: 'Logged out' });
});

// --- Get current user ---
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, totp_enabled, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// --- Recover account using recovery key ---
router.post('/recover', async (req, res) => {
  try {
    const { email, recoveryKey, newMasterPassword } = req.body;
    if (!email || !recoveryKey || !newMasterPassword) {
      return res.status(400).json({ error: 'Email, recovery key, and new master password are required' });
    }

    if (newMasterPassword.length < 8) {
      return res.status(400).json({ error: 'New master password must be at least 8 characters' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or recovery key' });
    }

    if (!user.recovery_wrapped_dek) {
      return res.status(400).json({ error: 'No recovery key was set up for this account' });
    }

    // Derive recovery KEK and try to unwrap DEK
    let dek;
    try {
      const recoveryKEK = await deriveRecoveryKEK(recoveryKey);
      dek = unwrapDEK(user.recovery_wrapped_dek, recoveryKEK);
    } catch {
      auditLog(user.id, 'anonymous', 'recovery_failed', { email }, req.ip);
      return res.status(401).json({ error: 'Invalid email or recovery key' });
    }

    // Recovery successful — re-wrap DEK with new master password
    const { key: newMasterKEK, salt: newSalt } = await deriveKeyFromPassword(newMasterPassword);
    const newWrappedDEK = wrapDEK(dek, newMasterKEK);
    const newPasswordHash = await hashPassword(newMasterPassword);

    db.prepare(`
      UPDATE users SET password_hash = ?, master_salt = ?, wrapped_dek = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newPasswordHash, newSalt, newWrappedDEK, user.id);

    // Log in the user
    const token = generateToken(user.id);
    sessionKeys.set(user.id, dek);

    auditLog(user.id, user.id, 'account_recovered', { email, method: 'recovery_key' }, req.ip);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      message: 'Account recovered successfully.',
    });
  } catch (err) {
    console.error('Recovery error:', err);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

// --- Request email OTP for password reset ---
router.post('/recover/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If the email exists, an OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Invalidate any previous unused OTPs
    db.prepare('UPDATE recovery_otps SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    // Store OTP hash
    db.prepare(
      'INSERT INTO recovery_otps (user_id, otp_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, otpHash, expiresAt);

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'SecureVault - Password Reset OTP',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #059669;">SecureVault Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>Your password reset OTP is:</p>
          <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #064e3b;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in <strong>10 minutes</strong>. If you didn't request this, ignore this email.</p>
        </div>
      `,
      text: `Your SecureVault password reset OTP is: ${otp}. It expires in 10 minutes.`,
    });

    auditLog(user.id, 'anonymous', 'recovery_otp_requested', { email }, req.ip);

    res.json({ message: 'If the email exists, an OTP has been sent.' });
  } catch (err) {
    console.error('OTP request error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// --- Verify OTP and reset password ---
router.post('/recover/verify-otp', async (req, res) => {
  try {
    const { email, otp, newMasterPassword } = req.body;
    if (!email || !otp || !newMasterPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newMasterPassword.length < 8) {
      return res.status(400).json({ error: 'New master password must be at least 8 characters' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or OTP' });
    }

    // Verify OTP
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpRecord = db.prepare(
      "SELECT * FROM recovery_otps WHERE user_id = ? AND otp_hash = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).get(user.id, otpHash);

    if (!otpRecord) {
      auditLog(user.id, 'anonymous', 'recovery_otp_failed', { email }, req.ip);
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    // Mark OTP as used
    db.prepare('UPDATE recovery_otps SET used = 1 WHERE id = ?').run(otpRecord.id);

    // Unwrap DEK using server key
    if (!user.server_wrapped_dek) {
      return res.status(400).json({ error: 'Server-assisted recovery not available for this account. Use your recovery key instead.' });
    }

    const serverKey = getServerRecoveryKey();
    const dekHex = decrypt(user.server_wrapped_dek, serverKey);
    const dek = Buffer.from(dekHex, 'hex');

    // Re-wrap DEK with new master password
    const { key: newMasterKEK, salt: newSalt } = await deriveKeyFromPassword(newMasterPassword);
    const newWrappedDEK = wrapDEK(dek, newMasterKEK);
    const newPasswordHash = await hashPassword(newMasterPassword);

    db.prepare(`
      UPDATE users SET password_hash = ?, master_salt = ?, wrapped_dek = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newPasswordHash, newSalt, newWrappedDEK, user.id);

    // Log in the user
    const token = generateToken(user.id);
    sessionKeys.set(user.id, dek);

    auditLog(user.id, user.id, 'account_recovered', { email, method: 'email_otp' }, req.ip);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      message: 'Password reset successful. You are now logged in.',
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

export default router;
