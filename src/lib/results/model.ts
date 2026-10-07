import { CONFIG } from "../../config";
import { replaceTeamAliases, TEAM } from "./team";
import type { TpeCompetitor, TpeResultUnit } from "./types";

export const RESULTS_SOURCE = CONFIG.source.code;
export const RESULTS_COMPETITION = CONFIG.name;
export const RESULTS_MIN_DATE = CONFIG.startDate;
export const RESULTS_MAX_DATE = CONFIG.endDate;
export const RESULTS_TIME_ZONE = CONFIG.timeZone;
export const RESULTS_INTERVAL_MS = CONFIG.syncIntervalMinutes * 60 * 1000;
export const RESULTS_RETRY_MS = RESULTS_INTERVAL_MS;
export const SOURCE_WEB = `${CONFIG.source.webUrl}/`;

type RecordValue = Record<string, unknown>;
export type ScheduleUnit = RecordValue & { Disc: string; Key: string; Status: string };
export const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "未開賽", START_LIST: "出賽名單", RUNNING: "進行中",
  UNOFFICIAL: "非正式成績", OFFICIAL: "正式成績", FINISHED: "已結束・待確認",
  DELAYED: "延賽", POSTPONED: "延期", CANCELLED: "取消", CANCELED: "取消",
  INTERRUPTED: "暫停", SUSPENDED: "暫停", RESCHEDULED: "時間調整",
};
export const SPORTS: Record<string, string> = {
  ATH: "田徑", SWM: "游泳", WPO: "水球", BDM: "羽球", BBL: "棒球",
  BK3: "3x3 籃球", BKB: "籃球", BOX: "拳擊", CSP: "輕艇競速", CRD: "公路自由車",
  EQU: "馬術", ELS: "電子競技", FEN: "擊劍", FBL: "足球", GAR: "競技體操",
  HBL: "手球", HOC: "曲棍球", KAB: "卡巴迪", KTE: "空手道", ROW: "划船",
  SHO: "射擊", SPK: "藤球", SQU: "壁球", TST: "軟式網球", TTE: "桌球",
  VBV: "沙灘排球", VVO: "排球", WLF: "舉重", WSU: "武術", TEN: "網球",
  TKW: "跆拳道", JUD: "柔道", GOL: "高爾夫", ARC: "射箭",
};

export function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("來源資料格式不符");
  return value as RecordValue;
}
export function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 500) : typeof value === "number" ? String(value) : "";
}
export function resultDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: RESULTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function shiftResultDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function parseResultDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return value >= RESULTS_MIN_DATE && value <= RESULTS_MAX_DATE ? value : null;
}
/** 主辦地日期已過閉幕日：賽事已結束，「今日」不再有意義 */
export function eventEnded(now = new Date()): boolean {
  return resultDate(now) > RESULTS_MAX_DATE;
}
export function defaultResultDate(now = new Date()): string {
  const date = resultDate(now);
  return date < RESULTS_MIN_DATE ? RESULTS_MIN_DATE : date > RESULTS_MAX_DATE ? RESULTS_MAX_DATE : date;
}
export function parseSchedule(value: unknown, discipline?: string): ScheduleUnit[] {
  if (!Array.isArray(value) || value.length > 6000) throw new Error("賽程資料格式不符");
  return value.map((item) => {
    const row = record(item);
    if (!/^[A-Z0-9]{3}$/.test(text(row.Disc)) || !/^[A-Z0-9._-]{4,90}$/.test(text(row.Key)) || !text(row.Status)) throw new Error("賽程缺少識別資料");
    if (discipline && row.Disc !== discipline) throw new Error("賽程項目不一致");
    if (discipline && (!Array.isArray(row.Orgs) || typeof row.isH2H !== "boolean")) throw new Error("來源缺少參賽代表隊或賽制");
    if (row.Orgs !== undefined && (!Array.isArray(row.Orgs) || !row.Orgs.every((v) => typeof v === "string"))) throw new Error("參賽代表隊資料格式不符");
    return row as ScheduleUnit;
  });
}
export function isTpeUnit(unit: ScheduleUnit): boolean {
  return (Array.isArray(unit.Orgs) && unit.Orgs.includes(TEAM)) || [unit.Home, unit.Away].some((v) => v && record(v).Org === TEAM);
}
function competitor(raw: unknown): TpeCompetitor {
  const row = record(raw);
  const organisation = text(row.Org);
  const originalName = text(row.Name) || text(row.NameS) || organisation;
  const name = replaceTeamAliases(originalName);
  return {
    id: text(row.Reg) || `${organisation}:${name}`, organisation, name,
    result: text(row.Result), rank: text(row.Rk), outcome: text(row.WLT) || (row.Winner === true ? "W" : ""),
    qualification: text(row.Qualified), irm: text(row.IRM), medal: text(row.Medal),
  };
}

