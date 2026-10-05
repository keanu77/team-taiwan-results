import { getAthleteNameDisplay } from "./athleteNameLookup";
import type { TpeResultUnit } from "./types";

/** 搜尋比對用：忽略大小寫、空白、連字號與斜線。 */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[\s\-‐/·・.,'’]+/g, "");
}

/** 選手姓名搜尋：中文（已驗證對照）與羅馬拼音皆可，對手與雙打搭檔也納入。 */
export function matchesAthlete(unit: TpeResultUnit, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return unit.competitors.some((competitor) => {
    const display = getAthleteNameDisplay(competitor, unit.discipline);
    return [competitor.name, display.primaryName, display.englishName ?? ""].some((name) => normalizeSearch(name).includes(needle));
  });
}
