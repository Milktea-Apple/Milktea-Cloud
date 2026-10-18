import type { NextRequest } from "next/server";
import { handle, json, requireSameOrigin } from "@/lib/api";
import { clearSessionCookie, destroyAllSessions, requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    destroyAllSessions(user.id);
    const response = json({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
