"use client";

import { useState } from "react";
import { clampResultsDate, displayTpe, isResultsDate, RESULTS_MAX_DATE, RESULTS_MIN_DATE, shiftResultsDate } from "./resultDisplay";
import type { ResultQuery } from "./resultQuery";
import { CONFIG, slashDate, utcOffsetLabel } from "@/config";

const shortDate = (date: string) => date.slice(5).replace(/^0/, "").replace("-0", "/").replace("-", "/");
const START_LABEL = shortDate(RESULTS_MIN_DATE);
const END_LABEL = shortDate(RESULTS_MAX_DATE);
const ZONE_NOTE = [
  `${CONFIG.timeZoneLabel} ${utcOffsetLabel(CONFIG.timeZone, new Date(`${RESULTS_MIN_DATE}T12:00:00Z`))}`,
  ...(CONFIG.viewerTimeZone !== CONFIG.timeZone ? [`${CONFIG.viewerTimeZoneLabel} ${utcOffsetLabel(CONFIG.viewerTimeZone, new Date(`${RESULTS_MIN_DATE}T12:00:00Z`))}`] : []),
].join("，");

export function ResultFilters({ query, today, ended, sports, statuses, loading, onQuery }: {
  query: ResultQuery;
  today: string;
  /** 賽事已閉幕：期間改顯示到閉幕日 */
  ended: boolean;
  sports: { key: string; label: string }[];
  statuses: { value: string; label: string }[];
  loading: boolean;
  onQuery: (query: ResultQuery) => void;
}) {
  const [draft, setDraft] = useState(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const changed = draft.period !== query.period || draft.date !== query.date || draft.sport !== query.sport || draft.status !== query.status;
  function selectDate(date: string) {
    if (isResultsDate(date)) setDraft((current) => ({ ...current, date, sport: "", status: "" }));
  }
  return <form aria-label="日期與賽況篩選" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-5" onSubmit={(event) => {
    event.preventDefault();
    // Submit the values visible in native controls, including date-picker/autofill changes.
    const fields = new FormData(event.currentTarget);
    const period = fields.get("range") === "period";
    const date = period ? clampResultsDate(today) : String(fields.get("date") ?? "");
    if (isResultsDate(date)) onQuery({ period, date, sport: String(fields.get("sport") ?? ""), status: String(fields.get("status") ?? "") });
  }}>
    <div className="mb-4 max-w-sm">
      <label htmlFor="results-range" className="mb-2 block text-sm font-medium text-gray-700">查詢範圍</label>
      <select id="results-range" name="range" className="input-field min-w-0" value={draft.period ? "period" : "day"} onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value === "period", date: clampResultsDate(today), sport: "", status: "" }))}>
        <option value="period">賽事期間（{START_LABEL} 至{ended ? ` ${END_LABEL}` : "當日"}）</option><option value="day">單日賽程</option>
      </select>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        {draft.period ? <div className="rounded-lg bg-brand-50 px-3 py-3">
          <p className="text-sm font-medium text-brand-900">賽事期間</p>
          <p className="mt-1 text-sm tabular-nums text-brand-800">{slashDate(RESULTS_MIN_DATE)} — {slashDate(draft.date)}（{CONFIG.timeZoneLabel}日期）</p>
        </div> : <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="results-date" className="text-sm font-medium text-gray-700">{CONFIG.timeZoneLabel}比賽日期</label>
            <button type="button" className="min-h-11 px-2 text-xs font-medium text-brand-700 disabled:text-gray-400" disabled={!today || draft.date === clampResultsDate(today)} onClick={() => selectDate(clampResultsDate(today))}>{today && !isResultsDate(today) ? "最近賽日" : "今天"}</button>
          </div>
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-1.5">
            <button type="button" aria-label="前一天" className="btn-secondary min-h-11 px-0 text-xl disabled:opacity-40" disabled={!isResultsDate(draft.date) || draft.date <= RESULTS_MIN_DATE} onClick={() => selectDate(shiftResultsDate(draft.date, -1))}>‹</button>
            <input id="results-date" name="date" type="date" className="input-field min-w-0 max-w-full px-2" min={RESULTS_MIN_DATE} max={RESULTS_MAX_DATE} value={draft.date} onInput={(event) => { const date = event.currentTarget.value; setDraft((current) => ({ ...current, date, sport: "", status: "" })); }} required />
            <button type="button" aria-label="後一天" className="btn-secondary min-h-11 px-0 text-xl disabled:opacity-40" disabled={!isResultsDate(draft.date) || draft.date >= RESULTS_MAX_DATE} onClick={() => selectDate(shiftResultsDate(draft.date, 1))}>›</button>
          </div>
        </>}
      </div>
      <button type="button" aria-expanded={filtersOpen} aria-controls="results-extra-filters" className="flex min-h-11 items-center justify-between gap-2 border-t border-gray-100 pt-2 text-left text-sm font-medium text-brand-700 sm:hidden" onClick={() => setFiltersOpen((open) => !open)}><span>項目與狀態篩選{draft.sport || draft.status ? " · 已選擇" : ""}</span><span aria-hidden="true">{filtersOpen ? "−" : "+"}</span></button>
      <div id="results-extra-filters" className={`min-w-0 content-start gap-3 sm:grid sm:grid-cols-2 ${filtersOpen ? "grid" : "hidden"}`}>
        <div className="min-w-0"><label htmlFor="results-sport" className="mb-2 block text-sm font-medium text-gray-700">運動項目</label><select id="results-sport" name="sport" className="input-field min-w-0" value={draft.sport} onChange={(event) => setDraft((current) => ({ ...current, sport: event.target.value }))}><option value="">全部項目</option>{draft.sport && !sports.some((sport) => sport.key === draft.sport) && <option value={draft.sport}>{draft.sport}</option>}{sports.map((sport) => <option key={sport.key} value={sport.key}>{displayTpe(sport.label)}</option>)}</select></div>
        <div className="min-w-0"><label htmlFor="results-status" className="mb-2 block text-sm font-medium text-gray-700">賽況狀態</label><select id="results-status" name="status" className="input-field min-w-0" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="">全部狀態</option>{draft.status && !statuses.some((status) => status.value === draft.status) && <option value={draft.status}>{draft.status}</option>}{statuses.map((status) => <option key={status.value} value={status.value}>{displayTpe(status.label)}</option>)}</select></div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
      <button type="submit" className="btn-primary min-h-11 w-full px-8 disabled:opacity-50 sm:w-auto" disabled={!today || !isResultsDate(draft.date) || (loading && !changed)}>{loading && !changed ? "查詢中…" : "查詢"}</button>
      <p className="text-xs text-gray-500" role="status">{changed ? "條件已變更，請按「查詢」顯示結果。" : "選好範圍與條件後，按「查詢」確認。"}</p>
    </div>
    <p className="mt-3 text-xs text-gray-500">可查日期：{slashDate(RESULTS_MIN_DATE)}–{slashDate(RESULTS_MAX_DATE).slice(5)} · {ZONE_NOTE}</p>
  </form>;
}
