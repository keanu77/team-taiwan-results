import { DAKAR_BASE, isDakarDate } from "./config";
import { parseDakarDetail, parseDakarMedals, parseDakarSchedule, PendingDakarEntriesError } from "./parse";
import { DAKAR_ATHLETES } from "./roster";
import type { DakarDay, DakarMedals, DakarUnit } from "./types";

const MAX_BYTES = 8 * 1024 * 1024;
export function allowedDakarPath(path: string): boolean {
  return /^\/nh\/en\/Comp\/ScheduleDatePartial\?sportCode=---&day=\d{8}$/.test(path)
    || /^\/nh\/en\/Comp\/ListPartial\?pagetype=(?:StartList|ResultList)&rsc=[A-Z0-9-]{20,48}$/.test(path)
    || path === "/nh/en/Medal/MedalCountryPartial/TPE?medalKind=DefaultSports&gender=&medal=";
}

export type DakarReader = (path: string) => Promise<string>;
/** Serialized, capped public reads; no cookies, credentials, browser scripts, or visitor-triggered polling. */
export const readDakar: DakarReader = async path => {
  if (!allowedDakarPath(path)) throw Error("官方來源路徑不符");
  await new Promise(resolve => setTimeout(resolve, 1000));
  const response = await fetch(DAKAR_BASE + path, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000), headers: {
    Accept: "text/html", "User-Agent": "TeamTaiwanResults/1.0 (+https://github.com/keanu77/team-taiwan-results)",
  } });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || Number(response.headers.get("content-length")) > MAX_BYTES) throw Error("官方來源暫時無法讀取");
  const reader = response.body?.getReader(); if (!reader) throw Error("官方來源沒有內容");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > MAX_BYTES) throw Error("官方來源大小超過限制"); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks).toString("utf8");
};

export async function fetchDakarDay(date: string, read: DakarReader = readDakar): Promise<DakarDay> {
  if (!isDakarDate(date)) throw Error("不支援的達卡日期");
  const dayKey = date.slice(8, 10) + date.slice(5, 7) + date.slice(0, 4);
  const schedule = parseDakarSchedule(await read(`/nh/en/Comp/ScheduleDatePartial?sportCode=---&day=${dayKey}`), date);
  const selected: DakarUnit[] = []; let detailRequests = 0, unconfirmedUnits = schedule.unconfirmedUnits;
  for (const candidate of schedule.candidates) {
    const knownTpe = candidate.competitors.some(c => c.country === "TPE");
    // Do not fetch detailed results for a match whose complete opponents are already non-TPE.
    if (!knownTpe && candidate.competitors.length >= 2 && candidate.competitors.every(c => c.country)) continue;
    if (knownTpe && ["BS5", "BK3"].includes(candidate.sportCode) && ["SCHEDULED", "START_LIST", "DELAYED", "POSTPONED", "CANCELLED", "RESCHEDULED"].includes(candidate.status)) {
      // Team roster comes from the verified handbook; this is not a claim about the starting lineup.
      if (["BS5", "BK3"].includes(candidate.sportCode) && !candidate.athletes.length) candidate.athletes = DAKAR_ATHLETES.filter(a => a.sportCode === candidate.sportCode).map(a => ({ ...a }));
      selected.push(candidate); continue;
    }
    if (++detailRequests > 240) throw Error("官方單日詳細查詢超過限制");
    const pageType = /\/ResultList\//.test(candidate.sourceUrl) ? "ResultList" : "StartList";
    try {
      const parsed = parseDakarDetail(await read(`/nh/en/Comp/ListPartial?pagetype=${pageType}&rsc=${candidate.id}`), candidate);
      if (parsed) selected.push(parsed);
    } catch (error) {
      if (error instanceof PendingDakarEntriesError) { unconfirmedUnits++; continue; }
      throw error;
    }
  }
  return { date, units: selected, totalUnits: schedule.totalUnits, unconfirmedUnits };
}

export async function fetchDakarMedals(read: DakarReader = readDakar): Promise<DakarMedals> {
  return parseDakarMedals(await read("/nh/en/Medal/MedalCountryPartial/TPE?medalKind=DefaultSports&gender=&medal="));
}
