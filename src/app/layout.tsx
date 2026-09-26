import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smooo",
  description: "A chat app where you can't post your own words",
  appleWebApp: { capable: true, title: "Smooo", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#3f0e40",
  // 入力欄にフォーカスしても、iPhone が画面を拡大しないようにする
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
