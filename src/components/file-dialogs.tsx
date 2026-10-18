"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Folder,
  Link2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { api, ApiClientError, copyText, shareUrl } from "@/lib/client/api";
import { formatBytes, type FileDTO, type ShareDTO } from "@/lib/shared";
import { FileIcon } from "./file-icon";
import { toastError, toastInfo, toastSuccess } from "./toast";
import { Modal, Spinner } from "./ui";

export function NewFolderDialog({
  open,
  parentId,
  onClose,
  onCreated,
}: {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: (folder: FileDTO) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ folder: FileDTO }>("/api/files/folder", {
        method: "POST",
        body: { name, parentId },
      });
      toastSuccess(`文件夹「${result.folder.name}」已创建`);
      onCreated(result.folder);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "创建文件夹失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建文件夹"
      subtitle="给文件留一个整齐的位置。"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" form="new-folder-form" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy && <Spinner />}
            创建
          </button>
        </>
      }
    >
      <form id="new-folder-form" className="form-stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="folder-name">文件夹名称</label>
          <input
            id="folder-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：项目资料"
            maxLength={160}
            autoFocus
          />
        </div>
        {error && <div className="form-error">{error}</div>}
      </form>
    </Modal>
  );
}

export function RenameDialog({
  open,
  file,
  onClose,
  onRenamed,
}: {
  open: boolean;
  file: FileDTO | null;
  onClose: () => void;
  onRenamed: (file: FileDTO) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && file) {
      setName(file.name);
      setError("");
      setBusy(false);
    }
  }, [open, file]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ file: FileDTO }>(`/api/files/${file.id}`, {
        method: "PATCH",
        body: { name },
      });
      toastSuccess("名称已更新");
      onRenamed(result.file);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "重命名失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="重命名"
      subtitle={file?.kind === "folder" ? "文件夹" : "文件"}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" form="rename-form" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy && <Spinner />}
            保存
          </button>
        </>
      }
    >
      <form id="rename-form" className="form-stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="rename-name">新名称</label>
          <input
            id="rename-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={160}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
      </form>
    </Modal>
  );
}

type FolderFlat = { folder: FileDTO; depth: number };

