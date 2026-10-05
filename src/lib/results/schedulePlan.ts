import { RESULTS_MIN_DATE, RESULTS_MAX_DATE, RESULTS_RETRY_MS, defaultResultDate, parseResultDate, resultDate, shiftResultDate, syncDue } from "./model";

export interface ResultSyncState {
  date: string;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
}
export const FINAL_CORRECTION_DATE = shiftResultDate(RESULTS_MAX_DATE, 3);

/** Refresh all historical snapshots daily, including partially finished days saved before an outage. */
export function scheduledResultDates(now: Date, rows: ResultSyncState[]): string[] {
  // One failed source job pauses all dates; persisted timestamps survive restarts.
  if (rows.some((row) => row.lastError && row.lastAttemptAt && now.getTime() < row.lastAttemptAt.getTime() + RESULTS_RETRY_MS)) return [];
  const today = resultDate(now);
  const latest = defaultResultDate(now);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const dates = [latest, shiftResultDate(latest, -1), shiftResultDate(latest, -2), shiftResultDate(latest, 1), ...rows.map((row) => row.date)];
  for (let date = RESULTS_MIN_DATE; date <= latest; date = shiftResultDate(date, 1)) dates.push(date);
  return [...new Set(dates)].filter((date) => {
    if (!parseResultDate(date)) return false;
    const row = byDate.get(date);
    // Each date receives a final correction pass, even after a long downtime or restart.
    if (today > FINAL_CORRECTION_DATE && row?.lastSuccessAt && resultDate(row.lastSuccessAt) >= FINAL_CORRECTION_DATE && !row.lastError) return false;
    return syncDue(date, row?.lastSuccessAt ?? null, row?.lastAttemptAt ?? null, now);
  });
}
