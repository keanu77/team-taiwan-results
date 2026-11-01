import { DAKAR_BASE, DAKAR_MAX_DATE, DAKAR_MIN_DATE, DAKAR_INTERVAL_MS, dakarSyncInterval, dakarSyncWindow, dakarToday, isDakarDate } from "@/lib/results/dakar/config";
import type { DakarCoverage, DakarResponse, DakarUnit } from "@/lib/results/dakar/types";

export type DakarView = "today" | "latest" | "all" | "finished" | "upcoming";
export type DakarFilters = { view: DakarView; date: string; sport: string; search: string };
/** A static deployment can stop updating; age must still advance in an open browser. */
export function withDakarFreshness(data: DakarResponse, now: Date): DakarResponse {
  const old = (at: string | null, interval: number) => {
    if (!at) return true;
    if (at.slice(0, 10) >= "2026-11-20" && dakarToday(now) > "2026-11-20") return false;
    return now.getTime() - Date.parse(at) > interval * 2;
  };
  return { ...data, syncEnabled: data.syncEnabled && dakarSyncWindow(now), medalsStale: data.medalsStale || old(data.medalsFetchedAt, DAKAR_INTERVAL_MS),
    coverage: data.coverage.map(day => {
      const stale = day.stale || old(day.fetchedAt, dakarSyncInterval(day.date, now));
      return { ...day, stale, warning: day.warning || (stale ? "資料更新延遲，請以官方公告為準。" : null) };
    }) };
}
export const isDakarFinished = (unit: DakarUnit) => ["OFFICIAL", "UNOFFICIAL", "FINISHED"].includes(unit.status);
export const isDakarLive = (unit: DakarUnit) => unit.status === "RUNNING";
export const isDakarUpcoming = (unit: DakarUnit) => ["SCHEDULED", "START_LIST", "POSTPONED", "DELAYED", "RESCHEDULED", "SUSPENDED", "UNKNOWN"].includes(unit.status);
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function filterDakarUnits(units: DakarUnit[], filters: DakarFilters, today: string): DakarUnit[] {
  const tokens = normalize(filters.search).split(/\s+/).filter(Boolean);
  const result = units.filter((unit) => {
    if (filters.view === "today" && unit.date !== today) return false;
    if (filters.view !== "today" && filters.date && unit.date !== filters.date) return false;
    if (filters.sport && unit.sportCode !== filters.sport) return false;
    if (filters.view === "finished" && !isDakarFinished(unit)) return false;
    if (filters.view === "latest" && !isDakarFinished(unit) && !isDakarLive(unit)) return false;
    if (filters.view === "upcoming" && !isDakarUpcoming(unit)) return false;
    const names = normalize([...unit.athletes, ...unit.competitors].map((athlete) => `${athlete.id} ${athlete.nameZh} ${athlete.name}`).join(" "));
    return tokens.every((token) => names.includes(token));
  });
  result.sort((a, b) => {
    if (filters.view === "latest") {
      const liveFirst = Number(isDakarLive(b)) - Number(isDakarLive(a));
      if (liveFirst) return liveFirst;
    }
    const comparison = (a.startsAt || `${a.date}T23:59:59Z`).localeCompare(b.startsAt || `${b.date}T23:59:59Z`) || a.id.localeCompare(b.id);
    return ["latest", "finished"].includes(filters.view) ? -comparison : comparison;
  });
  return filters.view === "latest" ? result.slice(0, 6) : result;
}

export function relevantDakarCoverage(coverage: DakarCoverage[], filters: DakarFilters, today: string, units: DakarUnit[] = []): DakarCoverage[] {
  const date = filters.view === "today" ? today : filters.date;
  if (date) return coverage.filter((day) => day.date === date);
  if (["latest", "finished"].includes(filters.view)) return coverage.filter((day) => day.date <= today);
  // Earlier postponed units remain relevant even when their scheduled date has passed.
  if (filters.view === "upcoming") {
    const pendingDates = new Set(units.filter(isDakarUpcoming).map((unit) => unit.date));
    return coverage.filter((day) => day.date >= today || pendingDates.has(day.date));
  }
  return coverage;
}

