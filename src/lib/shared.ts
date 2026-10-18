export type PreviewKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "markdown"
  | "text"
  | "code"
  | "csv"
  | "json"
  | "office"
  | "archive"
  | "none";

export type FileDTO = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "file" | "folder";
  size: number;
  mime: string;
  previewKind: PreviewKind;
  ext: string;
  createdAt: number;
  updatedAt: number;
};

export type Crumb = { id: string | null; name: string };

export type UserDTO = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: number;
};

export type MeDTO = {
  user: UserDTO;
  usage: number;
  quota: number;
  fileCount: number;
  folderCount: number;
  shareCount: number;
  trashCount: number;
  allowRegistration: boolean;
  maxFileBytes: number;
  chunkSize: number;
  diskFree: number;
  storagePath: string;
};

export type ShareDTO = {
  id: string;
  token: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  previewKind: PreviewKind;
  hasPassword: boolean;
  expiresAt: number | null;
  downloads: number;
  createdAt: number;
};

const IMAGE_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "avif",
  "svg",
  "heic",
  "heif",
]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "mkv", "ogv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"]);
const MARKDOWN_EXT = new Set(["md", "markdown", "mdx"]);
const CSV_EXT = new Set(["csv", "tsv"]);
const JSON_EXT = new Set(["json", "jsonc", "geojson"]);
const OFFICE_EXT = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"]);
const CODE_EXT = new Set([
  "js",
  "mjs",
  "cjs",
  "jsx",
  "ts",
  "tsx",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "php",
  "rb",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "bat",
  "sql",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "vue",
  "svelte",
  "lua",
  "r",
  "dart",
]);
const TEXT_EXT = new Set([
  "txt",
  "log",
  "srt",
  "vtt",
  "text",
  "env",
  "gitignore",
  "dockerfile",
  "makefile",
  "license",
  "readme",
]);

export const TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

export function extensionOf(name: string) {
  const base = name.split(/[\\/]/).pop() || name;
  if (!base.includes(".")) return "";
  return base.split(".").pop()!.toLowerCase();
}

export function previewKindOf(name: string, kind: "file" | "folder" = "file"): PreviewKind {
  if (kind === "folder") return "none";
  const ext = extensionOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (CSV_EXT.has(ext)) return "csv";
  if (JSON_EXT.has(ext)) return "json";
  if (OFFICE_EXT.has(ext)) return "office";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  if (CODE_EXT.has(ext)) return "code";
  if (TEXT_EXT.has(ext)) return "text";
  return "none";
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  mdx: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  log: "text/plain; charset=utf-8",
  srt: "text/plain; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  json: "application/json; charset=utf-8",
  jsonc: "application/json; charset=utf-8",
  geojson: "application/geo+json; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  py: "text/x-python; charset=utf-8",
  go: "text/plain; charset=utf-8",
  rs: "text/plain; charset=utf-8",
  java: "text/plain; charset=utf-8",
  kt: "text/plain; charset=utf-8",
  swift: "text/plain; charset=utf-8",
  c: "text/plain; charset=utf-8",
  h: "text/plain; charset=utf-8",
  cpp: "text/plain; charset=utf-8",
  hpp: "text/plain; charset=utf-8",
  cs: "text/plain; charset=utf-8",
  php: "text/plain; charset=utf-8",
  rb: "text/plain; charset=utf-8",
  sh: "text/x-shellscript; charset=utf-8",
  bash: "text/x-shellscript; charset=utf-8",
  zsh: "text/x-shellscript; charset=utf-8",
  ps1: "text/plain; charset=utf-8",
  sql: "text/plain; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  toml: "text/plain; charset=utf-8",
  ini: "text/plain; charset=utf-8",
  conf: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  scss: "text/x-scss; charset=utf-8",
  less: "text/x-less; charset=utf-8",
  vue: "text/plain; charset=utf-8",
  svelte: "text/plain; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  tgz: "application/gzip",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  epub: "application/epub+zip",
};

export function mimeForName(name: string, fallback = "application/octet-stream") {
  return MIME_BY_EXT[extensionOf(name)] || fallback;
}

export function textPreviewAllowed(name: string) {
  const kind = previewKindOf(name);
  return kind === "text" || kind === "code" || kind === "markdown" || kind === "csv" || kind === "json";
}

export function formatBytes(bytes: number, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : decimals;
  return `${value.toFixed(digits).replace(/\.0+$/, "")} ${units[index]}`;
}

export function formatSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDate(ts: number) {
  const date = new Date(ts);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (dayDiff === 0) return `今天 ${time}`;
  if (dayDiff === 1) return `昨天 ${time}`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatFullDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function formatExpiry(ts: number | null) {
  if (!ts) return "永久有效";
  const remaining = ts - Date.now();
  if (remaining <= 0) return "已过期";
  const days = Math.ceil(remaining / 86400000);
  return `${days} 天后过期`;
}

export function fileTypeLabel(name: string, kind: "file" | "folder") {
  if (kind === "folder") return "文件夹";
  const ext = extensionOf(name);
  return ext ? ext.toUpperCase() : "文件";
}

export function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "M";
  const chars = Array.from(trimmed);
  return chars.slice(0, 2).join("").toUpperCase();
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const SORT_OPTIONS = [
  { value: "name-asc", label: "名称 A → Z" },
  { value: "name-desc", label: "名称 Z → A" },
  { value: "updated-desc", label: "最近修改" },
  { value: "updated-asc", label: "最早修改" },
  { value: "size-desc", label: "从大到小" },
  { value: "size-asc", label: "从小到大" },
] as const;
