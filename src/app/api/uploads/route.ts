import type { NextRequest } from "next/server";
import { ApiError, handle, json, optionalString, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CHUNK_SIZE, MAX_FILE_BYTES, UPLOAD_TTL_MS, USER_QUOTA_BYTES } from "@/lib/config";
import { execute, now, queryOne } from "@/lib/db";
import { requireFolder, sanitizeName, usageFor } from "@/lib/files";
import { freeDiskBytes, receivedChunks, deleteUploadTemp } from "@/lib/storage";
import { totalChunksFor, type UploadRow } from "@/lib/uploads";
import { randomUUID } from "node:crypto";

type Body = {
  name?: string;
  size?: number;
  parentId?: string | null;
  clientKey?: string;
};

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const body = await readJson<Body>(request);
    const name = sanitizeName(body.name);
    const size = Number(body.size);
    if (!Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
      throw new ApiError(400, "文件大小不正确。", "bad_size");
    }
    if (size > MAX_FILE_BYTES) {
      throw new ApiError(413, "这个文件超过了单文件大小上限。", "file_too_large");
    }
    const parentId = body.parentId ? String(body.parentId) : null;
    requireFolder(user.id, parentId);
    const clientKey = optionalString(body.clientKey, 180);

    const usage = usageFor(user.id);
    if (usage.usage + size > USER_QUOTA_BYTES) {
      throw new ApiError(
        413,
        "你的存储空间不够了，可以先清理回收站。",
        "quota_exceeded",
        { quota: USER_QUOTA_BYTES, usage: usage.usage },
      );
    }
    if (size > 0) {
      const free = await freeDiskBytes();
      if (free > 0 && free < size + 64 * 1024 * 1024) {
        throw new ApiError(507, "这台电脑的磁盘空间不足了。", "disk_full", { diskFree: free });
      }
    }

    if (clientKey) {
      const existing = queryOne<UploadRow>(
        `SELECT * FROM uploads
         WHERE owner_id = ? AND client_key = ? AND parent_id IS ? AND size = ? AND name = ? AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`,
        user.id,
        clientKey,
        parentId,
        size,
        name,
        now(),
      );
      if (existing) {
        return json({
          id: existing.id,
          name: existing.name,
          size: Number(existing.size),
          chunkSize: CHUNK_SIZE,
          totalChunks: Number(existing.total_chunks),
          received: receivedChunks(existing.id),
          resumed: true,
        });
      }
      const stale = queryOne<{ id: string }>(
        "SELECT id FROM uploads WHERE owner_id = ? AND client_key = ?",
        user.id,
        clientKey,
      );
      if (stale) {
        deleteUploadTemp(stale.id);
        execute("DELETE FROM uploads WHERE id = ? AND owner_id = ?", stale.id, user.id);
      }
    }

    const id = randomUUID();
    const totalChunks = totalChunksFor(size);
    execute(
      `INSERT INTO uploads
        (id, owner_id, parent_id, name, size, mime, chunk_size, total_chunks, client_key, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      user.id,
      parentId,
      name,
      size,
      "application/octet-stream",
      CHUNK_SIZE,
      totalChunks,
      clientKey || null,
      now(),
      now() + UPLOAD_TTL_MS,
    );

    return json({
      id,
      name,
      size,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      received: [] as number[],
      resumed: false,
    });
  });
}
