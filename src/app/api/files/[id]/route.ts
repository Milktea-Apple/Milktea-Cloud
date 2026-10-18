import type { NextRequest } from "next/server";
import { handle, json, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getFileRow, moveFile, renameFile, toFileDTO, trashFile } from "@/lib/files";

type Body = { name?: string; parentId?: string | null };

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    const body = await readJson<Body>(request);
    let file = body.name !== undefined ? renameFile(user.id, id, body.name) : null;
    if (body.parentId !== undefined) {
      file = moveFile(user.id, id, body.parentId || null);
    }
    if (!file) {
      file = toFileDTO(getFileRow(user.id, id));
    }
    return json({ file });
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    return json(trashFile(user.id, id));
  });
}
