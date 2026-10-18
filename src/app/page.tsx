import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  Folder,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Lock,
  Server,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { CupArt } from "@/components/cup-art";
import { ThemeToggle } from "@/components/theme-toggle";
import { ALLOW_REGISTRATION } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { getPublicStats } from "@/lib/stats";
import { formatBytes } from "@/lib/shared";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [user, stats] = await Promise.all([getCurrentUser(), Promise.resolve(getPublicStats())]);
  const canRegister = ALLOW_REGISTRATION || stats.users === 0;
  const primaryHref = user ? "/drive" : canRegister ? "/login?mode=register" : "/login";
  const primaryLabel = user ? "打开我的网盘" : canRegister ? "免费创建空间" : "登录我的网盘";

  return (
    <div className="marketing">
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Brand href="/" size={40} />
          <nav className="marketing-links" aria-label="页面导航">
            <a href="#features">功能</a>
            <a href="#speed">关于不限速</a>
            <a href="#how">如何使用</a>
          </nav>
          <div className="marketing-nav-actions">
            <ThemeToggle />
            <Link href={user ? "/drive" : "/login"} className="nav-login">
              {user ? "我的网盘" : "登录"}
            </Link>
            <Link href={primaryHref} className="btn btn-primary btn-compact">
              {user ? "进入网盘" : "开始使用"}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                自托管 · 无广告 · 不限速
              </div>
              <h1>
                把文件，
                <br />
                放进一杯<span className="hero-underline">奶茶</span>里。
              </h1>
              <p className="hero-lead">
                Milktea Cloud 是一间属于这台电脑的网盘。每位成员都有独立的空间，
                文件直接落在本地磁盘，分享出去下载也不限速。
              </p>
              <div className="hero-cta">
                <Link href={primaryHref} className="btn btn-accent hero-btn">
                  {primaryLabel}
                  <ArrowRight size={17} />
                </Link>
                <Link href={user ? "/drive" : "/login"} className="btn btn-secondary hero-btn">
                  {user ? "查看我的文件" : "我已有账号"}
                </Link>
              </div>
              <div className="hero-trust">
                <span>
                  <Check size={13} /> 无需邮箱
                </span>
                <span>
                  <Check size={13} /> 注册即用
                </span>
                <span>
                  <Check size={13} /> 内容互不可见
                </span>
              </div>
              <div className="hero-stats">
                <div>
                  <strong>{stats.users}</strong>
                  <span>位成员</span>
                </div>
                <div>
                  <strong>{stats.files}</strong>
                  <span>个文件</span>
                </div>
                <div>
                  <strong>{formatBytes(stats.bytes)}</strong>
                  <span>已托管</span>
                </div>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-halo hero-halo-one" />
              <div className="hero-halo hero-halo-two" />
              <span className="hero-pearl hp1" />
              <span className="hero-pearl hp2" />
              <span className="hero-pearl hp3" />
              <span className="hero-pearl hp4" />
              <CupArt className="hero-cup" />

              <div className="float-card float-files">
                <div className="mini-window-head">
                  <span className="mini-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>我的空间</span>
                  <span className="mini-live">
                    <i /> 已同步
                  </span>
                </div>
                <div className="mini-file">
                  <span className="mini-icon tone-amber">
                    <Folder size={15} />
                  </span>
                  <div>
                    <strong>灵感收集</strong>
                    <span>12 个项目</span>
                  </div>
                  <span className="mini-size">84 MB</span>
                </div>
                <div className="mini-file">
                  <span className="mini-icon tone-mint">
                    <ImageIcon size={15} />
                  </span>
                  <div>
                    <strong>海边日落.jpg</strong>
                    <span>2 分钟前</span>
                  </div>
                  <span className="mini-size">4.2 MB</span>
                </div>
                <div className="mini-file">
                  <span className="mini-icon tone-sky">
                    <Download size={15} />
                  </span>
                  <div>
                    <strong>设计稿-v3.fig</strong>
                    <span>刚刚上传</span>
                  </div>
                  <span className="mini-size">128 MB</span>
                </div>
                <div className="mini-progress">
                  <div>
                    <span>正在上传 2 个文件</span>
                    <strong>82%</strong>
                  </div>
                  <div className="mini-progress-bar">
                    <i style={{ width: "82%" }} />
                  </div>
                </div>
              </div>

              <div className="float-card float-speed">
                <div className="float-speed-head">
                  <span className="speed-dot" />
                  下载不限速
                </div>
                <strong>
                  128.6 <small>MB/s</small>
                </strong>
                <div className="spark-bars">
                  {[18, 28, 22, 38, 34, 48, 42, 56, 50, 62, 58, 72].map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>

              <div className="float-note">
                <span className="float-note-icon">
                  <Lock size={13} />
                </span>
                <span>
                  <strong>仅你可见</strong>
                  <small>账号之间完全隔离</small>
                </span>
              </div>
            </div>
          </div>

          <div className="trust-strip">
            <span>
              <Gauge size={15} /> 磁盘直连，不限速
            </span>
            <i />
            <span>
              <ShieldCheck size={15} /> 独立空间，互不可见
            </span>
            <i />
            <span>
              <UploadCloud size={15} /> 断点续传
            </span>
            <i />
            <span>
              <Link2 size={15} /> 链接 / 提取码分享
            </span>
            <i />
            <span>
              <Server size={15} /> 全部存在本机
            </span>
          </div>
        </section>

        <section className="section features" id="features">
          <div className="section-head">
            <p className="eyebrow">Why Milktea</p>
            <h2>把复杂留给自己，<br className="desktop-break" />把简单留给你。</h2>
            <p>
              没有会员等级，没有下载队列，也没有“开通超级会员以继续”。
              Milktea Cloud 只做一件事：让文件从你的磁盘，稳稳地到对方手里。
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-wide">
              <div className="feature-icon">
                <Gauge size={21} />
              </div>
              <div className="feature-copy">
                <h3>不限速，因为服务器是自己的</h3>
                <p>
                  文件从磁盘直接流出，完整支持 HTTP Range。断点续传、拖动进度条、
                  IDM / aria2 多线程下载，都能跑满这台机器的带宽。
                </p>
                <div className="feature-tags">
                  <span>Range 请求</span>
                  <span>多线程下载</span>
                  <span>无等待队列</span>
                </div>
              </div>
              <div className="feature-visual speed-lines" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">
                <Users size={21} />
              </div>
              <h3>每个人，一间独立的房间</h3>
              <p>
                公开注册，但彼此的网盘完全隔离。你的文件、搜索、分享链接，
                别的账号一个都看不到。
              </p>
              <div className="feature-avatars" aria-hidden="true">
                <span className="avatar">麦</span>
                <span className="avatar">茶</span>
                <span className="avatar">M</span>
                <span className="avatar avatar-more">+</span>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">
                <KeyRound size={21} />
              </div>
              <h3>分享，有分寸</h3>
              <p>
                一条链接、一枚提取码、一个有效期。分享出去的文件同样不限速，
                也能在线预览。
              </p>
              <div className="feature-pill" aria-hidden="true">
                <Lock size={13} />
                <span>milktea.cloud/s/</span>
                <strong>k7m2x9</strong>
                <span className="pill-code">提取码 4821</span>
              </div>
            </article>

            <article className="feature-card">
              <div className="feature-icon">
                <HardDrive size={21} />
              </div>
              <h3>数据，留在本机</h3>
              <p>
                文件实体和 SQLite 索引都保存在这台电脑上。
                不经过第三方对象存储，也没有偷偷上传的统计脚本。
              </p>
              <div className="feature-local" aria-hidden="true">
                <Server size={14} />
                <span>D:\Milktea Cloud\storage</span>
                <em>本机</em>
              </div>
            </article>

            <article className="feature-card feature-wide">
              <div className="feature-icon">
                <Sparkles size={21} />
              </div>
              <div className="feature-copy">
                <h3>打开就能看，不用先下载</h3>
                <p>
                  图片、视频、音频、PDF、Markdown、代码和表格都能直接预览。
                  超大日志只取前 2 MB，打开 4 GB 的文本也不会卡死浏览器。
                </p>
                <div className="feature-tags">
                  <span>图片 · 视频 · 音频</span>
                  <span>PDF · Markdown</span>
                  <span>代码 · CSV · JSON</span>
                </div>
              </div>
              <div className="feature-visual preview-stack" aria-hidden="true">
                <div className="preview-mini">
                  <span className="preview-mini-top" />
                  <span className="preview-mini-line w80" />
                  <span className="preview-mini-line w60" />
                  <span className="preview-mini-line w70" />
                  <span className="preview-mini-block" />
                </div>
                <span className="preview-play">
                  <Zap size={16} />
                </span>
              </div>
            </article>
          </div>
        </section>

        <section className="section speed-section" id="speed">
          <div className="speed-inner">
            <div className="speed-copy">
              <p className="eyebrow">About speed</p>
              <h2>不限速，不是魔法。</h2>
              <p>
                它只是把“带宽成本”这件老实的事摆回台面上：服务器是你自己的，
                就没有人需要为你的流量收费，自然也没有限速的理由。
              </p>
              <ul className="check-list">
                <li>
                  <span>
                    <Check size={12} />
                  </span>
                  直连本地磁盘，不经过任何中转或压缩
                </li>
                <li>
                  <span>
                    <Check size={12} />
                  </span>
                  支持 Range，中断后可以接着下载
                </li>
                <li>
                  <span>
                    <Check size={12} />
                  </span>
                  分享链接与登录下载，速度一样
                </li>
              </ul>
              <p className="speed-honest">
                诚实地说：速度上限仍然取决于这台电脑的上行带宽，
                以及它是否一直开着。没有广告，没有套路，仅此而已。
              </p>
            </div>
            <div className="speed-demo">
              <div className="speed-demo-head">
                <span>同一份 2 GB 文件</span>
                <span className="live-badge">
                  <i /> 实时
                </span>
              </div>
              <div className="speed-row muted-row">
                <div className="speed-row-top">
                  <span>某些网盘的免费队列</span>
                  <strong>120 KB/s</strong>
                </div>
                <div className="speed-track">
                  <i style={{ width: "5%" }} />
                </div>
                <span className="speed-caption">预计还需 4 小时 43 分</span>
              </div>
              <div className="speed-row active-row">
                <div className="speed-row-top">
                  <span>
                    <span className="mini-cup" /> Milktea Cloud
                  </span>
                  <strong>112.4 MB/s</strong>
                </div>
                <div className="speed-track">
                  <i style={{ width: "92%" }} />
                </div>
                <span className="speed-caption">预计 18 秒完成 · 不限速</span>
              </div>
              <div className="speed-demo-foot">
                <Zap size={13} />
                速度只受本机上行带宽与网络环境影响
              </div>
            </div>
          </div>
        </section>

        <section className="section how-section" id="how">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>三步，把文件放好。</h2>
          </div>
          <div className="how-grid">
            <article>
              <span className="how-num">01</span>
              <div className="how-icon">
                <Users size={20} />
              </div>
              <h3>创建你的空间</h3>
              <p>注册一个用户名，第一个账号会自动成为这台网盘的站长。之后的每位成员都会得到属于自己的独立空间。</p>
            </article>
            <article>
              <span className="how-num">02</span>
              <div className="how-icon">
                <UploadCloud size={20} />
              </div>
              <h3>把文件拖进来</h3>
              <p>分片上传、断点续传，大文件也能稳稳落盘。文件夹、搜索、回收站，日常需要的都在。</p>
            </article>
            <article>
              <span className="how-num">03</span>
              <div className="how-icon">
                <Link2 size={20} />
              </div>
              <h3>把链接递出去</h3>
              <p>生成一条公开链接，可选提取码和有效期。对方打开就能预览、下载，速度和你一样。</p>
            </article>
          </div>
          <div className="how-cta">
            <div className="how-cta-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <h3>现在，给自己倒一杯。</h3>
              <p>不需要信用卡，不需要邮箱。用户名和密码，就够了。</p>
            </div>
            <Link href={primaryHref} className="btn btn-accent">
              {primaryLabel}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Brand href="/" size={34} />
            <p>
              一杯温热的、自托管的网盘。
              <br />
              数据留在这台电脑上，速度交还给你的带宽。
            </p>
          </div>
          <div className="footer-links">
            <div>
              <strong>产品</strong>
              <a href="#features">功能</a>
              <a href="#speed">不限速说明</a>
              <Link href={primaryHref}>开始使用</Link>
            </div>
            <div>
              <strong>账号</strong>
              <Link href="/login">登录</Link>
              <Link href="/login?mode=register">注册</Link>
              <Link href="/settings">设置</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Milktea Cloud</span>
          <span>自托管 · 无广告 · 数据留在本机</span>
        </div>
      </footer>
    </div>
  );
}
