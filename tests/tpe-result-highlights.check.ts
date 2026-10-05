import assert from "node:assert/strict";
import { compareSchedule, competitorHighlights, stageLabel, summarizeSport } from "../src/lib/results/highlights";
import type { TpeCompetitor, TpeResultUnit } from "../src/lib/results/types";

function entrant(overrides: Partial<TpeCompetitor> = {}): TpeCompetitor {
  return { id: "athlete-1", name: "Athlete", organisation: "TPE", result: "", rank: "", outcome: "", qualification: "", irm: "", medal: "", ...overrides };
}
function unit(overrides: Partial<TpeResultUnit> = {}): TpeResultUnit {
  return { id: "AG2026:ATH:M.100M.FNL.0001", discipline: "ATH", sport: "田徑", event: "Men's 100m", phase: "Final", unit: "Final", startsAt: "2026-09-23T01:00:00Z", timeNote: "", venue: "Stadium", status: "OFFICIAL", statusLabel: "正式成績", headToHead: false, competitors: [entrant()], sourceUrl: "https://example.test/results", detailAvailable: true, ...overrides };
}
function tones(value: TpeResultUnit, competitor = value.competitors[0]) {
  return competitorHighlights(value, competitor).map((badge) => badge.tone);
}

for (const status of ["RUNNING", "LIVE", "IN_PROGRESS", "UNOFFICIAL", "FINISHED", "SCHEDULED", "CANCELLED"]) {
  const provisional = unit({ status, competitors: [entrant({ outcome: "W", rank: "1", medal: "GOLD", qualification: "Q" })] });
  assert.deepEqual(tones(provisional), [], `${status} cannot supply confirmed badges`);
  const summary = summarizeSport([provisional]);
  assert.deepEqual([summary.wins, summary.losses, summary.draws, summary.bestRank, summary.medals.gold], [0, 0, 0, null, 0]);
}
for (const [code, tone] of [["GOLD", "gold"], ["ME_GOLD", "gold"], ["SILVER", "silver"], ["ME_SILVER", "silver"], ["BRONZE", "bronze"], ["ME_BRONZE", "bronze"]]) {
  const official = unit({ competitors: [entrant({ medal: code, rank: "1" })] });
  assert.deepEqual(tones(official), [tone], "explicit awards replace the unit rank badge");
}
for (const medal of ["1", "2", "3", "WINNER", "Medal", ""]) {
  const ranked = unit({ competitors: [entrant({ medal, rank: "1" })] });
  assert.deepEqual(competitorHighlights(ranked, ranked.competitors[0]), [{ label: "最終第 1 名", tone: "rank" }]);
  assert.deepEqual(summarizeSport([ranked]).medals, { gold: 0, silver: 0, bronze: 0 }, "numeric rank/medal flags never imply an award");
}
for (const rank of ["0", "-1", "1.5", "=2", "1st", "DNF", "Infinity", "9007199254740992"]) {
  const invalid = unit({ competitors: [entrant({ rank })] });
  assert.deepEqual(tones(invalid), []);
  assert.equal(summarizeSport([invalid]).bestRank, null);
}
for (const qualification of ["Q", "q"]) {
  const qualified = unit({ competitors: [entrant({ qualification })] });
  assert.deepEqual(tones(qualified), ["qualified"]);
}
assert.deepEqual(tones(unit({ competitors: [entrant({ qualification: "Q?" })] })), []);

const match = unit({ id: "AG2026:KAB:M.TEAM7.GPA.0001", discipline: "KAB", event: "Men", headToHead: true, competitors: [entrant({ id: "TPE01", name: "TPE", outcome: "W", rank: "1" }), entrant({ id: "KOR01", organisation: "KOR", outcome: "L" })] });
assert.deepEqual(tones(match), ["win"]);
assert.equal(summarizeSport([match, structuredClone(match)]).wins, 1, "duplicate unit IDs count a match once");
assert.equal(summarizeSport([match]).bestRank, null, "head-to-head rank is not an individual unit placing");
for (const [outcome, counter, tone] of [["L", "losses", "loss"], ["T", "draws", "draw"], ["D", "draws", "draw"]] as const) {
  const result = unit({ headToHead: true, competitors: [entrant({ outcome })] });
  assert.equal(summarizeSport([result])[counter], 1);
  assert.deepEqual(tones(result), [tone]);
}
const scoresOnly = unit({ headToHead: true, competitors: [entrant({ result: "99", rank: "1" }), entrant({ id: "CHN01", organisation: "CHN", result: "1", rank: "2", outcome: "L" })] });
assert.equal(summarizeSport([scoresOnly]).wins, 0, "scores, ranks and opponent losses cannot invent a TPE win");
assert.equal(summarizeSport([unit({ competitors: [entrant({ outcome: "W" })] })]).wins, 0, "race winner flags do not count as head-to-head wins");
const repeatedTeam = { ...match, competitors: [match.competitors[0], entrant({ id: "member-2", outcome: "W" }), match.competitors[1]] };
assert.equal(summarizeSport([repeatedTeam]).wins, 1, "member rows do not create additional match wins");
assert.equal(summarizeSport([match, { ...match, competitors: [entrant({ outcome: "L" })] }]).wins, 0, "conflicting versions of one unit are excluded");
assert.equal(summarizeSport([{ ...match, competitors: [entrant({ outcome: "W" }), entrant({ id: "member-2", outcome: "L" })] }]).wins, 0, "contradictory TPE outcomes do not count");
assert.equal(summarizeSport([{ ...match, competitors: [match.competitors[0], { ...match.competitors[1], outcome: "W" }] }]).wins, 0, "both opponents cannot be official winners");

