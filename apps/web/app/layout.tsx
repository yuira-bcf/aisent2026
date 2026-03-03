import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KyaraInnovate",
  description: "オーダーメイド香水プラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="bg-[#fafafa] text-black antialiased">{children}</body>
    </html>
  );
}
