import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();

function resolveDir(value: string | undefined, fallback: string) {
  return path.resolve(ROOT, value && value.trim() ? value.trim() : fallback);
}

function positiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const DATA_DIR = resolveDir(process.env.DATA_DIR, "data");
export const STORAGE_DIR = resolveDir(process.env.STORAGE_DIR, "storage");
export const BLOB_DIR = path.join(STORAGE_DIR, "blobs");
export const TMP_DIR = path.join(STORAGE_DIR, "tmp");
export const DB_PATH = path.join(DATA_DIR, "milktea.sqlite");

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SHARE_UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const UPLOAD_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const CHUNK_SIZE = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = positiveInt(process.env.MAX_FILE_BYTES, 50 * 1024 ** 3);
export const USER_QUOTA_BYTES = positiveInt(process.env.USER_QUOTA_BYTES, 100 * 1024 ** 3);
export const MAX_TEXT_PREVIEW = 2 * 1024 * 1024;
export const ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION !== "false";

let cachedSecret: string | null = null;

export function authSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    cachedSecret = process.env.AUTH_SECRET;
    return cachedSecret;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const secretFile = path.join(DATA_DIR, "auth-secret");
  if (existsSync(secretFile)) {
    cachedSecret = readFileSync(secretFile, "utf8").trim();
  } else {
    cachedSecret = randomBytes(32).toString("hex");
    writeFileSync(secretFile, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

export function ensureStorageDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(BLOB_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
}
