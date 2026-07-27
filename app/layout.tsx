import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "并购风云 — Acquire 网页版",
  description: "经典地产投资桌游并购风云 (Acquire) 网页版，在线联机对战",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-800 flex flex-col">
        {children}
      </body>
    </html>
  );
}
