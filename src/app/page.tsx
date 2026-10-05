"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { DisplaySettings } from "@/components/results/DisplaySettings";
import { MedalStandings } from "@/components/results/MedalStandings";
import {
  displayTpe, hostToday, isResultsDate, RESULTS_COMPETITION, RESULTS_MIN_DATE, resultStatusClass,
} from "@/components/results/resultDisplay";
import { ResultFilters } from "@/components/results/ResultFilters";
import { ResultGroups } from "@/components/results/ResultGroups";
import {
  isTodayQuery, periodQuery, readResultQuery, resultQueryHref, todayQuery, toggleStatusQuery, type ResultQuery,
} from "@/components/results/resultQuery";
import { ResultsNavigation } from "@/components/results/ResultsNavigation";
import { ResultsNotice } from "@/components/results/ResultsNotice";
import { useTpeResults } from "@/components/results/useTpeResults";
import { matchesAthlete } from "@/lib/results/resultSearch";
import { groupResultSports, resultSport } from "@/lib/results/sportGroups";
import { CONFIG } from "@/config";
import { TEAM } from "@/lib/results/team";
import "./results-theme.css";

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [today, setToday] = useState("");
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [queryNumber, setQueryNumber] = useState(0);
  const [athleteQuery, setAthleteQuery] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setToday(hostToday());
    const interval = window.setInterval(() => setToday(hostToday()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const requestedDate = searchParams.get("date");
  const query = readResultQuery(searchParams, today);
  const { date, period, sport, status } = query;
  const { data, loading, error, refresh, refreshInSeconds, refreshKey } = useTpeResults(date, period);
  const hasSnapshot = Boolean(data?.fetchedAt);
  const units = useMemo(() => hasSnapshot ? data?.units ?? [] : [], [data, hasSnapshot]);
  const sports = useMemo(() => groupResultSports(units), [units]);
  const statuses = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const unit of units) counts.set(unit.status, { label: unit.statusLabel || unit.status || "狀態待確認", count: (counts.get(unit.status)?.count ?? 0) + 1 });
    return Array.from(counts, ([value, entry]) => ({ value, ...entry }));
  }, [units]);
  const selectedSport = sport;
  const selectedStatus = status;
  const searching = athleteQuery.trim().length > 0;
  const filtered = units.filter((unit) => (!selectedSport || resultSport(unit).key === selectedSport) && (!selectedStatus || unit.status === selectedStatus) && matchesAthlete(unit, athleteQuery));

  function submitQuery(next: ResultQuery) {
    setPendingQuery(`${next.period}:${next.date}`);
    setQueryNumber((value) => value + 1);
    if (resultQueryHref(next) === resultQueryHref(query)) refresh();
    else router.replace(resultQueryHref(next), { scroll: false });
  }

  useEffect(() => {
    if (pendingQuery !== `${period}:${date}` || loading || (!data && !error)) return;
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    resultsRef.current?.focus({ preventScroll: true });
    setPendingQuery(null);
  }, [pendingQuery, date, period, loading, data, error]);

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-widest text-brand-700">{RESULTS_COMPETITION}</p>
          <h1 className="page-title">{TEAM} 賽程與賽果</h1>
          <p className="page-subtitle">按運動項目展開，快速查看 {TEAM} 選手與比分。</p>
        </div>
        <DisplaySettings />
      </header>

      <MedalStandings refreshKey={refreshKey} />

      <div role="group" aria-label="快速查看" className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">快速查看</span>
        {([["今日賽程", isTodayQuery(query, today), () => submitQuery(todayQuery(today))], ["賽事期間全部", period && !sport && !status, () => submitQuery(periodQuery(today))]] as const).map(([label, active, onClick]) =>
          <button key={label} type="button" aria-pressed={active} disabled={!today} onClick={onClick} className={`min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50 ${active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-700 ring-gray-300 hover:bg-brand-50"}`}>{label}</button>)}
      </div>
      <ResultFilters key={`${date}:${resultQueryHref(query)}`} query={query} today={today} sports={sports} statuses={statuses} loading={loading} onQuery={submitQuery} />
      {!period && requestedDate && !isResultsDate(requestedDate) && <p className="mt-2 text-xs text-amber-900">網址日期無效或超出範圍，已顯示可查詢的日期。</p>}

      <div ref={resultsRef} tabIndex={-1} className="mt-5 scroll-mt-6 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="查詢結果">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">查詢結果</h2>
      <div className="my-4"><ResultsNotice data={data} loading={loading} error={error} onRetry={refresh} refreshInSeconds={refreshInSeconds} /></div>

      {hasSnapshot && <section aria-label={period ? "期間賽況" : "當日賽況"}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm font-medium text-gray-700">{period ? `${RESULTS_MIN_DATE} 至 ${date}` : date} · 共 {units.length} 個場次／分項</p>
          {statuses.map((entry) => <button key={entry.value} type="button" aria-pressed={status === entry.value} title={status === entry.value ? "再按一次取消篩選" : "只看此狀態"} onClick={() => submitQuery(toggleStatusQuery(query, entry.value))} className={`min-h-11 rounded-full px-3 text-xs ring-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${resultStatusClass(entry.value)} ${status === entry.value ? "font-semibold ring-2" : "ring-1 hover:opacity-80"}`}>{displayTpe(entry.label)} {entry.count}{status === entry.value && <span aria-hidden="true"> ✕</span>}</button>)}
        </div>
        {units.length > 0 && <div className="mb-4 max-w-md">
          <label htmlFor="results-athlete" className="mb-1.5 block text-sm font-medium text-gray-700">搜尋選手</label>
          <div className="relative">
            <input id="results-athlete" type="search" className="input-field min-h-11 pr-11 [&::-webkit-search-cancel-button]:appearance-none" placeholder="中文姓名或英文拼音，例如 林俊易、LIN Chun" value={athleteQuery} onChange={(event) => setAthleteQuery(event.target.value)} autoComplete="off" enterKeyHint="search" />
            {searching && <button type="button" aria-label="清除搜尋" className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center text-gray-500 hover:text-gray-900" onClick={() => setAthleteQuery("")}>✕</button>}
          </div>
          <p className="mt-1 text-xs text-gray-500">只篩選下方場次，上方獎牌數不受影響。</p>
        </div>}
        {units.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-gray-600">{period ? `此期間已保存的資料中，尚無 ${TEAM} 賽程。` : `官方資料中，此日沒有 ${TEAM} 賽程。`}</p> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center"><p className="text-gray-600">{searching ? `找不到「${athleteQuery.trim()}」的場次。` : "沒有符合篩選條件的賽程。"}</p><button type="button" className="btn-secondary mt-4 min-h-11 text-sm" onClick={() => { setAthleteQuery(""); submitQuery({ ...query, sport: "", status: "" }); }}>清除篩選與搜尋</button></div> : <>
          {(selectedSport || selectedStatus || searching) && <p className="mb-3 text-xs text-gray-500" role="status">符合條件：{filtered.length} 筆</p>}
          <ResultGroups key={`${period}:${date}:${selectedSport}:${selectedStatus}:${queryNumber}:${searching ? athleteQuery.trim() : ""}`} units={filtered} autoExpand={Boolean(selectedSport || selectedStatus || searching)} expandFirst={period} period={period} />
        </>}
      </section>}
      </div>
      <details className="mt-6 text-xs leading-relaxed text-gray-500"><summary className="min-h-11 cursor-pointer py-3 font-medium text-gray-600 focus-visible:outline-brand-600">資料來源與時間說明</summary><p className="mb-2">此頁公開呈現 {RESULTS_COMPETITION} 的 {TEAM} 賽程與賽果，日期與時間以{CONFIG.timeZoneLabel}時間為準；展開場次可查看{CONFIG.viewerTimeZone !== CONFIG.timeZone ? "兩地" : ""}時間。</p><p>資料來源：<a href={`${CONFIG.source.webUrl}/`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand-700">{RESULTS_COMPETITION}官方成績網站<span className="sr-only">（另開視窗）</span></a>。{CONFIG.source.type === "bornan" ? `本站由 GitHub Actions 定時向官方抓取後發布：當日賽果至少間隔 ${CONFIG.syncIntervalMinutes} 分鐘同步，前兩日每 6 小時、較早日期每 24 小時補查；GitHub 排程可能延遲數分鐘。` : "本站成績由維護者手動更新。"}頁面顯示中時，每 60 秒讀取本站已發布的資料。未開賽與進行中的成績可能變動；正式結果以官方原始資料為準。獎牌僅顯示官方明示的紀錄。</p></details>
    </>
  );
}

export default function ResultsPage() {
  return <div className="results-theme min-h-screen"><ResultsNavigation /><main id="main" tabIndex={-1} className="page-container min-w-0"><Suspense fallback={<p className="text-gray-500">正在載入賽果頁…</p>}><ResultsContent /></Suspense></main></div>;
}
