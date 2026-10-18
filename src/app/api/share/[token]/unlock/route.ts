import type { NextRequest } from "next/server";
import { ApiError, clientIp, handle, json, rateLimit, readJson, requireSameOrigin } from "@/lib/api";
import { isSecureRequest } from "@/lib/auth";
import {
  findShareByToken,
  isShareUnlocked,
  publicShareMeta,
  setShareCookie,
  shareStatus,
  unlockShare,
} from "@/lib/shares";

type Body = { password?: string };

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    requireSameOrigin(request);
    const { token } = await context.params;
    rateLimit(`share-unlock:${clientIp(request)}:${token}`, 10, 10 * 60 * 1000);
    const row = findShareByToken(token);
    if (!row) throw new ApiError(404, "这个分享链接不存在。", "share_not_found");
    const status = shareStatus(row);
    if (status === "missing") throw new ApiError(404, "分享的文件已被删除。", "share_missing");
    if (status === "expired") throw new ApiError(410, "这个分享链接已经过期。", "share_expired");
    const body = await readJson<Body>(request);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) throw new ApiError(400, "请输入提取码。", "bad_share_password");
    await unlockShare(row, password);
    const response = json(publicShareMeta(row, true));
    if (row.password_hash) setShareCookie(response, token, row.password_hash, isSecureRequest(request));
    return response;
  });
}
