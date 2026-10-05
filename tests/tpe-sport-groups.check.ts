import assert from "node:assert/strict";
import { summarizeSport } from "../src/lib/results/highlights";
import { groupResultSports, resultSport } from "../src/lib/results/sportGroups";
import type { TpeResultUnit } from "../src/lib/results/types";

function unit(discipline: string, category: string, event: string, overrides: Partial<TpeResultUnit> = {}): TpeResultUnit {
  return {
    id: `AG2026:${discipline}:${category}.TEAM--------------.FNL-.000100--`, discipline,
    sport: discipline, event, phase: "Final", unit: "Final", startsAt: null, timeNote: "", venue: "",
    status: "OFFICIAL", statusLabel: "正式成績", headToHead: true, sourceUrl: "https://results.asiangames2026.org/", detailAvailable: true,
    competitors: [{ id: "TPE01", name: "TPE", organisation: "TPE", result: "3", rank: "", outcome: "W", medal: "", qualification: "", irm: "" }], ...overrides,
  };
}

const men = unit("BKB", "M", "Men's Team");
const women = unit("BKB", "W", "Women's Team", { competitors: [{ ...men.competitors[0], outcome: "L" }] });
const three = unit("BK3", "M", "Men");
const basketball = groupResultSports([men, women, three]);
assert.deepEqual(basketball.map((group) => group.label), ["女子籃球", "男子籃球"]);
assert.equal(summarizeSport(basketball[0].entries).losses, 1);
assert.equal(summarizeSport(basketball[0].entries).wins, 0);
assert.deepEqual(basketball[1].sections.map((section) => section.label), ["男子 · 5×5", "男子 · 3×3"]);
assert.ok(basketball[1].sections.every((section) => section.entries.length === 1));
for (const [disc, female, male] of [["VVO", "女子排球", "男子排球"], ["KAB", "女子卡巴迪", "男子卡巴迪"], ["FBL", "女子足球", "男子足球"]]) {
  assert.equal(resultSport(unit(disc, "W", "Women")).label, female);
  assert.equal(resultSport(unit(disc, "M", "Men")).label, male);
  assert.notEqual(resultSport(unit(disc, "?", "Team", { id: "unknown" })).label, female, "unknown category cannot become a women's team");
}

const tte = groupResultSports([unit("TTE", "M", "Men's Team"), unit("TTE", "W", "Women's Singles"), unit("TTE", "X", "Mixed Doubles")]);
assert.equal(tte.length, 1);
assert.deepEqual(tte[0].sections.map((section) => section.label), ["男子", "女子", "混合"]);
assert.ok(tte[0].sections.every((section) => summarizeSport(section.entries).wins === 1));
assert.equal(resultSport(unit("TST", "W", "Women's Singles", { sport: "軟式網球" })).label, "軟網");
assert.equal(resultSport(unit("ELS", "O", "League of Legends", { sport: "電子競技" })).label, "電競");
assert.equal(groupResultSports([unit("GLF", "M", "Men Individual")])[0].label, "高爾夫球");

for (const event of ["Men Individual Poomsae", "女子個人品勢"]) assert.equal(resultSport(unit("TKW", "M", event)).label, "跆拳品勢");
assert.equal(resultSport(unit("TKW", "W", "Individual", { id: "AG2026:TKW:W.INDPOOM-----------.FNL-.000100--" })).label, "跆拳品勢");
assert.equal(resultSport(unit("TKW", "M", "Men +80kg")).label, "跆拳對打");
assert.equal(resultSport(unit("TKW", "M", "Men", { id: "AG2026:TKW:M.O80KG-------------.FNL-.000100--" })).label, "跆拳對打");
assert.equal(resultSport(unit("TKW", "M", "Team", { headToHead: true })).label, "跆拳道（項目待確認）");
assert.equal(resultSport(unit("TKW", "M", "Poomsae -80kg")).label, "跆拳道（項目待確認）");

const merged = [unit("CRD", "M", "Men's Road Race"), unit("CTR", "W", "Women's Sprint"), unit("CSP", "M", "Men's Canoe"), unit("CSL", "W", "Women's Kayak")];
const groups = groupResultSports(merged);
assert.deepEqual(groups.map((group) => group.label), ["輕艇", "自由車"]);
assert.deepEqual(groups.map((group) => group.sections.map((section) => section.label)), [["男子 · 靜水競速", "女子 · 激流標竿"], ["男子 · 公路賽", "女子 · 場地賽"]]);
assert.equal(groups.flatMap((group) => group.sections.flatMap((section) => section.entries)).length, merged.length);
assert.ok(groups.every((group) => group.entries.every((entry) => resultSport(entry).key === group.key)), "filter and accordion use identical classification");
assert.equal(resultSport(unit("EQU", "O", "Dressage")).label, "馬術", "unlisted sports must remain visible");
assert.equal(resultSport(unit("NEW", "O", "New event", { sport: "官方新項目" })).label, "官方新項目");
assert.ok(groupResultSports([unit("BMF", "O", "BMX Freestyle")])[0].sections.every((section) => !/\s/.test(section.key)), "section keys must work in aria-labelledby IDs");
console.info("PASS TPE sport groups: preferred names/order, separated team genders, discipline subgroups, taekwondo evidence, filter parity and no lost events");
