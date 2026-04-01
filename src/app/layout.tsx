import type { Metadata } from "next";
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
  title: "Lessor Panda Village | 래서판다 빌리지",
  description: "WebGL 기반의 귀여운 래서판다들이 모여 사는 온라인 마을입니다. 다른 사람들과 함께 마을을 산책하고 이야기를 나눠보세요.",
  icons: {
    icon: "/images/red_panda_icon.png",
    apple: "/images/red_panda_icon.png",
  },
  openGraph: {
    title: "Lessor Panda Village | 래서판다 빌리지",
    description: "WebGL 기반의 귀여운 래서판다들이 모여 사는 멀티플레이어 온라인 마을",
    url: "https://lessor-panda-village.vercel.app", // 수정 필요 시 변경
    siteName: "Lessor Panda Village",
    images: [
      {
        url: "/images/red_panda_icon.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
