import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/toast";
import { themeScript } from "@/lib/theme";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: {
    default: "Milktea Cloud — 一杯奶茶的时间，文件就到了",
    template: "%s · Milktea Cloud",
  },
  description:
    "Milktea Cloud 是一个自托管的公开网盘：每位成员拥有独立空间，文件保存在本机磁盘，下载不限速，支持断点续传、在线预览与提取码分享。",
  applicationName: "Milktea Cloud",
  authors: [{ name: "Milktea Cloud" }],
  openGraph: {
    title: "Milktea Cloud — 一杯奶茶的时间，文件就到了",
    description: "自托管、不限速、每人独立空间的网盘。",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#14100e" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
