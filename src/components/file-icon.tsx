import {
  Archive,
  Braces,
  Code2,
  File,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Music2,
  Presentation,
  Table2,
} from "lucide-react";
import type { PreviewKind } from "@/lib/shared";

const MAP: Record<PreviewKind, { icon: typeof File; tone: string }> = {
  image: { icon: ImageIcon, tone: "mint" },
  video: { icon: Film, tone: "plum" },
  audio: { icon: Music2, tone: "rose" },
  pdf: { icon: FileText, tone: "tomato" },
  markdown: { icon: FileText, tone: "sky" },
  text: { icon: FileText, tone: "stone" },
  code: { icon: Code2, tone: "taro" },
  csv: { icon: Table2, tone: "matcha" },
  json: { icon: Braces, tone: "amber" },
  office: { icon: FileSpreadsheet, tone: "blue" },
  archive: { icon: Archive, tone: "caramel" },
  none: { icon: File, tone: "stone" },
};

export function FileIcon({
  kind,
  previewKind,
  size = "md",
}: {
  kind: "file" | "folder";
  previewKind?: PreviewKind;
  size?: "sm" | "md" | "lg";
}) {
  if (kind === "folder") {
    return (
      <span className={`file-icon file-icon-${size} tone-folder`} aria-hidden="true">
        <Folder size={size === "lg" ? 30 : size === "sm" ? 16 : 20} strokeWidth={1.8} />
      </span>
    );
  }
  const visual = MAP[previewKind || "none"] || MAP.none;
  const Icon = visual.icon;
  return (
    <span className={`file-icon file-icon-${size} tone-${visual.tone}`} aria-hidden="true">
      <Icon size={size === "lg" ? 30 : size === "sm" ? 16 : 20} strokeWidth={1.8} />
    </span>
  );
}

export function OfficeIcon({ type }: { type: "word" | "sheet" | "slides" }) {
  const Icon = type === "sheet" ? FileSpreadsheet : type === "slides" ? Presentation : FileText;
  return <Icon size={20} />;
}
