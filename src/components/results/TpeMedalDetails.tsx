"use client";

import { useMemo, useState } from "react";
import {
  groupMedalsByDate, groupMedalsBySport, MEDAL_ORDER, medalTally, sortedByMedal, tpeMedalKey,
  TPE_MEDAL_LIST_SOURCE, TPE_MEDAL_LIST_UPDATED,
  type MedalColor, type MedalTally, type TpeMedal,
} from "@/lib/results/tpeMedalList";
import { MEDAL_HEX } from "./ResultIcons";
import { CONFIG } from "@/config";
import { TEAM } from "@/lib/results/team";

type View = "medal" | "date" | "sport";

const VIEWS: readonly [View, string][] = [["medal", "依獎牌"], ["date", "依日期"], ["sport", "依種類"]];
const MEDAL_STYLE: Record<MedalColor, readonly [string, string]> = {
  gold: ["金", "bg-amber-400 text-[#451a03]"],
  silver: ["銀", "bg-slate-300 text-[#0f172a]"],
  bronze: ["銅", "bg-orange-500 text-white"],
};
const WEEKDAYS = "日一二三四五六";

export function shortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${month}/${day}（${WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}）`;
}

// Node 與瀏覽器的 ICU 可能輸出不同寬度的空白；統一避免 hydration 不一致。
const UPDATED_LABEL = new Intl.DateTimeFormat("zh-TW", { timeZone: CONFIG.viewerTimeZone, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(TPE_MEDAL_LIST_UPDATED)).replace(/\s+/g, " ");

function TallyText({ tally }: { tally: MedalTally }) {
  const parts = ([["gold", tally.gold], ["silver", tally.silver], ["bronze", tally.bronze]] as const).filter(([, count]) => count > 0);
  return <span className="flex flex-wrap items-center gap-1.5 text-sm font-normal">{parts.map(([medal, count]) => <span key={medal} className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${MEDAL_STYLE[medal][1]}`}>{count} {MEDAL_STYLE[medal][0]}</span>)}</span>;
}

/** 每日得牌：一面一格，flex-col-reverse 讓金牌貼底、往上依序銀、銅；每欄有總數與完整文字說明，下方清單即表格檢視。 */
function MedalDayChart({ groups }: { groups: { key: string; label: string; tally: MedalTally }[] }) {
  const max = Math.max(1, ...groups.map((group) => group.tally.total));
  const describe = (group: { label: string; tally: MedalTally }) => `${group.label}：${([["gold", "金"], ["silver", "銀"], ["bronze", "銅"]] as const).filter(([medal]) => group.tally[medal]).map(([medal, label]) => `${label} ${group.tally[medal]}`).join("、")}，共 ${group.tally.total} 面`;
  return <figure className="mb-4 rounded-xl border border-gray-200 bg-white px-3 py-3 sm:px-4">
    <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-semibold text-gray-900">每日得牌</span>
      <span className="flex items-center gap-3 text-xs text-gray-600">{(["gold", "silver", "bronze"] as const).map((medal) => <span key={medal} className="flex items-center gap-1"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MEDAL_HEX[medal] }} />{MEDAL_STYLE[medal][0]}</span>)}</span>
    </figcaption>
    <ul className="flex items-end gap-1.5 sm:gap-3">
      {groups.map((group) => <li key={group.key} className="flex min-w-0 flex-1 flex-col items-center" title={describe(group)}>
        <span className="sr-only">{describe(group)}</span>
        <span aria-hidden="true" className="flex w-full flex-col items-center justify-end" style={{ height: `${max * 14 + 20}px` }}>
        <span className="mb-1 text-xs font-semibold tabular-nums text-gray-700">{group.tally.total}</span>
        <span className="flex w-full max-w-10 flex-col-reverse gap-[2px]">
          {MEDAL_ORDER.flatMap((medal) => Array.from({ length: group.tally[medal] }, (_, index) => <span key={`${medal}-${index}`} className="block h-3 rounded-[3px]" style={{ backgroundColor: MEDAL_HEX[medal] }} />))}
        </span>
        </span>
        <span aria-hidden="true" className="mt-1.5 whitespace-nowrap text-[11px] tabular-nums text-gray-500">{group.label.replace(/（.）$/, "")}</span>
      </li>)}
    </ul>
  </figure>;
}

