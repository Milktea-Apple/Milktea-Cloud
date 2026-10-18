import type { Metadata } from "next";
import { PublicShareView } from "@/components/public-share-view";

export const metadata: Metadata = {
  title: "分享的文件",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicShareView token={token} />;
}