const gold = unit({ competitors: [entrant({ medal: "GOLD", rank: "1" })] });
assert.deepEqual(summarizeSport([gold, { ...gold, id: "other-phase" }]).medals, { gold: 1, silver: 0, bronze: 0 }, "one entrant/event medal is counted across phases once");
assert.equal(summarizeSport([gold]).bestRank, null, "award rows do not also create a rank summary");
assert.deepEqual(summarizeSport([gold, { ...gold, id: "different-event", event: "Men's 200m" }, { ...gold, id: "different-sport", discipline: "SWM" }]).medals, { gold: 3, silver: 0, bronze: 0 }, "discipline and event are part of award identity");
assert.equal(summarizeSport([gold, { ...gold, id: "another-entrant", competitors: [entrant({ id: "athlete-2", medal: "GOLD" })] }]).medals.gold, 2, "individual co-medallists remain separate entrants");
assert.deepEqual(summarizeSport([gold, { ...gold, id: "conflicting-award", competitors: [entrant({ medal: "SILVER" })] }]).medals, { gold: 0, silver: 0, bronze: 0 }, "conflicting awards for an entrant/event are not counted");
assert.equal(summarizeSport([{ ...gold, id: "earlier-phase" }, gold, { ...gold, competitors: [entrant({ medal: "SILVER" })] }]).medals.gold, 0, "an excluded conflicting duplicate cannot leave an older-phase medal counted");
const teamGold = { ...match, competitors: [entrant({ id: "TPE01", name: "TPE", medal: "GOLD" }), entrant({ id: "member-1", medal: "GOLD" }), entrant({ id: "member-2", medal: "ME_GOLD" })] };
assert.equal(summarizeSport([teamGold, { ...teamGold, id: "team-other-unit" }]).medals.gold, 1, "one team award survives repeated members and phases");
const relayGold = unit({ event: "Women's 4x100m Relay", competitors: [entrant({ id: "relay-member-1", medal: "GOLD" }), entrant({ id: "relay-member-2", medal: "GOLD" })] });
assert.equal(summarizeSport([relayGold]).medals.gold, 1, "member-only team awards are conservatively counted once");
assert.deepEqual(summarizeSport([{ ...relayGold, competitors: [relayGold.competitors[0], entrant({ id: "relay-member-2", medal: "BRONZE" })] }]).medals, { gold: 0, silver: 0, bronze: 0 }, "unlinked conflicting team members do not manufacture two medals");
const doublesGold = unit({ id: "doubles-final", discipline: "TTE", event: "Mixed Doubles", headToHead: true, competitors: [entrant({ id: "TTEXDOUBLES----TPE01", name: "Pair 1", medal: "GOLD" })] });
const doublesBronze = { ...doublesGold, id: "doubles-semifinal", competitors: [entrant({ id: "TTEXDOUBLES----TPE02", name: "Pair 2", medal: "BRONZE" })] };
assert.deepEqual(summarizeSport([doublesGold, doublesBronze]).medals, { gold: 1, silver: 0, bronze: 1 }, "official composite pair IDs preserve distinct TPE entrants with different awards");
assert.equal(summarizeSport([{ ...doublesGold, competitors: [{ ...doublesGold.competitors[0], medal: "BRONZE" }] }, doublesBronze]).medals.bronze, 2, "two distinct official pair entrants can each receive bronze");
const repeatedPairs = { ...doublesGold, id: "doubles-award-list", competitors: [...doublesGold.competitors, ...doublesBronze.competitors, entrant({ id: "pair-member-1", medal: "GOLD" }), entrant({ id: "pair-member-2", medal: "GOLD" }), entrant({ id: "pair-member-3", medal: "BRONZE" }), entrant({ id: "pair-member-4", medal: "BRONZE" })] };
assert.deepEqual(summarizeSport([doublesGold, doublesBronze, repeatedPairs, structuredClone(repeatedPairs)]).medals, { gold: 1, silver: 0, bronze: 1 }, "repeated pair and member rows cannot inflate either pair award");
assert.deepEqual(summarizeSport([{ ...doublesGold, competitors: [entrant({ id: "opaque-pair-1", name: "Player A / Player B", medal: "GOLD" }), entrant({ id: "opaque-pair-2", name: "Player C / Player D", medal: "BRONZE" }), entrant({ id: "unlinked-member", name: "Player A", medal: "GOLD" })] }]).medals, { gold: 1, silver: 0, bronze: 1 }, "composite pair names preserve distinct pairs even with opaque entrant IDs");
assert.equal(summarizeSport([unit({ competitors: [entrant({ id: "", medal: "GOLD" })] })]).medals.gold, 0, "missing entrant identity cannot support medal de-duplication");
const nonTpe = unit({ competitors: [entrant({ organisation: "CHN", medal: "GOLD", rank: "1", outcome: "W" })] });
assert.deepEqual(summarizeSport([nonTpe]), { wins: 0, losses: 0, draws: 0, medals: { gold: 0, silver: 0, bronze: 0 }, bestRank: null, featured: null, stages: [] });
assert.equal(summarizeSport([unit({ competitors: [entrant({ rank: "8" }), entrant({ id: "athlete-2", rank: "3" })] })]).bestRank, 3);
assert.equal(summarizeSport([unit({ competitors: [entrant({ rank: "1" }), entrant({ rank: "8" })] })]).bestRank, null, "conflicting ranks for one entrant in one unit are not counted");

