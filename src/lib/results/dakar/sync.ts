import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DAKAR_INTERVAL_MS, DAKAR_MAX_DATE, DAKAR_MIN_DATE, DAKAR_SOURCE, dakarDates, dakarSyncDue, dakarSyncInterval, dakarSyncWindow, dakarToday } from "./config";
import { fetchDakarDay, fetchDakarMedals, readDakar } from "./source";
import { isDay, isMedals, isTimestamp, type ValidatedDakarDay } from "./validation";
import type { DakarDay, DakarMedals, DakarResponse, DakarUnit } from "./types";

type Meta = { lastSuccessAt: string | null; lastAttemptAt: string | null; lastError: string | null };
type Row<T> = Meta & { value: T | null };
export type DakarState = { source: "DAKAR2026"; days: Record<string, Row<ValidatedDakarDay>>; medals: Row<DakarMedals> };
const emptyRow = <T>(): Row<T> => ({ lastSuccessAt: null, lastAttemptAt: null, lastError: null, value: null });
export const emptyDakarState = (): DakarState => ({ source: DAKAR_SOURCE, days: {}, medals: emptyRow() });
const epoch = (at: string | null) => at ? Date.parse(at) : 0;
const validMeta = (row: Row<unknown>) => row && [row.lastSuccessAt, row.lastAttemptAt].every(at => at === null || isTimestamp(at)) && (row.lastError === null || typeof row.lastError === "string");

function readState(dir: string): DakarState {
  const path = join(dir, "state.json");
  if (!existsSync(path)) {
    // A missing state must never silently replace an existing published archive.
    if (existsSync(join(dir, "index.json"))) throw Error("達卡同步狀態遺失，保留既有快照，請檢查 data 分支。");
    return emptyDakarState();
  }
  const value = JSON.parse(readFileSync(path, "utf8")) as DakarState;
  if (!value || value.source !== DAKAR_SOURCE || !value.days || typeof value.days !== "object" || Array.isArray(value.days) || !validMeta(value.medals) || (value.medals.value !== null && !isMedals(value.medals.value)) || Boolean(value.medals.value) !== Boolean(value.medals.lastSuccessAt)) throw Error("達卡已存快照格式不符，保留檔案，請檢查 data 分支。");
  for (const [date, row] of Object.entries(value.days)) {
    if (!dakarDates().includes(date) || !validMeta(row) || (row.value !== null && !isDay(row.value, date)) || Boolean(row.value) !== Boolean(row.lastSuccessAt)) throw Error(`達卡 ${date} 已存快照格式不符，保留檔案。`);
  }
  return value;
}

function writeJson(path: string, value: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value) + "\n");
  renameSync(`${path}.tmp`, path);
}

/** Preserve omitted units and their original confirmation, so rescans cannot revive a superseded date. */
export function mergeDakarDay(previous: Row<ValidatedDakarDay> | undefined, incoming: DakarDay, at: string): ValidatedDakarDay {
  if (!isDay(incoming, incoming.date) || incoming.units.some(unit => unit.retained)) throw Error("官方每日資料格式不符");
  const present = new Set(incoming.units.map(unit => unit.id));
  const omitted = previous?.value?.units.filter(unit => !present.has(unit.id)) ?? [];
  return { ...incoming, units: [...incoming.units, ...omitted.map(unit => ({ ...unit, retained: true }))], confirmedAt: Object.fromEntries([
    ...incoming.units.map(unit => [unit.id, at]),
    ...omitted.map(unit => [unit.id, previous?.value?.confirmedAt?.[unit.id] ?? (!unit.retained ? previous?.lastSuccessAt : null) ?? null]),
  ]) };
}

/** Public, database-free snapshot. No internal state or personal data is published. */
export function dakarSnapshot(state: DakarState, now = new Date()): DakarResponse {
  const chosen = new Map<string, { unit: DakarUnit; confirmed: number }>();
  const coverage = dakarDates().map(date => {
    const row = state.days[date], day = row?.value;
    const archived = row?.lastSuccessAt && row.lastSuccessAt.slice(0, 10) >= "2026-11-20" && dakarToday(now) > "2026-11-20";
    const stale = !day || Boolean(row?.lastError) || (!archived && now.getTime() - epoch(row?.lastSuccessAt ?? null) > dakarSyncInterval(date, now) * 2);
    for (const unit of day?.units ?? []) {
      const confirmed = epoch(day?.confirmedAt?.[unit.id] ?? (!unit.retained ? row?.lastSuccessAt ?? null : null));
      const old = chosen.get(unit.id);
      if (!old || (old.unit.retained && !unit.retained) || (Boolean(old.unit.retained) === Boolean(unit.retained) && confirmed >= old.confirmed)) chosen.set(unit.id, { unit, confirmed });
    }
    return { date, totalUnits: day?.totalUnits ?? 0, unconfirmedUnits: day?.unconfirmedUnits ?? 0, fetchedAt: row?.lastSuccessAt ?? null, lastAttemptAt: row?.lastAttemptAt ?? null, stale,
      warning: !day ? "此日期尚未取得完整資料。" : row?.lastError ? "官方資料暫時無法更新，保留最近一次成功資料。" : day.units.some(unit => unit.retained) ? "部分先前場次尚未重新確認，已保留並標示。" : stale ? "資料更新延遲，請以官方公告為準。" : null };
  });
  const medal = state.medals;
  const archived = medal.lastSuccessAt && medal.lastSuccessAt.slice(0, 10) >= "2026-11-20" && dakarToday(now) > "2026-11-20";
  return { success: true, source: DAKAR_SOURCE, minDate: DAKAR_MIN_DATE, maxDate: DAKAR_MAX_DATE, today: dakarToday(now), units: [...chosen.values()].map(entry => entry.unit), coverage,
    medals: medal.value, medalsFetchedAt: medal.lastSuccessAt, medalsStale: !medal.value || Boolean(medal.lastError) || (!archived && now.getTime() - epoch(medal.lastSuccessAt) > DAKAR_INTERVAL_MS * 2), syncEnabled: dakarSyncWindow(now), syncIntervalMinutes: 15 };
}

