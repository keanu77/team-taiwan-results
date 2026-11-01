import { CONFIG } from "@/config";
import type { ReactNode } from "react";

export function ResultsNavigation({ controls }: { controls?: ReactNode }) {
  return <header className="border-b border-gray-200 bg-white">
    <nav aria-label="賽果導覽" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <a href="../" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">← 所有賽事</a>
      <span className={`${controls ? "hidden sm:inline" : ""} text-base font-bold text-brand-950`}>{CONFIG.team.label}・{CONFIG.name}</span>
      <a href={`${CONFIG.source.webUrl}/`} target="_blank" rel="noopener noreferrer" className={`${controls ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-900`}>官方成績網站<span className="sr-only">（另開視窗）</span></a>
      {controls}
    </nav>
  </header>;
}
