export const FILES_CHANGED = "mc:files-changed";

export function notifyFilesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FILES_CHANGED));
}

export function onFilesChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(FILES_CHANGED, handler);
  return () => window.removeEventListener(FILES_CHANGED, handler);
}
