import type { NextRequest } from "next/server";
import { ApiError, clientIp, handle, json, optionalString, rateLimit, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createShareAsync, listShares } from "@/lib/shares";

type Body = { fileId?: string; password?: string; expiresInDays?: number };

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    return json({ shares: listShares(user.id) });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    rateLimit(`share:${clientIp(request)}:${user.id}`, 60, 60 * 60 * 1000);
    const body = await readJson<Body>(request);
    const fileId = optionalString(body.fileId, 80);
    const password = optionalString(body.password, 64);
    const expiresInDays = Number(body.expiresInDays || 0);
    if (!fileId) throw new ApiError(400, "请选择要分享的文件。", "missing_file");
    const share = await createShareAsync(user.id, fileId, {
      password: password || undefined,
      expiresInDays: Number.isFinite(expiresInDays) ? expiresInDays : 0,
    });
    return json({ share }, { status: 201 });
  });
}
