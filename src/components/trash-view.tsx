"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Info, RotateCcw, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { notifyFilesChanged } from "@/lib/client/events";
import { formatBytes, formatDate, type FileDTO } from "@/lib/shared";
import { FileIcon } from "./file-icon";
import { toastError, toastSuccess } from "./toast";
import { ConfirmDialog, EmptyState, Spinner } from "./ui";

type TrashItem = FileDTO & {
  deletedAt: number;
  location: string;
  itemCount: number;
};

export function TrashView() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ entries: TrashItem[] }>("/api/trash");
      setItems(result.entries);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "读取回收站失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(item: TrashItem) {
    setBusyId(item.id);
    try {
      await api(`/api/trash/${item.id}`, { method: "POST" });
      toastSuccess(`「${item.name}」已恢复到原来的位置`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      notifyFilesChanged();
    } catch (caught) {
      toastError(caught instanceof ApiClientError ? caught.message : "恢复失败。");
    } finally {
      setBusyId("");
    }
  }

  async function purge() {
    if (!purgeTarget || purging) return;
    setPurging(true);
    try {
      await api(`/api/trash/${purgeTarget.id}`, { method: "DELETE" });
      toastSuccess(`「${purgeTarget.name}」已彻底删除`);
      setPurgeTarget(null);
      setItems((current) => current.filter((entry) => entry.id !== purgeTarget.id));
      notifyFilesChanged();
    } catch (caught) {
      toastError(caught instanceof ApiClientError ? caught.message : "删除失败。");
    } finally {
      setPurging(false);
    }
  }

  async function empty() {
    if (purging) return;
    setPurging(true);
    try {
      const result = await api<{ count: number }>("/api/trash", { method: "DELETE" });
      toastSuccess(result.count > 0 ? "回收站已清空" : "回收站本来就是空的");
      setEmptyOpen(false);
      setItems([]);
      notifyFilesChanged();
    } catch (caught) {
      toastError(caught instanceof ApiClientError ? caught.message : "清空失败。");
    } finally {
      setPurging(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <p className="eyebrow">Recently deleted</p>
          <h1>回收站</h1>
          <p>
            删除的文件会在这里保留 30 天，之后自动清理。回收站里有 <strong>{items.length}</strong> 个项目。
          </p>
        </div>
        <div className="page-actions">
          {items.length > 0 && (
            <button type="button" className="btn btn-danger-soft" onClick={() => setEmptyOpen(true)}>
              <Trash2 size={16} /> 清空回收站
            </button>
          )}
        </div>
      </div>

      {!loading && items.length > 0 && (
        <div className="trash-note">
          <Info size={14} />
          恢复的文件会回到原来的文件夹；如果原文件夹已经不在，会回到「全部文件」。
        </div>
      )}

      {loading ? (
        <div className="trash-list">
          {[0, 1, 2].map((index) => (
            <div className="trash-row" key={index}>
              <span className="skeleton sk-icon" style={{ width: 42, height: 42 }} />
              <div className="trash-main">
                <span className="skeleton sk-name" style={{ width: `${36 + index * 10}%`, height: 12 }} />
                <span className="skeleton" style={{ width: "30%", height: 8, marginTop: 8 }} />
              </div>
              <span className="skeleton" style={{ width: 70, height: 28, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Trash2}
          title="没能打开回收站"
          description={error}
          action={
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              重试
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="回收站是空的"
          description="被删除的文件会先来到这里，30 天内都可以恢复。删除之前不用太紧张。"
          action={
            <Link href="/drive" className="btn btn-secondary">
              回到我的网盘
            </Link>
          }
        />
      ) : (
        <div className="trash-list">
          {items.map((item) => (
            <div className="trash-row" key={item.id}>
              <FileIcon kind={item.kind} previewKind={item.previewKind} size="lg" />
              <div className="trash-main">
                <span className="trash-name" title={item.name}>
                  {item.name}
                </span>
                <div className="trash-meta">
                  <span>{item.kind === "folder" ? `${item.itemCount} 个文件` : formatBytes(item.size)}</span>
                  <span className="dot" />
                  <span>{item.location}</span>
                  <span className="dot" />
                  <span>删除于 {formatDate(item.deletedAt)}</span>
                </div>
              </div>
              <div className="trash-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => restore(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? <Spinner size={14} /> : <RotateCcw size={14} />}
                  恢复
                </button>
                <button
                  type="button"
                  className="btn btn-danger-soft btn-sm"
                  onClick={() => setPurgeTarget(item)}
                >
                  彻底删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title="彻底删除这个文件？"
        description={
          purgeTarget ? (
            <>
              这会永久删除 <strong>「{purgeTarget.name}」</strong> 及其中的全部内容，
              无法恢复，也会释放 {formatBytes(purgeTarget.size)} 空间。
            </>
          ) : null
        }
        confirmLabel="永久删除"
        busy={purging}
        onConfirm={purge}
        onClose={() => setPurgeTarget(null)}
      />

      <ConfirmDialog
        open={emptyOpen}
        title="清空回收站？"
        description={
          <>
            回收站里的 <strong>{items.length} 个项目</strong> 会被永久删除，无法恢复。
            分享链接也会一起失效。
          </>
        }
        confirmLabel="全部删除"
        busy={purging}
        onConfirm={empty}
        onClose={() => setEmptyOpen(false)}
      />
    </>
  );
}