function flattenFolders(folders: FileDTO[]) {
  const children = new Map<string | null, FileDTO[]>();
  for (const folder of folders) {
    const key = folder.parentId;
    const list = children.get(key) || [];
    list.push(folder);
    children.set(key, list);
  }
  const result: FolderFlat[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) || []) {
      result.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

function collectDescendants(folders: FileDTO[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function MoveDialog({
  open,
  files,
  onClose,
  onMoved,
}: {
  open: boolean;
  files: FileDTO[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [folders, setFolders] = useState<FileDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setTarget(null);
    api<{ folders: FileDTO[] }>("/api/folders")
      .then((result) => setFolders(result.folders))
      .catch((caught) => setError(caught instanceof ApiClientError ? caught.message : "读取文件夹失败。"))
      .finally(() => setLoading(false));
  }, [open]);

  const excluded = useMemo(() => {
    const ids = new Set<string>();
    for (const file of files) {
      if (file.kind === "folder") {
        collectDescendants(folders, file.id).forEach((id) => ids.add(id));
      }
    }
    return ids;
  }, [files, folders]);

  const flat = useMemo(() => flattenFolders(folders), [folders]);
  const currentParent = files.length === 1 ? files[0].parentId : undefined;
  const allSameParent = files.every((file) => file.parentId === files[0]?.parentId);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        await api(`/api/files/${file.id}`, { method: "PATCH", body: { parentId: target } });
      }
      toastSuccess(files.length === 1 ? "已移动" : `已移动 ${files.length} 个项目`);
      onMoved();
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "移动失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={files.length > 1 ? `移动 ${files.length} 个项目` : "移动到…"}
      subtitle="选择一个目标文件夹。"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || loading || (allSameParent && target === currentParent)}
          >
            {busy && <Spinner />}
            移动到这里
          </button>
        </>
      }
    >
      <div className="folder-picker">
        {loading ? (
          <div className="preview-loading" style={{ padding: "30px 0" }}>
            <Spinner /> 正在读取文件夹…
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`folder-pick ${target === null ? "is-active" : ""}`}
              onClick={() => setTarget(null)}
            >
              <span className="folder-pick-icon">
                <Folder size={15} />
              </span>
              全部文件
              {target === null && <Check size={14} className="folder-pick-check" />}
            </button>
            {flat.map(({ folder, depth }) => {
              const disabled = excluded.has(folder.id);
              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`folder-pick ${target === folder.id ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                  style={{ paddingLeft: 9 + depth * 16 }}
                  onClick={() => !disabled && setTarget(folder.id)}
                  disabled={disabled}
                  title={disabled ? "不能移动到自身或子文件夹" : folder.name}
                >
                  <span className="folder-pick-icon">
                    <Folder size={15} />
                  </span>
                  <span className="folder-pick-name">{folder.name}</span>
                  {target === folder.id && <Check size={14} className="folder-pick-check" />}
                </button>
              );
            })}
            {flat.length === 0 && <p className="folder-picker-empty">还没有其他文件夹，直接放在全部文件里就好。</p>}
          </>
        )}
      </div>
      {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

export function ShareDialog({
  open,
  file,
  onClose,
  onCreated,
}: {
  open: boolean;
  file: FileDTO | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [expiry, setExpiry] = useState(0);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ share: ShareDTO; url: string; password: string } | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (open && file) {
      setExpiry(0);
      setPassword("");
      setError("");
      setBusy(false);
      setResult(null);
      setCopied("");
    }
  }, [open, file]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (password && password.length < 4) {
      setError("提取码至少需要 4 个字符，或者留空。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api<{ share: ShareDTO }>("/api/shares", {
        method: "POST",
        body: { fileId: file.id, password: password || undefined, expiresInDays: expiry },
      });
      setResult({
        share: response.share,
        url: shareUrl(response.share.token),
        password,
      });
      toastSuccess("分享链接已生成");
      onCreated?.();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "创建分享失败。");
    } finally {
      setBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    const ok = await copyText(value);
    if (!ok) {
      toastError("复制失败，请手动选择文本。");
      return;
    }
    setCopied(label);
    toastInfo("已复制到剪贴板");
    window.setTimeout(() => setCopied(""), 1800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? "分享链接已就绪" : "分享文件"}
      subtitle={
        result
          ? "把链接和提取码发给朋友，对方打开就能下载。"
          : "公开链接，可选提取码和有效期。"
      }
      size="md"
      footer={
        result ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResult(null)}>
              再建一条
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              完成
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="submit" form="share-form" className="btn btn-primary" disabled={busy || !file}>
              {busy && <Spinner />}
              生成链接
            </button>
          </>
        )
      }
    >
      {file && !result && (
        <form id="share-form" className="form-stack" onSubmit={create}>
          <div className="share-file-preview">
            <FileIcon kind={file.kind} previewKind={file.previewKind} size="lg" />
            <div>
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)} · 分享后同样不限速</span>
            </div>
          </div>

          <div className="field">
            <label>有效期</label>
            <div className="choice-grid">
              {[
                { value: 0, label: "永久有效" },
                { value: 1, label: "1 天" },
                { value: 7, label: "7 天" },
                { value: 30, label: "30 天" },
              ].map((option) => (
                <label key={option.value} className="choice">
                  <input
                    type="radio"
                    name="expiry"
                    checked={expiry === option.value}
                    onChange={() => setExpiry(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="share-password">提取码（可选）</label>
            <div className="input-with-icon">
              <Lock size={15} />
              <input
                id="share-password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value.replace(/\s/g, ""))}
                placeholder="留空则任何人都可以直接打开"
                maxLength={64}
              />
            </div>
            <span className="hint">设置后，访问者需要输入提取码才能预览或下载。</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="share-tip">
            <ShieldCheck size={14} />
            链接只指向这一个文件，不会暴露你的其他内容。
          </div>
        </form>
      )}

      {result && (
        <div className="share-result">
          <div className="share-result-box">
            <div className="share-result-label">
              <span>分享链接</span>
              {copied === "link" && <span className="copy-status">已复制</span>}
            </div>
            <div className="share-link-row">
              <input className="input" readOnly value={result.url} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy("link", result.url)}>
                {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                复制
              </button>
            </div>
          </div>

          {result.password && (
            <div className="share-result-box">
              <div className="share-result-label">
                <span>提取码</span>
                {copied === "code" && <span className="copy-status">已复制</span>}
              </div>
              <div className="share-code-row">
                <span className="share-code">{result.password}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => copy("code", result.password)}
                >
                  {copied === "code" ? <Check size={14} /> : <Copy size={14} />}
                  复制
                </button>
              </div>
            </div>
          )}

          <div className="share-result-meta">
            <span>
              <Link2 size={13} /> {result.share.hasPassword ? "需要提取码" : "公开访问"}
            </span>
            <span>{result.share.expiresAt ? "到期自动失效" : "永久有效"}</span>
          </div>

          <a href={result.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-block">
            <ExternalLink size={15} /> 打开分享页看看
          </a>
        </div>
      )}
    </Modal>
  );
}
