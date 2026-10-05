export interface TpeCompetitor {
  id: string;
  name: string;
  organisation: string;
  result: string;
  rank: string;
  outcome: string;
  qualification: string;
  irm: string;
  medal: string;
}

export interface TpeResultUnit {
  id: string;
  discipline: string;
  sport: string;
  event: string;
  phase: string;
  unit: string;
  startsAt: string | null;
  timeNote: string;
  venue: string;
  status: string;
  statusLabel: string;
  headToHead: boolean;
  competitors: TpeCompetitor[];
  sourceUrl: string;
  detailAvailable: boolean;
  /** Official daily snapshot date, included when reading a period. */
  scheduleDate?: string;
}

export interface TpeResultsResponse {
  success: true;
  source: string;
  competition: string;
  date: string;
  minDate: string;
  maxDate: string;
  fetchedAt: string | null;
  lastAttemptAt: string | null;
  syncIntervalMinutes: number;
  nextSyncAt: string | null;
  syncEnabled: boolean;
  syncing: boolean;
  stale: boolean;
  warning: string | null;
  units: TpeResultUnit[];
  period?: { startDate: string; endDate: string; availableDays: number; totalDays: number };
}
