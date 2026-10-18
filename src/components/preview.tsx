"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Download,
  FileQuestion,
  FileText,
  Maximize2,
  Music2,
  Share2,
  X,
} from "lucide-react";
import { FileIcon } from "./file-icon";
import { Spinner } from "./ui";
import {
  extensionOf,
  fileTypeLabel,
  formatBytes,
  previewKindOf,
  TEXT_PREVIEW_BYTES,
  type FileDTO,
} from "@/lib/shared";

type PreviewSource = {
  name: string;
  size: number;
  previewKind: FileDTO["previewKind"];
  inlineUrl: string;
  downloadUrl: string;
};

function decodeText(buffer: ArrayBuffer) {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function useTextContent(url: string) {
  const [state, setState] = useState<{
    loading: boolean;
    text: string;
    truncated: boolean;
    error: string;
  }>({ loading: true, text: "", truncated: false, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, text: "", truncated: false, error: "" });
    fetch(url, {
      headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` },
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 416) {
          setState({ loading: false, text: "", truncated: false, error: "" });
          return;
        }
        if (!response.ok && response.status !== 206) {
          throw new Error(response.status === 401 ? "没有预览权限。" : "读取文件失败。");
        }
        const buffer = await response.arrayBuffer();
        const range = response.headers.get("content-range");
        const total = range ? Number(range.split("/").pop()) : buffer.byteLength;
        const text = decodeText(buffer);
        setState({
          loading: false,
          text,
          truncated: total > TEXT_PREVIEW_BYTES,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          loading: false,
          text: "",
          truncated: false,
          error: error instanceof Error ? error.message : "读取文件失败。",
        });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const maxRows = 501;
  const maxCols = 40;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      if (row.length < maxCols) row.push(field);
      field = "";
    } else if (char === "\n") {
      if (row.length < maxCols) row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length >= maxRows) return rows;
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    if (row.length < maxCols) row.push(field);
    rows.push(row);
  }
  return rows;
}

function TextPreview({ source }: { source: PreviewSource }) {
  const { loading, text, truncated, error } = useTextContent(source.inlineUrl);
  const [wrap, setWrap] = useState(true);

  if (loading) {
    return (
      <div className="preview-loading">
        <Spinner size={17} /> 正在读取文本…
      </div>
    );
  }
  if (error) {
    return <PreviewError message={error} downloadUrl={source.downloadUrl} />;
  }
  const json = source.previewKind === "json" ? tryPrettyJson(text) : null;
  const content = json ?? text;

  return (
    <div className="preview-text-wrap">
      <pre className={`preview-text ${wrap ? "" : "no-wrap"}`}>{content || "（空文件）"}</pre>
      {truncated && (
        <div className="preview-truncated">
          <FileText size={12} /> 仅显示前 2 MB，完整文件请下载
        </div>
      )}
      <div className="preview-tools">
        <span>{source.previewKind === "json" ? "格式化 JSON" : "UTF-8 文本"}</span>
        <label className="checkline">
          <input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />
          自动换行
        </label>
      </div>
    </div>
  );
}

function tryPrettyJson(text: string) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

function CsvPreview({ source }: { source: PreviewSource }) {
  const { loading, text, truncated, error } = useTextContent(source.inlineUrl);
  if (loading) {
    return (
      <div className="preview-loading">
        <Spinner size={17} /> 正在解析表格…
      </div>
    );
  }
  if (error) return <PreviewError message={error} downloadUrl={source.downloadUrl} />;
  const delimiter = extensionOf(source.name) === "tsv" ? "\t" : ",";
  const rows = parseDelimited(text, delimiter);
  const width = Math.max(0, ...rows.map((row) => row.length));
  return (
    <div className="preview-csv-wrap">
      <div className="preview-csv">
        {rows.length === 0 ? (
          <div className="preview-loading">（空表格）</div>
        ) : (
          <table>
            <thead>
              <tr>
                {Array.from({ length: width }).map((_, index) => (
                  <th key={index}>{rows[0][index] || `列 ${index + 1}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: width }).map((_, cellIndex) => (
                    <td key={cellIndex}>{row[cellIndex] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="preview-tools">
        <span>
          {Math.max(0, rows.length - 1)} 行 · {width} 列
        </span>
        {truncated && <span className="truncated-note">仅解析前 2 MB</span>}
      </div>
    </div>
  );
}

function MarkdownPreview({ source }: { source: PreviewSource }) {
  const { loading, text, truncated, error } = useTextContent(source.inlineUrl);
  if (loading) {
    return (
      <div className="preview-loading">
        <Spinner size={17} /> 正在渲染 Markdown…
      </div>
    );
  }
  if (error) return <PreviewError message={error} downloadUrl={source.downloadUrl} />;
  return (
    <div className="preview-paper">
      <div className="preview-markdown markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
            img: ({ src, alt }) => {
              const url = typeof src === "string" ? src : "";
              if (url && (url.startsWith("/") || url.startsWith("data:image/"))) {
                return <img src={url} alt={alt || ""} loading="lazy" />;
              }
              return (
                <a href={url} target="_blank" rel="noreferrer noopener">
                  {alt || "图片"}
                </a>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {truncated && (
        <div className="preview-truncated">
          <FileText size={12} /> 仅渲染前 2 MB，完整文件请下载
        </div>
      )}
    </div>
  );
}

function PreviewError({ message, downloadUrl }: { message: string; downloadUrl: string }) {
  return (
    <div className="preview-notice">
      <FileQuestion size={34} />
      <h3>没法预览这个文件</h3>
      <p>{message}</p>
      <a className="btn btn-secondary btn-sm" href={downloadUrl}>
        <Download size={14} /> 直接下载
      </a>
    </div>
  );
}

function NoPreview({ source }: { source: PreviewSource }) {
  return (
    <div className="preview-notice">
      <FileText size={34} />
      <h3>{source.previewKind === "office" ? "Office 文档暂不支持在线预览" : "这个格式暂时不能预览"}</h3>
      <p>
        {source.previewKind === "office"
          ? "浏览器没有内置的 Office 渲染能力。下载后用本地应用打开即可。"
          : "下载原文件即可查看，下载速度不受限制。"}
      </p>
      <a className="btn btn-primary btn-sm" href={source.downloadUrl}>
        <Download size={14} /> 下载文件
      </a>
    </div>
  );
}

function ImagePreview({ source }: { source: PreviewSource }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <PreviewError message="浏览器无法显示这张图片，可能是 HEIC 等特殊格式。" downloadUrl={source.downloadUrl} />;
  return (
    <img
      className="preview-image"
      src={source.inlineUrl}
      alt={source.name}
      onError={() => setFailed(true)}
    />
  );
}

export function PreviewContent({ source }: { source: PreviewSource }) {
  switch (source.previewKind) {
    case "image":
      return <ImagePreview source={source} />;
    case "video":
      return (
        <video className="preview-video" controls playsInline preload="metadata" src={source.inlineUrl}>
          你的浏览器不支持视频播放。
        </video>
      );
    case "audio":
      return (
        <div className="preview-audio-wrap">
          <div className="preview-audio-art">
            <Music2 size={44} strokeWidth={1.4} />
          </div>
          <div style={{ textAlign: "center" }}>
            <strong style={{ display: "block", fontSize: 14 }}>{source.name}</strong>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{formatBytes(source.size)}</span>
          </div>
          <audio controls preload="metadata" src={source.inlineUrl}>
            你的浏览器不支持音频播放。
          </audio>
        </div>
      );
    case "pdf":
      return (
        <div className="preview-pdf-wrap">
          <iframe className="preview-pdf" src={source.inlineUrl} title={source.name} />
          <a
            className="preview-pdf-open"
            href={source.inlineUrl}
            target="_blank"
            rel="noreferrer"
          >
            若预览空白，可新窗口打开 PDF
          </a>
        </div>
      );
    case "markdown":
      return <MarkdownPreview source={source} />;
    case "csv":
      return <CsvPreview source={source} />;
    case "text":
    case "code":
    case "json":
      return <TextPreview source={source} />;
    case "office":
    case "archive":
    case "none":
    default:
      return <NoPreview source={source} />;
  }
}

export function PreviewModal({
  file,
  inlineUrl,
  downloadUrl,
  onClose,
  onShare,
}: {
  file: FileDTO;
  inlineUrl: string;
  downloadUrl: string;
  onClose: () => void;
  onShare?: (file: FileDTO) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    shellRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="preview-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="preview-shell" role="dialog" aria-modal="true" aria-label={`预览 ${file.name}`} ref={shellRef} tabIndex={-1}>
        <header className="preview-head">
          <FileIcon kind={file.kind} previewKind={file.previewKind} />
          <div className="preview-title">
            <strong title={file.name}>{file.name}</strong>
            <span>
              {fileTypeLabel(file.name, file.kind)} · {formatBytes(file.size)} · 原速下载
            </span>
          </div>
          <div className="preview-actions">
            {onShare && file.kind === "file" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onShare(file)}>
                <Share2 size={14} /> 分享
              </button>
            )}
            <a href={downloadUrl} className="btn btn-secondary btn-sm">
              <Download size={14} /> 下载
            </a>
            <a
              href={inlineUrl}
              target="_blank"
              rel="noreferrer"
              className="icon-btn"
              aria-label="新窗口打开"
              title="新窗口打开"
            >
              <Maximize2 size={16} />
            </a>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭预览">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="preview-body">
          <PreviewContent
            source={{
              name: file.name,
              size: file.size,
              previewKind: previewKindOf(file.name, file.kind),
              inlineUrl,
              downloadUrl,
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
