import type { TpeCompetitor, TpeResultUnit } from "./types";
import { isTeamLabel, TEAM } from "./team";

export type ResultTone = "win" | "loss" | "draw" | "gold" | "silver" | "bronze" | "rank" | "qualified" | "stage";
export interface ResultHighlight { label: string; tone: ResultTone }
export interface SportSummary {
  wins: number;
  losses: number;
  draws: number;
  medals: { gold: number; silver: number; bronze: number };
  /** Best confirmed final placing; heat/group/stage ranks never contribute. */
  bestRank: number | null;
  featured: { unit: TpeResultUnit; kind: "running" | "next"; timeKnown: boolean } | null;
  stages: string[];
}

type Medal = "gold" | "silver" | "bronze";
type Outcome = "win" | "loss" | "draw";
const MEDALS: Record<string, Medal> = { GOLD: "gold", ME_GOLD: "gold", SILVER: "silver", ME_SILVER: "silver", BRONZE: "bronze", ME_BRONZE: "bronze" };
const MEDAL_LABELS: Record<Medal, string> = { gold: "金牌", silver: "銀牌", bronze: "銅牌" };
const OUTCOMES: Record<string, Outcome> = { W: "win", L: "loss", T: "draw", D: "draw" };
const OUTCOME_LABELS: Record<Outcome, string> = { win: "勝", loss: "負", draw: "和局" };
const RUNNING_STATUSES = new Set(["RUNNING", "LIVE", "IN_PROGRESS"]);
const NEXT_STATUSES = new Set(["SCHEDULED", "START_LIST", "RESCHEDULED"]);
const COMPLETED_STATUSES = new Set(["OFFICIAL", "UNOFFICIAL", "FINISHED"]);
const TEAM_SPORTS = new Set(["BBL", "BKB", "BK3", "WPO", "VVO", "HBL", "FBL", "HOC", "KAB", "RUG"]);
const PHASE_CODES: Record<string, string> = { QFNL: "八強賽", SFNL: "四強賽", "8FNL": "十六強賽", R32: "三十二強賽", FNL: "決賽" };

