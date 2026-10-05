import type { TpeResultsResponse } from "@/lib/results/types";
import { displayTpe, formatResultTime } from "./resultDisplay";
import { CONFIG } from "@/config";
import { TEAM } from "@/lib/results/team";

export function ResultsNotice({ data, loading, error, onRetry, refreshInSeconds = 0 }: {
  data: TpeResultsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshInSeconds?: number;
}) {
  const noSnapshot = data && !data.fetchedAt;
  return (
    <div className="space-y-2 text-sm">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-red-800"><p>{error}</p>{data?.fetchedAt && <p className="mt-1">以下保留上次成功讀取的資料。</p>}</div>}
      {loading && !data && <p className="py-3 text-gray-500" role="status">正在讀取 {TEAM} 賽程與賽果…</p>}
      {noSnapshot && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900"><p className="font-medium">尚未取得此日期的賽程資料</p><p className="mt-1">{data.syncing ? "正在同步官方資料，稍後將自動更新。" : data.syncEnabled ? "資料將依排程更新；開幕前兩天開始同步。" : "目前同步已停用，尚無保存資料。"}</p></div>}
      {data?.stale && data.fetchedAt && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">資料更新延遲，以下為最後成功同步的內容。</p>}
      {data?.warning && <p className="text-amber-900 [overflow-wrap:anywhere]">{displayTpe(data.warning)}</p>}
      {data?.fetchedAt && <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
        <p>資料更新：<time dateTime={data.fetchedAt}>{formatResultTime(data.fetchedAt)}</time>（{CONFIG.timeZoneLabel}時間）{data.syncing ? " · 官方資料同步中" : ""}</p>
        <button type="button" className="min-h-11 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-600 disabled:text-gray-400" onClick={onRetry} disabled={loading || refreshInSeconds > 0}>{loading ? "讀取中…" : refreshInSeconds > 0 ? `重新讀取（${refreshInSeconds} 秒）` : "重新讀取"}</button>
      </div>}
      {!data?.fetchedAt && data?.lastAttemptAt && <p className="text-xs text-gray-500">最近嘗試：{formatResultTime(data.lastAttemptAt)}（{CONFIG.timeZoneLabel}時間）</p>}
      {data?.fetchedAt && <details className="text-xs leading-relaxed text-gray-500">
        <summary className="min-h-11 cursor-pointer py-2 font-medium text-gray-600 focus-visible:outline-brand-600">更新說明</summary>
        <ul className="list-disc space-y-1 pb-2 pl-5">
          <li>頁面每分鐘自動讀取本站已保存的資料；按「重新讀取」只讀取本站資料，不會加快官方同步。</li>
          {data.syncEnabled && <li>{data.period ? "當日" : "此日期"}的官方資料至少間隔 {data.syncIntervalMinutes < 60 ? `${data.syncIntervalMinutes} 分鐘` : `${data.syncIntervalMinutes / 60} 小時`}同步一次。{data.nextSyncAt && !data.syncing && <>下次最早：<time dateTime={data.nextSyncAt}>{formatResultTime(data.nextSyncAt)}</time>（{CONFIG.timeZoneLabel}時間，依排程執行）。</>}</li>}
          {data.period && <li>已保存 {data.period.availableDays}／{data.period.totalDays} 天資料，依各日最後成功同步的內容彙整；同一場次不重複計算。</li>}
        </ul>
      </details>}
      {(error || noSnapshot || data?.stale) && !data?.fetchedAt && <button type="button" className="btn-secondary min-h-10 text-sm disabled:opacity-50" onClick={onRetry} disabled={loading || refreshInSeconds > 0}>{refreshInSeconds > 0 ? "稍後可重新讀取" : "重新讀取"}</button>}
    </div>
  );
}
