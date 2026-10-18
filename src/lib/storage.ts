import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { stat, statfs } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { BLOB_DIR, CHUNK_SIZE, TMP_DIR, ensureStorageDirs } from "./config";
import { ApiError } from "./api";

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;

function assertId(id: string) {
  if (!SAFE_ID.test(id)) throw new ApiError(400, "上传会话无效。", "bad_upload_id");
}

export function newStorageKey() {
  const key = randomBytes(20).toString("hex");
  return `${key.slice(0, 2)}/${key}`;
}

export function blobPath(key: string) {
  if (!/^[a-f0-9]{2}\/[a-f0-9]{40}$/.test(key)) {
    throw new ApiError(500, "文件索引损坏。", "bad_storage_key");
  }
  return path.join(BLOB_DIR, key);
}

function uploadDir(uploadId: string) {
  assertId(uploadId);
  return path.join(TMP_DIR, "uploads", uploadId);
}

function chunkPath(uploadId: string, index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 1_000_000) {
    throw new ApiError(400, "分片序号不正确。", "bad_chunk");
  }
  return path.join(uploadDir(uploadId), `${index}.part`);
}

export function saveChunk(uploadId: string, index: number, data: Uint8Array, expectedSize: number) {
  ensureStorageDirs();
  if (data.byteLength !== expectedSize) {
    throw new ApiError(400, "分片大小不正确，请重试。", "bad_chunk_size", {
      expected: expectedSize,
      received: data.byteLength,
    });
  }
  const dir = uploadDir(uploadId);
  mkdirSync(dir, { recursive: true });
  const target = chunkPath(uploadId, index);
  const temporary = `${target}.writing`;
  writeFileSync(temporary, data);
  renameSync(temporary, target);
}

export function receivedChunks(uploadId: string) {
  const dir = uploadDir(uploadId);
  if (!existsSync(dir)) return [] as number[];
  return readdirSync(dir)
    .map((name) => {
      const match = /^(\d+)\.part$/.exec(name);
      return match ? Number(match[1]) : -1;
    })
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
}

export async function mergeChunks(uploadId: string, totalChunks: number, expectedSize: number) {
  const key = newStorageKey();
  const target = blobPath(key);
  mkdirSync(path.dirname(target), { recursive: true });
  const writeStream = createWriteStream(target, { flags: "wx" });
  let written = 0;
  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const part = chunkPath(uploadId, index);
      if (!existsSync(part)) {
        throw new ApiError(400, `第 ${index + 1} 个分片还没上传完成。`, "missing_chunk", { index });
      }
      const info = await stat(part);
      written += info.size;
      await pipeline(createReadStream(part), writeStream, { end: false });
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.once("finish", resolve);
      writeStream.once("error", reject);
      writeStream.end();
    });
  } catch (error) {
    writeStream.destroy();
    try {
      unlinkSync(target);
    } catch {
      // The partial blob may not exist yet.
    }
    throw error;
  }
  if (written !== expectedSize) {
    try {
      unlinkSync(target);
    } catch {
      // Nothing to clean up.
    }
    throw new ApiError(400, "合并后的文件大小不匹配，请重新上传。", "size_mismatch");
  }
  return key;
}

export function deleteUploadTemp(uploadId: string) {
  try {
    rmSync(uploadDir(uploadId), { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

export function deleteStorageKey(key: string | null | undefined) {
  if (!key) return;
  try {
    unlinkSync(blobPath(key));
  } catch {
    // Already gone.
  }
}

export async function freeDiskBytes() {
  try {
    ensureStorageDirs();
    const stats = await statfs(BLOB_DIR);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return 0;
  }
}

export function blobSize(key: string) {
  try {
    return statSync(blobPath(key)).size;
  } catch {
    return 0;
  }
}

export type ParsedRange = { start: number; end: number } | "invalid" | null;

export function parseRange(header: string | null, size: number): ParsedRange {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startText, endText] = match;
  if (!startText && !endText) return "invalid";
  if (size <= 0) return "invalid";
  let start: number;
  let end: number;
  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText ? Number(endText) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
    if (start >= size) return "invalid";
    end = Math.min(end, size - 1);
    if (end < start) return "invalid";
  }
  return { start, end };
}

export function contentDisposition(type: "inline" | "attachment", filename: string) {
  const cleaned = filename.replace(/[\r\n"]/g, "").replace(/[\\/:*?<>|]/g, "_");
  const ascii = cleaned.replace(/[^\x20-\x7e]/g, "_") || "download";
  const encoded = encodeURIComponent(cleaned).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function uploadChunkSize() {
  return CHUNK_SIZE;
}
