# 把 Milktea Cloud 开放到公网

> 适用：Windows 本机运行、项目默认监听 `127.0.0.1:3210`。  
> 目标：让外网用户通过 HTTPS 打开你的网盘，同时不把文件搬离这台电脑。

先选路线：

| 方案 | 需要公网 IP | 需要域名 | 成本 | 适合 |
| --- | --- | --- | --- | --- |
| **Cloudflare Tunnel** | 不需要 | 可选（正式用建议有） | 免费 | 最快、最省事，家用宽带首选 |
| 公网 IP + 端口映射 + Caddy | 需要 | 建议有 | 域名费用 | 有公网 IPv4 / IPv6，追求直连 |
| VPS + FRP + Nginx | VPS 有 | 需要 | VPS + 域名 | 国内访问更稳，或没有公网 IP |
| Tailscale / ZeroTier | 不需要 | 不需要 | 免费 | 只给家人朋友，不公开 |

本文重点写 **Cloudflare Tunnel**，后面附公网 IP 和 VPS + FRP 两种备选。

---

## 零、启动服务

如果还没跑起来：

```powershell
cd "D:\Trae_Projects\Milktea Cloud"
npm run build
npm run start
```

确认本机能打开：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3210/
```

返回 `200` 即可。

> 公网开放时请用 `npm run start`，不要用 `npm run dev`。开发模式更慢，也会暴露开发错误信息。

---

## 一、Cloudflare Tunnel（推荐）

优点：

- 不需要公网 IP，不需要在路由器上开端口
- Cloudflare 自动提供 HTTPS
- Windows 安装一个 `cloudflared` 就能用
- 免费套餐可用

缺点：

- 流量经过 Cloudflare，国内访问速度不稳定，先测试
- 免费版对**单次 HTTP 请求体**有 100 MB 限制（[Cloudflare 413 说明](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/)）
- 免费 Tunnel 不适合当公开大文件 CDN，量大请用 VPS 或对象存储

> 好消息：本项目上传是 **8 MiB 分片**，每个请求远小于 100 MB，所以大文件不会被这个限制卡住；不要把分片调大即可。下载是响应流，不受请求体限制。

### 1. 安装 cloudflared

```powershell
winget install --id Cloudflare.cloudflared -e
```

安装后重开一个 PowerShell，确认：

```powershell
cloudflared --version
```

如果提示找不到命令，用完整路径：

```powershell
& "C:\Program Files\cloudflared\cloudflared.exe" --version
```

### 2. 最快测试：临时公网地址

保持网盘在 3210 端口运行，另开一个 PowerShell：

```powershell
cloudflared tunnel --url http://127.0.0.1:3210
```

终端会输出类似：

```
https://random-words-1234.trycloudflare.com
```

把这个地址发到手机或另一台电脑，用无痕窗口打开。

注意事项：

- 这个地址是**临时的**，关掉终端就失效，重启后也会变
- 只适合测试，不适合长期分享
- 只要这个窗口开着，任何拿到地址的人都能访问；网盘本身仍然有登录
- 测试时如果不想被陌生人注册，先看下面「公开前的设置」

### 3. 正式使用：自定义域名 + 固定隧道

需要：

- 一个域名
- 域名已经接入 Cloudflare（在 Cloudflare 添加站点，按提示改 NS）
- 域名在 Cloudflare 里显示为 Active

#### 3.1 登录并创建隧道

```powershell
cloudflared tunnel login
cloudflared tunnel create milktea
```

`create` 会输出一个 UUID，例如：

```
Created tunnel milktea with id 12345678-abcd-1234-abcd-1234567890ab
```

同时会在 `C:\Users\<你的用户名>\.cloudflared\` 下生成：

```
12345678-abcd-1234-abcd-1234567890ab.json
cert.pem
```

#### 3.2 绑定域名

把 `cloud.example.com` 换成你自己的域名：

```powershell
cloudflared tunnel route dns milktea cloud.example.com
```

这一步会在 Cloudflare DNS 里创建一条 CNAME，指向隧道的 `cfargotunnel.com`。

#### 3.3 写配置文件

打开：

```powershell
notepad "$env:USERPROFILE\.cloudflared\config.yml"
```

写入（替换 UUID 和域名）：

```yaml
tunnel: 12345678-abcd-1234-abcd-1234567890ab
credentials-file: C:\Users\<你的用户名>\.cloudflared\12345678-abcd-1234-abcd-1234567890ab.json

