import { CONFIG } from "../../../config";
import { csvRecords } from "../../csv";
import { compareSchedule } from "../highlights";
import { SPORTS, STATUS_LABELS } from "../model";
import { emptyMeta, type StoredDay } from "../snapshot";
import type { TpeCompetitor, TpeResultUnit } from "../types";
import type { FileStore } from "./fileStore";
import type { SyncSummary } from "./run";

// 手動成績：官網不是 Bornan 系統時，把成績填進 events/<賽事>/results/manual.csv，每列是一場比賽裡的一位（或一隊）參賽者。

export const MANUAL_COLUMNS = ["unit_id", "date", "time", "sport", "event", "phase", "venue", "status", "name", "organisation", "result", "rank", "medal", "outcome", "discipline"] as const;
const REQUIRED = ["unit_id", "date", "sport", "event", "status", "name", "organisation"] as const;
const FOLLOWS_PREVIOUS = "接續前場";

const STATUS_BY_LABEL: Record<string, string> = Object.fromEntries(Object.entries(STATUS_LABELS).map(([code, label]) => [label, code]));
const MEDALS: Record<string, string> = { 金: "GOLD", 金牌: "GOLD", GOLD: "GOLD", 銀: "SILVER", 銀牌: "SILVER", SILVER: "SILVER", 銅: "BRONZE", 銅牌: "BRONZE", BRONZE: "BRONZE" };
const OUTCOMES: Record<string, string> = { 勝: "W", W: "W", 負: "L", L: "L", 和: "D", D: "D", T: "D" };
const DISCIPLINE_BY_SPORT: Record<string, string> = Object.fromEntries(Object.entries(SPORTS).map(([code, label]) => [label, code]));

function offsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(instant).map((p) => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)) - instant;
}

/**
 * 主辦地當地時間 → UTC ISO 字串。
 * 用「該瞬間的時差」再修正一次，夏令時間切換當天也正確；切換時跳過的時刻（例如 02:30）往後算。
 */
export function hostTimeToIso(date: string, time: string, timeZone = CONFIG.timeZone): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - offsetMs(wall, timeZone);
  const offset = offsetMs(first, timeZone);
  const second = wall - offset;
  // second 自洽（用它自己的時差換回來還是同一個當地時間）就採用；
  // 不自洽代表這個當地時刻因夏令時間被跳過，改用 first（等於往後順延）
  return new Date(offsetMs(second, timeZone) === offset ? second : first).toISOString();
}

function fail(line: number, message: string): never {
  throw new Error(`results/manual.csv 第 ${line} 列：${message}`);
}

