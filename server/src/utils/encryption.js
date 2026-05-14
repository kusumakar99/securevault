import crypto from 'crypto';
import argon2 from 'argon2';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// --- Argon2id Key Derivation ---

export async function deriveKeyFromPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(SALT_LENGTH);
  else if (typeof salt === 'string') salt = Buffer.from(salt, 'hex');

  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
    salt,
    raw: true,
  });

  return { key: hash, salt: salt.toString('hex') };
}

// --- AES-256-GCM Encrypt / Decrypt ---

export function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData, key) {
  const [ivHex, tagHex, ciphertext] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- Envelope Encryption (DEK/KEK Model) ---

export function generateDEK() {
  return crypto.randomBytes(32);
}

export function wrapDEK(dek, kek) {
  return encrypt(dek.toString('hex'), kek);
}

export function unwrapDEK(wrappedDEK, kek) {
  const dekHex = decrypt(wrappedDEK, kek);
  return Buffer.from(dekHex, 'hex');
}

// --- Vault Data Encryption (uses DEK) ---

export function encryptVaultData(data, dek) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return encrypt(json, dek);
}

export function decryptVaultData(encryptedData, dek) {
  const json = decrypt(encryptedData, dek);
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

// --- Recovery Key Generation ---

export function generateRecoveryKey() {
  // 24-byte random key, displayed as base64 to user
  const key = crypto.randomBytes(24);
  return key.toString('base64');
}

export async function deriveRecoveryKEK(recoveryKey) {
  // Use a fixed salt for recovery key (derived from the key itself)
  const salt = crypto.createHash('sha256').update('securevault-recovery-' + recoveryKey).digest().subarray(0, 32);
  const { key } = await deriveKeyFromPassword(recoveryKey, salt);
  return key;
}

// --- Nominee Access Code Generation ---

export function generateAccessCode() {
  // 8-character alphanumeric code, easy to share
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// --- Password Hashing (for auth password verification) ---

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}

// --- TOTP helpers ---

export function generateTOTPSecret() {
  return crypto.randomBytes(20).toString('hex');
}
