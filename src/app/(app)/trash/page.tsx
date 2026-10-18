import type { Metadata } from "next";
import { TrashView } from "@/components/trash-view";

export const metadata: Metadata = { title: "回收站" };
export const dynamic = "force-dynamic";

export default function TrashPage() {
  return <TrashView />;
}
