"use client";

import { useId, useMemo, useState } from "react";
import { summarizeSport } from "@/lib/results/highlights";
import { groupResultSports } from "@/lib/results/sportGroups";
import type { TpeResultUnit } from "@/lib/results/types";
import { displayTpe } from "./resultDisplay";
import { SportIcon } from "./ResultIcons";
import { ResultRow } from "./ResultRow";
import { SportHighlights } from "./SportHighlights";
import { CONFIG } from "@/config";

const RUNNING = ["RUNNING", "LIVE", "IN_PROGRESS"];

export function ResultGroups({ units, autoExpand = false, expandFirst = false, period = false }: { units: TpeResultUnit[]; autoExpand?: boolean; expandFirst?: boolean; period?: boolean }) {
  const prefix = useId();
  const groups = useMemo(() => groupResultSports(units).map((group) => ({
    ...group,
    summary: summarizeSport(group.entries),
    sections: group.sections.map((section) => ({ ...section, summary: summarizeSport(section.entries) })),
  })), [units]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(autoExpand ? groups.map((group) => group.key) : expandFirst && groups.length ? [groups[0].key] : []));
  const allOpen = groups.every((group) => open.has(group.key));
  const anyOpen = groups.some((group) => open.has(group.key));
  const titleId = (key: string) => `${prefix}-${key}-title`;

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  /** 索引跳轉：展開該項目、捲到標題並把焦點移過去。 */
  function jumpTo(key: string) {
    setOpen((current) => new Set(current).add(key));
    window.requestAnimationFrame(() => {
      const target = document.getElementById(titleId(key))?.querySelector("button");
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
      target?.focus({ preventScroll: true });
    });
  }

  return (
    <div>
      {groups.length > 1 && <nav aria-label="運動項目快速跳轉" className="-mx-4 mb-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-2 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {groups.map(({ key, label, entries, summary }) => {
            const medals = summary.medals.gold + summary.medals.silver + summary.medals.bronze;
            const running = entries.some((unit) => RUNNING.includes(unit.status));
            return <li key={key} className="shrink-0">
              <button type="button" onClick={() => jumpTo(key)} className="relative flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200/80 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                {running && <span className="h-1.5 w-1.5 rounded-full bg-sky-500"><span className="sr-only">進行中</span></span>}
                <SportIcon discipline={entries[0]?.discipline ?? ""} className="h-4 w-4 text-brand-700" />
                {displayTpe(label)}
                <span className="text-xs tabular-nums text-gray-500">{entries.length}</span>
                {medals > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold tabular-nums text-amber-900">{medals} 牌</span>}
              </button>
            </li>;
          })}
        </ul>
      </nav>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-gray-500">{groups.length} 個運動項目 · 摘要依目前篩選 · {CONFIG.timeZoneLabel}時間</p>
        <div className="flex gap-1">
          <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-600 disabled:text-gray-400" disabled={allOpen} onClick={() => setOpen(new Set(groups.map((group) => group.key)))}>全部展開</button>
          <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-brand-600 disabled:text-gray-400" disabled={!anyOpen} onClick={() => setOpen(new Set())}>全部收合</button>
        </div>
      </div>
      <div className="space-y-3">
        {groups.map(({ key, label: sport, entries, sections, summary }) => {
          const expanded = open.has(key);
          const running = entries.filter((unit) => RUNNING.includes(unit.status)).length;
          const official = entries.filter((unit) => unit.status === "OFFICIAL").length;
          const panelId = `${prefix}-${key}`;
          return (
            <section key={key} aria-labelledby={titleId(key)} className="scroll-mt-4 overflow-hidden rounded-xl border border-blue-200/80 bg-white shadow-sm">
              <h2 id={titleId(key)} className="scroll-mt-4">
                <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(key)} className={`flex w-full min-w-0 items-center gap-3 border-l-4 px-3 py-3 text-left transition-colors hover:bg-blue-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:px-4 ${expanded ? "border-blue-600 bg-blue-100/70" : "border-blue-300 bg-blue-50"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="flex items-center gap-1.5 self-center font-semibold text-gray-900"><SportIcon discipline={entries[0]?.discipline ?? ""} className="h-5 w-5 text-brand-700" />{displayTpe(sport)}</span>
                      <span className="text-xs font-normal tabular-nums text-gray-500">{entries.length} 場／分項{official > 0 ? ` · 已完賽 ${official}` : ""}</span>
                      {running > 0 && <span className="text-xs font-semibold text-sky-900">進行中 {running}</span>}
                    </span>
                    <span className="mt-1.5 block text-sm font-normal">
                      <SportHighlights summary={summary} period={period} showStages={sections.length === 1} />
                    </span>
                  </span>
                  <svg className={`h-4 w-4 shrink-0 text-gray-500 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
                </button>
              </h2>
              <div id={panelId} hidden={!expanded} className="border-t border-blue-200/70 bg-white sm:px-1">
                {sections.map((category) => <section key={category.key} aria-labelledby={`${panelId}-${category.key}`}>
                  <div className="border-b border-blue-100 bg-slate-100/80 px-3 py-2 sm:px-4">
                    <h3 id={`${panelId}-${category.key}`} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                      {category.label}<span className="text-xs font-normal text-slate-500">{category.entries.length} 場／分項</span>
                    </h3>
                    {sections.length > 1 && <div className="mt-1 text-sm"><SportHighlights summary={category.summary} period={period} showStages /></div>}
                  </div>
                  {category.entries.map((unit) => <ResultRow key={unit.id} unit={unit} showDate={period} />)}
                </section>)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