export function parseManualResults(text: string): Map<string, TpeResultUnit[]> {
  const records = csvRecords(text, REQUIRED, "results/manual.csv");
  // 誤存成空白檔（只剩表頭）會把所有成績清掉；要清空請刪掉個別列，不要整份清空
  if (!records.length) throw new Error("results/manual.csv 沒有任何成績列（只有表頭）。為避免誤存空白檔清掉所有成績，這裡會停下來；要下架整個賽事請刪除 events/<代號>/");
  const units = new Map<string, TpeResultUnit & { date: string }>();
  records.forEach((row, index) => {
    const line = index + 2;
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(row.unit_id)) fail(line, "unit_id 只能用英數字、點、底線、減號");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date < CONFIG.startDate || row.date > CONFIG.endDate) fail(line, `date 須在 ${CONFIG.startDate}–${CONFIG.endDate}`);
    // 「接續前場」：官方只寫接在前一場之後（Followed by），沒有開賽時間。
    // 可在前面加前一場的時間（「09:30 接續前場」），只用來排序，畫面仍顯示接續前場
    const time = row.time?.match(/^(?:(([01]\d|2[0-3]):[0-5]\d) )?(接續前場)$|^(([01]\d|2[0-3]):[0-5]\d)$/);
    if (row.time && !time) fail(line, `time 格式是 HH:MM（主辦地時間），或填「${FOLLOWS_PREVIOUS}」「HH:MM ${FOLLOWS_PREVIOUS}」`);
    const followsPrevious = Boolean(time?.[3]);
    const clock = time?.[1] ?? time?.[4] ?? "";
    const status = STATUS_LABELS[row.status.toUpperCase()] ? row.status.toUpperCase() : STATUS_BY_LABEL[row.status];
    if (!status) fail(line, `status 不認得：${row.status}（可填 ${Object.values(STATUS_LABELS).slice(0, 6).join("、")}…）`);
    const medal = row.medal ? MEDALS[row.medal.toUpperCase()] : "";
    if (medal === undefined) fail(line, "medal 只能填 金／銀／銅");
    const outcome = row.outcome ? OUTCOMES[row.outcome.toUpperCase()] : "";
    if (outcome === undefined) fail(line, "outcome 只能填 勝／負／和");
    const organisation = row.organisation.toUpperCase();
    if (!/^[A-Z]{3}$/.test(organisation)) fail(line, "organisation 是三碼代表隊代碼，例如 TPE");
    // 項目代碼決定分組：可填三碼官方代碼；沒填且不在內建表，就用運動名稱本身（不受列序影響）
    if (row.discipline && !/^[A-Z0-9]{3}$/.test(row.discipline)) fail(line, "discipline 是三碼項目代碼，例如 BDM；不確定可留空");
    const discipline = row.discipline || DISCIPLINE_BY_SPORT[row.sport] || `SPORT:${row.sport}`;

    const id = `${CONFIG.source.code}:MANUAL:${row.unit_id}`;
    const existing = units.get(id);
    if (existing && (existing.date !== row.date || existing.event !== row.event || existing.status !== status)) fail(line, `同一個 unit_id（${row.unit_id}）的日期、項目、狀態要一致`);
    const unit = existing ?? {
      id, date: row.date, discipline, sport: row.sport, event: row.event, phase: row.phase ?? "", unit: "",
      startsAt: clock ? hostTimeToIso(row.date, clock) : null, timeNote: followsPrevious ? FOLLOWS_PREVIOUS : row.time ? "" : "時間待定",
      venue: row.venue ?? "", status, statusLabel: STATUS_LABELS[status], headToHead: false, competitors: [],
      sourceUrl: `${CONFIG.source.webUrl}/`, detailAvailable: true,
    };
    const competitor: TpeCompetitor = {
      id: `${organisation}:${row.name}`, name: row.name, organisation,
      result: row.result ?? "", rank: row.rank ?? "", outcome, qualification: "", irm: "", medal,
    };
    unit.competitors.push(competitor);
    units.set(id, unit);
  });
  const byDate = new Map<string, TpeResultUnit[]>();
  for (const { date, ...unit } of units.values()) {
    const orgs = new Set(unit.competitors.map((c) => c.organisation));
    const final = { ...unit, headToHead: unit.competitors.length === 2 && orgs.size === 2 };
    byDate.set(date, [...(byDate.get(date) ?? []), final]);
  }
  for (const [date, list] of byDate) byDate.set(date, list.sort(compareSchedule));
  return byDate;
}

const countRows = (units: readonly TpeResultUnit[]) => units.reduce((sum, unit) => sum + unit.competitors.length, 0);

/**
 * 依 CSV 重寫有變動的日期；CSV 內容沒變就不動檔案，也就不會觸發重新部署。
 * guardDrop：成績列比上一份少一半以上就拒收（給多人編輯的試算表用，防止誤刪整張表）。
 */
export function runManualSync(store: FileStore, csvText: string, now = new Date(), options: { guardDrop?: boolean } = {}): SyncSummary {
  const summary: SyncSummary = { changed: false, medals: "skipped", days: {} };
  const index = store.readIndex();
  // 剛建立的賽事還沒填成績：安靜略過。已經有資料卻變成空白檔，才交給 parseManualResults 擋下
  if (!Object.keys(index.days).length && !csvRecords(csvText, [], "results/manual.csv").length) return { ...summary, reason: "尚未填寫成績" };
  const byDate = parseManualResults(csvText);
  if (options.guardDrop) {
    const before = Object.keys(index.days).reduce((sum, date) => sum + countRows(store.readDay(date)?.units ?? []), 0);
    const after = [...byDate.values()].reduce((sum, units) => sum + countRows(units), 0);
    if (before >= 10 && after < before / 2) throw new Error(`試算表成績列從 ${before} 列驟減到 ${after} 列，疑似誤刪，本輪不更新；確認無誤請改用 manual 來源或分次刪除`);
  }
  const dates = new Set([...byDate.keys(), ...Object.keys(index.days)]);
  for (const date of dates) {
    const units = byDate.get(date) ?? [];
    const previous = store.readDay(date);
    if (previous && JSON.stringify(previous.units) === JSON.stringify(units)) continue;
    const saved: StoredDay = { ...(previous ?? { date, successCount: 0, ...emptyMeta() }), date, units, lastSuccessAt: now.toISOString(), lastAttemptAt: now.toISOString(), lastError: null, successCount: (previous?.successCount ?? 0) + 1 };
    store.writeDay(saved);
    index.days[date] = { lastSuccessAt: saved.lastSuccessAt, lastAttemptAt: saved.lastAttemptAt, lastError: null };
    summary.days[date] = "updated";
  }
  summary.changed = Object.keys(summary.days).length > 0;
  if (summary.changed) store.writeIndex({ ...index, generatedAt: now.toISOString() });
  return summary;
}
