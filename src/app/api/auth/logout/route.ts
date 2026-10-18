import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { SESSION_COOKIE, clearSessionCookie, destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    destroySession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = json({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
