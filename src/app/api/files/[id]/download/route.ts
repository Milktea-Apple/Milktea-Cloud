import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { buildFileResponse } from "@/lib/download";
import { getFileRow } from "@/lib/files";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = requireUser(request);
    const { id } = await context.params;
    const row = getFileRow(user.id, id);
    return buildFileResponse(request, row, {
      inline: request.nextUrl.searchParams.get("inline") === "1",
    });
  });
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = requireUser(request);
    const { id } = await context.params;
    const row = getFileRow(user.id, id);
    return buildFileResponse(request, row, {
      inline: request.nextUrl.searchParams.get("inline") === "1",
    });
  });
}
