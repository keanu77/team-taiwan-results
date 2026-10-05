import type { ReactNode } from "react";

// 本站自繪的線條圖示（inline SVG，離線可用）。刻意不仿官方亞運項目圖示。

export type MedalColor = "gold" | "silver" | "bronze";

// 金銀銅三色已用 dataviz 驗證腳本檢查淺、深兩種底色（對比 ≥ 3:1、色盲可辨）；
// 銀色低彩度是語意使然，旁邊一律有文字「金／銀／銅」，不單靠顏色。
export const MEDAL_HEX: Record<MedalColor, string> = { gold: "#B98004", silver: "#7E8CA0", bronze: "#C4531A" };
const MEDAL_LIGHT: Record<MedalColor, string> = { gold: "#FCD34D", silver: "#E2E8F0", bronze: "#FDBA74" };

export function MedalIcon({ medal, className = "h-3.5 w-3.5" }: { medal: MedalColor; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={`shrink-0 ${className}`}>
    <path d="M4.5 1h3l1.2 5.2L6.5 7zM11.5 1h-3l-1.2 5.2L9.5 7z" fill={MEDAL_HEX[medal]} opacity="0.75" />
    <circle cx="8" cy="10.2" r="4.8" fill={MEDAL_HEX[medal]} />
    <circle cx="8" cy="10.2" r="3" fill={MEDAL_LIGHT[medal]} />
  </svg>;
}

const SPORT_PATHS: Record<string, ReactNode> = {
  shuttle: <><path d="M9 17.5 5.5 4.5M15 17.5l3.5-13M12 17.5V3.5M5.5 4.5C7.5 3.8 9.8 3.5 12 3.5s4.5.3 6.5 1M7.3 11h9.4" /><path d="M9 17.5h6v1a3 3 0 0 1-6 0z" /></>,
  paddle: <><circle cx="10" cy="10" r="6" /><path d="m14.3 14.3 5.2 5.2" /><circle cx="19" cy="5" r="1.6" /></>,
  stitchBall: <><circle cx="12" cy="12" r="8" /><path d="M7.5 5.5c2 3 2 10 0 13M16.5 5.5c-2 3-2 10 0 13" /></>,
  basketball: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4v16M6.3 6.5c2.8 3 2.8 8 0 11M17.7 6.5c-2.8 3-2.8 8 0 11" /></>,
  football: <><circle cx="12" cy="12" r="8" /><path d="m12 8.5 3.2 2.3-1.2 3.8h-4l-1.2-3.8zM12 4v4.5M19.6 10l-4.4.8M16.7 18.3 14 14.6M7.3 18.3 10 14.6M4.4 10l4.4.8" /></>,
  volleyball: <><circle cx="12" cy="12" r="8" /><path d="M12 4c-1.2 4 0 7.5 3.5 9.5M20 12.5c-4-1.2-7.4 0-9.4 3.4M5.3 16.8c2.6-2.8 3-6.6 1.2-10" /></>,
  racket: <><ellipse cx="10" cy="9" rx="5" ry="6.2" transform="rotate(-45 10 9)" /><path d="m13.6 12.6 6.4 6.4M7 11.8l6-6M8.2 6 13.8 11.6" /></>,
  belt: <><path d="M3 10.5h18v3H3z" /><path d="M10 9.5h4v5h-4zM11 14.5 8.5 21M13 14.5l2.5 6.5" /></>,
  barbell: <><path d="M2.5 12h19M6 8v8M8.8 6.5v11M15.2 6.5v11M18 8v8" /></>,
  glove: <><path d="M7 12V8.5A4.5 4.5 0 0 1 11.5 4h2A4.5 4.5 0 0 1 18 8.5V13a4 4 0 0 1-4 4H9.5L7 14.5z" /><path d="M8.5 17v3h8v-3M11 9.5h4" /></>,
  stopwatch: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M10 2.5h4M12 2.5v4M18.2 7.3l1.6-1.6" /></>,
  target: <><circle cx="11" cy="13" r="7.5" /><circle cx="11" cy="13" r="4" /><circle cx="11" cy="13" r="0.8" /><path d="m11 13 9-9M17 4h3v3" /></>,
  crosshair: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.5" /><path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5" /></>,
  rings: <><path d="M8 2.5v6.5M16 2.5v6.5" /><circle cx="8" cy="13.5" r="4.2" /><circle cx="16" cy="13.5" r="4.2" /></>,
  swords: <><path d="m4 4 11.5 11.5M20 4 8.5 15.5M13.5 18.5l5-5M5.5 13.5l5 5M17 17l3 3M7 17l-3 3" /></>,
  waves: <><path d="M3 15.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 19.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" /><circle cx="15.5" cy="6.5" r="2" /><path d="m5 12 5-4.5 3.5 2.5" /></>,
  boat: <><path d="M2.5 15.5h19l-2.2 3.5H4.7z" /><path d="m6 3.5 11 12M16 16.5l2.5 2.5" /></>,
  versus: <><path d="M3 12h6.5M14.5 12H21M6 8.5 2.5 12 6 15.5M18 8.5l3.5 3.5-3.5 3.5M12 4v16" /></>,
  gamepad: <><rect x="2.5" y="7.5" width="19" height="10" rx="4.5" /><path d="M7.5 10.5v4M5.5 12.5h4" /><circle cx="15.8" cy="11.3" r="0.9" /><circle cx="18" cy="13.8" r="0.9" /></>,
  bicycle: <><circle cx="6" cy="16" r="3.8" /><circle cx="18" cy="16" r="3.8" /><path d="m6 16 4-7.5h5.5L18 16M10 8.5l2.5 7.5H6M13.5 5.5h2.5l-.5 3" /></>,
  hockey: <><path d="m8 3 4.5 13.5A3 3 0 0 0 15.3 18.5H20" /><circle cx="6.5" cy="18.5" r="2" /></>,
  skateboard: <><path d="M3 12.5h18M5 12.5c0 1.8 1 2.5 2.2 2.5h9.6c1.2 0 2.2-.7 2.2-2.5" /><circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></>,
  surfboard: <><path d="M12 2.5c3.4 4.5 3.9 12 0 19-3.9-7-3.4-14.5 0-19z" /><path d="M12 8v10" /></>,
  horseshoe: <><path d="M7 20.5V11a5 5 0 0 1 10 0v9.5M4.5 20.5h5M14.5 20.5h5M9.5 11h.01M14.5 11h.01" /></>,
  medal: <><path d="M8 2.5h3l1 5.5M16 2.5h-3l-1 5.5" /><circle cx="12" cy="14.5" r="6" /><circle cx="12" cy="14.5" r="2.5" /></>,
};

const DISCIPLINE_ICON: Record<string, string> = {
  BDM: "shuttle", TTE: "paddle", BBL: "stitchBall", SBL: "stitchBall", BK3: "basketball", BKB: "basketball",
  FBL: "football", VVO: "volleyball", TEN: "racket", TST: "racket",
  KTE: "belt", WSU: "belt", TKW: "belt", JUD: "belt", JJI: "belt", KUR: "belt", WRE: "belt",
  WLF: "barbell", BOX: "glove", MMA: "glove", ATH: "stopwatch", TRI: "stopwatch", ARC: "target", SHO: "crosshair",
  GAR: "rings", GRY: "rings", FEN: "swords", SWM: "waves", DIV: "waves", ROW: "boat", CSP: "boat", CSL: "boat", SAL: "boat",
  KAB: "versus", ELS: "gamepad", CRD: "bicycle", CTR: "bicycle", MTB: "bicycle", BMF: "bicycle", BMX: "bicycle",
  HOC: "hockey", SKB: "skateboard", SRF: "surfboard", EQU: "horseshoe",
};

/** 運動項目圖示；沒有對應圖示的項目用通用獎牌，永遠搭配文字標籤。 */
export function SportIcon({ discipline, className = "h-5 w-5" }: { discipline: string; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
    {SPORT_PATHS[DISCIPLINE_ICON[discipline] ?? "medal"]}
  </svg>;
}

export const SPORT_ICON_NAMES = Object.keys(SPORT_PATHS);
export const ICON_DISCIPLINES = Object.keys(DISCIPLINE_ICON);
