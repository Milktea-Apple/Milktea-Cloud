import type { NextRequest } from "next/server";
import { handle, json, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createFolder } from "@/lib/files";

type Body = { name?: string; parentId?: string | null };

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const body = await readJson<Body>(request);
    const parentId = body.parentId ? String(body.parentId) : null;
    const folder = createFolder(user.id, parentId, body.name ?? "");
    return json({ folder }, { status: 201 });
  });
}
