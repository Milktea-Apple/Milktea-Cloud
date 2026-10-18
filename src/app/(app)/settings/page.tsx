import type { Metadata } from "next";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "设置" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsView />;
}