export function normalizeResult(unit: ScheduleUnit, rawDetail?: unknown): TpeResultUnit {
  let info: RecordValue = unit;
  let participants: unknown[] = [unit.Home, unit.Away].filter(Boolean);
  let detailAvailable = false;
  const resCode = text(unit.ResCode) || unit.Key;
  if (!/^[A-Z0-9._-]{4,90}$/.test(resCode)) throw new Error("成績識別碼不符");
  if (rawDetail != null) {
    const detail = record(rawDetail);
    const detailInfo = record(detail.Info);
    if (!text(detailInfo.Status) || typeof detailInfo.isH2H !== "boolean") throw new Error("成績缺少比賽狀態或賽制");
    if (detailInfo.Disc !== unit.Disc || detailInfo.Key !== resCode) throw new Error("成績與賽程不一致");
    if (!Array.isArray(detail.Competitors) || detail.Competitors.length > 2000) throw new Error("成績名單格式不符");
    info = { ...unit, ...detailInfo };
    participants = detail.Competitors;
    detailAvailable = true;
  }
  const headToHead = unit.isH2H === true;
  const competitors = participants.map(competitor).filter((c) => headToHead || c.organisation === TEAM);
  if (detailAvailable && participants.length && !competitors.some((c) => c.organisation === TEAM)) throw new Error(`成績名單尚未包含 ${TEAM}`);
  if (detailAvailable && ["OFFICIAL", "UNOFFICIAL"].includes(text(info.Status)) && !competitors.some((c) => c.organisation === TEAM)) throw new Error(`來源尚未提供 ${TEAM} 成績`);
  const rawTime = text(info.DateTimeRaw);
  if (rawTime && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(rawTime) || !Number.isFinite(Date.parse(rawTime)))) throw new Error("比賽時間格式不符");
  const estimate = text(info.EstText);
  const followed = /followed\s*by/i.test(estimate);
  const startsAt = info.HideStartDate === true || followed || !rawTime ? null : new Date(rawTime).toISOString();
  const status = text(info.Status);
  // Live feeds can carry placeholder tie/winner flags before the match is decided.
  if (!["OFFICIAL", "UNOFFICIAL"].includes(status)) {
    for (const c of competitors) c.outcome = "";
  }
  // Starting scores and default zeros are not results.
  if (["SCHEDULED", "START_LIST", "DELAYED", "POSTPONED", "RESCHEDULED"].includes(status)) {
    for (const c of competitors) { c.result = ""; c.rank = ""; c.outcome = ""; c.medal = ""; c.qualification = ""; }
  }
  return {
    id: `${RESULTS_SOURCE}:${unit.Disc}:${unit.Key}`, discipline: unit.Disc,
    sport: SPORTS[unit.Disc] || text(unit.DiscDesc) || unit.Disc,
    event: text(unit.EventDesc), phase: text(unit.PhaseDescA) || text(unit.PhaseDesc),
    unit: text(unit.UnitDescA) || text(unit.UnitDesc), startsAt,
    timeNote: followed ? "接續前場" : info.HideStartDate === true ? "時間待定" : info.Estimated === true ? "預估時間" : "",
    venue: text(info.VenueDescS) || text(info.VenueDesc), status,
    statusLabel: STATUS_LABELS[status] || "狀態待確認", headToHead, competitors, detailAvailable,
    sourceUrl: `${SOURCE_WEB}#/discipline/${unit.Disc}/results/${resCode}`,
  };
}

export function resultSyncInterval(date: string, now = new Date()): number {
  const today = resultDate(now);
  return date === today ? RESULTS_INTERVAL_MS : date >= shiftResultDate(today, -2) ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

/** Earliest eligibility, not a promise that the queued fetch finishes at this time. */
export function nextResultSyncAt(date: string, lastSuccess: Date | null, lastAttempt: Date | null, now = new Date()): Date {
  return new Date(Math.max(
    lastSuccess ? lastSuccess.getTime() + resultSyncInterval(date, now) : 0,
    lastAttempt ? lastAttempt.getTime() + RESULTS_RETRY_MS : 0,
  ));
}

export function syncDue(date: string, lastSuccess: Date | null, lastAttempt: Date | null, now = new Date()): boolean {
  return now.getTime() >= nextResultSyncAt(date, lastSuccess, lastAttempt, now).getTime();
}
