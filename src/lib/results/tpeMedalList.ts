import { TPE_MEDAL_DATA } from "./tpeMedalData";

// 代表團「成績公布總表」的得牌明細；資料由 scripts/import-tpe-medals.mjs 從 PDF 匯入。
export type MedalColor = "gold" | "silver" | "bronze";

export interface TpeMedal {
  /** 官方名單來源的識別碼；代表團總表匯入的項目沒有。 */
  id?: string;
  medal: MedalColor;
  sport: string;
  event: string;
  athletes: string[];
  date: string;
  /** 團體獎牌已由官方確認，但代表團尚未公布隊員名單。 */
  pending?: boolean;
}

export interface TpeMedalList {
  updatedAt: string;
  source: string;
  medals: TpeMedal[];
}

export interface MedalTally { gold: number; silver: number; bronze: number; total: number }
export interface MedalGroup { key: string; tally: MedalTally; medals: TpeMedal[] }

export const MEDAL_ORDER: readonly MedalColor[] = ["gold", "silver", "bronze"];
const rank = (medal: MedalColor) => MEDAL_ORDER.indexOf(medal);

/** 同一項目可有多位 TPE 得牌者（例如克拉術女子 57 公斤級）。 */
export function tpeMedalKey(entry: TpeMedal): string {
  return entry.id ?? JSON.stringify([entry.sport, entry.event, entry.medal, [...entry.athletes].sort()]);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) throw new Error(`獎牌明細${label}格式不符`);
  return value;
}

export function parseTpeMedalList(value: TpeMedalList): TpeMedalList {
  if (!Number.isFinite(Date.parse(value.updatedAt))) throw new Error("獎牌明細更新時間格式不符");
  const seen = new Set<string>();
  const medals = value.medals.map((entry) => {
    if (!MEDAL_ORDER.includes(entry.medal)) throw new Error("獎牌明細獎牌種類不符");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new Error("獎牌明細日期格式不符");
    text(entry.sport, "種類");
    text(entry.event, "項目");
    const key = tpeMedalKey(entry);
    if (seen.has(key)) throw new Error(`獎牌明細重複：${key}`);
    seen.add(key);
    if (!entry.athletes.length) throw new Error("獎牌明細缺少選手");
    return { ...entry, athletes: entry.athletes.map((name) => text(name, "姓名")) };
  });
  return { updatedAt: value.updatedAt, source: text(value.source, "來源"), medals };
}

export function medalTally(medals: readonly TpeMedal[]): MedalTally {
  const count = (medal: MedalColor) => medals.filter((entry) => entry.medal === medal).length;
  return { gold: count("gold"), silver: count("silver"), bronze: count("bronze"), total: medals.length };
}

/** 依金、銀、銅，同色依日期；保留原始順序作為最後依據。 */
export function sortedByMedal(medals: readonly TpeMedal[]): TpeMedal[] {
  return medals.map((entry, index) => ({ entry, index }))
    .sort((a, b) => rank(a.entry.medal) - rank(b.entry.medal) || a.entry.date.localeCompare(b.entry.date) || a.index - b.index)
    .map(({ entry }) => entry);
}

function groupBy(medals: readonly TpeMedal[], keyOf: (entry: TpeMedal) => string): MedalGroup[] {
  const groups = new Map<string, TpeMedal[]>();
  for (const entry of sortedByMedal(medals)) groups.set(keyOf(entry), [...(groups.get(keyOf(entry)) ?? []), entry]);
  return Array.from(groups, ([key, entries]) => ({ key, tally: medalTally(entries), medals: entries }));
}

export function groupMedalsByDate(medals: readonly TpeMedal[]): MedalGroup[] {
  return groupBy(medals, (entry) => entry.date).sort((a, b) => a.key.localeCompare(b.key));
}

/** 種類依奧運式排序（金 → 銀 → 銅 → 總數），同分依首面獎牌日期。 */
export function groupMedalsBySport(medals: readonly TpeMedal[]): MedalGroup[] {
  const firstDate = (group: MedalGroup) => group.medals.reduce((min, entry) => entry.date < min ? entry.date : min, "9999");
  return groupBy(medals, (entry) => entry.sport).sort((a, b) =>
    b.tally.gold - a.tally.gold || b.tally.silver - a.tally.silver || b.tally.bronze - a.tally.bronze || firstDate(a).localeCompare(firstDate(b)));
}

const DATA = parseTpeMedalList(TPE_MEDAL_DATA);
export const TPE_MEDAL_LIST: readonly TpeMedal[] = DATA.medals;
export const TPE_MEDAL_LIST_UPDATED = DATA.updatedAt;
export const TPE_MEDAL_LIST_SOURCE = DATA.source;
