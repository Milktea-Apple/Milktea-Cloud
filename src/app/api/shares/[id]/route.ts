import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { revokeShare } from "@/lib/shares";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const { id } = await context.params;
    return json(revokeShare(user.id, id));
  });
}
