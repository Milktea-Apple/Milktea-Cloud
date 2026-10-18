import type { Metadata } from "next";
import { DriveBrowser } from "@/components/drive-browser";

export const metadata: Metadata = { title: "我的网盘" };
export const dynamic = "force-dynamic";

type Params = { folder?: string; q?: string };

export default async function DrivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const folder = typeof params.folder === "string" && params.folder ? params.folder : null;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  return <DriveBrowser initialFolder={folder} initialQuery={query} />;
}
