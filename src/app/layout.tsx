import type { Metadata } from "next";
import "./globals.css";
import AuthLinkRouter from "@/components/auth-link-router";
export const metadata: Metadata = {
  title: "Reach Insight | PRリーチ分析",
  description:
    "インフルエンサーPR投稿の反応を、関心と属性から読み解く社内分析ツール。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body><AuthLinkRouter/>{children}</body>
    </html>
  );
}
