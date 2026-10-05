import assert from "node:assert/strict";
import { groupByCategory, resultCategory, type ResultCategoryKey } from "../src/lib/results/categories";
import { summarizeSport } from "../src/lib/results/highlights";
import type { TpeCompetitor, TpeResultUnit } from "../src/lib/results/types";

function entrant(overrides: Partial<TpeCompetitor> = {}): TpeCompetitor {
  return { id: "TPE01", name: "Athlete", organisation: "TPE", result: "", rank: "", outcome: "", qualification: "", irm: "", medal: "", ...overrides };
}
function unit(overrides: Partial<TpeResultUnit> = {}): TpeResultUnit {
  return { id: "unrecognized-id", discipline: "TTE", sport: "桌球", event: "Singles", phase: "Final", unit: "Match 1", startsAt: "2026-09-23T01:00:00Z", timeNote: "", venue: "Arena", status: "OFFICIAL", statusLabel: "正式成績", headToHead: true, competitors: [entrant()], sourceUrl: "https://example.test/results", detailAvailable: true, ...overrides };
}
function key(value: TpeResultUnit): ResultCategoryKey {
  return resultCategory(value).key;
}

for (const [code, expected, label] of [["M", "men", "男子"], ["W", "women", "女子"], ["X", "mixed", "混合"], ["O", "open", "公開組"]] as const) {
  assert.deepEqual(resultCategory(unit({ id: `AG2026:TTE:${code}.DOUBLES-----------.R32-.000400--` })), { key: expected, label }, "canonical source keys classify neutral event descriptions");
}
assert.equal(key(unit({ id: "AG2026:SHO:W.APW---------------.FNL-.000100--", discipline: "SHO", event: "10m Air Pistol Women Individual" })), "women");
assert.equal(key(unit({ id: "AG2026:ELS:O.TEAM--------------.GPA-.000100--", discipline: "ELS", event: "League of Legends" })), "open", "neutral esports labels retain their explicit open code");
assert.equal(key(unit({ id: "AG2026:TTE:X.DOUBLES-----------.R32-.000400--", event: "Mixed Doubles" })), "mixed");

for (const [event, expected] of [
  ["Men", "men"], ["Men's Singles", "men"], ["Men’s Singles", "men"], ["Men‘s Singles", "men"], ["Menʼs Singles", "men"], ["Men＇s Singles", "men"],
  ["Women", "women"], ["Women's Singles", "women"], ["Women’s Singles", "women"], ["Womenʼs Singles", "women"],
  ["10m Air Pistol Women Individual", "women"], ["Individual MEN - final", "men"], ["Female Individual", "women"], ["Male Individual", "men"],
  ["Mixed Doubles", "mixed"], ["OPEN singles", "open"], ["男子100公尺", "men"], ["女子雙打", "women"], ["混合雙打", "mixed"], ["公開組雙打", "open"],
] as const) {
  assert.equal(key(unit({ event })), expected, `explicit event fallback: ${event}`);
}
for (const event of ["Women Singles", "Female Individual"]) {
  assert.equal(key(unit({ event })), "women", "Men/Male cannot match substrings inside Women/Female");
}
for (const event of ["Singles", "Team", "Showmen", "Womenswear", "Femalevolent", "Openwater", "Mixedness", "SuperMen", "éMen", "Womené", "Mixed_Youth", "Men2"]) {
  assert.equal(key(unit({ event })), "unclassified", `neutral labels or partial words are not category evidence: ${event}`);
}
assert.equal(key(unit({ event: "Singles", phase: "Women Final", unit: "Men Match", venue: "Mixed Arena", competitors: [entrant({ id: "MALE01", name: "Female Men Women" })] })), "unclassified", "category evidence cannot come from athlete names, IDs, phase, unit or venue");
assert.equal(key(unit({ id: "AG2026:TTE:Z.SINGLES-----------.FNL-.000100--", event: "Women's Singles" })), "women", "unrecognized code may use explicit event evidence");

