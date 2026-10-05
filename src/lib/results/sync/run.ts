import { CONFIG } from "../../../config";
import { parseMedalStandings } from "../medals";
import { RESULTS_INTERVAL_MS, RESULTS_MIN_DATE, RESULTS_RETRY_MS, resultDate, shiftResultDate } from "../model";
import { parseTpeOrgMedals, type OfficialTpeMedal } from "../officialMedals";
import { scheduledResultDates } from "../schedulePlan";
import { emptyMeta, isArchived, sourceCooldown, type DataIndex, type StoredDay, type SyncMeta } from "../snapshot";
import { fetchTpeDay, readBornan, type SourceReader } from "../source";
import { TEAM } from "../team";
import type { TpeResultUnit } from "../types";
import type { FileStore } from "./fileStore";

// 一次同步：獎牌榜＋到期的比賽日。由 GitHub Actions 定時呼叫，同一時間只會有一個在跑（workflow concurrency）。

/**
 * GitHub 排程不準時，可能比上一輪「間隔 30 分鐘」早幾十秒觸發。
 * 判斷是否到期時把現在往後推一點，避免每隔一輪才更新一次。
 */
export const SCHEDULE_GRACE_MS = 5 * 60 * 1000;

export interface SyncOptions {
  store: FileStore;
  now?: () => Date;
  /** 這一輪最多花多久，超過就停在下一個日期之前 */
  budgetMs?: number;
  read?: SourceReader;
  fetchDay?: (date: string) => Promise<TpeResultUnit[]>;
  log?: (message: string) => void;
}

export interface SyncSummary {
  changed: boolean;
  medals: "updated" | "skipped" | "failed";
  days: Record<string, "updated" | "failed">;
  reason?: string;
}

const meta = (row: SyncMeta): SyncMeta => ({ lastSuccessAt: row.lastSuccessAt, lastAttemptAt: row.lastAttemptAt, lastError: row.lastError });
const ms = (value: string | null) => (value ? Date.parse(value) : 0);

async function syncMedals(store: FileStore, index: DataIndex, read: SourceReader, clock: () => Date, log: (m: string) => void): Promise<"updated" | "skipped" | "failed"> {
  const now = clock();
  const row = store.readMedals() ?? { ...emptyMeta(), standings: [], tpeMedals: [] };
  const due = now.getTime() + SCHEDULE_GRACE_MS;
  if (isArchived(row, now)) return "skipped";
  if (row.lastSuccessAt && due - ms(row.lastSuccessAt) < RESULTS_INTERVAL_MS) return "skipped";
  if (row.lastAttemptAt && due - ms(row.lastAttemptAt) < RESULTS_RETRY_MS) return "skipped";
  const attemptAt = now.toISOString();
  try {
    const standings = parseMedalStandings(await read("ALL/medals/standings"));
    if (!standings.length) throw new Error("獎牌榜尚未完整");
    // 本隊得牌名單是加值資料：讀不到就保留上次成功的名單，不影響獎牌榜本身。
    let tpeMedals: OfficialTpeMedal[] | null = null;
    try { tpeMedals = parseTpeOrgMedals(await read(`ALL/medals/org/${TEAM}`)); } catch { log(`[sync] ${TEAM} 得牌名單暫時讀不到，保留上一份`); }
    const saved = { standings, tpeMedals: tpeMedals ?? row.tpeMedals, lastSuccessAt: clock().toISOString(), lastAttemptAt: attemptAt, lastError: null };
    store.writeMedals(saved);
    index.medals = meta(saved);
    log(`[sync] 獎牌榜：${standings.length} 隊`);
    return "updated";
  } catch (error) {
    const failed = { ...row, lastAttemptAt: attemptAt, lastError: "source_unavailable" };
    store.writeMedals(failed);
    index.medals = meta(failed);
    log(`[sync] 獎牌榜讀取失敗，保留上一份：${error instanceof Error ? error.message : error}`);
    return "failed";
  }
}

async function syncDay(store: FileStore, index: DataIndex, date: string, fetchDay: (date: string) => Promise<TpeResultUnit[]>, clock: () => Date, log: (m: string) => void): Promise<"updated" | "failed"> {
  const row: StoredDay = store.readDay(date) ?? { date, units: [], successCount: 0, ...emptyMeta() };
  const attemptAt = clock().toISOString();
  try {
    const units = await fetchDay(date);
    if (!Array.isArray(units) || new Set(units.map((u) => u.id)).size !== units.length) throw new Error("賽程快照格式不符");
    const saved: StoredDay = { ...row, units, lastSuccessAt: clock().toISOString(), lastAttemptAt: attemptAt, lastError: null, successCount: row.successCount + 1 };
    store.writeDay(saved);
    index.days[date] = meta(saved);
    log(`[sync] ${date}：${units.length} 個場次`);
    return "updated";
  } catch (error) {
    // 抓失敗不覆蓋已保存的場次，只記錄失敗時間，讓下一輪依間隔重試
    const failed: StoredDay = { ...row, lastAttemptAt: attemptAt, lastError: "source_unavailable" };
    store.writeDay(failed);
    index.days[date] = meta(failed);
    log(`[sync] ${date} 讀取失敗，保留上一份：${error instanceof Error ? error.message : error}`);
    return "failed";
  }
}

export async function runSync(options: SyncOptions): Promise<SyncSummary> {
  const { store, now = () => new Date(), budgetMs = 20 * 60 * 1000, read = readBornan, fetchDay = (date: string) => fetchTpeDay(date, read), log = console.log } = options;
  const started = now();
  const summary: SyncSummary = { changed: false, medals: "skipped", days: {} };
  if (CONFIG.source.type !== "bornan") return { ...summary, reason: "來源不是 bornan，改用手動成績 CSV" };
  // 賽前兩天才開始抓，避免空跑
  if (resultDate(started) < shiftResultDate(RESULTS_MIN_DATE, -2)) return { ...summary, reason: "賽事尚未開始" };
  const index = store.readIndex();
  if (sourceCooldown(index) > started.getTime() + SCHEDULE_GRACE_MS) return { ...summary, reason: "上一輪來源失敗，冷卻中" };

  summary.medals = await syncMedals(store, index, read, now, log);
  if (summary.medals === "failed") {
    // 一個來源失敗就整輪暫停，避免連續打官網
    store.writeIndex({ ...index, generatedAt: now().toISOString() });
    return { ...summary, changed: true, reason: "獎牌榜讀取失敗" };
  }

  const rows = Object.entries(index.days).map(([date, m]) => ({
    date, lastSuccessAt: m.lastSuccessAt ? new Date(m.lastSuccessAt) : null, lastAttemptAt: m.lastAttemptAt ? new Date(m.lastAttemptAt) : null, lastError: m.lastError,
  }));
  for (const date of scheduledResultDates(new Date(now().getTime() + SCHEDULE_GRACE_MS), rows)) {
    if (now().getTime() - started.getTime() > budgetMs) { summary.reason = "本輪時間用完，其餘日期下一輪再補"; break; }
    const result = await syncDay(store, index, date, fetchDay, now, log);
    summary.days[date] = result;
    if (result === "failed") { summary.reason = `${date} 讀取失敗，本輪停止`; break; }
  }
  summary.changed = summary.medals !== "skipped" || Object.keys(summary.days).length > 0;
  if (summary.changed) store.writeIndex({ ...index, generatedAt: now().toISOString() });
  return summary;
}
