"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { useUpload, type UploadTask } from "./upload-provider";
import { Spinner } from "./ui";
import { formatBytes, formatSpeed } from "@/lib/shared";

function statusText(task: UploadTask) {
  switch (task.status) {
    case "waiting":
      return "等待上传";
    case "uploading":
      return `${formatBytes(task.loaded)} / ${formatBytes(task.size)}${
        task.speed > 0 ? ` · ${formatSpeed(task.speed)}` : ""
      }`;
    case "finishing":
      return "正在合并文件…";
    case "paused":
      return "已暂停";
    case "done":
      return "已完成";
    case "error":
      return task.error || "上传失败";
    default:
      return "";
  }
}

function percent(task: UploadTask) {
  if (task.status === "done") return 100;
  if (!task.size) return 0;
  return Math.min(100, Math.round((task.loaded / task.size) * 100));
}

export function UploadDock() {
  const { tasks, pause, resume, cancel, retry, clearDone } = useUpload();
  const [collapsed, setCollapsed] = useState(false);
  const previousCount = useRef(0);

  useEffect(() => {
    if (tasks.length > previousCount.current) setCollapsed(false);
    previousCount.current = tasks.length;
  }, [tasks.length]);

  const summary = useMemo(() => {
    const totalBytes = tasks.reduce((sum, task) => sum + task.size, 0);
    const loadedBytes = tasks.reduce((sum, task) => sum + Math.min(task.loaded, task.size), 0);
    const active = tasks.filter((task) => ["waiting", "uploading", "finishing"].includes(task.status));
    const done = tasks.filter((task) => task.status === "done");
    return {
      totalBytes,
      loadedBytes,
      active: active.length,
      done: done.length,
      overall: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : active.length ? 35 : 100,
    };
  }, [tasks]);

  if (tasks.length === 0) return null;

  return (
    <section className={`upload-dock ${collapsed ? "is-collapsed" : ""}`} aria-label="传输列表">
      <header className="upload-dock-head">
        <div className="upload-dock-title">
          <span className={`dock-icon ${summary.active > 0 ? "is-active" : ""}`}>
            {summary.active > 0 ? <Spinner size={17} /> : <UploadCloud size={17} />}
          </span>
          <div>
            <strong>
              {summary.active > 0
                ? `正在传输 ${summary.active} 个文件`
                : summary.done === tasks.length
                  ? "全部传输完成"
                  : "传输列表"}
            </strong>
            <span>
              {formatBytes(summary.loadedBytes)} / {formatBytes(summary.totalBytes)} · {summary.overall}%
            </span>
          </div>
        </div>
        <div className="upload-dock-actions">
          {summary.done > 0 && !summary.active && (
            <button type="button" className="text-btn" onClick={clearDone}>
              清除已完成
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "展开传输列表" : "收起传输列表"}
          >
            <ChevronDown size={17} className={collapsed ? "rotate-180" : ""} />
          </button>
        </div>
      </header>
      <div className="upload-overall">
        <span style={{ width: `${summary.overall}%` }} />
      </div>
      {!collapsed && (
        <div className="upload-list">
          {tasks.map((task) => (
            <div key={task.id} className={`upload-row status-${task.status}`}>
              <div className="upload-row-main">
                <div className="upload-row-text">
                  <span className="upload-name" title={task.name}>
                    {task.name}
                  </span>
                  <span className="upload-meta">{statusText(task)}</span>
                </div>
                <div className="upload-row-actions">
                  {task.status === "uploading" && (
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => pause(task.id)}
                      title="暂停"
                      aria-label="暂停"
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {task.status === "paused" && (
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => resume(task.id)}
                      title="继续"
                      aria-label="继续"
                    >
                      <Play size={14} />
                    </button>
                  )}
                  {task.status === "error" && (
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => retry(task.id)}
                      title="重试"
                      aria-label="重试"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {task.status === "done" ? (
                    <span className="upload-done-icon">
                      <Check size={14} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => cancel(task.id)}
                      title={task.status === "error" ? "移除" : "取消上传"}
                      aria-label="取消上传"
                      disabled={task.status === "finishing"}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="upload-row-bar">
                <span style={{ width: `${percent(task)}%` }} />
              </div>
              {task.status === "error" && (
                <p className="upload-error">
                  <CircleAlert size={12} /> {task.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
