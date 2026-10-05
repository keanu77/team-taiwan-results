// 公開賽果頁的顯示偏好（夜間模式、字級），只存在瀏覽者自己的 localStorage。
export const DISPLAY_PREFS_KEY = "results-display-prefs";
export const FONT_SCALES = ["sm", "md", "lg", "xl", "xxl"] as const;
export type FontScale = (typeof FONT_SCALES)[number];
export type ThemeChoice = "light" | "dark" | null;

export interface DisplayPrefs { theme: ThemeChoice; scale: FontScale }

export const DEFAULT_PREFS: DisplayPrefs = { theme: null, scale: "md" };
export const SCALE_PERCENT: Record<FontScale, number> = { sm: 87.5, md: 100, lg: 112.5, xl: 125, xxl: 137.5 };

export function parseDisplayPrefs(raw: string | null): DisplayPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return DEFAULT_PREFS;
    const { theme, scale } = value as Record<string, unknown>;
    return {
      theme: theme === "light" || theme === "dark" ? theme : null,
      scale: FONT_SCALES.includes(scale as FontScale) ? scale as FontScale : "md",
    };
  } catch { return DEFAULT_PREFS; }
}

export function stepScale(scale: FontScale, step: 1 | -1): FontScale {
  const index = Math.min(FONT_SCALES.length - 1, Math.max(0, FONT_SCALES.indexOf(scale) + step));
  return FONT_SCALES[index];
}

/** 未明確選擇時跟隨系統深淺色。 */
export function resolveDark(theme: ThemeChoice, systemDark: boolean): boolean {
  return theme === null ? systemDark : theme === "dark";
}

/** 首次繪製前套用偏好，避免夜間模式閃白。整個網站只有賽果頁，所以全站套用。 */
export const DISPLAY_PREPAINT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(DISPLAY_PREFS_KEY)})||"{}");var d=p.theme==="dark"||(p.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;if(d)h.classList.add("dark");if(${JSON.stringify(FONT_SCALES.filter((s) => s !== "md"))}.indexOf(p.scale)>=0)h.setAttribute("data-font-scale",p.scale);}catch(e){}})();`;
