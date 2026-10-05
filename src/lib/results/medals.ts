export interface MedalStanding {
  org: string;
  rank: string;
  tied: boolean;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

import { isOfficialTpeMedal, type OfficialTpeMedal } from "./officialMedals";
import { CONFIG } from "../../config";

export interface MedalResponse {
  success: true;
  fetchedAt: string | null;
  stale: boolean;
  warning: string | null;
  standings: MedalStanding[];
  /** 官方的本隊得牌名單；舊版回應沒有此欄位。 */
  tpeMedals?: OfficialTpeMedal[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("獎牌榜格式不符");
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("獎牌數格式不符");
  return value;
}

/** Official NOC totals count a team medal once; preserve official rank and ties. */
export function parseMedalStandings(value: unknown): MedalStanding[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error("獎牌榜尚未完整");
  const seen = new Set<string>();
  return value.filter((entry) => object(entry).Enabled !== false).map((entry) => {
    const row = object(entry);
    if (row.Championship !== CONFIG.source.code || row.Discipline !== "ALL" || typeof row.Org !== "string" || !/^[A-Z]{3}$/.test(row.Org) || seen.has(row.Org)) throw new Error("獎牌榜代表隊不符");
    if (typeof row.Rk !== "string" || !/^[1-9]\d{0,2}$/.test(row.Rk) || typeof row.RkEq !== "boolean") throw new Error("獎牌榜名次不符");
    seen.add(row.Org);
    const counts = object(row.Count);
    const gold = count(object(counts.ME_GOLD).total);
    const silver = count(object(counts.ME_SILVER).total);
    const bronze = count(object(counts.ME_BRONZE).total);
    const total = count(object(counts.total).total);
    if (gold + silver + bronze !== total) throw new Error("獎牌合計不符");
    return { org: row.Org, rank: row.Rk, tied: row.RkEq, gold, silver, bronze, total };
  }).sort((a, b) => Number(a.rank) - Number(b.rank));
}

export function isMedalResponse(value: unknown): value is MedalResponse {
  try {
    const data = object(value);
    if (data.success !== true || typeof data.stale !== "boolean" || !(data.warning === null || typeof data.warning === "string") || !(data.fetchedAt === null || (typeof data.fetchedAt === "string" && Number.isFinite(Date.parse(data.fetchedAt)))) || !Array.isArray(data.standings)) return false;
    if (data.tpeMedals !== undefined && !(Array.isArray(data.tpeMedals) && data.tpeMedals.every(isOfficialTpeMedal))) return false;
    const seen = new Set<string>();
    for (const value of data.standings) {
      const row = object(value);
      if (typeof row.org !== "string" || !/^[A-Z]{3}$/.test(row.org) || seen.has(row.org) || typeof row.rank !== "string" || !/^[1-9]\d{0,2}$/.test(row.rank) || typeof row.tied !== "boolean") return false;
      seen.add(row.org);
      if (count(row.gold) + count(row.silver) + count(row.bronze) !== count(row.total)) return false;
    }
    return true;
  } catch { return false; }
}
