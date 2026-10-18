export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "error") {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const payload = data as { error?: string; code?: string } | null;
    throw new ApiClientError(
      payload?.error || `请求失败（${response.status}）`,
      response.status,
      payload?.code || "error",
    );
  }
  return data as T;
}

export function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body });
}

export function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body });
}

export function del<T>(path: string, body?: unknown) {
  return api<T>(path, { method: "DELETE", body });
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadHref(fileId: string, inline = false) {
  return `/api/files/${encodeURIComponent(fileId)}/download${inline ? "?inline=1" : ""}`;
}

export function shareDownloadHref(token: string, inline = false) {
  return `/api/share/${encodeURIComponent(token)}/download${inline ? "?inline=1" : ""}`;
}

export function shareUrl(token: string) {
  if (typeof window === "undefined") return `/s/${token}`;
  return `${window.location.origin}/s/${token}`;
}
