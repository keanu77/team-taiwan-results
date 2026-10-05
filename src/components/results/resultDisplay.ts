import { CONFIG } from "../../config";
import { replaceTeamAliases } from "../../lib/results/team";
import type { TpeResultsResponse } from "../../lib/results/types";

export const RESULTS_MIN_DATE = CONFIG.startDate;
export const RESULTS_MAX_DATE = CONFIG.endDate;
export const RESULTS_COMPETITION = CONFIG.name;

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isResultsDate(value: string): boolean {
  return isCalendarDate(value) && value >= RESULTS_MIN_DATE && value <= RESULTS_MAX_DATE;
}

export function clampResultsDate(value: string): string {
  return value < RESULTS_MIN_DATE ? RESULTS_MIN_DATE : value > RESULTS_MAX_DATE ? RESULTS_MAX_DATE : value;
}

/** 主辦地的今天（YYYY-MM-DD） */
export function hostToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function shiftResultsDate(value: string, offset: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return clampResultsDate(date.toISOString().slice(0, 10));
}

export function formatResultTime(value: string, timeZone = CONFIG.timeZone): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "時間待確認";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

export function displayTpe(value: string): string {
  return replaceTeamAliases(value);
}

export function resultStatusClass(status: string): string {
  // 進行中用藍色，紅色只留給「負」，避免被讀成輸球或錯誤。
  if (["RUNNING", "LIVE", "IN_PROGRESS"].includes(status)) return "bg-sky-50 text-sky-900 ring-sky-300";
  if (status === "OFFICIAL") return "bg-teal-50 text-teal-800 ring-teal-200";
  if (["CANCELLED", "CANCELED", "POSTPONED", "SUSPENDED"].includes(status)) return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-gray-100 text-gray-700 ring-gray-200";
}

export function isResultsResponse(value: unknown, expectedDate: string, period = false): value is TpeResultsResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const nullableString = (entry: unknown) => entry === null || typeof entry === "string";
  const coverage = data.period as Record<string, unknown> | undefined;
  if (period ? !coverage || coverage.startDate !== RESULTS_MIN_DATE || coverage.endDate !== expectedDate || !Number.isInteger(coverage.availableDays) || !Number.isInteger(coverage.totalDays) || Number(coverage.availableDays) < 0 || Number(coverage.availableDays) > Number(coverage.totalDays) : coverage !== undefined) return false;
  return data.success === true && data.source === CONFIG.source.code && data.date === expectedDate &&
    typeof data.competition === "string" && typeof data.minDate === "string" && typeof data.maxDate === "string" &&
    nullableString(data.fetchedAt) && nullableString(data.lastAttemptAt) && nullableString(data.warning) &&
    nullableString(data.nextSyncAt) && typeof data.syncEnabled === "boolean" && typeof data.syncIntervalMinutes === "number" && data.syncIntervalMinutes > 0 &&
    typeof data.syncing === "boolean" && typeof data.stale === "boolean" && Array.isArray(data.units) &&
    data.units.every((unit: unknown) => {
      if (!unit || typeof unit !== "object") return false;
      const row = unit as Record<string, unknown>;
      return ["id", "discipline", "sport", "event", "phase", "unit", "timeNote", "venue", "status", "statusLabel", "sourceUrl"].every((key) => typeof row[key] === "string") &&
        nullableString(row.startsAt) && typeof row.headToHead === "boolean" && typeof row.detailAvailable === "boolean" &&
        (!period || (typeof row.scheduleDate === "string" && isResultsDate(row.scheduleDate) && row.scheduleDate >= RESULTS_MIN_DATE && row.scheduleDate <= expectedDate)) &&
        Array.isArray(row.competitors) && row.competitors.every((competitor: unknown) => {
          if (!competitor || typeof competitor !== "object") return false;
          const person = competitor as Record<string, unknown>;
          return ["id", "name", "organisation", "result", "rank", "outcome", "qualification", "irm", "medal"].every((key) => typeof person[key] === "string");
        });
    });
}
