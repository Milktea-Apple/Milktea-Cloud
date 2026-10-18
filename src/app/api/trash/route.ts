import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { emptyTrash, listTrash } from "@/lib/files";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    return json({ entries: listTrash(user.id) });
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    return json(emptyTrash(user.id));
  });
}
