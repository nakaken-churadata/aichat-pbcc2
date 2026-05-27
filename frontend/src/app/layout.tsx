import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "社内 AI チャット",
  description: "churadata.okinawa 社内向け Gemini AI チャットアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased dark:bg-gray-900 dark:text-white">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
