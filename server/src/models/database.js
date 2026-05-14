import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'vault.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    -- Users table (single user app, but designed for extensibility)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      master_salt TEXT NOT NULL,
      wrapped_dek TEXT NOT NULL,
      recovery_wrapped_dek TEXT,
      recovery_key_hash TEXT,
      server_wrapped_dek TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Vault entries (encrypted data stored as blob)
    CREATE TABLE IF NOT EXISTS vault_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Category index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_vault_category ON vault_entries(user_id, category);

    -- Nominees
    CREATE TABLE IF NOT EXISTS nominees (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      relationship TEXT,
      access_code_hash TEXT NOT NULL,
      access_level TEXT DEFAULT 'full',
      allowed_categories TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Access requests (dead man's switch activations)
    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      nominee_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      requested_at TEXT DEFAULT (datetime('now')),
      last_reminder_at TEXT,
      reminder_count INTEGER DEFAULT 0,
      responded_at TEXT,
      response TEXT,
      expires_at TEXT NOT NULL,
      unlocked_at TEXT,
      FOREIGN KEY (nominee_id) REFERENCES nominees(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Audit log (append-only)
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);

    -- Documents attached to vault entries (encrypted file storage)
    CREATE TABLE IF NOT EXISTS vault_documents (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (entry_id) REFERENCES vault_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vault_docs_entry ON vault_documents(entry_id);

    -- Recovery OTPs (temporary, for email-based password reset)
    CREATE TABLE IF NOT EXISTS recovery_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrations: add columns that may not exist on older databases
  const userColumns = db.pragma('table_info(users)').map(c => c.name);
  if (!userColumns.includes('server_wrapped_dek')) {
    db.exec('ALTER TABLE users ADD COLUMN server_wrapped_dek TEXT');
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
