"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Lock,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api, ApiClientError, copyText, shareUrl } from "@/lib/client/api";
import { onFilesChanged } from "@/lib/client/events";
import {
  formatBytes,
  formatDate,
  formatExpiry,
  type ShareDTO,
} from "@/lib/shared";
import { FileIcon } from "./file-icon";
import { useMe } from "./me-context";
import { toastError, toastInfo, toastSuccess } from "./toast";
import { ConfirmDialog, EmptyState } from "./ui";

type ShareItem = ShareDTO & {
  fileAvailable: boolean;
  expired: boolean;
  lastDownloadAt: number | null;
};

export function SharesView() {
  const { me } = useMe();
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ShareItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ shares: ShareItem[] }>("/api/shares");
      setShares(result.shares);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "读取分享列表失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return onFilesChanged(() => void load());
  }, [load]);

  const active = shares.filter((share) => !share.expired && share.fileAvailable).length;
  const paused = shares.length - active;

  async function copy(share: ShareItem) {
    const ok = await copyText(shareUrl(share.token));
    if (!ok) {
      toastError("复制失败，请手动复制地址。");
      return;
    }
    setCopied(share.id);
    toastInfo("分享链接已复制");
    window.setTimeout(() => setCopied(""), 1600);
  }

  async function revoke() {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    try {
      await api(`/api/shares/${revokeTarget.id}`, { method: "DELETE" });
      toastSuccess("分享链接已取消");
      setRevokeTarget(null);
      await load();
    } catch (caught) {
      toastError(caught instanceof ApiClientError ? caught.message : "取消分享失败。");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <p className="eyebrow">Shared links</p>
          <h1>分享链接</h1>
          <p>
            已经创建 <strong>{shares.length}</strong> 条链接 · 其中 <strong>{active}</strong> 条有效
            {paused > 0 ? ` · ${paused} 条已失效` : ""}
          </p>
          <div className="stat-strip">
            <span className="stat-chip">
              <ShieldCheck size={12} /> 链接只指向单个文件
            </span>
            <span className="stat-chip">
              <Lock size={12} /> 可设置提取码
            </span>
            <span className="stat-chip">
              <Clock size={12} /> 可设置有效期
            </span>
          </div>
        </div>
        <div className="page-actions">
          <Link href="/drive" className="btn btn-secondary">
            <Link2 size={16} /> 去网盘里分享
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading-rows" style={{ border: "1px solid var(--line)", borderRadius: 20, background: "var(--surface)" }}>
          {[0, 1, 2].map((index) => (
            <div className="loading-row" key={index} style={{ padding: "0 16px" }}>
              <span className="skeleton sk-icon" style={{ width: 48, height: 48, borderRadius: 14 }} />
              <span className="skeleton sk-name" style={{ width: `${40 + index * 12}%` }} />
              <span className="skeleton sk-meta" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Link2}
          title="没能读取分享列表"
          description={error}
          action={
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              重试
            </button>
          }
        />
      ) : shares.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="还没有分享链接"
          description={`在网盘里找到想分享的文件，点「分享」就能生成一条公开链接。当前空间里有 ${me.fileCount} 个文件。`}
          action={
            <Link href="/drive" className="btn btn-primary">
              <Link2 size={16} /> 去网盘看看
            </Link>
          }
        />
      ) : (
        <div className="share-card-list">
          {shares.map((share) => {
            const invalid = share.expired || !share.fileAvailable;
            return (
              <article className={`share-card ${invalid ? "is-invalid" : ""}`} key={share.id}>
                <FileIcon kind="file" previewKind={share.previewKind} size="lg" />
                <div className="share-card-main">
                  <div className="share-card-name">
                    <span title={share.fileName}>{share.fileName}</span>
                    {share.hasPassword && (
                      <span className="badge badge-lock">
                        <Lock size={9} /> 提取码
                      </span>
                    )}
                    {!share.fileAvailable ? (
                      <span className="badge badge-danger">文件已删除</span>
                    ) : share.expired ? (
                      <span className="badge badge-danger">已过期</span>
                    ) : (
                      <span className="badge badge-ok">有效</span>
                    )}
                  </div>
                  <div className="share-card-sub">
                    <span>{formatBytes(share.fileSize)}</span>
                    <span className="dot" />
                    <span>创建于 {formatDate(share.createdAt)}</span>
                    <span className="dot" />
                    <span>{share.downloads} 次下载</span>
                    <span className="dot" />
                    <span>{formatExpiry(share.expiresAt)}</span>
                    <span className="dot" />
                    <span className="share-token">/s/{share.token}</span>
                  </div>
                </div>
                <div className="share-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copy(share)}
                    disabled={invalid}
                  >
                    {copied === share.id ? <ShieldCheck size={14} /> : <Copy size={14} />}
                    {copied === share.id ? "已复制" : "复制链接"}
                  </button>
                  <Link
                    href={`/s/${share.token}`}
                    target="_blank"
                    className="icon-btn"
                    aria-label="打开分享页"
                    title="打开分享页"
                  >
                    <ExternalLink size={15} />
                  </Link>
                  <button
                    type="button"
                    className="icon-btn share-revoke"
                    aria-label="取消分享"
                    title="取消分享"
                    onClick={() => setRevokeTarget(share)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="取消这条分享？"
        description={
          revokeTarget ? (
            <>
              取消后，<strong>「{revokeTarget.fileName}」</strong> 的公开链接会立即失效。
              文件本身仍会保留在你的网盘里。
            </>
          ) : null
        }
        confirmLabel="取消分享"
        cancelLabel="保留"
        busy={revoking}
        onConfirm={revoke}
        onClose={() => setRevokeTarget(null)}
      />
    </>
  );
}
