import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { USER_QUOTA_BYTES } from "@/lib/config";
import { listDirectory, usageFor, type FileSort } from "@/lib/files";
import { maybeMaintain } from "@/lib/maintenance";

const SORTS = new Set<FileSort>([
  "name-asc",
  "name-desc",
  "updated-desc",
  "updated-asc",
  "size-desc",
  "size-asc",
]);

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    await maybeMaintain();
    const parentParam = request.nextUrl.searchParams.get("parent");
    const parentId = !parentParam || parentParam === "root" ? null : parentParam;
    const sortParam = request.nextUrl.searchParams.get("sort") as FileSort | null;
    const sort: FileSort = sortParam && SORTS.has(sortParam) ? sortParam : "name-asc";
    const listing = listDirectory(user.id, parentId, sort);
    const usage = usageFor(user.id);
    return json({
      ...listing,
      usage: usage.usage,
      fileCount: usage.fileCount,
      folderCount: usage.folderCount,
      shareCount: usage.shareCount,
      trashCount: usage.trashCount,
      quota: USER_QUOTA_BYTES,
    });
  });
}