for (const [code, expected] of [["QFNL", "八強賽"], ["SFNL", "四強賽"], ["8FNL", "十六強賽"], ["R32", "三十二強賽"], ["FNL", "決賽"]]) {
  assert.equal(stageLabel(unit({ id: `AG2026:TEN:M.SINGLES.${code}----.0001`, phase: "", unit: "Match 1" })), expected);
  assert.equal(stageLabel(unit({ phase: code })), expected);
}
assert.equal(stageLabel(unit({ phase: "Quarterfinals" })), "八強賽");
assert.equal(stageLabel(unit({ phase: "Semifinal" })), "四強賽");
assert.equal(stageLabel(unit({ phase: "Round of 16" })), "十六強賽");
const roundThree = unit({ id: "AG2026:TTE:X.DOUBLES-----------.8FNL.000100--", discipline: "TTE", event: "Mixed Doubles", phase: "Round 3", unit: "Match 1", headToHead: true });
assert.equal(stageLabel(roundThree), "十六強賽", "source-style generic Round 3 is resolved by its authoritative 8FNL phase code");
assert.deepEqual(summarizeSport([roundThree]).stages, ["十六強賽"]);
assert.equal(stageLabel({ ...roundThree, id: "AG2026:TTE:X.DOUBLES-----------.RND3.000100--" }), "Round 3", "generic round without a recognized code retains its source label");
assert.equal(stageLabel({ ...roundThree, phase: "Placement Round 3" }), "Placement Round 3", "a semantic unknown phase is not overwritten by the phase code");
assert.equal(stageLabel({ ...roundThree, phase: "Bronze Medal Match" }), "銅牌賽");
assert.equal(stageLabel({ ...roundThree, phase: "Final B" }), "B 組決賽");
assert.equal(stageLabel({ ...roundThree, unit: "Final B" }), "B 組決賽");
assert.equal(stageLabel(unit({ phase: "Bronze Medal Match" })), "銅牌賽");
assert.equal(stageLabel(unit({ phase: "Final B" })), "B 組決賽");
assert.equal(stageLabel(unit({ phase: "Final", unit: "Bronze Medal Match" })), "銅牌賽");
assert.equal(stageLabel(unit({ phase: "Unrecognized placement phase" })), "Unrecognized placement phase", "unknown explicit phase is not overwritten by generic FNL code");
const completed = ["Quarterfinals", "Semifinal", "Final", "Round of 16"].map((phase, i) => unit({ id: `completed-${i}`, phase }));
assert.deepEqual(summarizeSport([...completed, completed[0]]).stages, ["八強賽", "四強賽", "決賽"]);
assert.deepEqual(summarizeSport([unit({ phase: "Unknown phase" })]).stages, []);

