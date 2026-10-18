import type { NextRequest } from "next/server";
import { ApiError, assertString, handle, json, readJson, requireSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  ALLOW_REGISTRATION,
  CHUNK_SIZE,
  MAX_FILE_BYTES,
  STORAGE_DIR,
  USER_QUOTA_BYTES,
} from "@/lib/config";
import { execute, now } from "@/lib/db";
import { usageFor } from "@/lib/files";
import { maybeMaintain } from "@/lib/maintenance";
import { freeDiskBytes } from "@/lib/storage";

type Body = { displayName?: string };

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = requireUser(request);
    await maybeMaintain();
    const usage = usageFor(user.id);
    const diskFree = await freeDiskBytes();
    return json({
      user,
      ...usage,
      quota: USER_QUOTA_BYTES,
      allowRegistration: ALLOW_REGISTRATION,
      maxFileBytes: MAX_FILE_BYTES,
      chunkSize: CHUNK_SIZE,
      diskFree,
      storagePath: STORAGE_DIR,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    requireSameOrigin(request);
    const user = requireUser(request);
    const body = await readJson<Body>(request);
    const displayName = assertString(body.displayName, "昵称", 1, 32)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!displayName) throw new ApiError(400, "昵称不能为空。", "bad_display_name");
    execute("UPDATE users SET display_name = ? WHERE id = ?", displayName, user.id);
    return json({ user: { ...user, displayName } });
  });
}
