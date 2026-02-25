import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMIS - 프로젝트 관리 시스템",
  description: "건설 프로젝트 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
