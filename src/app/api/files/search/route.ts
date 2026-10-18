import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { searchFiles } from "@/lib/files";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    const query = request.nextUrl.searchParams.get("q") || "";
    return json({ entries: searchFiles(user.id, query), query });
  });
}
