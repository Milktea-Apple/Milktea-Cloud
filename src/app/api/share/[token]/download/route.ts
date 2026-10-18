import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { buildFileResponse } from "@/lib/download";
import {
  findShareByToken,
  getShareFile,
  recordShareDownload,
  requireShareAccess,
} from "@/lib/shares";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const row = findShareByToken(token);
    if (!row) return new Response("Not found", { status: 404 });
    requireShareAccess(request, row);
    const file = getShareFile(row);
    const inline = request.nextUrl.searchParams.get("inline") === "1";
    const response = buildFileResponse(request, file, { inline });
    if (!inline && !request.headers.get("range") && response.status < 400) {
      recordShareDownload(row.id);
    }
    return response;
  });
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const row = findShareByToken(token);
    if (!row) return new Response("Not found", { status: 404 });
    requireShareAccess(request, row);
    return buildFileResponse(request, getShareFile(row), { inline: false });
  });
}
