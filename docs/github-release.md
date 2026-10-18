# GitHub 发布包 · Milktea Cloud

这份文档用于把仓库整理成适合公开的样子。可以直接照抄字段，也可以按自己的风格调整。

---

## 一、仓库基础设置

### 仓库名

```
milktea-cloud
```

### About / Description

中文版（推荐）：

```
一杯温热的、自托管网盘：公开注册、每人独立空间、文件全部存在本机、下载不设软件限速。Next.js 15 + node:sqlite，零原生依赖。
```

英文版（可选）：

```
A warm, self-hosted cloud drive with per-account spaces, local-disk storage and no software bandwidth throttling. Built with Next.js and node:sqlite.
```

### Topics

```
self-hosted
cloud-drive
file-sharing
nextjs
react
sqlite
typescript
nas
self-hosting
webdav-alternative
```

> 不要写 `unlimited-storage`、`unlimited-bandwidth`、`baidu` 等容易被误解或蹭流量的词。

### 其它设置

- Website：留空，或填你的演示站 / 文档站
- License：MIT
- Default branch：`main`
- Social preview：使用 `screenshots/drive.png`，或按 `docs/bilibili.md` 的封面建议做一张 1280×640 的图
- Issues：开启
- Discussions：可选开启
- Wiki：不需要，README + `docs/` 已经够用

---

## 二、Release v1.0.0

### Tag

```
v1.0.0
```

### Release title

```
Milktea Cloud 1.0.0 · 一杯温热的、自托管网盘
```

### Release notes（可直接粘贴）

````markdown
# Milktea Cloud 1.0.0

第一个公开版本：把一台电脑变成一个可以公开访问、每人独立空间的网盘。

## 亮点

- 公开注册，第一位成员自动成为站长
- 每位成员独立空间，文件、搜索、分享、回收站完全隔离
- 8 MiB 分片上传，3 路并发，支持暂停 / 继续 / 取消
- 重新选择同一个文件即可从已上传分片继续
- 下载不设软件限速，完整支持 HTTP Range、HEAD、ETag、416
- 可选提取码与有效期的公开分享链接
- 图片、视频、音频、PDF、Markdown、CSV、JSON、代码、纯文本在线预览
- 列表 / 网格视图，图片缩略图，深色模式，移动端抽屉菜单
- 回收站、恢复、彻底删除、30 天自动清理
- 数据全部保存在本机：`data/` + `storage/`
- MIT 开源，Next.js 15 + React 19 + node:sqlite，零原生依赖

## 运行要求

- Node.js >= 22.13（推荐 24 LTS）
- 持久化磁盘
- 不支持 Vercel / Netlify 这类临时文件系统

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3210，第一个注册的账号自动成为站长。

生产模式：

```bash
npm run build
npm run start
```

## 部署

- VPS + Nginx + systemd：见 `deploy/`
- 自己的电脑 + Cloudflare Tunnel：见 README「部署到公网」

## 验证

- `npm run typecheck`
- `npm run build`
- `npm run smoke`：78 项 HTTP 端到端检查
- 真实 Chrome：注册、上传、暂停继续、预览、重命名、移动、分享、公开下载、回收站、移动端、深色模式

## 安全说明

- scrypt 密码哈希，服务端会话，HttpOnly + SameSite Cookie
- 跨账号访问一律 404
- HTML / SVG 直接访问时强制下载并附加 sandbox CSP
- 默认不做静态加密；磁盘或备份泄露时文件内容可读，请使用全盘加密

## 已知限制

- 分享只支持单个文件
- Office 文档不能在线渲染
- 单机单进程，不适合多副本横向扩展
- 没有找回密码、二次验证、内容审核
- 公开注册默认开启，公开部署前请阅读安全说明

完整说明见 README。

**License:** MIT
````

---

## 三、README 自检

公开前逐项确认：