ingress:
  - hostname: cloud.example.com
    service: http://127.0.0.1:3210
  - service: http_status:404
```

注意：

- `tunnel` 用 UUID，不要直接写隧道名
- `credentials-file` 路径用绝对路径
- 最后一条 `http_status:404` 必须有，用来兜底未匹配的域名

#### 3.4 前台跑通

```powershell
cloudflared tunnel run milktea
```

打开 `https://cloud.example.com`，应该能看到登录页。

- 登录、上传、下载、分享都测一遍
- 浏览器地址栏应该是 HTTPS
- 如果出现 502，检查 3210 是否在运行
- 如果出现 1033 / 无法连接，检查 `config.yml` 的 UUID、credentials 路径和 DNS

#### 3.5 长期运行

先确认前台能正常工作，再考虑开机自启。两种做法：

**A. 官方 Windows 服务（推荐先看官方说明）**

管理员 PowerShell：

```powershell
cloudflared service install
```

Windows 服务运行在系统账户下，可能读不到你用户目录里的 `config.yml`。如果服务启动失败，按 Cloudflare 的 [Windows 服务文档](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/) 把配置和 credentials 放到服务账户对应的 `.cloudflared` 目录。

**B. 任务计划程序**

- 触发器：登录时 / 启动时
- 操作：启动程序 `cloudflared.exe`
- 参数：`tunnel run milktea`
- 起始于：`C:\Users\<你的用户名>\.cloudflared`

这种方式会使用你的用户目录，配置路径问题少。

### 4. 可选：只让朋友访问（Cloudflare Access）

如果不想公开注册，只想让几个朋友用，可以在 Cloudflare Zero Trust 里给整个域名加 Access 策略（邮箱验证码 / Google 登录）。

注意：如果给整个站点加 Access，**公开分享链接也会被拦**。需要给下面这些路径设置 bypass：

```
/s/*
/api/share/*
```

否则朋友打开分享链接时，会先被要求登录 Cloudflare。这个方案适合“私人网盘”，不适合真正公开注册的网盘。

---

## 二、公开前的安全设置

### 1. 决定是否开放注册

当前默认：

```
ALLOW_REGISTRATION=true
```

也就是任何人都能注册。如果你要做“公开网盘”，保持开启；如果只是自己/朋友用，建议关闭。

在项目根目录新建 `.env.local`：

```env
# 关闭新用户注册；已有账号不受影响
ALLOW_REGISTRATION=false
```

改完重启应用：

```powershell
npm run start
```

> 如果当前服务是作为 Windows 服务 / 任务计划运行的，重启对应服务或任务。

### 2. 给公开注册设配额

公开注册 + 默认 100 GB/人，磁盘很快会被占满。建议降低：

```env
ALLOW_REGISTRATION=true
USER_QUOTA_BYTES=5368709120
MAX_FILE_BYTES=21474836480
```

上面是每人 5 GB、单文件 20 GB。按你的磁盘剩余空间调整。

### 3. 不要泄露这些目录

- `data/`：数据库、会话、分享索引
- `storage/`：文件实体
- `data/auth-secret`：签名密钥
- `.env.local`：环境变量

它们已经在 `.gitignore` 里，但**不要**把整个项目目录直接暴露成静态网站，也不要把这些目录放到 Nginx 的 `root` 下。

### 4. 确认 HTTPS 和登录

用无痕窗口检查：

- `https://你的域名` 能打开
- 登录后刷新页面，仍然保持登录
- 上传一个大于 100 MB 的文件（项目会按 8 MiB 分片，应该能完成）
- 分享链接在无痕窗口能打开
- 手机流量（不是同一个 Wi-Fi）能打开

### 5. Cloudflare 免费版的速度与合规

- 免费 Tunnel 的速度不保证，国内可能慢或断
- 不要拿免费 Tunnel 做公开视频站 / 大文件 CDN
- 如果访问量很大，改用 VPS + FRP，或把文件放对象存储
- 公开网盘请遵守所在地区法律法规，不要托管违法内容