function MedalItem({ entry, view }: { entry: TpeMedal; view: View }) {
  const [label, style] = MEDAL_STYLE[entry.medal];
  return <li className="flex gap-3 border-b border-gray-100 py-3 last:border-b-0">
    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style}`}>{label}<span className="sr-only">牌</span></span>
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-gray-900">{view !== "sport" && <span className="text-brand-700">{entry.sport}｜</span>}{entry.event}</span>
        {view !== "date" && <span className="text-sm tabular-nums text-gray-500">{shortDate(entry.date)}</span>}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">{entry.pending ? <span className="text-gray-500">{TEAM} 代表隊（隊員名單待代表團公布）</span> : entry.athletes.length ? <>{entry.athletes.join("、")}{entry.athletes.length > 1 && <span className="text-gray-500">（{entry.athletes.length} 人）</span>}</> : <span className="text-gray-500">選手待確認</span>}</p>
    </div>
  </li>;
}

/** official：清單來自官方即時名單（代表團總表只補中文與隊員）；否則是代表團總表本身。 */
export function TpeMedalDetails({ medals, official, liveTotal }: { medals: readonly TpeMedal[]; official: boolean; liveTotal: number | null }) {
  const [view, setView] = useState<View>("medal");
  const groups = useMemo(() => view === "date" ? groupMedalsByDate(medals).map((g) => ({ ...g, label: shortDate(g.key) }))
    : view === "sport" ? groupMedalsBySport(medals).map((g) => ({ ...g, label: g.key }))
    : [{ key: "all", label: "", tally: medalTally(medals), medals: sortedByMedal(medals) }], [view, medals]);
  const total = medals.length;
  const behind = liveTotal !== null && liveTotal > total;
  const mismatch = liveTotal !== null && liveTotal < total;

  return <details className="group border-t border-brand-200 bg-white">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-brand-900 focus-visible:outline-brand-600 sm:px-5 sm:text-lg [&::-webkit-details-marker]:hidden"><span>{TEAM} 獎牌明細 · {total} 面</span><span className="shrink-0 text-sm font-normal"><span className="group-open:hidden">展開 ＋</span><span className="hidden group-open:inline">收合 −</span></span></summary>
    <div className="px-3 pb-4 sm:px-5">
      <div role="group" aria-label="明細排序方式" className="mb-3 inline-flex rounded-xl bg-gray-100 p-1">
        {VIEWS.map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors sm:px-4 ${view === value ? "bg-white text-brand-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>{label}</button>)}
      </div>
      {behind && <p role="status" className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">{official ? "官方得牌名單尚在同步" : `明細更新至 ${UPDATED_LABEL}`}，官方即時已累計 {liveTotal} 面，其餘 {liveTotal - total} 面稍後補上。</p>}
      {mismatch && <p role="status" className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950">明細與官方即時獎牌數不一致，獎牌數以官方為準。</p>}
      {view === "date" && <MedalDayChart groups={groups} />}
      {groups.map((group) => <section key={group.key} aria-label={group.label || "全部獎牌"} className="mb-2">
        {group.label && <h3 className="sticky top-0 z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-950 sm:text-base"><span>{group.label}</span><TallyText tally={group.tally} /></h3>}
        <ul className="px-1">{group.medals.map((entry) => <MedalItem key={tpeMedalKey(entry)} entry={entry} view={view} />)}</ul>
      </section>)}
      <p className="mt-3 text-sm leading-relaxed text-gray-500">{official ? <>得牌項目依官方成績系統即時同步；中文項目名稱與團體隊員名單取自{TPE_MEDAL_LIST_SOURCE}（更新時間 {UPDATED_LABEL}，{CONFIG.viewerTimeZoneLabel}時間）。</> : <>資料來源：{TPE_MEDAL_LIST_SOURCE}（更新時間 {UPDATED_LABEL}，{CONFIG.viewerTimeZoneLabel}時間）。</>}依種類排序以金、銀、銅牌數排名。</p>
    </div>
  </details>;
}