- [ ] 首屏截图能正常显示
- [ ] 「快速开始」命令能从零跑通
- [ ] Node 版本要求写清楚（>= 22.13）
- [ ] 数据目录、备份方式写清楚
- [ ] 公开注册的风险写清楚
- [ ] 「不限速」解释清楚：不设软件限速，上限是上行带宽
- [ ] 没有把“破解第三方网盘”作为卖点
- [ ] 已知限制没有隐藏
- [ ] LICENSE 链接有效
- [ ] B 站链接占位符已替换
- [ ] GitHub 仓库地址占位符已替换

---

## 四、仓库文件清单

公开版本建议包含：

```
README.md
LICENSE
SECURITY.md
CHANGELOG.md
.env.example
.gitignore
package.json
package-lock.json
next.config.ts
tsconfig.json
src/
scripts/smoke.mjs
deploy/nginx.conf
deploy/milktea-cloud.service
screenshots/
docs/bilibili.md
docs/github-release.md
docs/public-access.md
.github/
```

**不要提交：**

```
data/
storage/
.env.local
data/auth-secret
*.log
node_modules/
.next/
```

这些在 `.gitignore` 里已经处理。提交前再跑一次：

```bash
git status --short
```

确认没有 `data/`、`storage/`、`.env.local` 或截图里的真实隐私信息。

---

## 五、首发文案（可选）

如果要在社交平台发一条短消息：

```text
做了一个自托管网盘：Milktea Cloud。

公开注册，但每人独立空间；文件存在本机；下载不设软件限速；支持分片断点续传、Range、在线预览、提取码分享和回收站。

技术栈：Next.js 15 + React 19 + node:sqlite，零原生依赖。
Node >= 22.13，MIT 开源。

不是破解第三方网盘，只是把一台电脑接成了网盘。
速度上限取决于本机上行带宽。

GitHub：https://github.com/Milktea-Apple/Milktea-Cloud
```

---

## 六、发布后的维护

- 在 README 顶部补上 B 站视频链接
- 把 Release 固定（Pin）在仓库首页
- 给仓库加 Social preview
- 及时回复 Issue，尤其是部署和 Node 版本问题
- 如果收到安全报告，优先私下处理，修复后再公开说明
- 如果修改了默认端口、配额或环境变量，同步更新 README 和 `.env.example`
- 每次发布前更新 `CHANGELOG.md`

---

## 七、Issue 分类建议

| 标签 | 用途 |
| --- | --- |
| `bug` | 可复现的功能错误 |
| `enhancement` | 新功能建议 |
| `deployment` | Nginx / systemd / Tunnel / Docker |
| `security` | 安全问题（建议引导到私下渠道） |
| `good first issue` | 适合新贡献者 |
| `documentation` | 文档修正 |

---

## 八、从本地到 GitHub

当前工作区里可能还有旧版本文件，第一次公开前建议确认一遍：

```bash
git status --short
```

确认没有 `data/`、`storage/`、`.env.local`、`node_modules/`、`.next/` 之后：

```bash
git add -A
git commit -m "Milktea Cloud 1.0.0"

# 如果当前分支叫 master，改成 main
git branch -M main

# 在 GitHub 新建一个空仓库，然后：
git remote add origin git@github.com:Milktea-Apple/Milktea-Cloud.git
git push -u origin main
```

如果使用 HTTPS，而不是 SSH：

```bash
git remote add origin https://github.com/Milktea-Apple/Milktea-Cloud.git
```

如果已经配置过 remote，用 `git remote set-url origin ...` 替换。

推送后：

1. 确认仓库是 Public
2. 检查 README 首屏截图是否正常
3. 创建 `v1.0.0` Release
4. 设置 About / Topics / Social preview
5. 把 B 站链接补回 README
6. 在 B 站简介里补上 GitHub 链接

---

## 九、Security Policy

仓库包含 `SECURITY.md`，说明了支持的版本、报告渠道、范围和不接受的事项。公开前请把里面的联系邮箱占位符替换成你自己的。
