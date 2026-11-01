import { DAKAR_BASE, dakarToday } from "./config";
import type { DakarDay, DakarMedals, DakarUnit } from "./types";
export type ValidatedDakarDay = DakarDay & { confirmedAt?: Record<string, string | null> };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, nonempty = false): value is string => typeof value === "string" && value.length <= 4_000 && (!nonempty || value.trim().length > 0);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000;
const list = (value: unknown, max = 2_000): value is unknown[] => Array.isArray(value) && value.length <= max;
function officialUrl(value: unknown): boolean {
  if (!text(value, true)) return false;
  try { const url = new URL(value); return url.origin === DAKAR_BASE && !url.username && !url.password && !url.hash; } catch { return false; }
}
export function isUnit(value: unknown, date: string): value is DakarUnit {
  if (!record(value) || !["id", "sportCode", "sport", "event", "status", "statusLabel"].every((key) => text(value[key], true)) || value.date !== date || !text(value.venue)) return false;
  if (!["official", "headToHead", "detailAvailable"].every((key) => typeof value[key] === "boolean") || (value.retained !== undefined && typeof value.retained !== "boolean") || !officialUrl(value.sourceUrl)) return false;
  if (value.startsAt !== null && (!text(value.startsAt, true) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.startsAt) || !Number.isFinite(Date.parse(value.startsAt)) || dakarToday(new Date(value.startsAt)) !== date)) return false;
  if (!list(value.competitors, 500) || !value.competitors.every((c) => record(c) && ["id", "name", "nameZh", "country", "score", "rank", "qualification", "irm"].every((key) => text(c[key])) && typeof c.winner === "boolean")) return false;
  if (!list(value.athletes, 500) || !value.athletes.every((a) => record(a) && ["id", "name", "sportCode"].every((key) => text(a[key], true)) && text(a.nameZh))) return false;
  return list(value.sets, 100) && value.sets.every((set) => record(set) && text(set.label, true) && list(set.scores, 500) && set.scores.every((score) => record(score) && text(score.country, true) && text(score.score)));
}
export function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function isDay(value: unknown, date: string): value is ValidatedDakarDay {
  if (!record(value) || value.date !== date || !list(value.units) || !value.units.every((unit) => isUnit(unit, date)) || !count(value.totalUnits) || !count(value.unconfirmedUnits)) return false;
  const ids = new Set(value.units.map((unit) => unit.id));
  if (ids.size !== value.units.length || value.totalUnits < value.unconfirmedUnits + value.units.filter((unit) => !unit.retained).length) return false;
  const confirmationsValid = value.confirmedAt === undefined || (record(value.confirmedAt) && Object.entries(value.confirmedAt).every(([id, at]) => ids.has(id) && (at === null || isTimestamp(at))));
  return confirmationsValid;
}
export function isMedals(value: unknown): value is DakarMedals {
  return record(value) && ["gold", "silver", "bronze"].every((key) => count(value[key])) && list(value.entries) && value.entries.every((entry) => record(entry) && ["medal", "event", "name"].every((key) => text(entry[key], true)) && text(entry.nameZh) && officialUrl(entry.sourceUrl));
}
