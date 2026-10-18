import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { TMP_DIR, TRASH_RETENTION_MS, ensureStorageDirs } from "./config";
import { execute, now, queryAll } from "./db";
import { purgeFile } from "./files";
import { deleteUploadTemp } from "./storage";

const globalRef = globalThis as typeof globalThis & { __milkteaLastCleanup?: number };
const CLEANUP_INTERVAL = 10 * 60 * 1000;

export async function maybeMaintain() {
  const last = globalRef.__milkteaLastCleanup || 0;
  if (Date.now() - last < CLEANUP_INTERVAL) return;
  globalRef.__milkteaLastCleanup = Date.now();
  try {
    await runMaintenance();
  } catch (error) {
    console.error("[milktea] maintenance failed", error);
  }
}

export async function runMaintenance() {
  ensureStorageDirs();
  const timestamp = now();
  execute("DELETE FROM sessions WHERE expires_at <= ?", timestamp);

  const oldTrash = queryAll<{ id: string; owner_id: string }>(
    `SELECT f.id, f.owner_id FROM files f
     LEFT JOIN files p ON p.id = f.parent_id
     WHERE f.deleted_at IS NOT NULL AND f.deleted_at < ?
       AND (f.parent_id IS NULL OR p.deleted_at IS NULL)
     LIMIT 50`,
    timestamp - TRASH_RETENTION_MS,
  );
  for (const row of oldTrash) {
    try {
      purgeFile(row.owner_id, row.id);
    } catch {
      // It may have been purged concurrently.
    }
  }

  const expiredUploads = queryAll<{ id: string }>(
    "SELECT id FROM uploads WHERE expires_at < ?",
    timestamp,
  );
  for (const upload of expiredUploads) {
    deleteUploadTemp(upload.id);
    execute("DELETE FROM uploads WHERE id = ?", upload.id);
  }

  execute(
    "DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?",
    timestamp - 30 * 24 * 60 * 60 * 1000,
  );

  try {
    const uploadRoot = path.join(TMP_DIR, "uploads");
    for (const name of readdirSync(uploadRoot)) {
      const known = queryAll<{ id: string }>("SELECT id FROM uploads WHERE id = ?", name);
      if (known.length === 0) {
        const dir = path.join(uploadRoot, name);
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // Best effort.
        }
      }
    }
  } catch {
    // The upload temp directory may not exist yet.
  }
}
