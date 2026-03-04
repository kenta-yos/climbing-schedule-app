import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SplashHider } from "@/components/SplashHider";

export const metadata: Metadata = {
  title: "Go Bouldering",
  description: "ボルダリングジム管理・スケジュール共有アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Go Bouldering",
  },
  icons: {
    apple: "/icon-192.png",
    icon: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FF512F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        {/* スプラッシュスクリーン: JS読み込み前から表示、Reactマウント後にフェードアウト */}
        <div
          id="splash"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            transition: "opacity 0.4s ease-out",
          }}
        >
          <img
            src="/icon-512.png"
            alt=""
            width={160}
            height={160}
            style={{ borderRadius: 24 }}
          />
        </div>
        <SplashHider />
        {children}
      </body>
    </html>
  );
}