for (const id of [
  "prefix:AG2026:TTE:M.SINGLES-----------.FNL-.000100--", "AG2026:TTE:M.SINGLES-----------.FNL-.000100--:suffix",
  "AG2026:TTE:M.SINGLES-----------.FNL-.000100--\n", "AG2025:TTE:M.SINGLES-----------.FNL-.000100--",
  "AG2026:TEN:M.SINGLES-----------.FNL-.000100--", "AG2026:TTE:MEN.SINGLES-----------.FNL-.000100--",
  "AG2026:TTE:M.", "AG2026:TTE:M.SINGLES", "AG2026:TTE:M.SINGLES..0001", "AG2026:TTE:M.SINGLES.FNL.0001.extra",
]) {
  assert.equal(key(unit({ id })), "unclassified", `noncanonical/mismatched key is not category evidence: ${JSON.stringify(id)}`);
  assert.equal(key(unit({ id, event: "Women" })), "women", "invalid key does not override explicit event evidence");
}
for (const [code, event] of [["M", "Women Singles"], ["W", "Men Singles"], ["X", "Open Doubles"], ["O", "Mixed Team"]]) {
  assert.equal(key(unit({ id: `AG2026:TTE:${code}.SINGLES-----------.FNL-.000100--`, event })), "unclassified", "code/text contradictions must remain visible as unclassified");
}
for (const event of ["Men and Women", "男子／女子", "Mixed Men Team", "Women's Open Singles", "Female Male Individual", "公開混合組"]) {
  assert.equal(key(unit({ event })), "unclassified", "multiple incompatible text categories are ambiguous");
  assert.equal(key(unit({ id: "AG2026:TTE:M.SINGLES-----------.FNL-.000100--", event })), "unclassified", "a canonical code cannot hide conflicting text signals");
}
for (const [event, expected] of [["Men's Singles / 男子 / Male", "men"], ["Women's Singles / 女子 / Female", "women"], ["Mixed Doubles / 混合", "mixed"], ["Open / 公開組", "open"]] as const) {
  assert.equal(key(unit({ event })), expected, "repeated same-category signals do not create a conflict");
}

assert.deepEqual(groupByCategory([]), []);
const firstWoman = unit({ id: "woman-1", event: "Women" });
const ordered = [unit({ id: "unknown" }), firstWoman, unit({ id: "open", event: "Open" }), unit({ id: "man-1", event: "Men" }), unit({ id: "mixed", event: "Mixed" }), unit({ id: "woman-2", event: "Women" }), unit({ id: "man-2", event: "Men" }), firstWoman];
const original = structuredClone(ordered);
const grouped = groupByCategory(ordered);
assert.deepEqual(grouped.map(({ key: category, label }) => [category, label]), [["men", "男子"], ["women", "女子"], ["mixed", "混合"], ["open", "公開組"], ["unclassified", "未分類"]]);
assert.deepEqual(grouped.map(({ entries }) => entries.map(({ id }) => id)), [["man-1", "man-2"], ["woman-1", "woman-2", "woman-1"], ["mixed"], ["open"], ["unknown"]]);
assert.equal(grouped.reduce((total, group) => total + group.entries.length, 0), ordered.length, "every occurrence survives grouping, including duplicate source IDs");
assert.equal(grouped[1].entries[0], firstWoman, "grouping preserves the original unit objects");
assert.deepEqual(ordered, original, "grouping never mutates source records or input order");
assert.deepEqual(groupByCategory([firstWoman]).map(({ key: category }) => category), ["women"], "empty categories are omitted and a single category remains labeled");

const results = [
  unit({ id: "AG2026:TTE:M.SINGLES-----------.FNL-.000100--", event: "Singles", competitors: [entrant({ outcome: "W", medal: "GOLD" }), entrant({ id: "KOR01", organisation: "KOR", outcome: "L" })] }),
  unit({ id: "AG2026:TTE:W.SINGLES-----------.FNL-.000100--", event: "Singles", competitors: [entrant({ outcome: "L", medal: "SILVER" }), entrant({ id: "KOR01", organisation: "KOR", outcome: "W" })] }),
  unit({ id: "AG2026:TTE:X.DOUBLES-----------.GPA-.000100--", event: "Doubles", competitors: [entrant({ outcome: "D" }), entrant({ id: "KOR01", organisation: "KOR", outcome: "T" })] }),
  ...["RUNNING", "UNOFFICIAL", "FINISHED", "SCHEDULED"].flatMap((status, index) => [
    unit({ id: `AG2026:TTE:M.TEAM--------------.GPA-.000${index + 2}00--`, event: "Men Team", status, competitors: [entrant({ outcome: "L", medal: "BRONZE" })] }),
    unit({ id: `AG2026:TTE:W.TEAM--------------.GPA-.000${index + 2}00--`, event: "Women Team", status, competitors: [entrant({ outcome: "W", medal: "GOLD" })] }),
  ]),
];
const summaries = groupByCategory(results).map(({ key: category, entries }) => {
  const summary = summarizeSport(entries);
  return { category, wins: summary.wins, losses: summary.losses, draws: summary.draws, medals: summary.medals };
});
assert.deepEqual(summaries, [
  { category: "men", wins: 1, losses: 0, draws: 0, medals: { gold: 1, silver: 0, bronze: 0 } },
  { category: "women", wins: 0, losses: 1, draws: 0, medals: { gold: 0, silver: 1, bronze: 0 } },
  { category: "mixed", wins: 0, losses: 0, draws: 1, medals: { gold: 0, silver: 0, bronze: 0 } },
], "same-sport categories summarize independently, even with identical neutral event/entrant identities; provisional results cannot alter official totals");

console.info("PASS TPE result categories: canonical keys, bounded event evidence, conflicts, complete grouping and independent official summaries");
