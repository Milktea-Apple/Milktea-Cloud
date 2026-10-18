import type { NextRequest } from "next/server";
import { ApiError, handle, json } from "@/lib/api";
import { findShareByToken, isShareUnlocked, publicShareMeta, shareStatus } from "@/lib/shares";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const row = findShareByToken(token);
    if (!row) throw new ApiError(404, "这个分享链接不存在。", "share_not_found");
    if (shareStatus(row) === "missing") {
      throw new ApiError(404, "分享的文件已经被删除。", "share_missing");
    }
    const unlocked = isShareUnlocked(request, row);
    return json(publicShareMeta(row, unlocked));
  });
}
