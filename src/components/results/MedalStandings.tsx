"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { countryName } from "@/lib/results/countries";
import { isMedalResponse, type MedalResponse } from "@/lib/results/medals";
import { mergeTpeMedals } from "@/lib/results/officialMedals";
import { medalTally, TPE_MEDAL_LIST, tpeMedalKey, type MedalColor } from "@/lib/results/tpeMedalList";
import { shortDate, TpeMedalDetails } from "./TpeMedalDetails";
import { CONFIG } from "@/config";
import { TEAM } from "@/lib/results/team";
import { loadMedals } from "./staticData";


const MANUAL = CONFIG.source.type === "manual";
const SOURCE = CONFIG.source.type === "bornan" ? `${CONFIG.source.webUrl}/#/medals/standings` : `${CONFIG.source.webUrl}/`;

export function MedalStandings({ refreshKey }: { refreshKey: number }) {
  const [selectedMedal, setSelectedMedal] = useState<MedalColor>("gold");
  const medalPanelId = useId();
  const [data, setData] = useState<MedalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // 手動成績沒有官方獎牌榜，只用 events/<賽事>/rosters/team-medals.csv 的明細
    if (MANUAL) return;
    const controller = new AbortController();
    let pending = false;
    async function read() {
      if (pending) return;
      pending = true;
      try {
        const value: unknown = await loadMedals(controller.signal);
        if (!isMedalResponse(value)) throw new Error("獎牌榜格式異常，請稍後重試。");
        if (!controller.signal.aborted) { setData(value); setError(null); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "暫時無法讀取獎牌榜。");
      } finally { pending = false; }
    }
    void read();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refreshKey]);
  const rows = data?.fetchedAt ? data.standings : [];
  // 官方的本隊得牌名單即時決定有哪些獎牌；還沒同步到時退回代表團公布的明細。
  const official = Boolean(data?.tpeMedals?.length);
  const medals = useMemo(() => mergeTpeMedals(data?.tpeMedals ?? [], TPE_MEDAL_LIST), [data]);
  const selectedMedals = medals.filter((entry) => entry.medal === selectedMedal);
  const selectedLabel = { gold: "金牌", silver: "銀牌", bronze: "銅牌" }[selectedMedal];
  const tpe = rows.find((row) => row.org === TEAM);
  const manualTally = MANUAL ? medalTally(medals) : null;
  const warning = MANUAL ? null : error || data?.warning;
  const synced = data?.fetchedAt ? new Intl.DateTimeFormat("zh-TW", { timeZone: CONFIG.timeZone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.fetchedAt)) : null;
  return <section aria-label="累計獎牌榜" className="mb-6 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/60 shadow-card">
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-brand-950">{TEAM} 累計獎牌</h2>
        {tpe && <p className="text-sm text-brand-900">{tpe.tied ? "並列" : ""}第 <strong className="tabular-nums">{tpe.rank}</strong> 名 <span className="text-brand-600">· 共 {tpe.total} 面</span></p>}
      </div>
      <div role="group" aria-label="依獎牌查看得獎選手" className="grid grid-cols-3 gap-2 sm:gap-3">
        {([
          ["gold", "金牌", tpe?.gold ?? manualTally?.gold, "border-amber-200 bg-amber-50 text-amber-900", "bg-amber-400"],
          ["silver", "銀牌", tpe?.silver ?? manualTally?.silver, "border-slate-300 bg-slate-100 text-slate-800", "bg-slate-400"],
          ["bronze", "銅牌", tpe?.bronze ?? manualTally?.bronze, "border-orange-200 bg-orange-50 text-orange-900", "bg-orange-500"],
        ] as const).map(([medal, label, count, style, dot]) => <button key={medal} type="button" aria-label={`${label} ${count ?? "尚待同步"}，查看得獎選手`} aria-pressed={selectedMedal === medal} aria-controls={medalPanelId} onClick={() => setSelectedMedal(medal)} className={`rounded-xl border px-3 py-3 text-left transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-4 ${style} ${selectedMedal === medal ? "ring-2 ring-current ring-inset" : "hover:shadow-sm"}`}>
          <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>
          <span className="mt-1 block text-3xl font-bold tabular-nums sm:text-4xl">{count ?? "—"}</span>
          <span className="mt-1 block text-xs">{selectedMedal === medal ? "目前顯示" : "查看選手"}</span>
        </button>)}
      </div>
      <section id={medalPanelId} aria-labelledby={`${medalPanelId}-heading`} className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 sm:px-4">
        <h3 id={`${medalPanelId}-heading`} aria-live="polite" className="text-sm font-semibold text-gray-900">{selectedLabel}得獎選手 · {selectedMedals.length} 面</h3>
        <ul className="mt-1.5 space-y-1.5">{selectedMedals.map((entry) => <li key={tpeMedalKey(entry)} className="flex flex-wrap items-baseline gap-x-2 text-sm leading-relaxed">
          <span className="font-semibold text-gray-900">{entry.sport}｜{entry.event}</span>
          <span className="text-gray-700">{entry.pending ? "隊員名單待公布" : entry.athletes.length ? entry.athletes.join("、") : "選手待確認"}</span>
          <span className="text-xs tabular-nums text-gray-500">{shortDate(entry.date)}</span>
        </li>)}</ul>
        {!selectedMedals.length && <p className="mt-2 text-sm text-gray-500">目前已取得的明細中尚無{selectedLabel}紀錄。</p>}
      </section>
      <p className="mt-3 text-xs leading-relaxed text-gray-600">全賽會最新累計，不隨下方日期或項目篩選改變。{MANUAL ? "依代表團公布的得牌明細。" : synced ? `本站同步：${synced}（${CONFIG.timeZoneLabel}時間）` : "尚待同步官方獎牌榜。"}</p>
      {data?.fetchedAt && !tpe && <p className="mt-2 text-xs text-gray-600">官方獎牌榜目前未列出 {TEAM}，獎牌數尚無可確認紀錄。</p>}
      {warning && <p role="status" className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-950">{warning}</p>}
    </div>
    <TpeMedalDetails medals={medals} official={official} liveTotal={tpe?.total ?? null} />
    {!MANUAL && <details className="group border-t border-brand-200 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-brand-900 focus-visible:outline-brand-600 sm:px-5 sm:text-lg [&::-webkit-details-marker]:hidden"><span>各國獎牌排行榜{rows.length ? ` · ${rows.length} 隊` : ""}</span><span className="shrink-0 text-sm font-normal"><span className="group-open:hidden">展開 ＋</span><span className="hidden group-open:inline">收合 −</span></span></summary>
      <div className="px-3 pb-4 sm:px-5">
        <p className="mb-3 text-sm leading-relaxed text-gray-500">依官方金、銀、銅牌排名，保留並列名次。{TEAM} 以底色標示。</p>
        {rows.length ? <table className="w-full table-fixed text-sm sm:text-base">
          <caption className="sr-only">各代表隊累計獎牌與官方排名</caption>
          <colgroup><col className="w-9 sm:w-14" /><col /><col className="w-7 sm:w-12" /><col className="w-7 sm:w-12" /><col className="w-7 sm:w-12" /><col className="w-8 sm:w-14" /></colgroup>
          <thead><tr className="border-b border-gray-200 text-gray-600"><th scope="col" className="py-2 text-left">名次</th><th scope="col" className="py-2 text-left">國家／代表隊</th><th scope="col" className="bg-amber-50 py-2 text-center text-amber-900">金</th><th scope="col" className="bg-slate-100 py-2 text-center">銀</th><th scope="col" className="bg-orange-50 py-2 text-center text-orange-900">銅</th><th scope="col" className="py-2 text-center">總計</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.org} className={`border-b border-gray-100 ${row.org === TEAM ? "bg-brand-50 font-bold text-brand-950" : "text-gray-700"}`}>
            <td className="py-3 tabular-nums">{row.tied && <span aria-label="並列">= </span>}{row.rank}</td>
            <th scope="row" className="break-words py-3 pr-2 text-left font-medium"><span className="flex flex-wrap items-center gap-1.5 font-semibold">{row.org}</span>{row.org !== TEAM && <span className="mt-1 block text-sm font-normal leading-relaxed text-gray-600 sm:text-base">{countryName(row.org)}</span>}</th>
            <td className="text-center font-semibold tabular-nums text-amber-900">{row.gold}</td><td className="text-center tabular-nums">{row.silver}</td><td className="text-center tabular-nums text-orange-900">{row.bronze}</td><td className="text-center font-semibold tabular-nums">{row.total}</td>
          </tr>)}</tbody>
        </table> : <p className="py-3 text-sm text-gray-500">獎牌排行榜尚未取得資料。</p>}
        <p className="mt-3 text-sm leading-relaxed text-gray-500">官方獎牌榜至少間隔 {CONFIG.syncIntervalMinutes} 分鐘同步一次。<a href={SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">查看官方獎牌榜<span className="sr-only">（另開視窗）</span></a></p>
      </div>
    </details>}
  </section>;
}
