import type { NextRequest } from "next/server";
import { ApiError, handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { USER_QUOTA_BYTES } from "@/lib/config";
import { execute } from "@/lib/db";
import { createFileRecord, requireFolder, usageFor } from "@/lib/files";
import { deleteStorageKey, deleteUploadTemp, mergeChunks, receivedChunks } from "@/lib/storage";
import { requireUpload } from "@/lib/uploads";

const completing = new Set<string>();

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    const row = requireUpload(user.id, id);
    if (completing.has(row.id)) throw new ApiError(409, "文件正在合并，请稍候。", "completing");
    completing.add(row.id);
    let storageKey: string | null = null;
    try {
      requireFolder(user.id, row.parent_id);
      const total = Number(row.total_chunks);
      const received = receivedChunks(row.id);
      for (let index = 0; index < total; index += 1) {
        if (!received.includes(index)) {
          throw new ApiError(400, `还有 ${total - received.length} 个分片没上传。`, "missing_chunks");
        }
      }
      const usage = usageFor(user.id);
      if (usage.usage + Number(row.size) > USER_QUOTA_BYTES) {
        throw new ApiError(413, "存储空间不足，文件没有保存。", "quota_exceeded");
      }
      storageKey = await mergeChunks(row.id, total, Number(row.size));
      const file = createFileRecord({
        ownerId: user.id,
        parentId: row.parent_id,
        name: row.name,
        size: Number(row.size),
        storageKey,
      });
      deleteUploadTemp(row.id);
      execute("DELETE FROM uploads WHERE id = ? AND owner_id = ?", row.id, user.id);
      return json({ file }, { status: 201 });
    } catch (error) {
      if (storageKey) deleteStorageKey(storageKey);
      throw error;
    } finally {
      completing.delete(row.id);
    }
  });
}
