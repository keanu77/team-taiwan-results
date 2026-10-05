import assert from "node:assert/strict";
import { isOfficialTpeMedal, mergeTpeMedals, parseTpeOrgMedals } from "../src/lib/results/officialMedals";
import { medalTally, TPE_MEDAL_LIST } from "../src/lib/results/tpeMedalList";
import { TPE_ORG_MEDALS_20260926 } from "./fixtures/tpeOrgMedals";

const official = parseTpeOrgMedals(TPE_ORG_MEDALS_20260926);
assert.equal(official.length, 24, "one entry per medal event");
assert.deepEqual(medalTally(official.map((m) => ({ medal: m.medal, sport: "", event: "", athletes: ["x"], date: m.date }))), { gold: 2, silver: 5, bronze: 17, total: 24 });
assert.ok(official.every(isOfficialTpeMedal));
const puyo = official.find((m) => m.event.startsWith("Puyo"));
assert.equal(puyo?.date, "2026-09-26", "dates use the Japan calendar day");
assert.deepEqual(puyo?.athletes, [{ name: "KUO Tzu-ang", registrationId: "2800288" }]);
assert.equal(official.filter((m) => m.type === "T").length, 8);

// 格式錯誤的來源整批拒絕，不部分寫入。
const row = TPE_ORG_MEDALS_20260926[0];
for (const bad of [null, {}, [{ ...row, Org: "JPN" }], [{ ...row, Medal: "ME_PLATINUM" }], [{ ...row, DateRaw: "soon" }], [{ ...row, Disc: "../x" }]]) {
  assert.throws(() => parseTpeOrgMedals(bad), JSON.stringify(bad)?.slice(0, 60));
}
assert.deepEqual(parseTpeOrgMedals([]), [], "no medals yet is valid");

// 官方決定有哪些獎牌；代表團總表補上中文項目名與團體隊員。
const merged = mergeTpeMedals(official, TPE_MEDAL_LIST);
assert.equal(merged.length, 24);
assert.deepEqual(medalTally(merged), { gold: 2, silver: 5, bronze: 17, total: 24 });
const menTeam = merged.find((m) => m.sport === "軟網" && m.medal === "silver" && m.event.includes("男子"));
assert.deepEqual(menTeam?.athletes, ["陳郁勲", "陳柏邑", "余凱文", "林韋傑", "張祐菘"], "team roster comes from the delegation list");
const womenTeam = merged.find((m) => m.sport === "軟網" && m.medal === "silver" && m.event.includes("女子"));
assert.ok(womenTeam?.athletes.includes("黃詩媛"), "same-day same-medal teams are separated by gender");
const newPuyo = merged.find((m) => m.date === "2026-09-26");
assert.deepEqual([newPuyo?.sport, newPuyo?.event, newPuyo?.athletes, newPuyo?.pending], ["電競", "魔法氣泡", ["郭子昂"], false], "a medal not yet in the delegation list uses official data and verified Chinese names");
assert.equal(merged.filter((m) => m.pending).length, 0);
assert.deepEqual(merged.find((m) => m.event.includes("200公尺蝶式"))?.athletes, ["王冠閎"]);

const officialOnly = mergeTpeMedals(official, []);
const pendingTeams = officialOnly.filter((m) => m.pending);
assert.equal(pendingTeams.length, 8, "teams without a delegation roster are marked pending");
assert.ok(pendingTeams.every((m) => m.athletes.length === 0));
assert.deepEqual(officialOnly.find((m) => m.medal === "gold" && m.sport === "軟網")?.athletes, ["余凱文", "黃詩媛"], "doubles pairs are split and translated");
assert.equal(officialOnly.find((m) => m.sport === "輕艇")?.event, "男子C1 500公尺", "trailing Final is dropped before translation");

// 官方團體列附 Members：隊員直接取官方登錄（中文依報名編號對照），不必等總表。
const baseball = {
  Medal: "ME_BRONZE", Org: "TPE", Reg: "BBLMTEAM9------TPE01", Type: "T", DateRaw: "2026-09-26T18:00:00+09:00", Name: "Chinese Taipei",
  Disc: "BBL", Event: "M.TEAM9-------------.FNL-", EventDesc: "Men’s Finals", Gender: "M",
  Members: [
    { Reg: "11414238", Org: "TPE", Name: "YU Tsung-ju", Order: 0, BirthDate: "1992-05-21" },
    { Reg: "8096499", Org: "TPE", Name: "GUO Dinghong", Order: 0, BirthDate: "2000-01-01" },
  ],
};
const [parsedTeam] = parseTpeOrgMedals([baseball]);
assert.deepEqual(parsedTeam.athletes, [{ name: "YU Tsung-ju", registrationId: "11414238" }, { name: "GUO Dinghong", registrationId: "8096499" }], "only name and registration are kept");
const [team] = mergeTpeMedals([parsedTeam], TPE_MEDAL_LIST);
assert.deepEqual([team.sport, team.event, team.athletes, team.pending], ["棒球", "棒球", ["游宗儒", "GUO Dinghong"], false], "gender-only events show the sport; unverified names stay in English");
const [updatedBaseball] = mergeTpeMedals([{ ...parsedTeam, date: "2026-09-27" }], TPE_MEDAL_LIST);
assert.equal(updatedBaseball.event, "男子棒球");
assert.equal(updatedBaseball.athletes.length, 24, "9/29 PDF supplies the full baseball roster when official medal date matches");
assert.equal(updatedBaseball.pending, false);
assert.throws(() => parseTpeOrgMedals([{ ...baseball, Members: [{ Name: "X", Org: "JPN" }] }]));
assert.throws(() => parseTpeOrgMedals([{ ...baseball, Members: "x" }]));
const legacy = mergeTpeMedals([{ ...parsedTeam, athletes: [{ name: "Chinese Taipei", registrationId: "BBLMTEAM9------TPE01" }] }], []);
assert.deepEqual([legacy[0].athletes, legacy[0].pending], [[], true], "stored snapshots without members stay pending");

assert.equal(mergeTpeMedals([], TPE_MEDAL_LIST), TPE_MEDAL_LIST, "without an official list the delegation list is used as-is");
assert.equal(TPE_ORG_MEDALS_20260926[0].Name, row.Name, "input stays intact");
console.info("PASS TPE official medals: org list parsing, Japan dates, delegation roster merge, official team members, pending teams and fallback");