const early = unit({ id: "early", status: "START_LIST", startsAt: "2026-09-23T00:00:00Z" });
const later = unit({ id: "later", status: "SCHEDULED", startsAt: "2026-09-23T03:00:00Z" });
const live = unit({ id: "live", status: "RUNNING", startsAt: null });
const ignoredStatuses = ["CANCELLED", "CANCELED", "POSTPONED", "DELAYED", "SUSPENDED", "INTERRUPTED", "NEW_STATUS"].map((status) => unit({ id: status, status, startsAt: "2026-09-23T00:00:00Z" }));
assert.equal(summarizeSport([later, early]).featured?.unit.id, "early");
assert.equal(summarizeSport([early, live, later]).featured?.kind, "running");
assert.equal(summarizeSport([early, live, later]).featured?.unit.id, "live");
for (const status of ["LIVE", "IN_PROGRESS"]) {
  const alias = { ...live, status };
  assert.equal(summarizeSport([early, alias, later]).featured?.kind, "running");
  assert.equal(summarizeSport([early, alias, later]).featured?.unit.id, "live", `${status} takes precedence over the next scheduled entry`);
}
assert.equal(summarizeSport([unit({ status: "RESCHEDULED" })]).featured?.kind, "next");
assert.equal(summarizeSport([{ ...early, competitors: [] }]).featured?.unit.id, "early", "TPE-filtered schedules can precede publication of competitor rows");
assert.equal(summarizeSport(ignoredStatuses).featured, null);
for (const hidden of [unit({ status: "SCHEDULED", startsAt: null }), unit({ status: "SCHEDULED", startsAt: "invalid" }), unit({ status: "SCHEDULED", timeNote: "FOLLOWED BY" }), unit({ status: "SCHEDULED", timeNote: "接續前場" }), unit({ status: "SCHEDULED", timeNote: "時間待定" })]) {
  const featured = summarizeSport([hidden]).featured;
  assert.equal(featured?.kind, "next", "a following match without a clock time is still the next match");
  assert.equal(featured?.timeKnown, false, "unknown/hidden start times cannot become a next timestamp");
}
const followed = unit({ id: "AG2026:BDM:M.DOUBLES.8FNL.000200", status: "SCHEDULED", startsAt: null, timeNote: "接續前場", scheduleDate: "2026-09-26" });
assert.equal(summarizeSport([followed, early]).featured?.unit.id, "early", "a known clock time is preferred over a following match");
assert.equal(summarizeSport([followed, early]).featured?.timeKnown, true);

const round = (id: string, phase: string, unitName: string, extra: Partial<TpeResultUnit> = {}) => unit({ id, phase, unit: unitName, startsAt: null, timeNote: "接續前場", scheduleDate: "2026-09-25", ...extra });
const r32m12 = round("AG2026:BDM:X.DOUBLES.R32-.001200--", "1st Round", "Match 12");
const r32m4 = round("AG2026:BDM:X.DOUBLES.R32-.000400--", "1st Round", "Match 4");
const r16m6 = round("AG2026:BDM:X.DOUBLES.8FNL.000600--", "2nd Round", "Match 6");
const timed = unit({ id: "AG2026:BDM:X.DOUBLES.QFNL.000100--", phase: "Quarterfinals", unit: "Match 1", startsAt: "2026-09-25T05:00:00Z", scheduleDate: "2026-09-25" });
assert.deepEqual([r16m6, r32m12, timed, r32m4].sort(compareSchedule).map((u) => u.id), [timed.id, r32m4.id, r32m12.id, r16m6.id], "known times first, then bracket round, then match number");
assert.deepEqual([round("b", "Round of 16", "Match 1", { scheduleDate: "2026-09-26" }), r16m6].sort(compareSchedule).map((u) => u.id), [r16m6.id, "b"], "schedule date wins over round");

const stagesOf = (...phases: string[]) => summarizeSport(phases.map((phase, i) => unit({ id: `stage-${i}`, phase }))).stages;
assert.deepEqual(stagesOf("Round of 16", "Quarterfinals", "Round of 32"), ["三十二強賽", "十六強賽", "八強賽"], "stages follow the bracket, not feed order");
assert.deepEqual(stagesOf("Semifinal", "Round of 32", "Quarterfinals", "Round of 16"), ["十六強賽", "八強賽", "四強賽"], "the latest stages are kept when truncating");
const original = structuredClone([match, gold, early]);
summarizeSport(original);
assert.deepEqual(original, [match, gold, early], "summary remains pure and leaves source order/records intact");
console.info("PASS TPE result highlights: official evidence, match outcomes, award identity, stage semantics and known schedules");
