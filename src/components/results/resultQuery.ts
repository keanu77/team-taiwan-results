import { clampResultsDate, isCalendarDate } from "./resultDisplay";

export interface ResultQuery { period: boolean; date: string; sport: string; status: string }
const filterValue = (value: string | null) => value && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : "";

export function readResultQuery(params: Pick<URLSearchParams, "get">, today: string): ResultQuery {
  const requested = params.get("date");
  const range = params.get("range");
  // Plain homepage links open the full period; existing dated links stay single-day.
  const period = range === "period" || (range !== "day" && requested === null);
  return {
    period,
    date: today ? clampResultsDate(!period && requested && isCalendarDate(requested) ? requested : today) : "",
    sport: filterValue(params.get("sport")), status: filterValue(params.get("status")),
  };
}

export function resultQueryHref(query: ResultQuery): string {
  const params = new URLSearchParams(query.period ? { range: "period" } : { date: query.date });
  if (query.sport) params.set("sport", query.sport);
  if (query.status) params.set("status", query.status);
  // 網站只有這一頁；basePath 由 Next router 自動補上
  return `/?${params}`;
}

/** 狀態膠囊：點選即篩選，再點一次清除；保留其他條件。 */
export function toggleStatusQuery(query: ResultQuery, status: string): ResultQuery {
  return { ...query, status: query.status === status ? "" : status };
}

export function todayQuery(today: string): ResultQuery {
  return { period: false, date: clampResultsDate(today), sport: "", status: "" };
}

export function periodQuery(today: string): ResultQuery {
  return { period: true, date: clampResultsDate(today), sport: "", status: "" };
}

export function isTodayQuery(query: ResultQuery, today: string): boolean {
  return !query.period && Boolean(today) && query.date === clampResultsDate(today);
}
