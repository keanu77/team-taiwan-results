export const DAKAR_SOURCE = "DAKAR2026" as const;
export const DAKAR_MIN_DATE = "2026-10-30";
export const DAKAR_MAX_DATE = "2026-11-13";
export const DAKAR_BASE = "https://webresult.apps.dakar2026.org";
export const DAKAR_INTERVAL_MS = 60 * 60_000;

export function isDakarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < DAKAR_MIN_DATE || value > DAKAR_MAX_DATE) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dakarToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftDakarDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function dakarDates(): string[] {
  const dates: string[] = [];
  for (let date: string = DAKAR_MIN_DATE; date <= DAKAR_MAX_DATE; date = shiftDakarDate(date, 1)) dates.push(date);
  return dates;
}

export function dakarSyncWindow(now = new Date()): boolean {
  const today = dakarToday(now);
  return today >= "2026-10-29" && today <= "2026-11-20";
}

export function dakarSyncInterval(date: string, now = new Date()): number {
  const distance = Math.abs(new Date(`${date}T00:00:00Z`).getTime() - new Date(`${dakarToday(now)}T00:00:00Z`).getTime()) / 86_400_000;
  return distance <= 1 ? DAKAR_INTERVAL_MS : 6 * 60 * 60_000;
}

export type DakarSyncState = { lastSuccessAt: Date | null; lastAttemptAt: Date | null; lastError?: string | null };

export function dakarAttemptedThisHour(at: Date | null, now = new Date()): boolean {
  return Boolean(at && Math.floor(at.getTime() / DAKAR_INTERVAL_MS) >= Math.floor(now.getTime() / DAKAR_INTERVAL_MS));
}

export function dakarSyncDue(row: DakarSyncState | null, interval: number, now = new Date()): boolean {
  // Use hour boundaries: a scan that finishes at :20 must not skip the next :13 trigger.
  if (dakarAttemptedThisHour(row?.lastAttemptAt ?? null, now)) return false;
  if (!row?.lastSuccessAt || row.lastError) return true;
  if (interval === DAKAR_INTERVAL_MS) return !dakarAttemptedThisHour(row.lastSuccessAt, now);
  return now.getTime() - row.lastSuccessAt.getTime() >= interval;
}
