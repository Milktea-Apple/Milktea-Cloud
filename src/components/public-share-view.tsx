"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Clock,
  Copy,
  Download,
  FileQuestion,
  KeyRound,
  Link2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { api, ApiClientError, copyText, shareDownloadHref } from "@/lib/client/api";
import { formatBytes, formatExpiry, formatFullDate, type PreviewKind } from "@/lib/shared";
import { Brand } from "./brand";
import { FileIcon } from "./file-icon";
import { PreviewContent } from "./preview";
import { ThemeToggle } from "./theme-toggle";
import { toastError, toastInfo } from "./toast";
import { Spinner } from "./ui";

type PublicMeta = {
  token: string;
  status: "active" | "expired" | "missing";
  name: string;
  size: number;
  mime: string;
  previewKind: PreviewKind;
  owner: string;
  createdAt: number;
  expiresAt: number | null;
  downloads: number;
  requiresPassword: boolean;
  unlocked: boolean;
  canPreview: boolean;
};

export function PublicShareView({ token }: { token: string }) {
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<PublicMeta>(`/api/share/${encodeURIComponent(token)}`)
      .then((result) => {
        if (alive) setMeta(result);
      })
      .catch((caught) => {
        if (alive) {
          setFatal(caught instanceof ApiClientError ? caught.message : "这个分享链接暂时打不开。");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const result = await api<PublicMeta>(`/api/share/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        body: { password },
      });
      setMeta(result);
      setPassword("");
    } catch (caught) {
      setUnlockError(caught instanceof ApiClientError ? caught.message : "提取码校验失败。");
    } finally {
      setUnlocking(false);
    }
  }

  async function copy() {
    const ok = await copyText(window.location.href);
    if (!ok) {
      toastError("复制失败，请手动复制地址。");
      return;
    }
    setCopied(true);
    toastInfo("链接已复制");
    window.setTimeout(() => setCopied(false), 1800);
  }

  const downloadUrl = shareDownloadHref(token);
  const inlineUrl = shareDownloadHref(token, true);
  const shareable = meta && meta.status === "active" && meta.unlocked;

  return (
    <div className="public-page">
      <header className="public-nav">
        <Brand href="/" size={38} />
        <div className="public-nav-right">
          <ThemeToggle />
          <Link href="/login?mode=register" className="btn btn-secondary btn-compact public-nav-cta">
            我也要一个网盘
          </Link>
        </div>
      </header>

      <main className="public-main">
        {loading ? (
          <div className="public-loading">
            <Spinner /> 正在打开分享…
          </div>
        ) : fatal ? (
          <div className="public-card">
            <div className="public-status">
              <div className="public-status-icon">
                <FileQuestion size={30} />
              </div>
              <h2>这个链接打不开</h2>
              <p>{fatal} 它可能已经被取消，或者地址不完整。</p>
              <Link href="/" className="btn btn-secondary">
                <ArrowLeft size={15} /> 回到首页
              </Link>
            </div>
          </div>
        ) : !meta ? null : meta.status !== "active" ? (
          <div className="public-card">
            <div className="public-status">
              <div className="public-status-icon">
                {meta.status === "expired" ? <Clock size={30} /> : <FileQuestion size={30} />}
              </div>
              <h2>{meta.status === "expired" ? "这条链接已经过期" : "文件已经不在了"}</h2>
              <p>
                {meta.status === "expired"
                  ? "分享者设置的有效期已经结束。可以请对方重新生成一条链接。"
                  : "分享的文件已经被删除，或者分享已经被取消。"}
              </p>
              <Link href="/" className="btn btn-secondary">
                <ArrowLeft size={15} /> 回到首页
              </Link>
            </div>
          </div>
        ) : meta.requiresPassword && !meta.unlocked ? (
          <div className="public-card">
            <div className="public-card-head">
              <FileIcon kind="file" previewKind={meta.previewKind} size="lg" />
              <div className="public-file-info">
                <strong>{meta.name}</strong>
                <span>
                  {formatBytes(meta.size)}
                  <i />
                  由 {meta.owner} 分享
                </span>
              </div>
            </div>
            <div className="public-lock">
              <div className="public-lock-art">
                <Lock size={34} strokeWidth={1.5} />
              </div>
              <h2>这杯有盖子。</h2>
              <p>分享者设置了提取码。输入正确后即可预览和不限速下载。</p>
              <form className="unlock-form" onSubmit={unlock}>
                <input
                  className="input"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setUnlockError("");
                  }}
                  placeholder="输入提取码"
                  aria-label="提取码"
                  autoFocus
                  maxLength={64}
                />
                <button type="submit" className="btn btn-primary" disabled={unlocking || !password}>
                  {unlocking ? <Spinner /> : <KeyRound size={15} />}
                  打开
                </button>
              </form>
              {unlockError && (
                <div className="form-error" style={{ marginTop: 12, width: "min(330px, 100%)" }}>
                  {unlockError}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="public-card">
            <div className="public-card-head">
              <FileIcon kind="file" previewKind={meta.previewKind} size="lg" />
              <div className="public-file-info">
                <strong title={meta.name}>{meta.name}</strong>
                <span>
                  {formatBytes(meta.size)}
                  <i />
                  由 {meta.owner} 分享
                  <i />
                  {formatExpiry(meta.expiresAt)}
                </span>
              </div>
              <div className="public-head-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
                  {copied ? <ShieldCheck size={14} /> : <Copy size={14} />}
                  {copied ? "已复制" : "复制链接"}
                </button>
              </div>
            </div>

            {shareable && (
              <div className="public-preview">
                <PreviewContent
                  source={{
                    name: meta.name,
                    size: meta.size,
                    previewKind: meta.previewKind,
                    inlineUrl,
                    downloadUrl,
                  }}
                />
              </div>
            )}

            <div className="public-download-bar">
              <a href={downloadUrl} className="btn btn-accent">
                <Download size={17} /> 下载文件
              </a>
              <div className="public-download-note">
                <ShieldCheck size={14} /> 不限速 · 支持断点续传
              </div>
              <div className="public-meta">
                <span>{meta.downloads} 次下载</span>
                <span>·</span>
                <span>{formatFullDate(meta.createdAt)} 分享</span>
                <span>·</span>
                <span>{meta.expiresAt ? "到期自动失效" : "永久有效"}</span>
              </div>
            </div>

            <div className="public-share-stamp">
              <Link2 size={13} />
              <span>
                由 <strong>{meta.owner}</strong> 通过 Milktea Cloud 分享
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Link href="/login?mode=register">创建你自己的空间</Link>
              </span>
            </div>
          </div>
        )}
      </main>

      <footer className="public-footer">
        <span>Milktea Cloud · 自托管网盘</span>
        <span>
          文件保存在分享者的电脑上 · <Link href="/">了解 Milktea Cloud</Link>
        </span>
      </footer>
    </div>
  );
}
