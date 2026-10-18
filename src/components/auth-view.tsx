"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { Brand } from "./brand";
import { CupArt } from "./cup-art";
import { ThemeToggle } from "./theme-toggle";
import { Spinner } from "./ui";

type Mode = "login" | "register";

export function AuthView({
  initialMode,
  allowRegistration,
  next,
  memberCount,
}: {
  initialMode: Mode;
  allowRegistration: boolean;
  next: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (isRegister && password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await api("/api/auth/register", {
          method: "POST",
          body: { username, password, displayName },
        });
      } else {
        await api("/api/auth/login", {
          method: "POST",
          body: { username, password },
        });
      }
      router.replace(next || "/drive");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "网络连接失败，请稍后重试。");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div style={{ position: "relative", zIndex: 2 }}>
          <Brand href="/" size={40} />
        </div>
        <CupArt className="auth-visual-cup" />
        <div className="auth-visual-copy">
          <blockquote>“文件应该待在它该待的地方——你的磁盘上。”</blockquote>
          <p>
            每位成员都有自己的独立空间，上传、预览、分享，都不会经过第三方。
            下载没有会员等级，也没有等待队列。
          </p>
          <div className="auth-visual-chips">
            <span>
              <Check size={11} /> 不限速
            </span>
            <span>
              <ShieldCheck size={11} /> 独立空间
            </span>
            <span>
              <Sparkles size={11} /> 本地存储
            </span>
            <span>
              <Users size={11} /> {memberCount} 位成员
            </span>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-top">
          <Link href="/" className="auth-back">
            <ArrowLeft size={14} /> 返回首页
          </Link>
          <ThemeToggle />
        </div>

        <div className="auth-box">
          <p className="auth-eyebrow">{isRegister ? "Join the cloud" : "Welcome back"}</p>
          <h1>{isRegister ? "给自己一间空间。" : "欢迎回来。"}</h1>
          <p className="auth-sub">
            {isRegister
              ? "注册不需要邮箱。第一个账号会成为这台网盘的站长。"
              : "登录后继续管理你的文件、分享与回收站。"}
          </p>

          {allowRegistration && (
            <div className="auth-tabs" role="tablist" aria-label="登录或注册">
              <button
                type="button"
                className={mode === "login" ? "is-active" : ""}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                role="tab"
                aria-selected={mode === "login"}
              >
                登录
              </button>
              <button
                type="button"
                className={mode === "register" ? "is-active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                role="tab"
                aria-selected={mode === "register"}
              >
                创建账号
              </button>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder={isRegister ? "3–24 位文字、数字或下划线" : "你的用户名"}
                required
                autoFocus
                minLength={3}
                maxLength={24}
              />
            </div>

            {isRegister && (
              <div className="field">
                <label htmlFor="displayName">昵称</label>
                <input
                  id="displayName"
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                  placeholder="别人在分享页看到的名字（可选）"
                  maxLength={32}
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="password">密码</label>
              <div className="password-field">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "至少 8 个字符" : "输入密码"}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="icon-btn tiny password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div className="field">
                <label htmlFor="confirm">确认密码</label>
                <input
                  id="confirm"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  placeholder="再输入一次"
                  required
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy && <Spinner />}
              {isRegister ? "创建我的空间" : "登录"}
            </button>
          </form>

          {!allowRegistration && (
            <div className="auth-notice">
              <Lock size={14} />
              这台网盘目前关闭了新用户注册。你可以使用已有账号登录。
            </div>
          )}

          <p className="auth-foot">
            {isRegister ? "已经有账号了？" : "还没有账号？"}{" "}
            {allowRegistration ? (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setMode(isRegister ? "login" : "register");
                  setError("");
                }}
              >
                {isRegister ? "直接登录" : "创建一个"}
              </button>
            ) : (
              <span>请联系站长。</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
