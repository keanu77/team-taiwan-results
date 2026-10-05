import raw from "../competition.config.json";

// 換賽事只改 competition.config.json；這裡負責檢查格式，錯了就在 build／同步時直接失敗。

export interface CompetitionConfig {
  /** 頁面顯示的賽事名稱 */
  name: string;
  /** 比賽日期範圍（主辦地日期，YYYY-MM-DD） */
  startDate: string;
  endDate: string;
  /** 主辦地時區（IANA 名稱），「今天」與比賽日都以它計算 */
  timeZone: string;
  timeZoneLabel: string;
  /** 觀眾所在時區，展開場次時並列顯示 */
  viewerTimeZone: string;
  viewerTimeZoneLabel: string;
  team: {
    /** 國家／地區代碼，例如 TPE */
    noc: string;
    label: string;
    /** 官方資料中代表隊可能出現的寫法，顯示時一律換成代碼 */
    aliases: string[];
  };
  source:
    | { type: "bornan"; code: string; apiBase: string; webUrl: string }
    | { type: "manual"; code: string; webUrl: string };
  syncIntervalMinutes: number;
  teamMedals: { source: string; updatedAt: string };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(field: string): never {
  throw new Error(`competition.config.json 的 ${field} 格式不符`);
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(field);
  return value.trim();
}

function zone(value: unknown, field: string): string {
  const name = str(value, field);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
  } catch {
    fail(field);
  }
  return name;
}

function url(value: unknown, field: string): string {
  const text = str(value, field);
  if (!/^https:\/\//.test(text)) fail(field);
  return text.replace(/\/+$/, "");
}

export function parseConfig(value: unknown): CompetitionConfig {
  if (!value || typeof value !== "object") fail("（整份檔案）");
  const c = value as Record<string, unknown>;
  const startDate = str(c.startDate, "startDate");
  const endDate = str(c.endDate, "endDate");
  if (!DATE.test(startDate)) fail("startDate");
  if (!DATE.test(endDate) || endDate < startDate) fail("endDate");
  const team = (c.team ?? {}) as Record<string, unknown>;
  const noc = str(team.noc, "team.noc").toUpperCase();
  if (!/^[A-Z]{3}$/.test(noc)) fail("team.noc");
  const aliases = Array.isArray(team.aliases) ? team.aliases.map((a, i) => str(a, `team.aliases[${i}]`)) : [];
  const source = (c.source ?? {}) as Record<string, unknown>;
  const code = str(source.code, "source.code");
  if (!/^[A-Z0-9]{2,20}$/.test(code)) fail("source.code");
  const parsedSource: CompetitionConfig["source"] =
    source.type === "bornan" ? { type: "bornan", code, apiBase: url(source.apiBase, "source.apiBase"), webUrl: url(source.webUrl, "source.webUrl") }
    : source.type === "manual" ? { type: "manual", code, webUrl: url(source.webUrl, "source.webUrl") }
    : fail("source.type（只支援 bornan 或 manual）");
  const interval = Number(c.syncIntervalMinutes);
  if (!Number.isInteger(interval) || interval < 15 || interval > 24 * 60) fail("syncIntervalMinutes（15–1440 分鐘）");
  const medals = (c.teamMedals ?? {}) as Record<string, unknown>;
  const updatedAt = str(medals.updatedAt, "teamMedals.updatedAt");
  if (!Number.isFinite(Date.parse(updatedAt))) fail("teamMedals.updatedAt");
  return {
    name: str(c.name, "name"),
    startDate,
    endDate,
    timeZone: zone(c.timeZone, "timeZone"),
    timeZoneLabel: str(c.timeZoneLabel, "timeZoneLabel"),
    viewerTimeZone: zone(c.viewerTimeZone, "viewerTimeZone"),
    viewerTimeZoneLabel: str(c.viewerTimeZoneLabel, "viewerTimeZoneLabel"),
    team: { noc, label: str(team.label, "team.label"), aliases },
    source: parsedSource,
    syncIntervalMinutes: interval,
    teamMedals: { source: str(medals.source, "teamMedals.source"), updatedAt },
  };
}

export const CONFIG: CompetitionConfig = parseConfig(raw);
export const TEAM = CONFIG.team.noc;

/** 例如 Asia/Tokyo → UTC+9 */
export function utcOffsetLabel(timeZone: string, at = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  return part.replace(/^GMT/, "UTC").replace(/^UTC$/, "UTC+0");
}

/** 2026-09-10 → 2026/09/10 */
export function slashDate(date: string): string {
  return date.replaceAll("-", "/");
}
