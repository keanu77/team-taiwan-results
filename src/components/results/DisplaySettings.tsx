"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_PREFS, DISPLAY_PREFS_KEY, FONT_SCALES, parseDisplayPrefs, resolveDark, SCALE_PERCENT, stepScale,
  type DisplayPrefs,
} from "./displayPrefs";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(): DisplayPrefs {
  try { return parseDisplayPrefs(window.localStorage.getItem(DISPLAY_PREFS_KEY)); } catch { return DEFAULT_PREFS; }
}

function applyToDocument(prefs: DisplayPrefs, systemDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(prefs.theme, systemDark));
  if (prefs.scale === "md") root.removeAttribute("data-font-scale");
  else root.setAttribute("data-font-scale", prefs.scale);
}

function SunIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
}

/** 右上角顯示設定：字級縮放與夜間模式，離開賽果頁時還原，不影響其他頁面。手機版收成一顆按鈕。 */
export function DisplaySettings() {
  const [prefs, setPrefs] = useState<DisplayPrefs | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    setSystemDark(media.matches);
    setPrefs(readStored());
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      document.documentElement.classList.remove("dark");
      document.documentElement.removeAttribute("data-font-scale");
    };
  }, []);

  useEffect(() => { if (prefs) applyToDocument(prefs, systemDark); }, [prefs, systemDark]);

  function update(next: DisplayPrefs) {
    setPrefs(next);
    try { window.localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(next)); } catch { /* 無痕或封鎖儲存時僅本次有效 */ }
  }

  const current = prefs ?? DEFAULT_PREFS;
  const dark = resolveDark(current.theme, systemDark);
  const index = FONT_SCALES.indexOf(current.scale);
  const button = "flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2 font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600";

  return <div ref={rootRef} className="relative shrink-0">
    <button type="button" className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 sm:hidden" aria-expanded={menuOpen} aria-controls={panelId} aria-label="顯示設定（字級與夜間模式）" onClick={() => setMenuOpen((open) => !open)}>
      <span aria-hidden="true">Aa</span>{dark ? <MoonIcon /> : <SunIcon />}
    </button>
    <div id={panelId} role="group" aria-label="顯示設定" className={`${menuOpen ? "flex" : "hidden"} absolute right-0 top-full z-30 mt-2 w-max items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:static sm:mt-0 sm:flex`}>
    <button type="button" className={`${button} text-sm`} onClick={() => update({ ...current, scale: stepScale(current.scale, -1) })} disabled={index === 0} aria-label="縮小字級">A−</button>
    <button type="button" className="min-h-11 min-w-14 rounded-lg px-1 text-xs tabular-nums text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600" onClick={() => update({ ...current, scale: "md" })} aria-label={`目前字級 ${SCALE_PERCENT[current.scale]}%，按此還原預設`} title="還原預設字級">{SCALE_PERCENT[current.scale]}%</button>
    <button type="button" className={`${button} text-lg`} onClick={() => update({ ...current, scale: stepScale(current.scale, 1) })} disabled={index === FONT_SCALES.length - 1} aria-label="放大字級">A＋</button>
    <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-gray-200" />
    <button type="button" className={button} onClick={() => update({ ...current, theme: dark ? "light" : "dark" })} aria-pressed={dark} aria-label="夜間模式" title={dark ? "切換為日間模式" : "切換為夜間模式"}>{dark ? <SunIcon /> : <MoonIcon />}</button>
    </div>
  </div>;
}
