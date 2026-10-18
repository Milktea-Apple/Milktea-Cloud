import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteUploadTemp, receivedChunks } from "@/lib/storage";
import { requireUpload } from "@/lib/uploads";
import { execute } from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = requireUser(request);
    const { id } = await context.params;
    const row = requireUpload(user.id, id);
    return json({
      id: row.id,
      name: row.name,
      size: Number(row.size),
      totalChunks: Number(row.total_chunks),
      received: receivedChunks(row.id),
    });
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    const row = requireUpload(user.id, id);
    deleteUploadTemp(row.id);
    execute("DELETE FROM uploads WHERE id = ? AND owner_id = ?", row.id, user.id);
    return json({ ok: true });
  });
}
