"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  HardDrive,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  SearchX,
  Share2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api, ApiClientError, downloadHref } from "@/lib/client/api";
import { notifyFilesChanged, onFilesChanged } from "@/lib/client/events";
import {
  SORT_OPTIONS,
  formatBytes,
  formatDate,
  formatFullDate,
  type Crumb,
  type FileDTO,
} from "@/lib/shared";
import { FileIcon } from "./file-icon";
import {
  MoveDialog,
  NewFolderDialog,
  RenameDialog,
  ShareDialog,
} from "./file-dialogs";
import { PreviewModal } from "./preview";
import { useMe } from "./me-context";
import { toastError, toastInfo, toastSuccess } from "./toast";
import { ConfirmDialog, EmptyState, Spinner } from "./ui";
import { useUpload } from "./upload-provider";

type Entry = FileDTO & { location?: string };
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type Listing = {
  folder: FileDTO | null;
  breadcrumbs: Crumb[];
  entries: Entry[];
  usage?: number;
  fileCount?: number;
  folderCount?: number;
  shareCount?: number;
};

const VIEW_KEY = "milktea-view";

export function DriveBrowser({
  initialFolder,
  initialQuery,
}: {
  initialFolder: string | null;
  initialQuery: string;
}) {
  const router = useRouter();
  const { me } = useMe();
  const { pickFiles, enqueue } = useUpload();

  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortValue>("name-asc");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileDTO | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileDTO | null>(null);
  const [moveTargets, setMoveTargets] = useState<FileDTO[] | null>(null);
  const [shareTarget, setShareTarget] = useState<FileDTO | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<FileDTO[] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const dragDepth = useRef(0);

  const isSearch = Boolean(initialQuery);
  const entries = data?.entries || [];
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selected.has(entry.id)),
    [entries, selected],
  );
  const allSelected = entries.length > 0 && entries.every((entry) => selected.has(entry.id));
  const inRoot = !initialFolder && !isSearch;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        if (initialQuery) {
          const result = await api<{ entries: Entry[] }>(
            `/api/files/search?q=${encodeURIComponent(initialQuery)}`,
          );
          setData({ folder: null, breadcrumbs: [], entries: result.entries });
        } else {
          const result = await api<Listing>(
            `/api/files?parent=${encodeURIComponent(initialFolder || "root")}&sort=${sort}`,
          );
          setData(result);
        }
        setError("");
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : "读取文件列表失败。");
      } finally {
        setLoading(false);
      }
    },
    [initialFolder, initialQuery, sort],
  );

  useEffect(() => {
    setData(null);
    setSelected(new Set());
    setMenuId(null);
    void load();
  }, [initialFolder, initialQuery, sort, load]);

  useEffect(() => onFilesChanged(() => void load(true)), [load]);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".menu-anchor")) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  const title = isSearch
    ? `搜索 “${initialQuery}”`
    : data?.folder?.name || (initialFolder ? "正在打开…" : "我的网盘");
  const usage = data?.usage ?? me.usage;

  function changeView(next: "list" | "grid") {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage is optional.
    }
  }

  function goFolder(id: string | null) {
    router.push(id ? `/drive?folder=${encodeURIComponent(id)}` : "/drive");
  }

  function openEntry(entry: Entry) {
    if (entry.kind === "folder") goFolder(entry.id);
    else setPreview(entry);
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((entry) => entry.id)));
  }

  function onDragEnter(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent) {
    if (!event.dataTransfer.types.includes("Files")) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (isSearch) {
      toastInfo("搜索结果里不能上传，先清除搜索吧。");
      return;
    }
    if (event.dataTransfer.files?.length) {
      enqueue(event.dataTransfer.files, initialFolder);
    }
  }

  function beginUpload() {
    if (isSearch) {
      toastInfo("搜索模式下不能上传，先清除搜索吧。");
      return;
    }
    pickFiles(initialFolder);
  }

  function afterMutation() {
    notifyFilesChanged();
  }

  async function confirmDelete() {
    if (!deleteTargets || deleteBusy) return;
    setDeleteBusy(true);
    let failed = 0;
    try {
      for (const file of deleteTargets) {
        try {
          await api(`/api/files/${file.id}`, { method: "DELETE" });
        } catch {
          failed += 1;
        }
      }
      if (failed === 0) {
        toastSuccess(
          deleteTargets.length === 1
            ? `「${deleteTargets[0].name}」已移到回收站`
            : `${deleteTargets.length} 个项目已移到回收站`,
        );
      } else {
        toastError(`有 ${failed} 个项目没能删除，请刷新后重试。`);
      }
      setDeleteTargets(null);
      setSelected(new Set());
      afterMutation();
    } finally {
      setDeleteBusy(false);
    }
  }

  function renderMenu(entry: Entry, mobile = false) {
    return (
      <div className="menu" role="menu">
        {entry.kind === "file" && (
          <>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuId(null);
                setPreview(entry);
              }}
            >
              <Eye size={14} /> 预览
            </button>
            <a
              className="menu-item"
              href={downloadHref(entry.id)}
              onClick={() => setMenuId(null)}
            >
              <Download size={14} /> 下载
            </a>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuId(null);
                setShareTarget(entry);
              }}
            >
              <Share2 size={14} /> 分享
            </button>
            <div className="menu-sep" />
          </>
        )}
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setMenuId(null);
            setRenameTarget(entry);
          }}
        >
          <Pencil size={14} /> 重命名
        </button>
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setMenuId(null);
            setMoveTargets([entry]);
          }}
        >
          <FolderInput size={14} /> 移动到…
        </button>
        <div className="menu-sep" />
        <button
          type="button"
          className="menu-item danger"
          onClick={() => {
            setMenuId(null);
            setDeleteTargets([entry]);
          }}
        >
          <Trash2 size={14} /> 删除
        </button>
        {mobile && <span className="sr-only">更多操作</span>}
      </div>
    );
  }

  function actionButtons(entry: Entry) {
    return (
      <div className="file-actions" onClick={(event) => event.stopPropagation()}>
        {entry.kind === "file" && (
          <>
            <a
              href={downloadHref(entry.id)}
              className="icon-btn tiny download-quick"
              aria-label={`下载 ${entry.name}`}
              title="下载"
            >
              <Download size={15} />
            </a>
            <button
              type="button"
              className="icon-btn tiny share-quick"
              onClick={() => setShareTarget(entry)}
              aria-label={`分享 ${entry.name}`}
              title="分享"
            >
              <Share2 size={15} />
            </button>
          </>
        )}
        <span className="menu-anchor">
          <button
            type="button"
            className="icon-btn tiny"
            aria-label={`更多操作 ${entry.name}`}
            aria-expanded={menuId === entry.id}
            onClick={() => setMenuId((current) => (current === entry.id ? null : entry.id))}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuId === entry.id && renderMenu(entry)}
        </span>
      </div>
    );
  }

  function renderEntry(entry: Entry) {
    return (
      <div
        key={entry.id}
        className={`file-row ${selected.has(entry.id) ? "is-selected" : ""}`}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input, .menu-anchor")) return;
          openEntry(entry);
        }}
      >
        <span className="check-wrap">
          <input
            type="checkbox"
            checked={selected.has(entry.id)}
            onChange={() => toggleSelected(entry.id)}
            aria-label={`选择 ${entry.name}`}
          />
        </span>
        <div className="file-name-cell">
          <FileIcon kind={entry.kind} previewKind={entry.previewKind} />
          <button type="button" className="file-name-btn" onClick={() => openEntry(entry)} title={entry.name}>
            <span className="file-name">{entry.name}</span>
            {isSearch ? (
              <span className="file-sub file-search-loc">{entry.location}</span>
            ) : (
              <span className="file-sub">
                {entry.kind === "folder" ? "文件夹" : formatBytes(entry.size)} · {formatDate(entry.updatedAt)}
              </span>
            )}
          </button>
        </div>
        <span className="file-meta">{entry.kind === "folder" ? "—" : formatBytes(entry.size)}</span>
        <span className="file-meta" title={formatFullDate(entry.updatedAt)}>
          {formatDate(entry.updatedAt)}
        </span>
        {actionButtons(entry)}
      </div>
    );
  }

  function renderCard(entry: Entry) {
    const showThumb = entry.kind === "file" && entry.previewKind === "image";
    return (
      <div
        key={entry.id}
        className={`file-card ${selected.has(entry.id) ? "is-selected" : ""} ${showThumb ? "has-thumb" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => openEntry(entry)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEntry(entry);
          }
        }}
      >
        <div className="file-card-top">
          {showThumb ? (
            <div className="file-card-thumb">
              <img src={downloadHref(entry.id, true)} alt="" loading="lazy" />
            </div>
          ) : (
            <FileIcon kind={entry.kind} previewKind={entry.previewKind} size="lg" />
          )}
          <span className="file-card-check" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected.has(entry.id)}
              onChange={() => toggleSelected(entry.id)}
              aria-label={`选择 ${entry.name}`}
              style={{ width: 14, height: 14, accentColor: "var(--accent)" }}
            />
          </span>
        </div>
        <span className="file-card-name">{entry.name}</span>
        <div className="file-card-meta">
          <span>{entry.kind === "folder" ? "文件夹" : formatBytes(entry.size)}</span>
          <span>{formatDate(entry.updatedAt)}</span>
        </div>
        <div className="file-card-actions" onClick={(event) => event.stopPropagation()}>
          {entry.kind === "file" && (
            <a
              href={downloadHref(entry.id)}
              className="icon-btn tiny"
              aria-label={`下载 ${entry.name}`}
              title="下载"
            >
              <Download size={14} />
            </a>
          )}
          <span className="menu-anchor">
            <button
              type="button"
              className="icon-btn tiny"
              aria-label={`更多操作 ${entry.name}`}
              aria-expanded={menuId === entry.id}
              onClick={() => setMenuId((current) => (current === entry.id ? null : entry.id))}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuId === entry.id && renderMenu(entry, true)}
          </span>
        </div>
      </div>
    );
  }

  const breadcrumbs = data?.breadcrumbs || [{ id: null, name: "全部文件" }];

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <p className="eyebrow">My Drive</p>
          <h1 title={title}>{title}</h1>
          <p>
            {isSearch ? (
              <>在全部文件中按名称搜索，共找到 <strong>{entries.length}</strong> 个结果。</>
            ) : (
              <>
                <strong>{entries.length}</strong> 个项目 · 已用 <strong>{formatBytes(usage)}</strong> · 所有内容保存在本机
              </>
            )}
          </p>
          <div className="stat-strip">
            <span className="stat-chip">
              <HardDrive size={12} /> 本机剩余 <strong>{formatBytes(me.diskFree)}</strong>
            </span>
            <span className="stat-chip">
              <FolderOpen size={12} /> 文件 <strong>{me.fileCount}</strong>
            </span>
            <span className="stat-chip">
              <Link2 size={12} /> 分享 <strong>{me.shareCount}</strong>
            </span>
          </div>
        </div>
        <div className="page-actions">
          {isSearch ? (
            <button type="button" className="btn btn-secondary" onClick={() => router.push("/drive")}>
              清除搜索
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus size={16} /> 新建文件夹
              </button>
              <button type="button" className="btn btn-primary" onClick={beginUpload}>
                <UploadCloud size={16} /> 上传文件
              </button>
            </>
          )}
        </div>
      </div>

      <section
        className="drive-card"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label="文件列表"
      >
        <div className="drive-toolbar">
          {isSearch ? (
            <div className="breadcrumbs">
              <span className="crumb current">
                <SearchX size={13} /> 搜索结果
              </span>
            </div>
          ) : (
            <nav className="breadcrumbs" aria-label="文件夹路径">
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={`${crumb.id || "root"}-${index}`}>
                  {index > 0 && <ChevronRight size={13} className="crumb-sep" />}
                  <button
                    type="button"
                    className={`crumb ${index === breadcrumbs.length - 1 ? "current" : ""}`}
                    onClick={() => goFolder(crumb.id)}
                    title={crumb.name}
                  >
                    {crumb.name}
                  </button>
                </Fragment>
              ))}
            </nav>
          )}
          <div className="toolbar-right">
            <div className="sort-wrap">
              <ArrowUpDown size={13} />
              <select
                className="sort-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
                aria-label="排序方式"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="view-toggle" role="group" aria-label="视图">
              <button
                type="button"
                className={view === "list" ? "is-active" : ""}
                onClick={() => changeView("list")}
                aria-label="列表视图"
                title="列表视图"
              >
                <List size={15} />
              </button>
              <button
                type="button"
                className={view === "grid" ? "is-active" : ""}
                onClick={() => changeView("grid")}
                aria-label="网格视图"
                title="网格视图"
              >
                <Grid2X2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {dragging && (
          <div className="drop-overlay">
            <div className="drop-inner">
              <span className="drop-icon">
                <UploadCloud size={28} />
              </span>
              <strong>松手，就开始上传</strong>
              <span>文件会上传到「{data?.folder?.name || "全部文件"}」</span>
            </div>
          </div>
        )}

        {error ? (
          <EmptyState
            icon={CircleAlert}
            title="没能打开这个位置"
            description={error}
            action={
              <>
                <button type="button" className="btn btn-primary btn-compact" onClick={() => void load()}>
                  {loading && <Spinner />} 重试
                </button>
                <button type="button" className="btn btn-ghost btn-compact" onClick={() => goFolder(null)}>
                  回到全部文件
                </button>
              </>
            }
          />
        ) : loading && !data ? (
          <div className="loading-rows" aria-label="正在加载">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div className="loading-row" key={index}>
                <span className="skeleton sk-icon" />
                <span className="skeleton sk-name" style={{ width: `${38 + ((index * 13) % 32)}%` }} />
                <span className="skeleton sk-meta" />
                <span className="skeleton sk-meta" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          isSearch ? (
            <EmptyState
              icon={SearchX}
              title="没有找到匹配的文件"
              description={`没有名称包含「${initialQuery}」的文件。换个关键词，或者回到网盘继续浏览。`}
              action={
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => router.push("/drive")}>
                  返回全部文件
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title={inRoot ? "这里还空着" : "这个文件夹是空的"}
              description={
                isSearch
                  ? "换个关键词试试。"
                  : "把文件拖进这个窗口，或者点击上传按钮。每个文件都只属于你，别人看不到。"
              }
              action={
                <>
                  <button type="button" className="btn btn-primary" onClick={beginUpload}>
                    <UploadCloud size={16} /> 上传文件
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setNewFolderOpen(true)}>
                    <FolderPlus size={16} /> 新建文件夹
                  </button>
                </>
              }
            >
              <div className="empty-tip">
                <HardDrive size={12} /> 文件会直接保存到这台电脑的磁盘上
              </div>
            </EmptyState>
          )
        ) : view === "list" ? (
          <div className="file-table">
            <div className="file-table-head">
              <span className="check-wrap">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="全选"
                />
              </span>
              <span>名称</span>
              <span>大小</span>
              <span>修改时间</span>
              <span />
            </div>
            {entries.map(renderEntry)}
          </div>
        ) : (
          <div className="file-grid">{entries.map(renderCard)}</div>
        )}

        <div className="drive-foot">
          <span>
            <HardDrive size={12} /> 所有文件均保存在本机磁盘
          </span>
          <span className="drive-foot-sep" />
          <span>下载不限速 · 支持断点续传</span>
          <span className="drive-foot-right">
            <Check size={12} /> 仅你可见
          </span>
        </div>
      </section>

      {selectedEntries.length > 0 && (
        <div className="selection-bar" role="region" aria-label="批量操作">
          <strong>已选 {selectedEntries.length} 项</strong>
          <button
            type="button"
            className="btn btn-compact"
            onClick={() => setMoveTargets(selectedEntries)}
          >
            <FolderInput size={14} /> 移动到
          </button>
          <button
            type="button"
            className="btn btn-danger-soft btn-compact"
            onClick={() => setDeleteTargets(selectedEntries)}
          >
            <Trash2 size={14} /> 删除
          </button>
          <button type="button" className="icon-btn" onClick={() => setSelected(new Set())} aria-label="取消选择">
            ×
          </button>
        </div>
      )}

      {preview && (
        <PreviewModal
          file={preview}
          inlineUrl={downloadHref(preview.id, true)}
          downloadUrl={downloadHref(preview.id)}
          onClose={() => setPreview(null)}
          onShare={(file) => {
            setPreview(null);
            setShareTarget(file);
          }}
        />
      )}

      <NewFolderDialog
        open={newFolderOpen}
        parentId={initialFolder}
        onClose={() => setNewFolderOpen(false)}
        onCreated={() => afterMutation()}
      />

      <RenameDialog
        open={Boolean(renameTarget)}
        file={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => afterMutation()}
      />

      <MoveDialog
        open={Boolean(moveTargets)}
        files={moveTargets || []}
        onClose={() => setMoveTargets(null)}
        onMoved={() => {
          setSelected(new Set());
          afterMutation();
        }}
      />

      <ShareDialog
        open={Boolean(shareTarget)}
        file={shareTarget}
        onClose={() => setShareTarget(null)}
        onCreated={() => afterMutation()}
      />

      <ConfirmDialog
        open={Boolean(deleteTargets)}
        title={deleteTargets && deleteTargets.length > 1 ? `删除 ${deleteTargets.length} 个项目？` : "移到回收站？"}
        description={
          deleteTargets ? (
            <>
              确定要删除{" "}
              <strong>
                {deleteTargets.length === 1
                  ? `「${deleteTargets[0].name}」`
                  : `这 ${deleteTargets.length} 个项目`}
              </strong>{" "}
              吗？它们会进入回收站，30 天内可以恢复。
            </>
          ) : null
        }
        confirmLabel="移到回收站"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTargets(null)}
      />
    </>
  );
}
