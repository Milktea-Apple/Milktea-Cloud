"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Database,
  HardDrive,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/client/api";
import { formatBytes, formatFullDate, initials } from "@/lib/shared";
import { useMe } from "./me-context";
import { toastError, toastSuccess } from "./toast";
import { ConfirmDialog, ProgressBar, Spinner } from "./ui";

export function SettingsView() {
  const { me, refreshMe } = useMe();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(me.user.displayName);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setDisplayName(me.user.displayName);
  }, [me.user.displayName]);

  const percent = me.quota > 0 ? Math.min(100, (me.usage / me.quota) * 100) : 0;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileError("");
    try {
      await api("/api/me", { method: "PATCH", body: { displayName } });
      await refreshMe();
      toastSuccess("昵称已更新");
    } catch (caught) {
      setProfileError(caught instanceof ApiClientError ? caught.message : "保存失败。");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (passwordBusy) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的新密码不一致。");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    try {
      await api("/api/me/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toastSuccess("密码已更新，其他设备已退出登录");
    } catch (caught) {
      setPasswordError(caught instanceof ApiClientError ? caught.message : "修改密码失败。");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function logoutAll() {
    setLoggingOut(true);
    try {
      await api("/api/me/logout-all", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      toastError(caught instanceof ApiClientError ? caught.message : "操作失败。");
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <p className="eyebrow">Account & storage</p>
          <h1>设置</h1>
          <p>管理你的账号、密码，以及这台电脑上的存储空间。</p>
        </div>
      </div>

      <div className="settings-grid">
        <div>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>账号资料</h2>
                <p>你在分享页和网盘里显示的名字。</p>
              </div>
              <UserRound size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <div className="profile-card">
                <span className="avatar">{initials(me.user.displayName)}</span>
                <div className="profile-name">
                  <strong>
                    {me.user.displayName}{" "}
                    {me.user.isAdmin && (
                      <span className="badge badge-warn">
                        <BadgeCheck size={9} /> 站长
                      </span>
                    )}
                  </strong>
                  <span>@{me.user.username}</span>
                </div>
              </div>

              <form className="form-stack" onSubmit={saveProfile}>
                <div className="field">
                  <label htmlFor="display-name">昵称</label>
                  <div className="input-row">
                    <input
                      id="display-name"
                      className="input"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={32}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={profileBusy || !displayName.trim() || displayName === me.user.displayName}
                    >
                      {profileBusy && <Spinner />}
                      保存
                    </button>
                  </div>
                </div>
                {profileError && <div className="form-error">{profileError}</div>}
              </form>

              <div className="info-list" style={{ marginTop: 16 }}>
                <div className="info-row">
                  <span>用户名</span>
                  <strong>@{me.user.username}</strong>
                </div>
                <div className="info-row">
                  <span>加入时间</span>
                  <strong>{formatFullDate(me.user.createdAt)}</strong>
                </div>
                <div className="info-row">
                  <span>账号角色</span>
                  <strong>{me.user.isAdmin ? "站长 · 第一位成员" : "普通成员"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>修改密码</h2>
                <p>修改后，其他设备上的登录会立即失效。</p>
              </div>
              <KeyRound size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <form className="form-stack" onSubmit={changePassword}>
                <div className="field">
                  <label htmlFor="current-password">当前密码</label>
                  <input
                    id="current-password"
                    className="input"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="new-password">新密码</label>
                  <input
                    id="new-password"
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <span className="hint">至少 8 个字符。</span>
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">确认新密码</label>
                  <input
                    id="confirm-password"
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                {passwordError && <div className="form-error">{passwordError}</div>}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                  style={{ alignSelf: "flex-start" }}
                >
                  {passwordBusy && <Spinner />}
                  更新密码
                </button>
              </form>
            </div>
          </section>

          <section className="panel danger-zone">
            <div className="panel-head">
              <div>
                <h2>登录与设备</h2>
                <p>如果怀疑账号泄露，可以退出所有设备上的登录。</p>
              </div>
              <MonitorSmartphone size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <div className="settings-note" style={{ marginBottom: 14 }}>
                <ShieldCheck size={14} />
                退出所有设备不会删除任何文件。你需要在每台设备上重新输入密码。
              </div>
              <button type="button" className="btn btn-danger-soft" onClick={() => setLogoutAllOpen(true)}>
                <LogOut size={15} /> 退出所有设备
              </button>
            </div>
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>存储空间</h2>
                <p>文件实体保存在这台电脑的磁盘上。</p>
              </div>
              <HardDrive size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <div className="storage-big">
                <div className="storage-big-num">
                  {formatBytes(me.usage)} <span>/ {formatBytes(me.quota)}</span>
                </div>
                <ProgressBar value={percent} />
                <small>
                  已使用 {Math.round(percent)}%（含回收站）· 本机磁盘剩余 {formatBytes(me.diskFree)}
                </small>
              </div>
              <div className="info-list" style={{ marginTop: 12 }}>
                <div className="info-row">
                  <span>文件 / 文件夹</span>
                  <strong>
                    {me.fileCount} 个文件 · {me.folderCount} 个文件夹
                  </strong>
                </div>
                <div className="info-row">
                  <span>单文件上限</span>
                  <strong>{formatBytes(me.maxFileBytes)}</strong>
                </div>
                <div className="info-row">
                  <span>上传分片</span>
                  <strong>{formatBytes(me.chunkSize)}</strong>
                </div>
                <div className="info-row">
                  <span>回收站</span>
                  <strong>{me.trashCount} 个项目</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>关于这台网盘</h2>
                <p>Milktea Cloud 是一个自托管的私人网盘。</p>
              </div>
              <Server size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <div className="info-list">
                <div className="info-row">
                  <span>版本</span>
                  <strong>Milktea Cloud 1.0</strong>
                </div>
                <div className="info-row">
                  <span>运行方式</span>
                  <strong>Next.js · node:sqlite</strong>
                </div>
                <div className="info-row">
                  <span>注册</span>
                  <strong>{me.allowRegistration ? "开放" : "已关闭"}</strong>
                </div>
                <div className="info-row">
                  <span>存储目录</span>
                  <code>{me.storagePath}</code>
                </div>
                <div className="info-row">
                  <span>数据位置</span>
                  <strong>只在这台电脑上</strong>
                </div>
              </div>
              <div className="settings-note" style={{ marginTop: 14 }}>
                <Database size={13} />
                备份时请同时复制数据库与 storage 目录。文件内容不会上传到任何第三方服务。
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>空间小贴士</h2>
                <p>让这个网盘保持轻盈。</p>
              </div>
              <CalendarDays size={17} style={{ color: "var(--faint)" }} />
            </div>
            <div className="panel-body">
              <ul className="settings-tips">
                <li>删除的文件会在回收站保留 30 天，之后自动释放空间。</li>
                <li>上传中断后重新选择同一个文件，会从已上传的分片继续。</li>
                <li>分享链接可以在「分享链接」页面随时取消。</li>
                <li>下载不限速，速度只受本机上行带宽影响。</li>
              </ul>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={logoutAllOpen}
        title="退出所有设备？"
        description="当前浏览器也会退出登录。文件、分享链接和回收站都不会受到影响。"
        confirmLabel="全部退出"
        busy={loggingOut}
        onConfirm={logoutAll}
        onClose={() => setLogoutAllOpen(false)}
      />
    </>
  );
}
