import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeScript } from "@/components/reader/theme";
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
  title: "눈길 · EyeTracking PDF Reader",
  description: "웹캠 아이트래킹으로 읽는 부분을 따라가며 도와주는 PDF 리더",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // ThemeScript가 그리기 전에 dark 클래스를 붙이므로 서버 HTML과 달라질 수 있다.
      suppressHydrationWarning
    >
      <head>
        {/* 저장된 테마를 첫 화면 전에 적용해 다크 모드에서 밝게 깜빡이지 않게 한다. */}
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
