import { defaultResultDate, RESULTS_MIN_DATE, shiftResultDate } from "@/lib/results/model";
import type { MedalResponse } from "@/lib/results/medals";
import { combineResultDays } from "@/lib/results/period";
import { dayResponse, isDataIndex, isStoredDay, isStoredMedals, medalResponse, sourceCooldown, type DataIndex } from "@/lib/results/snapshot";
import type { TpeResultsResponse } from "@/lib/results/types";

// 網站是純靜態檔：讀 GitHub Actions 同步後放進 /data/ 的 JSON，再在瀏覽器組成畫面要的格式。

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  // GitHub Pages 會快取 10 分鐘；帶上「分鐘」參數，每分鐘最多讀到一次新版本
  const response = await fetch(`${BASE}/data/${path}?v=${Math.floor(Date.now() / 60_000)}`, { signal, cache: "no-store", credentials: "omit" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("暫時無法讀取賽果，請稍後重試。");
  return response.json();
}

async function loadIndex(signal?: AbortSignal): Promise<DataIndex | null> {
  const value = await getJson("index.json", signal);
  if (value === null) return null;
  if (!isDataIndex(value)) throw new Error("賽果資料格式異常，請稍後重試。");
  return value;
}

async function loadDay(index: DataIndex | null, date: string, signal?: AbortSignal) {
  if (!index?.days[date]) return null;
  const value = await getJson(`days/${date}.json`, signal);
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
  const value = await getJson("medals.json", signal);
  if (value !== null && !isStoredMedals(value)) throw new Error("獎牌榜格式異常，請稍後重試。");
  return medalResponse(value, new Date());
}
