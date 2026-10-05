import { CONFIG } from "../../config";
import { isMedalResponse, type MedalResponse, type MedalStanding } from "./medals";
import { RESULTS_SOURCE, RESULTS_COMPETITION, RESULTS_MIN_DATE, RESULTS_MAX_DATE, RESULTS_INTERVAL_MS, RESULTS_RETRY_MS, resultDate, resultSyncInterval, nextResultSyncAt, defaultResultDate, shiftResultDate } from "./model";
import { isOfficialTpeMedal, type OfficialTpeMedal } from "./officialMedals";
import { FINAL_CORRECTION_DATE } from "./schedulePlan";
import type { TpeResultUnit, TpeResultsResponse } from "./types";

// 同步程式（GitHub Actions）寫出、網頁讀取的資料格式。純函式，瀏覽器與 Node 共用。

export interface SyncMeta {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
}

/** data/days/<date>.json */
export interface StoredDay extends SyncMeta {
  date: string;
  units: TpeResultUnit[];
  successCount: number;
}

/** data/medals.json */
export interface StoredMedals extends SyncMeta {
  standings: MedalStanding[];
  tpeMedals: OfficialTpeMedal[];
}

/** data/index.json：網頁先讀它，才知道哪些日期有檔案 */
export interface DataIndex {
  source: string;
  generatedAt: string;
  days: Record<string, SyncMeta>;
  medals: SyncMeta | null;
}

export const emptyMeta = (): SyncMeta => ({ lastSuccessAt: null, lastAttemptAt: null, lastError: null });

const time = (value: string | null) => (value ? Date.parse(value) : 0);
const asDate = (value: string | null) => (value ? new Date(value) : null);

/** 任一來源最近失敗過，所有官方請求一起暫停到這個時間點（毫秒） */
export function sourceCooldown(index: DataIndex | null): number {
  if (!index) return 0;
  const metas = [...Object.values(index.days), ...(index.medals ? [index.medals] : [])];
  return Math.max(0, ...metas.filter((m) => m.lastError && m.lastAttemptAt).map((m) => time(m.lastAttemptAt) + RESULTS_RETRY_MS));
}

/** 這一天在最終補正後已封存，不再同步 */
export function isArchived(meta: SyncMeta | null | undefined, now: Date): boolean {
  return Boolean(meta?.lastSuccessAt && !meta.lastError && resultDate(now) > FINAL_CORRECTION_DATE && resultDate(new Date(meta.lastSuccessAt)) >= FINAL_CORRECTION_DATE);
}

export function dayResponse(date: string, row: StoredDay | null, cooldown: number, now: Date): TpeResultsResponse {
  const nowMs = now.getTime();
  const expiry = date === resultDate(now) ? RESULTS_INTERVAL_MS * 2 : 26 * 60 * 60 * 1000;
  const archived = isArchived(row, now);
  // 手動成績沒有「排程」：有資料就是最新，不顯示延遲警告
  const manual = CONFIG.source.type === "manual";
  const stale = !row?.lastSuccessAt || Boolean(row.lastError) || (!manual && !archived && nowMs - time(row.lastSuccessAt) > expiry);
  const scheduled = !manual && (Boolean(row) || date <= shiftResultDate(defaultResultDate(now), 1));
  return {
    success: true, source: RESULTS_SOURCE, competition: RESULTS_COMPETITION,
    date, minDate: RESULTS_MIN_DATE, maxDate: RESULTS_MAX_DATE,
    fetchedAt: row?.lastSuccessAt ?? null,
    lastAttemptAt: row?.lastAttemptAt ?? null,
    syncIntervalMinutes: resultSyncInterval(date, now) / 60_000,
    nextSyncAt: !archived && scheduled ? new Date(Math.max(nowMs, cooldown, nextResultSyncAt(date, asDate(row?.lastSuccessAt ?? null), asDate(row?.lastAttemptAt ?? null), now).getTime())).toISOString() : null,
    syncEnabled: !manual,
    syncing: false,
    stale,
    warning: row?.lastError ? "官方資料暫時無法完整更新，保留最近一次成功資料，系統將依間隔重試。" : !row?.lastSuccessAt ? (manual ? "此日期尚無成績資料。" : "此日期尚無完整資料，將依排程同步。") : stale ? "資料更新延遲，請以官方最新公告為準。" : null,
    units: Array.isArray(row?.units) ? row.units : [],
  };
}

export function medalResponse(row: StoredMedals | null, now: Date): MedalResponse {
  const archived = Boolean(row?.lastSuccessAt && !row.lastError && resultDate(new Date(row.lastSuccessAt)) >= FINAL_CORRECTION_DATE);
  const stale = !row?.lastSuccessAt || Boolean(row.lastError) || (!archived && now.getTime() - time(row.lastSuccessAt) > RESULTS_INTERVAL_MS * 2);
  const data: MedalResponse = {
    success: true, fetchedAt: row?.lastSuccessAt ?? null, stale,
    warning: !row?.lastSuccessAt ? "獎牌榜尚未取得完整資料。" : row.lastError ? "官方獎牌榜暫時無法更新，保留最近一次成功資料。" : stale ? "獎牌榜更新延遲，請以官方公告為準。" : null,
    standings: row?.standings ?? [],
    tpeMedals: Array.isArray(row?.tpeMedals) ? row.tpeMedals.filter(isOfficialTpeMedal) : [],
  };
  if (!isMedalResponse(data)) throw new Error("已保存獎牌榜格式異常");
  return data;
}

function isMeta(value: unknown): value is SyncMeta {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  const nullableDate = (v: unknown) => v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)));
  return nullableDate(m.lastSuccessAt) && nullableDate(m.lastAttemptAt) && (m.lastError === null || typeof m.lastError === "string");
}

export function isDataIndex(value: unknown): value is DataIndex {
  if (!value || typeof value !== "object") return false;
  const index = value as Record<string, unknown>;
  if (typeof index.source !== "string" || typeof index.generatedAt !== "string") return false;
  if (!index.days || typeof index.days !== "object" || Array.isArray(index.days)) return false;
  if (!Object.entries(index.days).every(([date, meta]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isMeta(meta))) return false;
  return index.medals === null || isMeta(index.medals);
}

export function isStoredDay(value: unknown, date: string): value is StoredDay {
  if (!isMeta(value)) return false;
  const day = value as unknown as Record<string, unknown>;
  return day.date === date && Array.isArray(day.units) && Number.isInteger(day.successCount);
}

export function isStoredMedals(value: unknown): value is StoredMedals {
  if (!isMeta(value)) return false;
  const row = value as unknown as Record<string, unknown>;
  return Array.isArray(row.standings) && Array.isArray(row.tpeMedals);
}
