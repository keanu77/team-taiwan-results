import { defaultResultDate, RESULTS_MIN_DATE, shiftResultDate } from "@/lib/results/model";
import type { MedalResponse } from "@/lib/results/medals";
import { combineResultDays } from "@/lib/results/period";
import { dataKey, takePrefetched } from "./dataPrefetch";
import { dayResponse, isDataIndex, isStoredDay, isStoredMedals, medalResponse, sourceCooldown, type DataIndex, type SyncMeta } from "@/lib/results/snapshot";
import type { TpeResultsResponse } from "@/lib/results/types";

// 網站是純靜態檔：讀 GitHub Actions 同步後放進 /data/ 的 JSON，再在瀏覽器組成畫面要的格式。

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 已下載過的檔案，以「路徑＋版本」為鍵；版本沒變就不再下載 */
const cache = new Map<string, unknown>();

async function getJson(path: string, version: string, signal?: AbortSignal): Promise<unknown> {
  const key = dataKey(path, version);
  if (cache.has(key)) return cache.get(key);
  // <head> 已預抓的就直接用；預抓失敗才自己抓
  const prefetched = takePrefetched(key);
  if (prefetched) {
    const value = await prefetched.catch(() => undefined);
    if (value !== undefined) {
      if (value !== null) cache.set(key, value);
      return value;
    }
  }
  // 版本號放進網址：內容沒變時網址也不變，瀏覽器與 CDN 的快取都用得上
  const response = await fetch(`${BASE}/data/${key}`, { signal, credentials: "omit" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("暫時無法讀取賽果，請稍後重試。");
  const value: unknown = await response.json();
  cache.set(key, value);
  return value;
}

const metaVersion = (meta: SyncMeta | null | undefined) => meta?.lastSuccessAt ?? meta?.lastAttemptAt ?? "none";

async function loadIndex(signal?: AbortSignal): Promise<DataIndex | null> {
  // index.json 是唯一需要「每次都問新版」的檔案；GitHub Pages 會快取 10 分鐘，所以帶上分鐘數
  const value = await getJson("index.json", String(Math.floor(Date.now() / 60_000)), signal);
  if (value === null) return null;
  if (!isDataIndex(value)) throw new Error("賽果資料格式異常，請稍後重試。");
  return value;
}

async function loadDay(index: DataIndex | null, date: string, signal?: AbortSignal) {
  if (!index?.days[date]) return null;
  const value = await getJson(`days/${date}.json`, metaVersion(index.days[date]), signal);
  if (value === null) return null;
  if (!isStoredDay(value, date)) throw new Error("賽果資料格式異常，請稍後重試。");
  return value;
}

export async function loadResults(date: string, period: boolean, signal?: AbortSignal): Promise<TpeResultsResponse> {
  const now = new Date();
  const index = await loadIndex(signal);
  const cooldown = sourceCooldown(index);
  if (!period) return dayResponse(date, await loadDay(index, date, signal), cooldown, now);
  if (date > defaultResultDate(now)) throw new Error("期間不可超過當日");
  const dates: string[] = [];
  for (let day = RESULTS_MIN_DATE; day <= date; day = shiftResultDate(day, 1)) dates.push(day);
  const rows = await Promise.all(dates.map((day) => loadDay(index, day, signal)));
  return combineResultDays(dates.map((day, i) => dayResponse(day, rows[i], cooldown, now)));
}

export async function loadMedals(signal?: AbortSignal): Promise<MedalResponse> {
  const index = await loadIndex(signal);
  const value = index?.medals ? await getJson("medals.json", metaVersion(index.medals), signal) : null;
  if (value !== null && !isStoredMedals(value)) throw new Error("獎牌榜格式異常，請稍後重試。");
  return medalResponse(value, new Date());
}
