import assert from "node:assert/strict";
import { competitorHighlights, rankContext, summarizeSport } from "../src/lib/results/highlights";
import type { TpeResultUnit } from "../src/lib/results/types";

// Public AG2026 results, checked 2026-09-23: WANG Hsing-hao was second
// in heat 3, but eighth in the final of the men's 200m individual medley.
const heat: TpeResultUnit = {
  id: "AG2026:SWM:M.200MIM------------.HEAT.000300--", discipline: "SWM", sport: "游泳",
  event: "Men's 200m Individual Medley", phase: "Heats", unit: "Heat 3",
  startsAt: "2026-09-20T02:00:00Z", timeNote: "", venue: "Tokyo Aquatics Centre",
  status: "OFFICIAL", statusLabel: "正式成績", headToHead: false, detailAvailable: true,
  sourceUrl: "https://results.asiangames2026.org/#/discipline/SWM/results/M.200MIM------------.HEAT.000300--",
  competitors: [{ id: "3559226", name: "WANG Hsing-hao", organisation: "TPE", result: "2:01.70", rank: "2", outcome: "", qualification: "", irm: "OK", medal: "" }],
};
const final: TpeResultUnit = {
  ...heat, id: "AG2026:SWM:M.200MIM------------.FNL-.000100--", phase: "Final", unit: "Men's 200m Individual Medley Final",
  startsAt: "2026-09-20T08:09:00Z",
  sourceUrl: "https://results.asiangames2026.org/#/discipline/SWM/results/M.200MIM------------.FNL-.000100--",
  competitors: [{ ...heat.competitors[0], result: "2:01.21", rank: "8" }],
};

assert.equal(summarizeSport([heat, final]).bestRank, 8, "a heat placing must not outrank the final placing");
assert.equal(summarizeSport([final, heat]).bestRank, 8, "input ordering must not change the final placing");
assert.equal(summarizeSport([heat]).bestRank, null, "a heat-only day has no confirmed final placing");
assert.deepEqual(competitorHighlights(heat, heat.competitors[0]), [{ tone: "rank", label: "預賽第 3 組第 2 名" }]);
assert.deepEqual(competitorHighlights(final, final.competitors[0]), [{ tone: "rank", label: "最終第 8 名" }]);
assert.deepEqual(rankContext(final), { label: "最終", final: true });

for (const stage of [
  { phase: "Qualification", unit: "Qualification" },
  { phase: "Semifinal", unit: "Semifinal 1" },
  { phase: "Final B", unit: "Final B" },
  { phase: "Final", unit: "Group A" },
  { phase: "Final", unit: "Day 1" },
  { phase: "Final", unit: "Race 1" },
  { phase: "Unknown", unit: "Unknown" },
  { discipline: "WSU", event: "Women's Taijiquan & Taijijian", phase: "Final", unit: "Taijijian Final" },
]) {
  const partial = { ...final, ...stage, competitors: heat.competitors };
  assert.equal(summarizeSport([partial]).bestRank, null, `${stage.phase}/${stage.unit} is not a confirmed overall placing`);
  assert.ok(!competitorHighlights(partial, partial.competitors[0]).some((b) => b.label.includes("最終")));
}
assert.equal(summarizeSport([heat, { ...final, status: "UNOFFICIAL" }]).bestRank, null, "a pending final must not fall back to a heat rank");
assert.deepEqual(summarizeSport([heat, final]).medals, { gold: 0, silver: 0, bronze: 0 }, "placing does not imply a medal");
assert.deepEqual(rankContext({ ...final, phase: "Final", unit: "Final B" }), { label: "B 組決賽", final: false });
assert.deepEqual(rankContext({ ...final, phase: "Final", unit: "Group A" }), { label: "決賽 A 組", final: false });
assert.deepEqual(rankContext({ ...final, phase: "Final", unit: "Day 1" }), { label: "決賽第 1 日", final: false });
assert.deepEqual(rankContext({ ...heat, phase: "", unit: "Heat 3" }), { label: "預賽第 3 組", final: false });
assert.deepEqual(rankContext({ ...final, phase: "", unit: "Final" }), { label: "最終", final: true }, "an explicit FNL code plus final unit identifies the final");
assert.equal(summarizeSport([final, { ...final, phase: "Heats", unit: "Heat 3" }]).bestRank, null, "conflicting stage metadata for the same source unit is not accepted");
assert.equal(summarizeSport([final, { ...final, id: "conflicted-copy" }, { ...final, id: "conflicted-copy", competitors: heat.competitors }]).bestRank, null, "conflicting final evidence cannot retain an earlier final rank");
assert.deepEqual(competitorHighlights({ ...final, status: "UNOFFICIAL" }, final.competitors[0]), [], "pending final rows have no confirmed rank badge");

const original = structuredClone([heat, final]);
summarizeSport(original);
assert.deepEqual(original, [heat, final], "rank classification preserves the original official values");

console.info("PASS rank scope: heat groups, final placing, ambiguous finals, partial rounds and pending results");
