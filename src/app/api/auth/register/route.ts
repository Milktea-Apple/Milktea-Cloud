import type { NextRequest } from "next/server";
import { ApiError, assertString, clientIp, handle, json, rateLimit, readJson, requireSameOrigin } from "@/lib/api";
import {
  createSession,
  dummyPasswordHash,
  hashPassword,
  isSecureRequest,
  setSessionCookie,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { ALLOW_REGISTRATION } from "@/lib/config";
import { countUsers, findUserByUsername, publicUser } from "@/lib/auth";
import { execute, now, transaction, queryOne } from "@/lib/db";

type Body = { username?: string; password?: string; displayName?: string };

function cleanDisplayName(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 32);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    rateLimit(`register:${clientIp(request)}`, 12, 60 * 60 * 1000);
    const body = await readJson<Body>(request);
    const username = validateUsername(assertString(body.username, "用户名", 3, 24));
    const password = validatePassword(body.password || "");
    const displayName = cleanDisplayName(body.displayName || "") || username;
    if (displayName.length < 1) throw new ApiError(400, "昵称不能为空。", "bad_display_name");

    if (findUserByUsername(username)) {
      throw new ApiError(409, "这个用户名已经有人用了。", "username_taken");
    }
    const isFirst = countUsers() === 0;
    if (!isFirst && !ALLOW_REGISTRATION) {
      throw new ApiError(403, "这个网盘目前关闭了注册。", "registration_closed");
    }

    await dummyPasswordHash();
    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();
    const timestamp = now();
    try {
      transaction(() => {
        const existing = queryOne<{ id: string }>("SELECT id FROM users WHERE username = ? COLLATE NOCASE", username);
        if (existing) throw new ApiError(409, "这个用户名已经有人用了。", "username_taken");
        execute(
          "INSERT INTO users (id, username, display_name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          id,
          username,
          displayName,
          passwordHash,
          isFirst ? 1 : 0,
          timestamp,
        );
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(409, "这个用户名已经有人用了。", "username_taken");
    }

    const user = findUserByUsername(username)!;
    const token = createSession(id, request.headers.get("user-agent"));
    const response = json({ user: publicUser(user) }, { status: 201 });
    setSessionCookie(response, token, isSecureRequest(request));
    return response;
  });
}
