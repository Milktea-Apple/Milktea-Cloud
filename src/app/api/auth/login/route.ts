import type { NextRequest } from "next/server";
import { ApiError, clientIp, handle, json, rateLimit, readJson, requireSameOrigin } from "@/lib/api";
import {
  createSession,
  dummyPasswordHash,
  findUserByUsername,
  isSecureRequest,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

type Body = { username?: string; password?: string };

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const body = await readJson<Body>(request);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) throw new ApiError(400, "请输入用户名和密码。", "bad_input");
    rateLimit(`login:${clientIp(request)}:${username.toLowerCase()}`, 12, 15 * 60 * 1000);

    const user = findUserByUsername(username);
    if (!user) {
      await verifyPassword(password, await dummyPasswordHash());
      throw new ApiError(401, "用户名或密码不正确。", "bad_credentials");
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw new ApiError(401, "用户名或密码不正确。", "bad_credentials");

    const token = createSession(user.id, request.headers.get("user-agent"));
    const response = json({ user: publicUser(user) });
    setSessionCookie(response, token, isSecureRequest(request));
    return response;
  });
}
