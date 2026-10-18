import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api";
import { authSecret, SHARE_UNLOCK_TTL_MS } from "./config";
import { execute, now, queryAll, queryOne } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { getFileRow, toFileDTO, type FileRow } from "./files";
import { previewKindOf, type ShareDTO } from "./shared";

export type ShareRow = {
  id: string;
  owner_id: string;
  file_id: string;
  token: string;
  password_hash: string | null;
  expires_at: number | null;
  downloads: number;
  created_at: number;
  last_download_at: number | null;
};

type ShareWithFile = ShareRow & {
  file_name: string;
  file_size: number;
  file_kind: "file" | "folder";
  file_mime: string;
  file_deleted: number | null;
  owner_name: string;
};

const TOKEN_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const COOKIE_PREFIX = "mc_share_";

function newToken() {
  const bytes = randomBytes(18);
  let token = "";
  for (const byte of bytes) token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return token.slice(0, 22);
}

export function shareCookieName(token: string) {
  return `${COOKIE_PREFIX}${token}`;
}

export function shareCookiePath(token: string) {
  return `/api/share/${token}`;
}

export function shareUnlockValue(token: string, passwordHash: string) {
  return createHmac("sha256", authSecret())
    .update(`share-unlock:${token}:${passwordHash}`)
    .digest("base64url");
}

export function setShareCookie(response: NextResponse, token: string, passwordHash: string, secure: boolean) {
  response.cookies.set(shareCookieName(token), shareUnlockValue(token, passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: shareCookiePath(token),
    maxAge: Math.floor(SHARE_UNLOCK_TTL_MS / 1000),
  });
}

export function clearShareCookie(response: NextResponse, token: string) {
  response.cookies.set(shareCookieName(token), "", {
    httpOnly: true,
    sameSite: "lax",
    path: shareCookiePath(token),
    maxAge: 0,
  });
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isShareUnlocked(request: NextRequest, row: ShareRow) {
  if (!row.password_hash) return true;
  const candidate = request.cookies.get(shareCookieName(row.token))?.value;
  if (!candidate) return false;
  return safeEqual(candidate, shareUnlockValue(row.token, row.password_hash));
}

export function findShareByToken(token: string) {
  if (!/^[a-z0-9]{16,32}$/.test(token)) return null;
  return queryOne<ShareWithFile>(
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.kind AS file_kind,
            f.mime AS file_mime, f.deleted_at AS file_deleted, u.display_name AS owner_name
     FROM shares s
     JOIN files f ON f.id = s.file_id
     JOIN users u ON u.id = s.owner_id
     WHERE s.token = ?`,
    token,
  );
}

export function shareStatus(row: ShareWithFile) {
  if (row.file_deleted) return "missing" as const;
  if (row.expires_at && row.expires_at <= now()) return "expired" as const;
  return "active" as const;
}

export function publicShareMeta(row: ShareWithFile, unlocked: boolean) {
  const status = shareStatus(row);
  return {
    token: row.token,
    status,
    name: row.file_name,
    size: Number(row.file_size),
    mime: row.file_mime,
    previewKind: previewKindOf(row.file_name, row.file_kind),
    owner: row.owner_name,
    createdAt: Number(row.created_at),
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    downloads: Number(row.downloads),
    requiresPassword: Boolean(row.password_hash),
    unlocked,
    canPreview: status === "active" && unlocked,
  };
}

export function requireShareAccess(request: NextRequest, row: ShareWithFile) {
  const status = shareStatus(row);
  if (status === "missing") throw new ApiError(404, "分享的文件已被删除。", "share_missing");
  if (status === "expired") throw new ApiError(410, "这个分享链接已经过期。", "share_expired");
  if (!isShareUnlocked(request, row)) {
    throw new ApiError(401, "这个分享需要提取码。", "share_locked");
  }
}

export async function createShareAsync(
  ownerId: string,
  fileId: string,
  options: { password?: string; expiresInDays?: number },
) {
  const file = getFileRow(ownerId, fileId);
  if (file.kind !== "file") {
    throw new ApiError(400, "目前只能分享单个文件。", "folder_share_unsupported");
  }
  let passwordHash: string | null = null;
  if (options.password) {
    if (options.password.length < 4 || options.password.length > 64) {
      throw new ApiError(400, "提取码需要 4–64 个字符。", "bad_share_password");
    }
    passwordHash = await hashPassword(options.password);
  }
  const days = Number(options.expiresInDays || 0);
  const expiresAt = days > 0 ? now() + Math.min(days, 365) * 86400000 : null;
  let token = newToken();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = queryOne<{ id: string }>("SELECT id FROM shares WHERE token = ?", token);
    if (!exists) break;
    token = newToken();
  }
  const id = randomBytes(12).toString("hex");
  execute(
    `INSERT INTO shares (id, owner_id, file_id, token, password_hash, expires_at, downloads, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    ownerId,
    fileId,
    token,
    passwordHash,
    expiresAt,
    now(),
  );
  return toShareDTO(id, ownerId);
}

function toShareDTO(id: string, ownerId: string): ShareDTO {
  const row = queryOne<ShareWithFile>(
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.kind AS file_kind,
            f.mime AS file_mime, f.deleted_at AS file_deleted, u.display_name AS owner_name
     FROM shares s JOIN files f ON f.id = s.file_id JOIN users u ON u.id = s.owner_id
     WHERE s.id = ? AND s.owner_id = ?`,
    id,
    ownerId,
  );
  if (!row) throw new ApiError(500, "分享创建失败。", "share_create_failed");
  return {
    id: row.id,
    token: row.token,
    fileId: row.file_id,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    previewKind: previewKindOf(row.file_name, row.file_kind),
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    downloads: Number(row.downloads),
    createdAt: Number(row.created_at),
  };
}

export function listShares(ownerId: string) {
  const rows = queryAll<ShareWithFile>(
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.kind AS file_kind,
            f.mime AS file_mime, f.deleted_at AS file_deleted, u.display_name AS owner_name
     FROM shares s JOIN files f ON f.id = s.file_id JOIN users u ON u.id = s.owner_id
     WHERE s.owner_id = ? ORDER BY s.created_at DESC`,
    ownerId,
  );
  return rows.map((row) => ({
    ...toShareDTO(row.id, ownerId),
    fileAvailable: !row.file_deleted,
    expired: Boolean(row.expires_at && row.expires_at <= now()),
    lastDownloadAt: row.last_download_at ? Number(row.last_download_at) : null,
  }));
}

export function revokeShare(ownerId: string, shareId: string) {
  const row = queryOne<ShareRow>(
    "SELECT * FROM shares WHERE id = ? AND owner_id = ?",
    shareId,
    ownerId,
  );
  if (!row) throw new ApiError(404, "分享不存在。", "share_not_found");
  execute("DELETE FROM shares WHERE id = ? AND owner_id = ?", shareId, ownerId);
  return { token: row.token };
}

export async function unlockShare(row: ShareWithFile, password: string) {
  if (!row.password_hash) return true;
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) throw new ApiError(403, "提取码不正确。", "bad_share_password");
  return true;
}

export function recordShareDownload(shareId: string) {
  execute(
    "UPDATE shares SET downloads = downloads + 1, last_download_at = ? WHERE id = ?",
    now(),
    shareId,
  );
}

export function getShareFile(row: ShareWithFile): FileRow {
  return queryOne<FileRow>("SELECT * FROM files WHERE id = ?", row.file_id) as FileRow;
}

export function shareFileDTO(row: ShareWithFile) {
  return toFileDTO(getShareFile(row));
}
