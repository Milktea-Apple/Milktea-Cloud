import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { DB_PATH, DATA_DIR } from "./config";

type GlobalDb = typeof globalThis & {
  __milkteaDb?: DatabaseSync;
};

const SCHEMA_VERSION = 1;

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  if (row && Number(row.value) >= SCHEMA_VERSION) return;

  db.exec(`BEGIN`);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES files(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
        size INTEGER NOT NULL DEFAULT 0,
        mime TEXT NOT NULL DEFAULT 'application/octet-stream',
        storage_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        trash_batch TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_files_owner_parent
        ON files(owner_id, parent_id, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_files_owner_trash
        ON files(owner_id, deleted_at, trash_batch);
      CREATE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key);

      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id TEXT,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime TEXT NOT NULL,
        chunk_size INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        client_key TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_uploads_owner_key
        ON uploads(owner_id, client_key, parent_id);

      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        expires_at INTEGER,
        downloads INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_download_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);
    `);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION),
    );
    db.exec(`COMMIT`);
  } catch (error) {
    db.exec(`ROLLBACK`);
    throw error;
  }
}

export function getDb() {
  const globalRef = globalThis as GlobalDb;
  if (globalRef.__milkteaDb) return globalRef.__milkteaDb;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  migrate(db);
  globalRef.__milkteaDb = db;
  return db;
}

export function queryOne<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function queryAll<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function execute(sql: string, ...params: SQLInputValue[]) {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function now() {
  return Date.now();
}
