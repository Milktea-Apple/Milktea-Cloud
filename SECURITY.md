# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

**请不要在公开 Issue 里贴出利用细节。**

推荐通过 GitHub 的 **Private vulnerability reporting / Security Advisory** 提交：

```
https://github.com/Milktea-Apple/Milktea-Cloud/security/advisories/new
```

如果该功能尚未开启，请先发一个**不包含利用细节**的 Issue，说明“有安全问题需要私下联系”，维护者会回复你。

邮件里尽量包含：

- 受影响版本或 commit
- 复现步骤
- 影响范围（例如：跨账号读取、认证绕过、XSS、路径穿越、分享解锁绕过）
- 你认为的严重程度
- 如果可以，附一个最小复现

我会在看到后尽快确认。修复完成后，会在 Release notes 或 Security Advisory 中说明，并感谢报告者（如果你愿意署名）。

## 范围

以下问题属于安全范围：

- 认证 / 会话绕过
- 跨账号访问文件、搜索、分享、回收站
- 路径穿越、任意文件读写
- 存储型 / 反射型 XSS
- 分享提取码或解锁 Cookie 绕过
- CSRF（会改变状态或泄露数据）
- 上传分片 / 合并逻辑导致的任意文件写入
- 下载响应头导致的内容嗅探或脚本执行

以下通常不属于安全范围：

- 你自己把 `data/`、`storage/`、`.env.local` 或 `auth-secret` 泄露出去
- 你自己的反向代理、TLS、防火墙配置错误
- 公开注册被滥用、磁盘被占满（这是运营配置问题）
- 本机磁盘或备份被拿走（项目不做静态加密，见 README 的安全模型）
- 上游带宽不足导致的慢
- 浏览器不支持某种视频编码
- 依赖包的已知问题（请同时报告给上游）

## 安全模型

Milktea Cloud 的核心假设是：

1. 服务端进程和磁盘是可信的
2. 每个账号只应访问自己的文件
3. 公开分享只暴露被分享的那一个文件
4. 不依赖前端隐藏来实现隔离

它**不做静态加密**。如果攻击者拿到了磁盘、备份或云主机快照，文件内容、文件名和账号信息都是可读的。请使用 BitLocker / LUKS / 云厂商加密盘。

## 公开部署提醒

- 默认开放注册；不想让人注册就设置 `ALLOW_REGISTRATION=false`
- 公开注册会消耗磁盘和带宽，请自行设置配额或关闭注册
- 使用 HTTPS；Cookie 的 `Secure` 标志依赖反向代理传 `X-Forwarded-Proto`
- 不要把 `data/`、`storage/` 暴露成静态目录
- 定期备份，并测试恢复
- 不要托管违法内容