export async function runDakarSync(options: { dir: string; now?: () => Date; budgetMs?: number; fetchDay?: typeof fetchDakarDay; fetchMedals?: typeof fetchDakarMedals; log?: (message: string) => void }) {
  const clock = options.now ?? (() => new Date()), start = clock(), log = options.log ?? console.log;
  const summary: { changed: boolean; medals: "updated" | "failed" | "skipped"; days: Record<string, "updated" | "failed">; reason?: string } = { changed: false, medals: "skipped", days: {} };
  if (!dakarSyncWindow(start)) return { ...summary, reason: "outside Dakar sync window" };
  const state = readState(options.dir);
  const deadline = start.getTime() + (options.budgetMs ?? 20 * 60_000);
  class BudgetExpired extends Error {}
  const read = async (path: string) => {
    if (clock().getTime() + 21_000 >= deadline) throw new BudgetExpired();
    return readDakar(path);
  };
  const rows = [...Object.values(state.days), state.medals];
  if (rows.some(row => row.lastError && start.getTime() - epoch(row.lastAttemptAt) < DAKAR_INTERVAL_MS)) return { ...summary, reason: "source cooldown" };
  const tasks = [...dakarDates(), "medals"].filter(key => {
    const row = key === "medals" ? state.medals : state.days[key];
    return dakarSyncDue(row ? { ...row, lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt) : null, lastAttemptAt: row.lastAttemptAt ? new Date(row.lastAttemptAt) : null } : null, key === "medals" ? DAKAR_INTERVAL_MS : dakarSyncInterval(key, start), start);
  }).sort((a, b) => {
    const rowA = a === "medals" ? state.medals : state.days[a], rowB = b === "medals" ? state.medals : state.days[b];
    const failures = Number(Boolean(rowA?.lastError)) - Number(Boolean(rowB?.lastError));
    if (failures) return failures;
    if (rowA?.lastError && rowB?.lastError) return epoch(rowA.lastAttemptAt) - epoch(rowB.lastAttemptAt);
    const priority = (key: string) => key === "medals" ? 0 : key === dakarToday(start) ? 1 : 2;
    return priority(a) - priority(b) || epoch(rowA?.lastAttemptAt ?? null) - epoch(rowB?.lastAttemptAt ?? null) || a.localeCompare(b);
  });
  mkdirSync(options.dir, { recursive: true });
  for (const key of tasks) {
    if (clock().getTime() - start.getTime() >= (options.budgetMs ?? 20 * 60_000)) break;
    const attemptAt = clock().toISOString();
    try {
      if (key === "medals") {
        const incoming = await (options.fetchMedals ?? (() => fetchDakarMedals(read)))();
        if (!isMedals(incoming)) throw Error("官方獎牌資料格式不符");
        state.medals = { value: incoming, lastSuccessAt: clock().toISOString(), lastAttemptAt: attemptAt, lastError: null };
        summary.medals = "updated";
      } else {
        const incoming = await (options.fetchDay ?? ((date: string) => fetchDakarDay(date, read)))(key);
        if (incoming.date !== key) throw Error("官方日期不符");
        const at = clock().toISOString();
        state.days[key] = { value: mergeDakarDay(state.days[key], incoming, at), lastSuccessAt: at, lastAttemptAt: attemptAt, lastError: null };
        summary.days[key] = "updated";
      }
      log(`[dakar] ${key}: updated`);
    } catch (error) {
      if (error instanceof BudgetExpired) { summary.reason = "本輪同步時間用完，下一輪續查。"; break; }
      if (key === "medals") { state.medals = { ...state.medals, lastAttemptAt: clock().toISOString(), lastError: "source_unavailable" }; summary.medals = "failed"; }
      else { state.days[key] = { ...(state.days[key] ?? emptyRow()), lastAttemptAt: clock().toISOString(), lastError: "source_unavailable" }; summary.days[key] = "failed"; }
      summary.reason = "官方來源暫時無法讀取，保留上一份資料。";
      log(`[dakar] ${key}: ${error instanceof Error ? error.message.slice(0, 200) : "source unavailable"}; retained snapshot`);
    }
    summary.changed = true;
    writeJson(join(options.dir, "state.json"), state);
    writeJson(join(options.dir, "index.json"), dakarSnapshot(state, clock()));
    // Respect an upstream outage; next round prioritizes healthy feeds to avoid starvation.
    if (summary.medals === "failed" || Object.values(summary.days).includes("failed")) break;
  }
  return summary;
}
