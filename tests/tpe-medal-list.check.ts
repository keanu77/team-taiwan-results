import assert from "node:assert/strict";
import { groupMedalsByDate, groupMedalsBySport, medalTally, parseTpeMedalList, sortedByMedal, tpeMedalKey, TPE_MEDAL_LIST, TPE_MEDAL_LIST_UPDATED } from "../src/lib/results/tpeMedalList";

assert.deepEqual(medalTally(TPE_MEDAL_LIST), { gold: 3, silver: 10, bronze: 24, total: 37 }, "matches the delegation's 9/29 summary");
assert.equal(TPE_MEDAL_LIST_UPDATED, "2026-09-29T23:00:00+08:00");
assert.equal(new Set(TPE_MEDAL_LIST.map(tpeMedalKey)).size, 37, "fallback UI keys preserve multiple medallists in one event");
const duplicate = TPE_MEDAL_LIST[0];
assert.throws(() => parseTpeMedalList({ updatedAt: TPE_MEDAL_LIST_UPDATED, source: "test", medals: [duplicate, { ...duplicate, athletes: [...duplicate.athletes].reverse() }] }), /重複/, "true duplicate medals remain rejected regardless of roster order");
assert.equal(new Set(TPE_MEDAL_LIST.map((m) => `${m.sport}|${m.event}|${m.medal}|${m.athletes.join()}`)).size, TPE_MEDAL_LIST.length, "each medal recipient appears once; one event may have multiple TPE medallists");
for (const m of TPE_MEDAL_LIST) {
  assert.match(m.date, /^2026-09-(1\d|2\d)$/);
  assert.ok(m.athletes.length > 0 && m.athletes.every((name) => name.trim() === name && name.length > 0));
}

const byMedal = sortedByMedal(TPE_MEDAL_LIST);
assert.deepEqual(byMedal.filter((m) => m.medal === "gold").flatMap((m) => m.athletes).sort(), ["余凱文", "傅兆玄", "王冠閎", "黃詩媛"].sort(), "medal totals alone cannot detect swapped colors");
assert.equal(byMedal[byMedal.length - 1].medal, "bronze");

const byDate = groupMedalsByDate(TPE_MEDAL_LIST);
assert.deepEqual(byDate.map((g) => g.key), Array.from({ length: 10 }, (_, index) => `2026-09-${20 + index}`));
assert.deepEqual(byDate[0].tally, { gold: 0, silver: 2, bronze: 1, total: 3 });
assert.deepEqual(byDate[5].tally, { gold: 1, silver: 2, bronze: 5, total: 8 });
assert.deepEqual(byDate[2].tally, { gold: 0, silver: 0, bronze: 3, total: 3 }, "Chung Meng-yu date follows pages 2 and 3");
assert.deepEqual(byDate[6].tally, { gold: 0, silver: 0, bronze: 1, total: 1 }, "Puyo date follows pages 1 and 2");
assert.deepEqual(byDate[7].tally, { gold: 1, silver: 2, bronze: 2, total: 5 });
assert.deepEqual(byDate[8].tally, { gold: 0, silver: 1, bronze: 4, total: 5 }, "use medal rows, not the incorrect 5-silver subtotal on page 2");
assert.deepEqual(byDate[9].tally, { gold: 0, silver: 2, bronze: 1, total: 3 });
const baseball = TPE_MEDAL_LIST.find((m) => m.sport === "棒球");
assert.equal(baseball?.athletes.length, 24, "slash-delimited multiline roster is split into individuals");
assert.ok(baseball?.athletes.includes("林昱珉") && baseball.athletes.includes("張翔") && baseball.athletes.includes("楊振裕"), "wrapped and spaced names are rejoined");
assert.deepEqual(TPE_MEDAL_LIST.filter((m) => m.sport === "克拉術" && m.event === "女子57公斤級").map((m) => [m.medal, ...m.athletes]), [["silver", "李宛庭"], ["bronze", "王品淳"]]);

const bySport = groupMedalsBySport(TPE_MEDAL_LIST);
assert.equal(bySport.length, 17);
assert.equal(bySport[0].key, "軟式網球", "sports ranked by gold, silver, bronze");
assert.deepEqual(bySport[0].tally, { gold: 1, silver: 2, bronze: 1, total: 4 });
assert.equal(bySport.find((g) => g.key === "空手道")?.tally.bronze, 4);

const input = [...TPE_MEDAL_LIST];
sortedByMedal(input); groupMedalsByDate(input); groupMedalsBySport(input);
assert.deepEqual(input, TPE_MEDAL_LIST, "helpers must not mutate input");
console.info("PASS TPE medal list totals, date/sport grouping and ordering");
