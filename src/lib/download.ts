import { createReadStream, existsSync } from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { ApiError } from "./api";
import { blobPath, contentDisposition, parseRange } from "./storage";
import { extensionOf, mimeForName, previewKindOf } from "./shared";
import type { FileRow } from "./files";

const RISKY_EXTENSIONS = new Set(["html", "htm", "xhtml", "svg", "xml", "xsl"]);

export function canPreviewInline(row: FileRow) {
  if (row.kind !== "file") return false;
  const kind = previewKindOf(row.name, row.kind);
  return kind !== "none" && kind !== "office" && kind !== "archive";
}

export function buildFileResponse(
  request: NextRequest,
  row: FileRow,
  options: { inline: boolean },
) {
  if (!row.storage_key) throw new ApiError(404, "文件内容不存在。", "blob_missing");
  const filePath = blobPath(row.storage_key);
  if (!existsSync(filePath)) throw new ApiError(404, "文件内容不在磁盘上。", "blob_missing");

  const ext = extensionOf(row.name);
  const risky = RISKY_EXTENSIONS.has(ext);
  const wantsInline = options.inline && canPreviewInline(row) && !risky;
  const disposition = wantsInline ? "inline" : "attachment";
  const size = Number(row.size);
  const etag = `"${row.storage_key}-${size}"`;
  const contentType = mimeForName(row.name, row.mime || "application/octet-stream");

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition(disposition, row.name),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ETag: etag,
    "Last-Modified": new Date(Number(row.updated_at)).toUTCString(),
  });
  if (risky) headers.set("Content-Security-Policy", "sandbox; default-src 'none'");

  if (!options.inline && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    if (request.method === "HEAD") return new Response(null, { status: 206, headers });
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(size));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  if (size === 0) return new Response(null, { status: 200, headers });
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers,
  });
}
