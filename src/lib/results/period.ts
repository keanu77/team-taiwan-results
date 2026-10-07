import { compareSchedule } from "./highlights";
import type { TpeResultUnit, TpeResultsResponse } from "./types";

/** Merge saved days only. The freshest snapshot wins if a continuing match appears twice. */
export function combineResultDays(days: TpeResultsResponse[]): TpeResultsResponse {
  if (!days.length) throw new Error("期間不可為空");
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const saved = ordered.filter((day) => day.fetchedAt);
  const units = new Map<string, TpeResultUnit>();
  for (const day of [...saved].sort((a, b) => a.fetchedAt!.localeCompare(b.fetchedAt!) || a.date.localeCompare(b.date))) {
    for (const unit of day.units) units.set(unit.id, { ...unit, scheduleDate: day.date });
  }
  // 手動成績（syncEnabled=false）沒資料的日子就是沒有本隊場次，不算缺漏
  const missing = ordered.filter((day) => !day.fetchedAt && day.syncEnabled).length;
  const latest = saved.map((day) => day.fetchedAt!).sort().at(-1) ?? null;
  const stale = ordered.some((day) => day.stale);
  return {
    ...ordered.at(-1)!, fetchedAt: latest, syncing: ordered.some((day) => day.syncing), stale,
    warning: missing ? `尚有 ${missing} 天資料未完整同步；以下為已保存的賽程與賽果。` : stale ? "部分日期的資料更新延遲，以下保留最後成功同步的內容。" : null,
    units: [...units.values()].sort(compareSchedule),
    period: { startDate: ordered[0].date, endDate: ordered.at(-1)!.date, availableDays: saved.length, totalDays: ordered.length },
  };
}
