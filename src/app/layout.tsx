import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const jua = localFont({
  src: "../../public/fonts/Jua-Regular.ttf",
  variable: "--font-jua",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lessor-panda-village.vercel.app"),
  title: "래서판다 빌리지",
  description:
    "닉네임을 정하고 산책하며 다른 방문자가 남긴 쪽지를 읽는 작은 3D 마을.",
  icons: {
    icon: "/images/red_panda_icon.png",
    apple: "/images/red_panda_icon.png",
  },
  openGraph: {
    title: "래서판다 빌리지",
    description: "브라우저에서 산책하고 쪽지를 남기는 작은 3D 마을",
    url: "https://lessor-panda-village.vercel.app",
    siteName: "래서판다 빌리지",
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
    <html lang="ko" className={`${jua.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