---

## 三、备选：公网 IP + 端口映射 + Caddy

只有当你**确实有公网 IP** 时才适用。很多家庭宽带是 CGNAT，路由器 WAN 口 IP 和公网 IP 不一致，端口映射不会生效。

### 1. 检查是否有公网 IP

```powershell
(Invoke-RestMethod https://api.ipify.org)
```

把结果和路由器「WAN 口 IP / 外网 IP」对比：

- 一样：可能是公网 IPv4，可以尝试端口映射
- 不一样：大概率是 CGNAT，放弃端口映射，用 Tunnel / VPS
- 只有 IPv6：也可以做，但需要路由器防火墙放行，且对方也要有 IPv6

### 2. 固定局域网 IP

在路由器里给这台电脑绑定 DHCP 静态地址，例如 `192.168.1.50`。

### 3. Caddy 处理 HTTPS

下载 Caddy：

```powershell
winget install --id CaddyServer.Caddy -e
```

新建 `C:\caddy\Caddyfile`：

```caddyfile
cloud.example.com {
    reverse_proxy 127.0.0.1:3210 {
        header_up X-Forwarded-Proto {scheme}
    }
}
```

运行：

```powershell
cd C:\caddy
caddy run
```

Caddy 会自动申请 Let's Encrypt 证书，需要：

- 域名 A 记录指向你的公网 IP
- 路由器把 **80 和 443** 转发到这台电脑
- Windows 防火墙放行 80 / 443

防火墙命令（管理员 PowerShell）：

```powershell
New-NetFirewallRule -DisplayName "Milktea Cloud HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Milktea Cloud HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 4. 不要直接暴露 3210

不要把路由器 3210 端口直接映射到公网。HTTP 明文会让密码和 Cookie 裸奔。

正确链路：

```
公网 443 -> 路由器 -> 本机 Caddy -> 127.0.0.1:3210
```

### 5. 国内宽带注意

- 很多地区封锁入站 80 / 443
- 家宽公网 IPv4 通常需要申请，甚至无法申请
- 用域名对公网提供网站服务，可能涉及备案要求
- 动态 IP 需要 DDNS，IP 变了要更新解析

如果这些听起来麻烦，回到 Cloudflare Tunnel 或 VPS + FRP。

---

## 四、备选：VPS + FRP + Nginx

适合：

- 没有公网 IP
- Cloudflare Tunnel 在国内太慢
- 有一台带公网 IP 的 VPS

原理：文件仍然存在你的 Windows 电脑上，VPS 只做流量中转。

```
公网用户 -> VPS:443 (Nginx/Caddy) -> frps:7000 -> frpc -> 127.0.0.1:3210
```

代价：所有下载都经过 VPS，**速度上限变成 VPS 带宽**，并且消耗 VPS 流量。

### 1. VPS 安装 frps

以 Linux 为例，下载 frp 后配置 `frps.toml`：

```toml
bindPort = 7000

auth.method = "token"
auth.token = "change-this-token"

vhostHTTPPort = 8080
```

启动：

```bash
./frps -c frps.toml
```

VPS 防火墙放行 `7000`、`80`、`443`。

### 2. Windows 安装 frpc

下载 Windows 版 frp，配置 `frpc.toml`：

```toml
serverAddr = "你的VPS公网IP"
serverPort = 7000

auth.method = "token"
auth.token = "change-this-token"

[[proxies]]
name = "milktea"
type = "http"
localIP = "127.0.0.1"
localPort = 3210
customDomains = ["cloud.example.com"]
```

启动：

```powershell
.\frpc.exe -c .\frpc.toml
```

### 3. VPS 上用 Nginx 接 HTTPS

```nginx
server {
    listen 80;
    server_name cloud.example.com;

    client_max_body_size 0;
    proxy_request_buffering off;
    proxy_read_timeout 3600s;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection "";
    }
}
```

然后：

```bash
sudo certbot --nginx -d cloud.example.com
```

### 4. 注意

- VPS 只做中转，**数据仍然在 Windows 电脑**，电脑关机就下线
- VPS 带宽和流量是新的瓶颈
- 国内 VPS 对公网网站可能有备案要求
- frp 的 token 不要用示例值

---

## 五、长期开机

公网网盘的前提是这台电脑一直开着。

### 1. 关闭睡眠

管理员 PowerShell：

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

也可以：

- 设置 → 系统 → 电源 → 屏幕和睡眠 → 接通电源时「从不」
- 使用「高性能」电源计划

### 2. 让应用开机自启

最简单的方式：任务计划程序

- 触发器：登录时 / 启动时
- 操作：启动程序 `C:\Program Files\nodejs\npm.cmd`
- 参数：`run start`
- 起始于：`D:\Trae_Projects\Milktea Cloud`

或者用 NSSM 注册成服务：

```powershell
winget install --id NSSM.NSSM -e

