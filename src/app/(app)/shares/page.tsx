import type { Metadata } from "next";
import { SharesView } from "@/components/shares-view";

export const metadata: Metadata = { title: "分享链接" };
export const dynamic = "force-dynamic";

export default function SharesPage() {
  return <SharesView />;
}
