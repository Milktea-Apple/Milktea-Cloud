import type { NextRequest } from "next/server";
import { ApiError, handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { CHUNK_SIZE } from "@/lib/config";
import { saveChunk } from "@/lib/storage";
import { expectedChunkSize, requireUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; index: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id, index: indexText } = await context.params;
    const row = requireUpload(user.id, id);
    const index = Number(indexText);
    const expected = expectedChunkSize(row, index);
    const declared = request.headers.get("content-length");
    if (declared !== null && Number(declared) !== expected) {
      throw new ApiError(400, "分片大小不正确。", "bad_chunk_size", { expected });
    }
    if (declared && Number(declared) > CHUNK_SIZE + 1) {
      throw new ApiError(413, "分片过大。", "chunk_too_large");
    }
    const buffer = new Uint8Array(await request.arrayBuffer());
    if (buffer.byteLength > CHUNK_SIZE) throw new ApiError(413, "分片过大。", "chunk_too_large");
    saveChunk(row.id, index, buffer, expected);
    return json({ ok: true, index, size: buffer.byteLength });
  });
}
