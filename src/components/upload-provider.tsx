"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiClientError } from "@/lib/client/api";
import { notifyFilesChanged } from "@/lib/client/events";
import { formatBytes, type FileDTO } from "@/lib/shared";
import { useMe } from "./me-context";
import { toastError, toastInfo, toastSuccess } from "./toast";

export type UploadStatus = "waiting" | "uploading" | "finishing" | "paused" | "done" | "error";

export type UploadTask = {
  id: string;
  uploadId?: string;
  name: string;
  size: number;
  parentId: string | null;
  status: UploadStatus;
  loaded: number;
  receivedCount: number;
  totalChunks: number;
  speed: number;
  error?: string;
  createdAt: number;
};

type InitResponse = {
  id: string;
  name: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  received: number[];
  resumed: boolean;
};

type InternalTask = UploadTask & {
  file: File;
  clientKey: string;
  chunkSize: number;
  received: Set<number>;
  paused: boolean;
  cancelled: boolean;
  running: boolean;
  runToken: number;
  abort: AbortController | null;
  startedAt: number;
  lastLoaded: number;
  lastProgressAt: number;
};

type UploadContextValue = {
  tasks: UploadTask[];
  enqueue: (files: FileList | File[] | null | undefined, parentId: string | null) => void;
  pickFiles: (parentId: string | null) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  clearDone: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

const MAX_ACTIVE_FILES = 2;
const CHUNK_CONCURRENCY = 3;

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "网络连接中断";
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function recomputeLoaded(task: InternalTask) {
  let loaded = 0;
  for (const index of task.received) {
    loaded += Math.max(0, Math.min(task.chunkSize, task.size - index * task.chunkSize));
  }
  task.loaded = Math.min(loaded, task.size);
  task.receivedCount = task.received.size;
  return task.loaded;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const { refreshMe } = useMe();
  const tasksRef = useRef<Map<string, InternalTask>>(new Map());
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const startTaskRef = useRef<(id: string) => void>(() => {});

  const sync = useCallback(() => {
    setTasks(
      Array.from(tasksRef.current.values()).map((task) => ({
        id: task.id,
        uploadId: task.uploadId,
        name: task.name,
        size: task.size,
        parentId: task.parentId,
        status: task.status,
        loaded: task.loaded,
        receivedCount: task.receivedCount,
        totalChunks: task.totalChunks,
        speed: task.speed,
        error: task.error,
        createdAt: task.createdAt,
      })),
    );
  }, []);

  const pump = useCallback(() => {
    let active = Array.from(tasksRef.current.values()).filter(
      (task) => task.status === "uploading" || task.status === "finishing",
    ).length;
    while (active < MAX_ACTIVE_FILES) {
      const next = Array.from(tasksRef.current.values()).find(
        (task) => task.status === "waiting" && !task.running,
      );
      if (!next) return;
      next.running = true;
      active += 1;
      startTaskRef.current(next.id);
    }
  }, []);

  const uploadChunk = useCallback(async (task: InternalTask, index: number) => {
    const start = index * task.chunkSize;
    const end = Math.min(task.size, start + task.chunkSize);
    const blob = task.file.slice(start, end);
    const signal = task.abort!.signal;
    let attempt = 0;
    for (;;) {
      if (task.paused || task.cancelled || signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const response = await fetch(`/api/uploads/${task.uploadId}/chunks/${index}`, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "application/octet-stream" },
          credentials: "same-origin",
          signal,
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;
          throw new ApiClientError(
            payload?.error || "分片上传失败，请重试。",
            response.status,
            payload?.code,
          );
        }
        return;
      } catch (error) {
        if (signal.aborted || task.paused || task.cancelled || isAbort(error)) {
          throw new DOMException("Aborted", "AbortError");
        }
        attempt += 1;
        if (attempt >= 3) throw error;
        await sleep(600 * attempt, signal);
      }
    }
  }, []);

  const startTask = useCallback(
    async (id: string) => {
      const task = tasksRef.current.get(id);
      if (!task || task.cancelled) return;
      task.running = true;
      task.status = "uploading";
      task.paused = false;
      task.error = undefined;
      task.speed = 0;
      task.startedAt = Date.now();
      task.lastLoaded = task.loaded;
      task.lastProgressAt = Date.now();
      task.runToken += 1;
      const token = task.runToken;
      task.abort = new AbortController();
      sync();

      try {
        if (!task.uploadId) {
          const init = await api<InitResponse>("/api/uploads", {
            method: "POST",
            body: {
              name: task.name,
              size: task.size,
              parentId: task.parentId,
              clientKey: task.clientKey,
            },
          });
          if (task.cancelled) {
            void fetch(`/api/uploads/${init.id}`, { method: "DELETE", credentials: "same-origin" });
            return;
          }
          if (token !== task.runToken) return;
          task.uploadId = init.id;
          task.chunkSize = init.chunkSize;
          task.totalChunks = init.totalChunks;
          task.received = new Set(init.received);
          recomputeLoaded(task);
          if (init.resumed) toastInfo(`继续上传「${task.name}」`);
          sync();
        }

        const pending: number[] = [];
        for (let index = 0; index < task.totalChunks; index += 1) {
          if (!task.received.has(index)) pending.push(index);
        }

        if (pending.length > 0) {
          let cursor = 0;
          let failure: unknown = null;
          const worker = async () => {
            for (;;) {
              if (task.paused || task.cancelled || token !== task.runToken) return;
              const index = pending[cursor];
              cursor += 1;
              if (index === undefined) return;
              try {
                await uploadChunk(task, index);
                if (task.cancelled || token !== task.runToken) return;
                task.received.add(index);
                recomputeLoaded(task);
                const now = Date.now();
                const deltaTime = Math.max(1, now - task.lastProgressAt);
                const deltaBytes = task.loaded - task.lastLoaded;
                const instant = (deltaBytes / deltaTime) * 1000;
                task.speed = task.speed > 0 ? task.speed * 0.65 + instant * 0.35 : instant;
                task.lastLoaded = task.loaded;
                task.lastProgressAt = now;
                sync();
              } catch (error) {
                if (isAbort(error)) return;
                if (!failure) failure = error;
                task.abort?.abort();
                return;
              }
            }
          };
          await Promise.all(Array.from({ length: CHUNK_CONCURRENCY }, () => worker()));
          if (task.paused || task.cancelled || token !== task.runToken) return;
          if (failure) throw failure;
          if (task.received.size < task.totalChunks) {
            throw new Error("还有分片没有上传完成，请重试。");
          }
        }

        task.status = "finishing";
        task.loaded = task.size;
        task.speed = 0;
        sync();
        const result = await api<{ file: FileDTO }>(`/api/uploads/${task.uploadId}/complete`, {
          method: "POST",
        });
        if (token !== task.runToken || task.cancelled) return;
        task.status = "done";
        task.name = result.file.name;
        task.loaded = task.size;
        task.speed = 0;
        task.uploadId = undefined;
        task.received.clear();
        sync();
        toastSuccess(`「${result.file.name}」上传完成`);
        notifyFilesChanged();
        void refreshMe();
      } catch (error) {
        if (task.paused || task.cancelled || token !== task.runToken) return;
        task.status = "error";
        task.speed = 0;
        task.error = errorMessage(error);
        toastError(`「${task.name}」上传失败：${task.error}`);
      } finally {
        if (token === task.runToken) {
          task.running = false;
          task.abort = null;
          sync();
        }
        pump();
      }
    },
    [pump, refreshMe, sync, uploadChunk],
  );

  startTaskRef.current = (id: string) => {
    void startTask(id);
  };

  const enqueue = useCallback(
    (files: FileList | File[] | null | undefined, parentId: string | null) => {
      if (!files) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      let added = 0;
      for (const file of list) {
        const clientKey = `${file.name}|${file.size}|${file.lastModified}`;
        const duplicate = Array.from(tasksRef.current.values()).some(
          (task) => task.clientKey === clientKey && task.status !== "error" && task.status !== "done",
        );
        if (duplicate) {
          toastInfo(`「${file.name}」已经在传输队列里了`);
          continue;
        }
        const id = crypto.randomUUID();
        const task: InternalTask = {
          id,
          name: file.name,
          size: file.size,
          parentId,
          status: "waiting",
          loaded: 0,
          receivedCount: 0,
          totalChunks: 0,
          speed: 0,
          createdAt: Date.now(),
          file,
          clientKey,
          chunkSize: 8 * 1024 * 1024,
          received: new Set(),
          paused: false,
          cancelled: false,
          running: false,
          runToken: 0,
          abort: null,
          startedAt: Date.now(),
          lastLoaded: 0,
          lastProgressAt: Date.now(),
        };
        tasksRef.current.set(id, task);
        added += 1;
      }
      if (added > 0) {
        sync();
        toastInfo(
          added === 1
            ? `开始上传「${list[0].name}」`
            : `已加入 ${added} 个文件，共 ${formatBytes(list.reduce((sum, file) => sum + file.size, 0))}`,
        );
        window.setTimeout(pump, 30);
      }
    },
    [pump, sync],
  );

  const pickFiles = useCallback(
    (parentId: string | null) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        enqueue(input.files, parentId);
        input.remove();
      });
      input.click();
    },
    [enqueue],
  );

  const pause = useCallback(
    (id: string) => {
      const task = tasksRef.current.get(id);
      if (!task || task.status !== "uploading") return;
      task.paused = true;
      task.status = "paused";
      task.speed = 0;
      task.abort?.abort();
      sync();
    },
    [sync],
  );

  const resume = useCallback(
    (id: string) => {
      const task = tasksRef.current.get(id);
      if (!task || (task.status !== "paused" && task.status !== "error")) return;
      task.paused = false;
      task.cancelled = false;
      task.running = false;
      task.status = "uploading";
      startTaskRef.current(id);
    },
    [],
  );

  const cancel = useCallback(
    (id: string) => {
      const task = tasksRef.current.get(id);
      if (!task) return;
      task.cancelled = true;
      task.abort?.abort();
      if (task.uploadId) {
        void fetch(`/api/uploads/${task.uploadId}`, {
          method: "DELETE",
          credentials: "same-origin",
        }).catch(() => {});
      }
      tasksRef.current.delete(id);
      sync();
      pump();
    },
    [pump, sync],
  );

  const retry = useCallback(
    (id: string) => {
      const task = tasksRef.current.get(id);
      if (!task) return;
      task.status = "waiting";
      task.error = undefined;
      task.paused = false;
      task.cancelled = false;
      task.running = false;
      task.speed = 0;
      sync();
      pump();
    },
    [pump, sync],
  );

  const clearDone = useCallback(() => {
    for (const [id, task] of tasksRef.current) {
      if (task.status === "done") tasksRef.current.delete(id);
    }
    sync();
  }, [sync]);

  const value = useMemo(
    () => ({ tasks, enqueue, pickFiles, pause, resume, cancel, retry, clearDone }),
    [tasks, enqueue, pickFiles, pause, resume, cancel, retry, clearDone],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used inside UploadProvider");
  return context;
}
