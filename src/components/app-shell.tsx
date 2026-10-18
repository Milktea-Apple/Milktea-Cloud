"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CloudUpload,
  HardDrive,
  Link2,
  LogOut,
  Menu,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/client/api";
import { initials, formatBytes, type MeDTO } from "@/lib/shared";
import { Brand } from "./brand";
import { MeProvider, useMe } from "./me-context";
import { ThemeToggle } from "./theme-toggle";
import { Spinner } from "./ui";
import { UploadProvider, useUpload } from "./upload-provider";
import { UploadDock } from "./upload-dock";

const NAV = [
  { href: "/drive", label: "我的网盘", icon: HardDrive },
  { href: "/shares", label: "分享链接", icon: Link2 },
  { href: "/trash", label: "回收站", icon: Trash2 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ initial, children }: { initial: MeDTO; children: ReactNode }) {
  return (
    <MeProvider initial={initial}>
      <UploadProvider>
        <Shell>{children}</Shell>
      </UploadProvider>
    </MeProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const { pickFiles } = useUpload();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const percent = Math.min(100, me.quota > 0 ? (me.usage / me.quota) * 100 : 0);
  const activeHref = NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;

  useEffect(() => {
    setDrawerOpen(false);
    setUserMenu(false);
    if (pathname === "/drive") {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") || "");
    }
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/drive?q=${encodeURIComponent(trimmed)}` : "/drive");
  }

  function uploadFromTopbar() {
    const folder = new URLSearchParams(window.location.search).get("folder");
    pickFiles(folder);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="shell">
      <button
        type="button"
        className={`drawer-scrim ${drawerOpen ? "is-visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-label="关闭菜单"
        tabIndex={drawerOpen ? 0 : -1}
      />
      <aside className={`sidebar ${drawerOpen ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <Brand href="/drive" size={36} />
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="side-nav" aria-label="主导航">
          <span className="nav-label">空间</span>
          {NAV.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.href === "/trash" && me.trashCount > 0 && (
                  <span className="nav-badge">{me.trashCount > 99 ? "99+" : me.trashCount}</span>
                )}
                {active && <span className="nav-dot" aria-hidden="true" />}
              </Link>
            );
          })}
          <span className="nav-label nav-label-gap">账号</span>
          {NAV.slice(3).map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {active && <span className="nav-dot" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="storage-card">
          <div className="storage-card-head">
            <span>存储空间</span>
            <strong>{Math.round(percent)}%</strong>
          </div>
          <div className="storage-bar">
            <span style={{ width: `${Math.max(1.5, percent)}%` }} />
          </div>
          <p>
            已用 {formatBytes(me.usage)} <span>/ {formatBytes(me.quota)}</span>
          </p>
          <Link href="/settings" className="storage-link">
            查看存储详情
          </Link>
        </div>

        <div className="user-area">
          <button
            type="button"
            className="user-chip"
            onClick={() => setUserMenu((value) => !value)}
            aria-expanded={userMenu}
          >
            <span className="avatar">{initials(me.user.displayName)}</span>
            <span className="user-chip-text">
              <strong>{me.user.displayName}</strong>
              <span>@{me.user.username}</span>
            </span>
            <span className="user-chevron">···</span>
          </button>
          {userMenu && (
            <div className="user-menu">
              <Link href="/settings" className="user-menu-item">
                <Settings size={15} /> 账号设置
              </Link>
              <button type="button" className="user-menu-item danger" onClick={signOut} disabled={signingOut}>
                {signingOut ? <Spinner size={15} /> : <LogOut size={15} />} 退出登录
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn mobile-menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <form className="search-box" onSubmit={submitSearch} role="search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索我的文件…"
              aria-label="搜索我的文件"
            />
            <kbd>/</kbd>
          </form>
          <div className="topbar-actions">
            <button type="button" className="btn btn-primary btn-compact top-upload" onClick={uploadFromTopbar}>
              <CloudUpload size={17} />
              <span>上传</span>
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="avatar avatar-top"
              onClick={() => setDrawerOpen(true)}
              aria-label="打开账号菜单"
            >
              {initials(me.user.displayName)}
            </button>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
      <UploadDock />
    </div>
  );
}
