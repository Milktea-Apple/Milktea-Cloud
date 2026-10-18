import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiError } from "./api";
import { SESSION_TTL_MS } from "./config";
import { execute, now, queryOne } from "./db";
import type { UserDTO } from "./shared";

export const SESSION_COOKIE = "mc_session";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
};

type SessionRow = {
  id: string;
  expires_at: number;
  user_id: string;
  username: string;
  display_name: string;
  is_admin: number;
  created_at: number;
};

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltPart, keyPart] = parts;
  try {
    const salt = Buffer.from(saltPart, "base64url");
    const expected = Buffer.from(keyPart, "base64url");
    const key = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        expected.length,
        { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
        (error, derived) => (error ? reject(error) : resolve(derived as Buffer)),
      );
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | null = null;

export function dummyPasswordHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(randomBytes(18).toString("hex"));
  return dummyHashPromise;
}

export function publicUser(row: UserRow): UserDTO {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  };
}

export function findUserByUsername(username: string) {
  return queryOne<UserRow>("SELECT * FROM users WHERE username = ? COLLATE NOCASE", username);
}

export function countUsers() {
  const row = queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM users");
  return Number(row?.count || 0);
}

function sessionId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
  execute(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    sessionId(token),
    userId,
    createdAt,
    createdAt + SESSION_TTL_MS,
    (userAgent || "").slice(0, 300),
  );
  return token;
}

export function resolveSession(token: string | undefined | null): UserDTO | null {
  if (!token || token.length > 200) return null;
  const row = queryOne<SessionRow>(
    `SELECT s.id, s.expires_at, u.id AS user_id, u.username, u.display_name, u.is_admin, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
    sessionId(token),
    now(),
  );
  if (!row) return null;
  return {
    id: row.user_id,
    username: row.username,
    displayName: row.display_name,
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
  };
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  execute("DELETE FROM sessions WHERE id = ?", sessionId(token));
}

export function destroyAllSessions(userId: string) {
  execute("DELETE FROM sessions WHERE user_id = ?", userId);
}

export function requireUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = resolveSession(token);
  if (!user) throw new ApiError(401, "登录状态已失效，请重新登录。", "unauthorized");
  return user;
}

export async function getCurrentUser() {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

export function isSecureRequest(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return request.nextUrl.protocol === "https:";
}

export function setSessionCookie(response: NextResponse, token: string, secure: boolean) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function normalizeUsername(value: string) {
  return value.normalize("NFC").trim();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)) {
    throw new ApiError(400, "用户名需为 3–24 位文字、数字、下划线或短横线。", "bad_username");
  }
  return username;
}

export function validatePassword(value: string) {
  if (typeof value !== "string" || value.length < 8) {
    throw new ApiError(400, "密码至少需要 8 个字符。", "bad_password");
  }
  if (value.length > 200) {
    throw new ApiError(400, "密码太长了。", "bad_password");
  }
  return value;
}
