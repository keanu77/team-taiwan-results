export interface DakarAthlete { id: string; name: string; nameZh: string; sportCode: string }
export interface DakarCompetitor { id: string; name: string; nameZh: string; country: string; score: string; rank: string; qualification: string; irm: string; winner: boolean }
export interface DakarSet { label: string; scores: { country: string; score: string }[] }
export interface DakarUnit {
  id: string; date: string; sportCode: string; sport: string; event: string;
  startsAt: string | null; venue: string; status: string; statusLabel: string;
  official: boolean; headToHead: boolean; competitors: DakarCompetitor[];
  athletes: DakarAthlete[]; sets: DakarSet[]; sourceUrl: string; detailAvailable: boolean; retained?: boolean;
}
export interface DakarDay { date: string; units: DakarUnit[]; totalUnits: number; unconfirmedUnits: number }
export interface DakarCoverage { date: string; totalUnits: number; unconfirmedUnits: number; fetchedAt: string | null; lastAttemptAt: string | null; stale: boolean; warning: string | null }
export interface DakarMedals { gold: number; silver: number; bronze: number; entries: { medal: string; event: string; name: string; nameZh: string; sourceUrl: string }[] }
export interface DakarResponse {
  success: true; source: "DAKAR2026"; today: string; minDate: string; maxDate: string;
  units: DakarUnit[]; coverage: DakarCoverage[]; medals: DakarMedals | null;
  medalsFetchedAt: string | null; medalsStale: boolean; syncEnabled: boolean; syncIntervalMinutes: 15 | 60; // 15 remains readable during a static deployment transition.
}
