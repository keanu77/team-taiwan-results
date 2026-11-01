"use client";

import { useEffect, useId, useState } from "react";
import { DAKAR_BASE, DAKAR_MAX_DATE, DAKAR_MIN_DATE, dakarToday } from "@/lib/results/dakar/config";
import type { DakarCoverage, DakarResponse, DakarUnit } from "@/lib/results/dakar/types";
import { dakarTime, filterDakarUnits, isDakarFinished, isDakarLive, isDakarUpcoming, relevantDakarCoverage, withDakarFreshness, type DakarFilters, type DakarView } from "./dakarDisplay";
import { DakarResultCard } from "./DakarResultCard";
import { useDakarResults } from "./useDakarResults";

const views: { value: DakarView; label: string }[] = [
  { value: "today", label: "今日賽程" }, { value: "latest", label: "最新賽果" },
  { value: "all", label: "全部" }, { value: "finished", label: "已結束" }, { value: "upcoming", label: "待出賽" },
];
const emptyFilters: DakarFilters = { view: "today", date: "", sport: "", search: "" };

function CoverageNotice({ days, label }: { days: DakarCoverage[]; label: string }) {
  const missing = days.filter((day) => !day.fetchedAt);
  const delayed = days.filter((day) => day.fetchedAt && day.stale);
  const pending = days.reduce((total, day) => total + day.unconfirmedUnits, 0);
  const warning = days.some((day) => day.warning);
  const incomplete = missing.length > 0 || delayed.length > 0 || pending > 0 || warning;
  return <div className={`rounded-xl border p-3 text-xs leading-relaxed ${incomplete ? "border-amber-200 bg-amber-50 text-amber-950" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
    {missing.length > 0 && <p>{missing.length} 日尚未取得資料，不能視為當日沒有賽程。</p>}
    {pending > 0 && <p>官方出賽名單仍有 {pending} 個場次待確認（TPE 參與的 17 種運動項目）。</p>}
    {delayed.length > 0 && <p>{delayed.length} 日更新延遲，保留最近一次成功資料。</p>}
    <p>僅列已確認的 TPE 場次，可能尚非完整賽程。</p>
    <details className="mt-1">
      <summary className="min-h-11 cursor-pointer py-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><span>{label}</span><span className="mt-0.5 block">已取得 {days.length - missing.length}／{days.length} 日資料 · 查看更新狀態</span></summary>
      <p className="my-2">運動項目與選手搜尋不改變每日資料覆蓋狀態。</p>
      <ul className="space-y-2">{days.map((day) => <li key={day.date} className="border-t border-current/10 pt-2 [overflow-wrap:anywhere]">
        <span className="font-medium">{day.date}</span> · {day.fetchedAt ? `最近成功更新 ${dakarTime(day.fetchedAt)}（臺灣）` : "尚未取得"}
        {day.unconfirmedUnits > 0 && ` · ${day.unconfirmedUnits} 場出賽名單待確認`}
        {day.warning && <p>{day.warning}</p>}
      </li>)}</ul>
    </details>
  </div>;
}

function MedalSummary({ data }: { data: DakarResponse }) {
  const medals = data.medals;
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 pt-3 sm:px-4" aria-label="TPE 獎牌摘要">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 className="shrink-0 text-xs font-semibold text-gray-900 sm:text-sm">TPE 獎牌</h2>
      {!medals ? <p className="text-xs text-gray-600">獎牌資料尚未確認。</p> : <dl className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 text-center">{([
        ["金牌", medals.gold, "bg-amber-50 text-amber-900"], ["銀牌", medals.silver, "bg-slate-100 text-gray-700"], ["銅牌", medals.bronze, "bg-orange-50 text-orange-900"],
      ] as const).map(([label, value, tone]) => <div key={label} className={`flex flex-wrap items-center justify-center gap-x-1.5 rounded-lg px-1.5 py-1 ${tone}`}><dt className="text-xs">{label}</dt><dd className="font-mono text-lg font-bold tabular-nums">{value}</dd></div>)}</dl>}
    </div>
    {data.medalsStale && <p className="mt-2 text-xs text-amber-900">獎牌資料更新延遲，等待官方資料確認。</p>}
    <details className="mt-1 text-xs text-gray-500">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">獎牌明細與更新時間 <span aria-hidden="true" className="ml-auto">＋</span></summary>
      <div className="pb-3">
        <p>以官方獎牌榜為準。</p>
        {medals && medals.gold + medals.silver + medals.bronze === 0 && <p className="mt-2">官方獎牌資料：尚無已確認獎牌。</p>}
        {!!medals?.entries.length && <ul className="mt-2 space-y-2">{medals.entries.map((entry, index) => <li key={`${entry.event}-${entry.name}-${index}`} className="[overflow-wrap:anywhere]"><p>{({ gold: "金牌", silver: "銀牌", bronze: "銅牌" })[entry.medal as "gold" | "silver" | "bronze"]} · {entry.nameZh} <span lang="en">{entry.name}</span></p><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-brand-700 underline">{entry.event}<span className="sr-only">，官方獎牌資料（另開視窗）</span></a></li>)}</ul>}
        {data.medalsFetchedAt && <p className="mt-2">獎牌最近成功更新：{dakarTime(data.medalsFetchedAt)}（臺灣）</p>}
      </div>
    </details>
  </section>;
}

function Cards({ units, coverage }: { units: DakarUnit[]; coverage: DakarCoverage[] }) {
  return <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2">{units.map((unit) => <DakarResultCard key={unit.id} unit={unit} coverage={coverage.find((day) => day.date === unit.date)} />)}</div>;
}

export function DakarResults({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const { data: snapshot, loading, error, refresh } = useDakarResults();
  const [filters, setFilters] = useState<DakarFilters>(emptyFilters);
  const [clientToday, setClientToday] = useState("");
  const [clockAt, setClockAt] = useState<string | null>(null);
  const data = snapshot && clockAt ? withDakarFreshness(snapshot, new Date(clockAt)) : snapshot;
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const update = () => { setClientToday(dakarToday()); setClockAt(new Date().toISOString()); };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const today = clientToday || data?.today || "";
  const units = data?.units ?? [];
  const filtered = filterDakarUnits(units, filters, today);
  const days = relevantDakarCoverage(data?.coverage ?? [], filters, today, units);
  const sports = [...new Map(units.map((unit) => [unit.sportCode, unit.sport])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-Hant"));
  const latest = filterDakarUnits(units, { ...emptyFilters, view: "latest" }, today).slice(0, 2);
  const upcoming = units.filter(isDakarUpcoming).sort((a, b) => (a.startsAt || a.date).localeCompare(b.startsAt || b.date)).slice(0, 2);
  const compactDates = new Set([...latest, ...upcoming].map((unit) => unit.date));
  const compactDays = (data?.coverage ?? []).filter((day) => day.date === today || compactDates.has(day.date));
  const activeFilters = [filters.date, sports.find(([code]) => code === filters.sport)?.[1], filters.search.trim()].filter(Boolean);
  function changeView(view: DakarView) { setFilters((previous) => ({ ...previous, view, date: "" })); }

  return <section className={compact ? "card min-w-0 !p-4 sm:!p-6" : "min-w-0"} aria-labelledby={`${id}-title`}>
    <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 sm:mb-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-brand-700">2026 達卡青奧</p>
        {compact ? <h2 id={`${id}-title`} className="section-title mt-1">TPE 賽程與賽果</h2> : <h1 id={`${id}-title`} className="page-title mt-1 text-xl sm:text-3xl">TPE 賽程與賽果</h1>}
      </div>
      <button type="button" onClick={refresh} disabled={loading} className="btn-secondary min-h-11 min-w-11 px-2.5 text-sm disabled:opacity-50 sm:px-4" aria-label="重新讀取達卡本站賽果" title={loading ? "讀取中…" : "重新讀取"}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17"/></svg>
        <span className="hidden sm:inline">{loading ? "讀取中…" : "重新讀取"}</span>
      </button>
      <p className="col-span-2 text-xs leading-relaxed text-gray-600 sm:text-sm">{compact ? "最近賽況與接下來的出賽。" : "10/30–11/13 · 達卡比賽日 · 臺灣快 8 小時"}</p>
    </header>

    {loading && !data && <p role="status" className="mb-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">正在讀取達卡賽程與賽果…</p>}
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}{data ? " 下方保留最近一次成功讀取的資料；各場次更新時間請見卡片。" : " 可按「重新讀取」重試，或開啟官方網站。"}</p>}
    {data && !data.syncEnabled && <p className="mb-3 text-xs text-amber-900">目前背景同步已停止，以下為已保存資料。</p>}

    {data && <div className="mb-3"><MedalSummary data={data} /></div>}
    {!compact && <>
      <div role="group" aria-label="賽程檢視" className="mb-3 grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">{views.map((view) => <button key={view.value} type="button" aria-label={view.label} aria-pressed={filters.view === view.value} onClick={() => changeView(view.value)} className={`min-h-11 min-w-0 rounded-lg px-1 py-2 text-xs font-medium ring-1 ring-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 sm:rounded-full sm:px-4 sm:text-sm ${filters.view === view.value ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-brand-700 ring-gray-300 hover:bg-brand-50"}`}><span className="sm:hidden">{view.value === "today" ? "今日" : view.value === "latest" ? "最新" : view.label}</span><span className="hidden sm:inline">{view.label}</span></button>)}</div>
      <button type="button" aria-label="日期、運動與選手篩選" aria-expanded={filtersOpen} aria-controls={`${id}-filters`} onClick={() => setFiltersOpen((open) => !open)} className="mb-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 sm:hidden">
        <span>日期、運動與選手篩選{activeFilters.length > 0 && `（${activeFilters.length}）`}</span><span aria-hidden="true">{filtersOpen ? "−" : "＋"}</span>
      </button>
      <div id={`${id}-filters`} className={`mb-3 min-w-0 gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] sm:p-4 ${filtersOpen ? "grid" : "hidden sm:grid"}`}>
        <label htmlFor={`${id}-date`} className="min-w-0 text-xs font-medium text-gray-700">達卡比賽日
          <input id={`${id}-date`} type="date" min={DAKAR_MIN_DATE} max={DAKAR_MAX_DATE} value={filters.view === "today" ? today >= DAKAR_MIN_DATE && today <= DAKAR_MAX_DATE ? today : "" : filters.date} onChange={(event) => setFilters((previous) => ({ ...previous, date: event.target.value, view: previous.view === "today" ? "all" : previous.view }))} className="input-field mt-1.5 min-h-11 w-full min-w-0 max-w-full text-base sm:text-sm" />
        </label>
        <label htmlFor={`${id}-sport`} className="min-w-0 text-xs font-medium text-gray-700">運動項目
          <select id={`${id}-sport`} value={filters.sport} onChange={(event) => setFilters((previous) => ({ ...previous, sport: event.target.value }))} className="input-field mt-1.5 min-h-11 w-full min-w-0 text-base sm:text-sm"><option value="">全部運動項目</option>{sports.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
        </label>
        <label htmlFor={`${id}-athlete`} className="min-w-0 text-xs font-medium text-gray-700 sm:col-span-2 lg:col-span-1">搜尋選手
          <input id={`${id}-athlete`} type="search" autoComplete="off" placeholder="中文姓名或英文拼音" value={filters.search} onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))} className="input-field mt-1.5 min-h-11 w-full min-w-0 text-base sm:text-sm" />
        </label>
      </div>
      {activeFilters.length > 0 && <p className="mb-1 text-xs leading-relaxed text-gray-600 [overflow-wrap:anywhere]">目前篩選：{activeFilters.join(" · ")}</p>}
      {(filters.date || filters.sport || filters.search) && <button type="button" className="mb-3 inline-flex min-h-11 items-center text-sm text-brand-700 underline" onClick={() => setFilters({ ...emptyFilters, view: "all" })}>清除篩選與搜尋</button>}
    </>}

    {data && <>
      <div className="mb-4"><CoverageNotice days={compact ? compactDays : days} label={compact ? "今日與下列場次" : filters.view === "today" ? `${today}（達卡今日）` : filters.date || (["latest", "finished"].includes(filters.view) ? "截至達卡今日" : "查詢期間")} /></div>
      {compact ? <div className="space-y-4">
        <div><h3 className="mb-2 text-sm font-semibold text-gray-900">最近賽況</h3>{latest.length ? <Cards units={latest} coverage={data.coverage} /> : <p className="text-sm text-gray-500">目前尚無已確認的進行中賽況或已結束賽果。</p>}</div>
        <div><h3 className="mb-2 text-sm font-semibold text-gray-900">接下來的出賽</h3>{upcoming.length ? <Cards units={upcoming} coverage={data.coverage} /> : <p className="text-sm text-gray-500">尚無已確認的待出賽場次，請查看完整賽程與各日更新狀態。</p>}</div>
      </div> : <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-gray-900">{views.find((view) => view.value === filters.view)?.label}</h2><p role="status" className="text-xs text-gray-500">{filtered.length} 個場次／分項{filters.view === "latest" ? "（最多顯示 6 筆，進行中優先）" : ""}</p></div>
        {filtered.length > 0 ? <Cards units={filtered} coverage={data.coverage} /> : <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm text-gray-600">目前已保存資料中，尚無符合條件的已確認 TPE 場次。</p>
          <p className="mt-2 text-xs text-gray-500">可切換全部或調整篩選；尚未取得、待確認或更新延遲的資料，仍可能新增場次。</p>
          <button type="button" onClick={() => setFilters({ ...emptyFilters, view: "all" })} className="btn-secondary mt-4 min-h-11 text-sm">查看全部已確認場次</button>
        </div>}
        <p className="mt-3 text-xs text-gray-500">已保存：{units.filter(isDakarFinished).length} 場已結束 · {units.filter(isDakarLive).length} 場進行中 · {units.filter(isDakarUpcoming).length} 場待出賽。搜尋含代表隊名冊，仍請核對實際出賽名單。</p>
      </>}
    </>}

    {compact && <a href="./" className="mt-4 inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-4">查看完整 TPE 賽程與賽果 →</a>}
    <details className="mt-4 text-xs leading-relaxed text-gray-500">
      <summary className="min-h-11 cursor-pointer py-3 font-medium text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">資料來源與更新方式</summary>
      <p>此頁公開查詢，無須登入。日期篩選以達卡（UTC+0）比賽日為準；卡片同時列出臺灣（UTC+8）與達卡日期、時間。所有名次均為該場次／輪次的名次，不代表最終排名或獎牌。</p>
      <p className="mt-2">背景同步：達卡當日約每 15 分鐘、前後相鄰日約每 30 分鐘、其他日期約每 6 小時。由 GitHub Actions 排程同步後發布靜態快照，排程可能延遲；實際更新請查看每場資料時間。頁面顯示時每 60 秒讀取本站快取，「重新讀取」也只讀取本站已保存資料，不會立即向官方抓取。</p>
      <p className="mt-2">暫定成績與未完成的場次仍可能變更。正式結果以各場次官方原始資料為準。</p>
      <a href={`${DAKAR_BASE}/`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-brand-700 underline underline-offset-4">達卡官方賽程與賽果<span className="sr-only">（另開視窗）</span> <span aria-hidden="true">↗</span></a>
    </details>
    {!data && <a href={`${DAKAR_BASE}/`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-700 underline">開啟達卡官方賽程與賽果 <span aria-hidden="true">↗</span></a>}
    {!compact && <a href="../ag2026/" className="mt-3 inline-flex min-h-11 items-center text-xs text-gray-500 underline underline-offset-4">名古屋亞運歷史賽果</a>}
  </section>;
}
