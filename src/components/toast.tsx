"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

let items: ToastItem[] = [];
let sequence = 0;
const EMPTY: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  items = [...items];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function toast(message: string, tone: ToastTone = "success", duration = 3800) {
  sequence += 1;
  const id = sequence;
  items = [...items.slice(-3), { id, message, tone }];
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toastSuccess = (message: string) => toast(message, "success");
export const toastError = (message: string) => toast(message, "error", 5200);
export const toastInfo = (message: string) => toast(message, "info");

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {list.map((item) => {
        const Icon = item.tone === "success" ? CircleCheck : item.tone === "error" ? CircleAlert : Info;
        return (
          <div key={item.id} className={`toast toast-${item.tone}`} role="status">
            <Icon size={18} className="toast-icon" />
            <span>{item.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(item.id)} aria-label="关闭提示">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