nssm install MilkteaCloud "C:\Program Files\nodejs\npm.cmd" "run start"
nssm set MilkteaCloud AppDirectory "D:\Trae_Projects\Milktea Cloud"
nssm set MilkteaCloud AppEnvironmentExtra NODE_ENV=production
nssm start MilkteaCloud
```

> 默认服务以 SYSTEM 运行。如果 D 盘权限或路径有问题，在服务属性里改成你的用户账户。

### 3. 让隧道开机自启

见上文 Cloudflare 的「长期运行」：官方 Windows 服务，或任务计划程序。

### 4. 备份

至少每天备份一次：

- `data/`
- `storage/`
- `data/auth-secret`

可以拷到移动硬盘、NAS 或另一台电脑。没有备份的网盘，只是一块随时会坏的磁盘。

---

## 六、上线检查清单

- [ ] 本机 `http://127.0.0.1:3210` 正常
- [ ] 公网 HTTPS 地址能打开登录页
- [ ] 登录后刷新仍保持登录
- [ ] 上传大于 100 MB 的文件能完成
- [ ] 下载支持断点续传（`Accept-Ranges: bytes`）
- [ ] 分享链接在无痕窗口能打开
- [ ] 手机移动网络能访问
- [ ] 关闭或保留注册的决定已确定
- [ ] 配额已按磁盘容量调整
- [ ] 管理员密码足够强
- [ ] 数据备份已配置
- [ ] 电脑不会休眠
- [ ] 没有把 `data/`、`storage/`、`.env.local` 暴露出去

---

## 七、常见问题

### 打开域名出现 502

本机 3210 没运行，或 `config.yml` 里的 `service` 地址不对。先确认：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3210/
```

### 打开域名出现 1033

Cloudflare Tunnel 没连上，或 DNS 记录没指向隧道。检查：

```powershell
cloudflared tunnel list
cloudflared tunnel info milktea
```

### 上传大文件失败

- 确认使用的是 8 MiB 分片，不要改大
- 如果走 Cloudflare，单请求不要超过 100 MB
- 检查磁盘剩余空间
- 检查反向代理的 `client_max_body_size` 和 `proxy_request_buffering`

### 登录后立刻掉线

通常是 HTTPS 判断问题。确认反向代理传了：

```
X-Forwarded-Proto: https
```

Cloudflare Tunnel 和 Caddy 默认会处理；自己写 Nginx 时不要漏。

### 分享链接被 Cloudflare Access 拦了

给 `/s/*` 和 `/api/share/*` 加 bypass；或者不要把 Access 加在整个域名上。

### 能不能只让朋友用，不公开注册？

可以：

```env
ALLOW_REGISTRATION=false
```

已有账号仍能登录；新用户不能注册。也可以叠加 Cloudflare Access。

---

## 八、建议的起步顺序

1. **今天**：`cloudflared tunnel --url http://127.0.0.1:3210`，拿临时地址测试
2. **确认能用**：注册 / 登录 / 上传 / 下载 / 分享各测一遍
3. **要长期用**：接域名，创建命名隧道，开 HTTPS
4. **要公开**：决定注册策略，设置配额，配置备份
5. **要稳定**：把应用和隧道做成开机自启，关闭睡眠
6. **国内访问慢**：换 VPS + FRP，或只用公网 IP

如果你只是想把链接发给几个朋友，Cloudflare 临时隧道足够；如果你要做公开网盘，至少要把注册、配额、备份和滥用风险想清楚。
