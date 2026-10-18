import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { purgeFile, restoreFile } from "@/lib/files";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    return json({ file: restoreFile(user.id, id) });
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    return json(purgeFile(user.id, id));
  });
}