export function dakarTime(value: string, timeZone = "Asia/Taipei"): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "時間待確認";
  return new Intl.DateTimeFormat("zh-TW", { timeZone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function dakarName(unit: DakarUnit, competitor: DakarUnit["competitors"][number]): { primary: string; english: string } {
  if (/^(Chinese\s*Taipei|中華[臺台]北|TPE)$/i.test(competitor.name.trim())) return { primary: "TPE", english: "" };
  const athlete = unit.athletes.find((person) => person.id === competitor.id);
  const nameZh = competitor.nameZh && competitor.nameZh !== "TPE" ? competitor.nameZh : athlete?.nameZh;
  return { primary: nameZh || competitor.name || competitor.country || "名單待確認", english: nameZh && competitor.name !== nameZh ? competitor.name : "" };
}

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 4000;
const timestamp = (value: unknown) => value === null || (text(value) && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const list = (value: unknown): value is unknown[] => Array.isArray(value) && value.length <= 20_000;
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => text(value[key]));
function officialLink(value: unknown): boolean {
  if (!text(value)) return false;
  try { const url = new URL(value); return url.origin === DAKAR_BASE && !url.username && !url.password; } catch { return false; }
}

/** Reject malformed cached responses before rendering nested values or source links. */
export function isDakarResponse(value: unknown): value is DakarResponse {
  if (!object(value) || value.success !== true || value.source !== "DAKAR2026" || value.minDate !== DAKAR_MIN_DATE || value.maxDate !== DAKAR_MAX_DATE || !text(value.today) || !/^\d{4}-\d{2}-\d{2}$/.test(value.today)) return false;
  if (typeof value.syncEnabled !== "boolean" || typeof value.syncIntervalMinutes !== "number" || ![15, 60].includes(Number(value.syncIntervalMinutes)) || typeof value.medalsStale !== "boolean" || !timestamp(value.medalsFetchedAt)) return false;
  if (!list(value.coverage) || !value.coverage.every((day) => object(day) && isDakarDate(day.date) && count(day.totalUnits) && count(day.unconfirmedUnits) && timestamp(day.fetchedAt) && timestamp(day.lastAttemptAt) && typeof day.stale === "boolean" && (day.warning === null || text(day.warning)))) return false;
  const coverageDays = new Set(value.coverage.map((day) => (day as Record<string, unknown>).date));
  if (value.coverage.length !== 15 || coverageDays.size !== 15) return false;
  if (!list(value.units) || !value.units.every((unit) => object(unit) && strings(unit, ["id", "sportCode", "sport", "event", "venue", "status", "statusLabel"]) && isDakarDate(unit.date) && timestamp(unit.startsAt) && officialLink(unit.sourceUrl) && ["official", "headToHead", "detailAvailable"].every((key) => typeof unit[key] === "boolean") && (unit.retained === undefined || typeof unit.retained === "boolean") &&
    list(unit.competitors) && unit.competitors.every((person) => object(person) && strings(person, ["id", "name", "nameZh", "country", "score", "rank", "qualification", "irm"]) && typeof person.winner === "boolean") &&
    list(unit.athletes) && unit.athletes.every((person) => object(person) && strings(person, ["id", "name", "nameZh", "sportCode"])) &&
    list(unit.sets) && unit.sets.every((set) => object(set) && text(set.label) && list(set.scores) && set.scores.every((score) => object(score) && strings(score, ["country", "score"]))))) return false;
  if (new Set(value.units.map((unit) => (unit as Record<string, unknown>).id)).size !== value.units.length) return false;
  const medals = value.medals;
  return medals === null || (object(medals) && ["gold", "silver", "bronze"].every((key) => count(medals[key])) && list(medals.entries) && medals.entries.every((entry) => object(entry) && strings(entry, ["medal", "event", "name", "nameZh"]) && ["gold", "silver", "bronze"].includes(String(entry.medal)) && officialLink(entry.sourceUrl)));
}
