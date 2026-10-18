import { ApiError } from "./api";
import { CHUNK_SIZE } from "./config";
import { queryOne } from "./db";

export type UploadRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  size: number;
  mime: string;
  chunk_size: number;
  total_chunks: number;
  client_key: string | null;
  created_at: number;
  expires_at: number;
};

export function findUpload(ownerId: string, uploadId: string) {
  return queryOne<UploadRow>(
    "SELECT * FROM uploads WHERE id = ? AND owner_id = ?",
    uploadId,
    ownerId,
  );
}

export function requireUpload(ownerId: string, uploadId: string) {
  const row = findUpload(ownerId, uploadId);
  if (!row) throw new ApiError(404, "上传会话不存在，请重新选择文件。", "upload_not_found");
  if (row.expires_at <= Date.now()) {
    throw new ApiError(410, "上传会话已过期，请重新选择文件。", "upload_expired");
  }
  return row;
}

export function expectedChunkSize(row: UploadRow, index: number) {
  const total = Number(row.total_chunks);
  const size = Number(row.size);
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new ApiError(400, "分片序号超出范围。", "bad_chunk");
  }
  if (index === total - 1) {
    const remainder = size - (total - 1) * CHUNK_SIZE;
    return remainder > 0 ? remainder : CHUNK_SIZE;
  }
  return CHUNK_SIZE;
}

export function totalChunksFor(size: number) {
  return Math.max(0, Math.ceil(size / CHUNK_SIZE));
}
