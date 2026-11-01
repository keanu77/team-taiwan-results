import type { DakarCoverage, DakarUnit } from "@/lib/results/dakar/types";
import { dakarName, dakarTime, isDakarFinished } from "./dakarDisplay";

export function DakarResultCard({ unit, coverage }: { unit: DakarUnit; coverage?: DakarCoverage }) {
  const competitors = [...unit.competitors].sort((a, b) => Number(b.country === "TPE") - Number(a.country === "TPE"));
  const hasResult = isDakarFinished(unit) || unit.status === "RUNNING";
  const statusClass = unit.official ? "bg-teal-50 text-teal-800 ring-teal-200" : unit.status === "RUNNING" ? "bg-sky-50 text-sky-900 ring-gray-200" : "bg-gray-100 text-gray-700 ring-gray-200";
  return <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 sm:p-4" aria-label={`${unit.sport} ${unit.event}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-semibold text-brand-700">{unit.sport}</p>
      <span className={`rounded px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClass}`}>{unit.statusLabel}{!unit.official && unit.status === "FINISHED" ? "（非正式）" : ""}</span>
    </div>
    <h3 className="mt-2 text-sm font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]" lang="en">{unit.event}</h3>
    <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:flex sm:flex-wrap sm:gap-x-4 tabular-nums text-gray-600">
      {unit.startsAt ? <><p>臺灣 {dakarTime(unit.startsAt)}</p><p>達卡 {dakarTime(unit.startsAt, "Africa/Dakar")}</p></> : <p>達卡 {unit.date.replaceAll("-", "/")} · 時間待確認</p>}
    </div>
    <div className="mt-3 grid gap-1.5">
      {competitors.map((competitor, index) => {
        const name = dakarName(unit, competitor);
        return <div key={`${competitor.id}-${index}`} data-country={competitor.country} className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 ${competitor.country === "TPE" ? "bg-blue-50 ring-1 ring-inset ring-blue-100" : "bg-slate-50"}`}>
          <div className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
            {competitor.country && name.primary !== competitor.country && <p className="text-[11px] font-semibold text-gray-500">{competitor.country}</p>}
            <p className="font-semibold text-gray-900">{name.primary}</p>
            {name.english && <p className="mt-0.5 text-xs text-gray-500" lang="en">{name.english}</p>}
          </div>
          <div className="max-w-[45%] text-right [overflow-wrap:anywhere]">
            <p className="font-mono text-2xl font-bold leading-tight tabular-nums text-brand-950">{hasResult ? competitor.score || competitor.irm || "—" : "—"}</p>
            {hasResult && competitor.rank && <p className="text-xs text-gray-600">本輪名次 {competitor.rank}</p>}
            {hasResult && competitor.qualification && <p className="text-xs text-gray-600">晉級註記：{competitor.qualification}</p>}
            {isDakarFinished(unit) && competitor.winner && <p className="text-xs font-semibold text-teal-700">{unit.official ? "勝方" : "暫定勝方"}</p>}
          </div>
        </div>;
      })}
      {!competitors.length && <p className="py-2 text-sm text-gray-500">參賽名單待確認</p>}
    </div>
    {hasResult && unit.sets.length > 0 && <div className="mt-2 space-y-1 text-xs text-gray-600" aria-label="各局比分">{unit.sets.map((set, index) => <p key={`${set.label}-${index}`} className="[overflow-wrap:anywhere]"><span className="font-medium">{set.label}</span> · {[...set.scores].sort((a, b) => Number(b.country === "TPE") - Number(a.country === "TPE")).map((score) => `${score.country} ${score.score || "—"}`).join(" · ")}</p>)}</div>}
    {unit.retained && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-900">此場次尚未重新確認，保留先前資料；時間、名單與成績請核對官方公告。</p>}
    {coverage?.stale && <p className="mt-2 text-xs text-amber-900">資料更新延遲，顯示最近成功更新的資料。</p>}
    <p className="mt-3 text-[11px] text-gray-500">{coverage?.stale ? "最近成功更新" : "本日資料更新"}：{coverage?.fetchedAt ? `${dakarTime(coverage.fetchedAt)}（臺灣）` : "尚未確認"}{unit.retained ? "（不代表此場次已重新確認）" : ""}</p>
    <details className="mt-1 border-t border-gray-100 text-xs text-gray-600">
      <summary className="min-h-11 cursor-pointer py-3 font-medium text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">場地、代表隊名單與來源</summary>
      <p className="leading-relaxed [overflow-wrap:anywhere]">場地：{unit.venue || "尚待公布"}</p>
      {unit.athletes.length > 0 && <div className="mt-3">
        <p className="font-semibold text-gray-700">代表隊名單／選手</p>
        <p className="mt-1 leading-relaxed">包含賽事相關選手或已核對的代表隊名冊；實際出賽名單以官方場次資料為準。</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">{unit.athletes.map((athlete) => <li key={athlete.id} className="min-w-0 border-b border-gray-100 pb-2 [overflow-wrap:anywhere]">{athlete.nameZh && <span className="block font-medium text-gray-800">{athlete.nameZh}</span>}<span lang="en">{athlete.name}</span></li>)}</ul>
      </div>}
      <a className="mt-2 inline-flex min-h-11 items-center text-brand-700 underline underline-offset-4" href={unit.sourceUrl} target="_blank" rel="noopener noreferrer">官方原始資料<span className="sr-only">（另開視窗）</span> <span aria-hidden="true">↗</span></a>
    </details>
  </article>;
}
