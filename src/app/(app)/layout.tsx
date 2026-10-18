import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";
import {
  ALLOW_REGISTRATION,
  CHUNK_SIZE,
  MAX_FILE_BYTES,
  STORAGE_DIR,
  USER_QUOTA_BYTES,
} from "@/lib/config";
import { usageFor } from "@/lib/files";
import { freeDiskBytes } from "@/lib/storage";
import type { MeDTO } from "@/lib/shared";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const usage = usageFor(user.id);
  const diskFree = await freeDiskBytes();
  const initial: MeDTO = {
    user,
    ...usage,
    quota: USER_QUOTA_BYTES,
    allowRegistration: ALLOW_REGISTRATION,
    maxFileBytes: MAX_FILE_BYTES,
    chunkSize: CHUNK_SIZE,
    diskFree,
    storagePath: STORAGE_DIR,
  };
  return <AppShell initial={initial}>{children}</AppShell>;
}
