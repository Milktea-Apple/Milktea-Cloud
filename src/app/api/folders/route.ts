import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listFolders } from "@/lib/files";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    return json({ folders: listFolders(user.id) });
  });
}
