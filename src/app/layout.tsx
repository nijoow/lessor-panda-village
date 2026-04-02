import type { Metadata } from "next";
import { Jua, Geist_Mono } from "next/font/google";
import "./globals.css";

export const jua = Jua({
  variable: "--font-jua",
  subsets: ["latin"],
  weight: ["400"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lessor Panda Village | 래서판다 빌리지",
  description:
    "WebGL 기반의 귀여운 래서판다들이 모여 사는 온라인 마을입니다. 다른 사람들과 함께 마을을 산책하고 이야기를 나눠보세요.",
  icons: {
    icon: "/images/red_panda_icon.png",
    apple: "/images/red_panda_icon.png",
  },
  openGraph: {
    title: "Lessor Panda Village | 래서판다 빌리지",
    description:
      "WebGL 기반의 귀여운 래서판다들이 모여 사는 멀티플레이어 온라인 마을",
    url: "https://lessor-panda-village.vercel.app",
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
      className={`${jua.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${jua.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
