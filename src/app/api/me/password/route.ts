import type { NextRequest } from "next/server";
import { ApiError, clientIp, handle, json, rateLimit, readJson, requireSameOrigin } from "@/lib/api";
import {
  createSession,
  destroyAllSessions,
  findUserByUsername,
  hashPassword,
  isSecureRequest,
  requireUser,
  setSessionCookie,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { execute } from "@/lib/db";

type Body = { currentPassword?: string; newPassword?: string };

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const sessionUser = requireUser(request);
    rateLimit(`password:${clientIp(request)}:${sessionUser.id}`, 6, 15 * 60 * 1000);
    const body = await readJson<Body>(request);
    const currentPassword = body.currentPassword || "";
    const newPassword = validatePassword(body.newPassword || "");
    const row = findUserByUsername(sessionUser.username);
    if (!row) throw new ApiError(401, "账号不存在。", "unauthorized");
    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw new ApiError(403, "当前密码不正确。", "bad_credentials");
    }
    const passwordHash = await hashPassword(newPassword);
    execute("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, row.id);
    destroyAllSessions(row.id);
    const token = createSession(row.id, request.headers.get("user-agent"));
    const response = json({ ok: true });
    setSessionCookie(response, token, isSecureRequest(request));
    return response;
  });
}
