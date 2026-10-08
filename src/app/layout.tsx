import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./globals.css";
import { DISPLAY_PREPAINT_SCRIPT } from "@/components/results/displayPrefs";
import { CONFIG } from "@/config";

export const metadata: Metadata = {
  title: `${CONFIG.team.noc} 賽程與賽果｜${CONFIG.name}`,
  description: `${CONFIG.name} ${CONFIG.team.label}賽程、賽果與獎牌，定時同步官方成績系統。`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        {/* 夜間模式／字級需在首次繪製前套用，避免閃白 */}
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_PREPAINT_SCRIPT }} />
      </head>
      <body className="antialiased min-h-screen bg-gray-50 font-sans dark:bg-night-canvas">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none">跳到主要內容</a>
        {children}
      </body>
    </html>
  );
}
