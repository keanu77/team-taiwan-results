import { resultCategory } from "@/lib/results/categories";
import { countryName, isCountryTeamName } from "@/lib/results/countries";
import { eventNameZh, unitLabelZh } from "@/lib/results/eventNames";
import { competitorHighlights, stageLabel } from "@/lib/results/highlights";
import { resultSport } from "@/lib/results/sportGroups";
import type { TpeResultUnit } from "@/lib/results/types";
import { AthleteName } from "./AthleteName";
import { ResultBadge } from "./ResultBadge";
import { ResultDetails } from "./ResultDetails";
import { displayTpe, formatResultTime, resultStatusClass } from "./resultDisplay";
import { TEAM } from "@/lib/results/team";

/** Keep names and scores together; secondary information stays behind native disclosure. */
export function ResultRow({ unit, showSport = false, showDate = false }: { unit: TpeResultUnit; showSport?: boolean; showDate?: boolean }) {
  const follows = /FOLLOW(?:ED)?\s*BY|接續前場/i.test(unit.timeNote);
  const time = follows ? "接續前場" : unit.startsAt ? formatResultTime(unit.startsAt).split(" ").pop() : "時間待定";
  const phase = [...new Set([stageLabel(unit), unit.unit].map((label) => unitLabelZh(label, unit.event)).filter(Boolean))].join(" · ");
  const eventZh = eventNameZh(unit.event);
  const visible = [...unit.competitors]
    .sort((a, b) => Number(b.organisation === TEAM) - Number(a.organisation === TEAM))
    .slice(0, 2);
  const sport = resultSport(unit);
  const category = resultCategory(unit);
  const sportLabel = [sport.label, sport.detail, sport.label.includes(category.label) ? "" : category.label].filter(Boolean).join(" · ");

  return (
    <details className="group/match min-w-0 border-b border-gray-200 last:border-b-0 open:bg-slate-50">
      <summary className="relative list-none cursor-pointer bg-white px-3 py-3 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className={`grid min-w-0 gap-2 ${showSport ? "" : "md:grid-cols-[5.5rem_minmax(8rem,0.7fr)_minmax(0,1.3fr)] md:items-center md:gap-4 md:pr-6"}`}>
          <span className={`flex min-w-0 flex-wrap items-center gap-2 pr-7 text-xs ${showSport ? "" : "md:flex-col md:items-start md:pr-0"}`}>
            {showDate && unit.scheduleDate && <span className="font-semibold tabular-nums text-brand-700">{unit.scheduleDate.slice(5).replace("-", "/")}</span>}
            <span className="font-mono text-sm font-semibold tabular-nums text-gray-700">{time}{unit.timeNote === "預估時間" ? "（預估）" : ""}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${resultStatusClass(unit.status)}`}>{displayTpe(unit.statusLabel)}</span>
          </span>
          <span className="block min-w-0">
            {showSport && <span className="mb-1 block text-xs font-semibold text-brand-700">{displayTpe(sportLabel)}</span>}
            <span className="block text-sm font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]" lang={eventZh ? "zh-Hant" : "en"}>{eventZh ?? displayTpe(unit.event || unit.unit || "項目待確認")}</span>
            {phase && <span className="mt-1 block text-xs leading-snug text-gray-500 [overflow-wrap:anywhere]">{displayTpe(phase)}</span>}
            {eventZh && <span className="mt-0.5 block text-[11px] leading-snug text-gray-400 [overflow-wrap:anywhere]" lang="en">{unit.event}</span>}
          </span>
          <span className="block w-full min-w-0 max-w-lg">
            <span className="grid min-w-0 gap-1">
              {visible.map((competitor, index) => (
                <span key={`${competitor.id}-${index}`} className={`flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm ${competitor.organisation === TEAM ? "bg-blue-50 ring-1 ring-inset ring-blue-100" : "bg-slate-50"}`}>
                  {competitor.organisation === TEAM && !isCountryTeamName(competitor.name, competitor.organisation) && <span className="w-7 shrink-0 text-[10px] font-bold text-blue-800">{TEAM}</span>}
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {competitor.organisation !== TEAM && !isCountryTeamName(competitor.name, competitor.organisation) && <span className="mb-0.5 block text-[11px] font-medium text-gray-500">{countryName(competitor.organisation)}</span>}
                    <AthleteName competitor={competitor} discipline={unit.discipline} compact />
                  </span>
                  <span className="flex max-w-[35%] shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
                    <span className="max-w-full font-mono text-base font-bold tabular-nums text-brand-950 [overflow-wrap:anywhere]">{competitor.result || (competitor.irm && competitor.irm !== "OK" ? competitor.irm : "—")}</span>
                    {competitorHighlights(unit, competitor).map((badge) => <ResultBadge key={badge.tone} {...badge} />)}
                  </span>
                </span>
              ))}
              {visible.length === 0 && <span className="text-xs text-gray-500">參賽名單待公布</span>}
            </span>
            {unit.competitors.length > visible.length && <span className="mt-1 block text-xs text-gray-500">另 {unit.competitors.length - visible.length} 位參賽者，展開查看</span>}
          </span>
          <span className={`absolute right-3 top-3.5 text-gray-500 sm:right-4 ${showSport ? "" : "md:top-1/2 md:-translate-y-1/2"}`}>
            <svg className="h-4 w-4 transition-transform group-open/match:rotate-180 motion-reduce:transition-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
          </span>
          <span className="sr-only">查看此場次詳細資料</span>
        </span>
      </summary>
      <ResultDetails unit={unit} />
    </details>
  );
}
