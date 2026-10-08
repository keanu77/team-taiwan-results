// events/<代號>/competition.config.json 的格式與檢查。錯了就在 build／同步前（scripts/prepare-event.ts）直接失敗。

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
    | { type: "manual"; code: string; webUrl: string }
    /** Google 試算表「發布到網路」的 CSV 網址，欄位與 manual.csv 相同 */
    | { type: "sheet"; code: string; webUrl: string; csvUrl: string };
  syncIntervalMinutes: number;
  teamMedals: { source: string; updatedAt: string };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

let FILE = "competition.config.json";

function fail(field: string): never {
  throw new Error(`${FILE} 的 ${field} 格式不符`);
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

/** 只接受 Google 試算表「發布到網路 → CSV」的網址，避免同步程式被拿去抓任意網站 */
function sheetUrl(value: unknown): string {
  const text = url(value, "source.csvUrl");
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[A-Za-z0-9_-]+\/pub\?([^#]*&)?output=csv(&|$)/.test(text)) {
    fail("source.csvUrl（Google 試算表「檔案 → 共用 → 發布到網路」選 CSV 後的網址，開頭是 https://docs.google.com/spreadsheets/d/e/）");
  }
  return text;
}

export function parseConfig(value: unknown, file = "competition.config.json"): CompetitionConfig {
  FILE = file;
  if (!value || typeof value !== "object") fail("（整份檔案）");
  const c = value as Record<string, unknown>;
  const startDate = str(c.startDate, "startDate");
  const endDate = str(c.endDate, "endDate");
  if (!DATE.test(startDate)) fail("startDate（格式 YYYY-MM-DD）");
  if (!DATE.test(endDate)) fail("endDate（格式 YYYY-MM-DD）");
  if (endDate < startDate) fail("endDate（不能早於 startDate）");
  const team = (c.team ?? {}) as Record<string, unknown>;
  const noc = str(team.noc, "team.noc").toUpperCase();
  if (!/^[A-Z]{3}$/.test(noc)) fail("team.noc");
  const aliases = Array.isArray(team.aliases) ? team.aliases.map((a, i) => str(a, `team.aliases[${i}]`)) : [];
  const source = (c.source ?? {}) as Record<string, unknown>;
  const code = str(source.code, "source.code");
  if (!/^[A-Z0-9]{2,20}$/.test(code)) fail("source.code（2–20 碼大寫英數字，例如 AG2026）");
  const parsedSource: CompetitionConfig["source"] =
    source.type === "bornan" ? { type: "bornan", code, apiBase: url(source.apiBase, "source.apiBase"), webUrl: url(source.webUrl, "source.webUrl") }
    : source.type === "manual" ? { type: "manual", code, webUrl: url(source.webUrl, "source.webUrl") }
    : source.type === "sheet" ? { type: "sheet", code, webUrl: url(source.webUrl, "source.webUrl"), csvUrl: sheetUrl(source.csvUrl) }
    : fail("source.type（只支援 bornan、manual 或 sheet）");
  const interval = Number(c.syncIntervalMinutes);
  // workflow 排程最密每 10 分鐘一輪；低於 30 分鐘要搭配外部觸發才準時（見 README）
  if (!Number.isInteger(interval) || interval < 10 || interval > 24 * 60) fail("syncIntervalMinutes（10–1440 分鐘）");
  // 選填：沒有代表團得牌明細時可以整段省略
  const medals = (c.teamMedals ?? { source: "代表團公布的得牌明細", updatedAt: `${startDate}T00:00:00Z` }) as Record<string, unknown>;
  const updatedAt = str(medals.updatedAt, "teamMedals.updatedAt（例如 2026-09-29T23:00:00+08:00）");
  if (!Number.isFinite(Date.parse(updatedAt))) fail("teamMedals.updatedAt（例如 2026-09-29T23:00:00+08:00）");
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
