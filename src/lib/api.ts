import { NextResponse, type NextRequest } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, code = "error", details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json(
      { error: error.message, code: error.code, ...(error.details || {}) },
      { status: error.status },
    );
  }
  console.error("[milktea]", error);
  return json({ error: "服务器开了个小差，请稍后再试。", code: "internal" }, { status: 500 });
}

export function handle(fn: () => Promise<Response> | Response) {
  return Promise.resolve()
    .then(fn)
    .catch(errorResponse);
}

export async function readJson<T>(request: NextRequest): Promise<T> {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new ApiError(415, "请求格式不正确。", "unsupported_media_type");
  }
  const text = await request.text();
  if (text.length > 64 * 1024) {
    throw new ApiError(413, "请求内容过大。", "payload_too_large");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "请求内容不是有效的 JSON。", "bad_json");
  }
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (!host || new URL(origin).host !== host) {
      throw new ApiError(403, "请求来源校验失败。", "bad_origin");
    }
  } catch {
    throw new ApiError(403, "请求来源校验失败。", "bad_origin");
  }
}

export function clientIp(request: NextRequest) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
  return "local";
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    return;
  }
  if (existing.count >= limit) {
    throw new ApiError(429, "操作太频繁了，请稍后再试。", "rate_limited");
  }
  existing.count += 1;
}

export function assertString(value: unknown, label: string, min = 1, max = 200) {
  if (typeof value !== "string") throw new ApiError(400, `${label}格式不正确。`, "bad_input");
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ApiError(400, `${label}长度需要在 ${min}–${max} 个字符之间。`, "bad_input");
  }
  return trimmed;
}

export function optionalString(value: unknown, max = 500) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ApiError(400, "参数格式不正确。", "bad_input");
  return value.trim().slice(0, max);
}