function medalOf(competitor: TpeCompetitor): Medal | undefined {
  return MEDALS[competitor.medal.trim().toUpperCase()];
}
function outcomeOf(competitor: TpeCompetitor): Outcome | undefined {
  return OUTCOMES[competitor.outcome.trim().toUpperCase()];
}
function rankOf(competitor: TpeCompetitor): number | null {
  const raw = competitor.rank.trim();
  if (!/^\d+$/.test(raw)) return null;
  const rank = Number(raw);
  return Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

export function competitorHighlights(unit: TpeResultUnit, competitor: TpeCompetitor): ResultHighlight[] {
  if (unit.status !== "OFFICIAL") return [];
  const badges: ResultHighlight[] = [];
  const medal = medalOf(competitor);
  const outcome = outcomeOf(competitor);
  const rank = rankOf(competitor);
  if (medal) badges.push({ label: MEDAL_LABELS[medal], tone: medal });
  if (unit.headToHead && outcome) badges.push({ label: OUTCOME_LABELS[outcome], tone: outcome });
  if (!unit.headToHead && !medal && rank !== null) badges.push({ label: `${rankContext(unit).label}第 ${rank} 名`, tone: "rank" });
  if (/^[Qq]$/.test(competitor.qualification.trim())) badges.push({ label: "晉級", tone: "qualified" });
  return badges;
}

function specialPhase(value: string): string | null {
  if (/\bbronze\b|\b(?:3rd|third)\s+place\b|銅牌|季軍/i.test(value)) return "銅牌賽";
  const finalGroup = value.match(/^finals?\s+([a-z])$/i);
  return finalGroup ? `${finalGroup[1].toUpperCase()} 組決賽` : null;
}
function knownPhase(value: string): string | null {
  const phase = value.trim();
  if (PHASE_CODES[phase.toUpperCase()]) return PHASE_CODES[phase.toUpperCase()];
  const special = specialPhase(phase);
  if (special) return special;
  if (/^(?:quarter[ -]?finals?|1\/4\s*finals?)$/i.test(phase)) return "八強賽";
  if (/^(?:semi[ -]?finals?|1\/2\s*finals?)$/i.test(phase)) return "四強賽";
  if (/^(?:round\s+of\s+16|1\/8\s*finals?)$/i.test(phase)) return "十六強賽";
  if (/^round\s+of\s+32$/i.test(phase)) return "三十二強賽";
  if (/^(?:finals?|gold\s+medal\s+(?:match|game))$/i.test(phase)) return "決賽";
  if (/^(?:heats?|preliminary(?:\s+round)?s?)$/i.test(phase)) return "預賽";
  if (/^(?:qualification|qualifying)(?:\s+round)?s?$/i.test(phase)) return "資格賽";
  if (/^(?:group\s+(?:stage|phase)|pool\s+stage)$/i.test(phase)) return "分組賽";
  if (/^round[ -]robin$/i.test(phase)) return "循環賽";
  if (["八強賽", "四強賽", "十六強賽", "三十二強賽", "決賽", "銅牌賽", "預賽", "資格賽", "分組賽", "循環賽"].includes(phase)) return phase;
  return null;
}
function stageInfo(unit: TpeResultUnit): { label: string; known: boolean } {
  // A bronze match or a B final must take precedence over a generic FNL key.
  const special = specialPhase(unit.phase.trim()) || specialPhase(unit.unit.trim());
  if (special) return { label: special, known: true };
  const code = unit.id.match(/(?:^|[.:])(QFNL|SFNL|8FNL|R32|FNL)[_-]*(?:[.:]|$)/i)?.[1].toUpperCase();
  if (unit.phase.trim()) {
    const translated = knownPhase(unit.phase);
    // The feed can call a knockout stage simply "Round 3" while its unit key
    // identifies 8FNL. Preserve semantic labels such as placement rounds.
    if (!translated && /^round\s+\d+$/i.test(unit.phase.trim()) && code) return { label: PHASE_CODES[code], known: true };
    return { label: translated || unit.phase.trim(), known: translated !== null };
  }
  const unitPhase = knownPhase(unit.unit);
  if (unitPhase) return { label: unitPhase, known: true };
  return code ? { label: PHASE_CODES[code], known: true } : { label: unit.unit.trim(), known: false };
}

export function stageLabel(unit: TpeResultUnit): string {
  return stageInfo(unit).label;
}

/** Rk belongs to its result unit. OFFICIAL confirms that unit, not an event's overall ranking. */
export function rankContext(unit: TpeResultUnit): { label: string; final: boolean } {
  if (unit.headToHead) return { label: "本場", final: false };
  const stage = stageInfo(unit);
  const phase = unit.phase.trim();
  const name = unit.unit.trim();
  const heat = name.match(/\bheat\s+(\d+)$/i) || name.match(/預賽第\s*(\d+)\s*組/);
  if (stage.label === "預賽" || /^(?:preliminary\s+race|HEAT)$/i.test(phase) || heat) {
    return { label: heat ? `預賽第 ${heat[1]} 組` : "預賽", final: false };
  }
  const group = name.match(/^(?:group|pool)\s+([a-z0-9]+)$/i);
  const finalGroup = `${phase} ${name}`.match(/\bfinals?\s+([a-z])\b|\b([a-z])\s+finals?\b/i);
  if (/^[A-Z] 組決賽$/.test(stage.label) || finalGroup) {
    return { label: finalGroup ? `${(finalGroup[1] || finalGroup[2]).toUpperCase()} 組決賽` : stage.label, final: false };
  }
  if (group) return { label: `${stage.label === "決賽" ? "決賽" : stage.known ? stage.label : "分組賽"} ${group[1].toUpperCase()} 組`, final: false };
  const day = name.match(/^day\s+(\d+)$/i);
  if (day) return { label: `${stage.known ? stage.label : "階段"}第 ${day[1]} 日`, final: false };
  // A final may contain several groups, races, apparatus or cumulative sessions.
  // Only an unqualified final unit (or a named final of the entire event) can
  // supply an overall placing. Keep unfamiliar/partial units out of the summary.
  const normalizedName = name.toLocaleLowerCase().replace(/\s+/g, " ");
  const normalizedEvent = unit.event.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const entireFinal = /^(?:finals?|決賽|總決賽)$/.test(normalizedName) ||
    Boolean(normalizedEvent && [normalizedEvent, `${normalizedEvent} final`, `${normalizedEvent} finals`].includes(normalizedName));
  if (stage.label === "決賽" && entireFinal) return { label: "最終", final: true };
  if (stage.label === "決賽") return { label: "決賽階段", final: false };
  if (stage.label === "四強賽") return { label: "準決賽", final: false };
  return { label: stage.known ? stage.label : "本階段", final: false };
}

function evidenceKey(unit: TpeResultUnit): string {
  // Duplicate snapshots with contradictory evidence cannot safely contribute totals.
  // Display names and scores are irrelevant to explicit outcome/award evidence.
  return JSON.stringify([
    unit.discipline, unit.event, unit.phase, unit.unit, unit.status, unit.headToHead,
    [...new Set(unit.competitors.map((c) => JSON.stringify([c.id, c.organisation, c.outcome.trim().toUpperCase(), c.rank.trim(), medalOf(c) || c.medal.trim(), c.qualification.trim(), c.irm.trim()])))].sort(),
  ]);
}
function eventKey(unit: TpeResultUnit): string {
  return JSON.stringify([unit.discipline, unit.event.trim()]);
}
function uniqueUnits(units: TpeResultUnit[]): { units: TpeResultUnit[]; conflictedEvents: Set<string> } {
  const byId = new Map<string, { unit: TpeResultUnit; evidence: string; conflict: boolean }>();
  const conflictedEvents = new Set<string>();
  for (const unit of units) {
    const evidence = evidenceKey(unit);
    const previous = byId.get(unit.id);
    if (!previous) byId.set(unit.id, { unit, evidence, conflict: false });
    else if (previous.evidence !== evidence) {
      previous.conflict = true;
      conflictedEvents.add(eventKey(previous.unit));
      conflictedEvents.add(eventKey(unit));
    }
  }
  return { units: [...byId.values()].filter(({ conflict }) => !conflict).map(({ unit }) => unit), conflictedEvents };
}
function matchOutcome(unit: TpeResultUnit): Outcome | null {
  const tpe = unit.competitors.filter((c) => c.organisation === TEAM);
  const outcomes = new Set(tpe.map(outcomeOf).filter((value): value is Outcome => value !== undefined));
  if (outcomes.size !== 1) return null;
  const outcome = [...outcomes][0];
  const opposite = outcome === "win" ? "loss" : outcome === "loss" ? "win" : "draw";
  if (unit.competitors.some((c) => c.organisation !== TEAM && outcomeOf(c) && outcomeOf(c) !== opposite)) return null;
  return outcome;
}
function isTeamEvent(unit: TpeResultUnit): boolean {
  return TEAM_SPORTS.has(unit.discipline) || /\b(?:teams?|relays?|doubles|pairs?)\b|團體|接力|雙打|雙人/i.test(unit.event);
}
function isTeamEntrant(competitor: TpeCompetitor): boolean {
  const id = competitor.id.trim().toUpperCase();
  return id === TEAM || id === `${TEAM}:${TEAM}` || new RegExp(`${TEAM}\\d+$`).test(id) ||
    isTeamLabel(competitor.name) ||
    competitor.name.split("/").filter((name) => name.trim()).length > 1;
}
function singleMedal(competitors: TpeCompetitor[]): Medal | null {
  const medals = new Set(competitors.map(medalOf).filter((value): value is Medal => value !== undefined));
  return medals.size === 1 ? [...medals][0] : null;
}
function addMedals(units: TpeResultUnit[], summary: SportSummary): void {
  const events = new Map<string, { team: boolean; competitors: TpeCompetitor[] }>();
  for (const unit of units) {
    if (!unit.discipline.trim() || !unit.event.trim()) continue;
    const key = eventKey(unit);
    const event = events.get(key) || { team: false, competitors: [] };
    event.team ||= isTeamEvent(unit);
    event.competitors.push(...unit.competitors.filter((c) => c.organisation === TEAM));
    events.set(key, event);
  }
  for (const event of events.values()) {
    const entrants = new Map<string, TpeCompetitor[]>();
    for (const competitor of event.competitors) {
      if (!competitor.id.trim()) continue;
      const rows = entrants.get(competitor.id) || [];
      rows.push(competitor);
      entrants.set(competitor.id, rows);
    }
    let groups = [...entrants.values()];
    if (event.team) {
      const teams = groups.filter((rows) => rows.some(isTeamEntrant));
      // A single team and its repeated members share one award. With member-only
      // data, unanimous explicit evidence supports at most one team award.
      // Multiple named teams retain their IDs; unlinked members cannot add medals.
      groups = teams.length > 1 ? teams : [groups.flat()];
    }
    for (const rows of groups) {
      const medal = singleMedal(rows);
      if (medal) summary.medals[medal] += 1;
    }
  }
}
function knownTime(unit: TpeResultUnit): number | null {
  if (!unit.startsAt || /followed\s*by|接續前場|時間待定|hidden|\btbd\b/i.test(unit.timeNote)) return null;
  const time = Date.parse(unit.startsAt);
  return Number.isFinite(time) ? time : null;
}
// 賽制先後：資格／預賽 → 分組 → 淘汰賽各輪 → 銅牌賽 → 決賽。未辨識的階段視為最早。
const STAGE_RANK: Record<string, number> = { 資格賽: 1, 預賽: 2, 分組賽: 3, 循環賽: 3, 三十二強賽: 5, 十六強賽: 6, 八強賽: 7, 四強賽: 8, 銅牌賽: 9, 決賽: 10 };
const CODE_RANK: Record<string, number> = { R64: 4, R32: 5, "8FNL": 6, QFNL: 7, SFNL: 8, FNL: 10 };
function stageRank(label: string): number {
  return STAGE_RANK[label] ?? (/^[A-Z] 組決賽$/.test(label) ? 9 : 0);
}
function unitStageRank(unit: TpeResultUnit): number {
  const stage = stageInfo(unit);
  if (stage.known) return stageRank(stage.label);
  const code = unit.id.match(/(?:^|[.:])(R64|R32|8FNL|QFNL|SFNL|FNL)[_-]*(?:[.:]|$)/i)?.[1].toUpperCase();
  return code ? CODE_RANK[code] : 0;
}
function matchNumber(unit: TpeResultUnit): number {
  const number = unit.unit.match(/(\d+)\s*$/);
  return number ? Number(number[1]) : 0;
}
function byTime(a: TpeResultUnit, b: TpeResultUnit): number {
  return (knownTime(a) ?? Infinity) - (knownTime(b) ?? Infinity) || unitStageRank(a) - unitStageRank(b) || matchNumber(a) - matchNumber(b) || a.id.localeCompare(b.id);
}

/** 場次顯示順序：日期 → 已知開賽時間 → 賽制輪次 → 場序。「接續前場」沒有時間，只能依輪次與場序推定。 */
export function compareSchedule(a: TpeResultUnit, b: TpeResultUnit): number {
  return (a.scheduleDate ?? "").localeCompare(b.scheduleDate ?? "") || byTime(a, b);
}

export function summarizeSport(units: TpeResultUnit[]): SportSummary {
  const summary: SportSummary = { wins: 0, losses: 0, draws: 0, medals: { gold: 0, silver: 0, bronze: 0 }, bestRank: null, featured: null, stages: [] };
  const deduplicated = uniqueUnits(units);
  // The source has already selected TPE schedules. A not-yet-published start
  // list may have no competitor rows, but explicit non-TPE rows cannot qualify.
  const unique = deduplicated.units.filter((unit) => !unit.competitors.length || unit.competitors.some((c) => c.organisation === TEAM));
  const official = unique.filter((unit) => unit.status === "OFFICIAL");
  for (const unit of official) {
    if (unit.headToHead) {
      const outcome = matchOutcome(unit);
      if (outcome === "win") summary.wins += 1;
      if (outcome === "loss") summary.losses += 1;
      if (outcome === "draw") summary.draws += 1;
    } else if (rankContext(unit).final && !deduplicated.conflictedEvents.has(eventKey(unit))) {
      for (const competitor of unit.competitors) {
        if (competitor.organisation !== TEAM || medalOf(competitor)) continue;
        const rank = rankOf(competitor);
        const conflict = unit.competitors.some((other) => other !== competitor && other.id === competitor.id && other.organisation === TEAM && other.rank.trim() && other.rank.trim() !== competitor.rank.trim());
        if (conflict) continue;
        if (rank !== null) summary.bestRank = Math.min(summary.bestRank ?? Infinity, rank);
      }
    }
  }
  // A conflicting duplicate must not let an older phase's award survive as if
  // the event had no conflicting evidence. Exclude that event conservatively.
  addMedals(official.filter((unit) => !deduplicated.conflictedEvents.has(eventKey(unit))), summary);
  const running = unique.filter((unit) => RUNNING_STATUSES.has(unit.status)).sort(byTime)[0];
  // 有開賽時間的優先；都沒有時，接續前場的場次依日期與輪次推定下一場，但不捏造時間。
  const upcoming = unique.filter((unit) => NEXT_STATUSES.has(unit.status));
  const next = upcoming.filter((unit) => knownTime(unit) !== null).sort(compareSchedule)[0] ?? [...upcoming].sort(compareSchedule)[0];
  if (running) summary.featured = { unit: running, kind: "running", timeKnown: knownTime(running) !== null };
  else if (next) summary.featured = { unit: next, kind: "next", timeKnown: knownTime(next) !== null };
  const stages = new Set<string>();
  for (const unit of unique) {
    if (!COMPLETED_STATUSES.has(unit.status)) continue;
    const stage = stageInfo(unit);
    if (stage.known) stages.add(stage.label);
  }
  // 依賽制排序，只保留最近的三個階段。
  summary.stages = [...stages].sort((a, b) => stageRank(a) - stageRank(b)).slice(-3);
  return summary;
}
