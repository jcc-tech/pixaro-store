import type { Metadata } from "next";
import "./globals.css";
import RoleFeedback from "./RoleFeedback";

export const metadata: Metadata = {
  title: "Pixaro 遊戲商城",
  description: "瀏覽遊戲商品與售價，前往 Pixaro Discord 詢價下單。",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body><RoleFeedback/>{children}</body></html>;
}
