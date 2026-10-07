import assert from "node:assert/strict";
import { convertArchiveUnit, splitEventPhase } from "../src/lib/results/import/olympicsArchive";

// 精簡自 2024 巴黎奧運官方逐場 JSON（Wayback 存檔）
const team = (name: string, code: string) => ({ name, organisation: { code } });
const unit = (code: string, long: string, short: string, items: object[], status = "OFFICIAL") => ({
  results: { eventUnitCode: code, eventUnit: { longDescription: long, shortDescription: short }, status: { code: status },
    schedule: { startDate: "2024-08-04T16:10:00+02:00", venue: { description: "La Chapelle Arena" } }, items },
});
const games = (wlt: string, g: string[]) => JSON.stringify({ wlt, extra: Object.fromEntries(g.map((v, i) => [`resultG${i + 1}`, v])) });

const bdmFinal = convertArchiveUnit(unit("BDMMDOUBLES-----------FNL-000100--", "Men's Doubles Gold Medal Match", "Gold Medal Match", [
  { resultData: "1", resultWLT: "L", resultDataText: games("L", ["17", "21", "19"]), participant: team("LIANG Wei Keng / WANG Chang", "CHN") },
  { resultData: "2", resultWLT: "W", resultDataText: games("W", ["21", "18", "21"]), participant: team("LEE Yang / WANG Chi-Lin", "TPE") },
]), "TPE");
assert.equal(bdmFinal.rows.length, 2, "head-to-head keeps the opponent row");
const lee = bdmFinal.rows.find((r) => r.organisation === "TPE")!;
assert.deepEqual([lee.unit_id, lee.date, lee.time, lee.sport, lee.event, lee.phase], ["BDMMDOUBLES-FNL-000100", "2024-08-04", "16:10", "羽球", "Men's Doubles", "金牌戰"]);
assert.deepEqual([lee.result, lee.medal, lee.outcome], ["2-1（21-17, 18-21, 21-19）", "金", "勝"]);
assert.equal(bdmFinal.rows.find((r) => r.organisation === "CHN")!.medal, "銀");

const boxSemi = convertArchiveUnit(unit("BOXW60KG--------------SFNL000100--", "Women's 60kg - Semifinal", "Semifinal", [
  { resultData: "0", resultWLT: "L", resultDataText: "{}", participant: team("WU Shih Yi", "TPE") },
  { resultData: "5", resultWLT: "W", resultDataText: JSON.stringify({ extra: { resCode: "WP" } }), participant: team("YANG Wenlu", "CHN") },
]), "TPE");
const wu = boxSemi.rows.find((r) => r.organisation === "TPE")!;
assert.deepEqual([wu.event, wu.phase, wu.result, wu.medal, wu.outcome], ["Women's 60kg", "四強", "0-5（點數判定）", "銅", "負"], "boxing semifinal losers take bronze");

const wlf = convertArchiveUnit(unit("WLFW59KG--------------FNL-000100--", "Women's 59kg", "Women's 59kg", [
  { resultRank: "1", resultData: "241", participant: team("LUO Shifang", "CHN") },
  { resultRank: "3", resultData: "235", participant: team("KUO Hsing-Chun", "TPE") },
  { resultRank: "", resultData: "", resultIrm: "DNF", participant: team("X", "TPE") },
]), "TPE");
assert.deepEqual(wlf.rows.map((r) => [r.name, r.phase, r.rank, r.result, r.medal]), [["KUO Hsing-Chun", "決賽", "3", "235", "銅"], ["X", "決賽", "", "DNF", ""]], "multi-competitor units keep only the team and rank-based medals");

const ranking = convertArchiveUnit(unit("ARCMINDIVID-----------QUAL000100--", "Men's Individual Ranking Round", "Ranking Round", [
  { resultRank: "1", resultData: "694", participant: team("KIM Woojin", "KOR") },
  { resultRank: "12", resultData: "665", participant: team("TANG Chih-Chun", "TPE") },
]), "TPE");
assert.deepEqual(ranking.rows.map((r) => [r.event, r.phase, r.rank, r.medal]), [["Men's Individual", "排名賽", "12", ""]], "ranking rounds never award medals");

assert.deepEqual(convertArchiveUnit(unit("BDMMSINGLES-----------FNL-000100--", "Men's Singles Gold Medal Match", "Gold Medal Match", [
  { participant: team("A", "DEN") }, { participant: team("B", "THA") },
]), "TPE").rows, [], "units without the team are ignored");
assert.match(convertArchiveUnit(unit("BOXW57KG--------------FNL-000100--", "Women's 57kg - Final", "Final", [{ participant: team("LIN Yu Ting", "TPE") }], "SCHEDULED"), "TPE").skipped ?? "", /不是正式成績/);
assert.deepEqual(splitEventPhase("Men's Doubles Group Play Stage - Group D", "Group Play Stage - Group D"), { event: "Men's Doubles", phase: "分組賽 D 組", known: true });
assert.equal(splitEventPhase("Men's Individual 1/32 Elimination Round", "1/32 Elimination Round").phase, "64 強");
for (const [short, phase] of [["Table of 32", "32 強"], ["Quarter-final", "八強"], ["First Round", "第 1 輪"], ["Round Robin - Group D", "循環賽 D 組"], ["Qualification - Day 2", "資格賽第 2 天"], ["Qualification Rapid", "資格賽（快射）"], ["Subdivision 3", "資格賽第 3 組"], ["Round 1 - Heat 6", "第 1 輪第 6 組"], ["Preliminary Round - Heat 2", "資格預賽第 2 組"], ["Repechage Round - Heat 1", "復活賽第 1 組"], ["Qualification - Group B", "資格賽 B 組"], ["Heats 2nd Run", "預賽第 2 趟"]]) {
  assert.equal(splitEventPhase(`X ${short}`, short).phase, phase, short);
}
for (const [long, short, event, phase] of [
  ["Men -60 kg Repechage contest", "Repechage", "Men -60 kg", "復活賽"],
  ["Mixed Doubles Quarterfinal", "Quarterfinal 1", "Mixed Doubles", "八強"],
  ["Men's Horizontal Bar Qualification Subdivision 3", "Subdivision 3", "Men's Horizontal Bar", "資格賽第 3 組"],
  ["Men's Kayak Cross Round 1 Race 9", "Race 9", "Men's Kayak Cross", "第 1 輪第 9 組"],
  ["Men's Kayak Cross Repechage Race 1", "Race 1", "Men's Kayak Cross", "復活賽第 1 組"],
  ["Men's 200m Repechage - Heat 3", "Repechage - Heat 3", "Men's 200m", "復活賽第 3 組"],
  ["B-Boys Round Robin - Group D", "Round Robin - Group D", "B-Boys", "循環賽 D 組"],
  ["Men's Individual 1/32 Elimination Round", "1/32 Elimination Round", "Men's Individual", "64 強"],
  ["Women's 57kg - Final", "Final", "Women's 57kg", "決賽"],
  ["Men -60 kg Elimination Round of 32", "Elimination Round of 32", "Men -60 kg", "32 強"],
  ["Women's 57kg - Preliminaries - Round of 16", "Preliminaries - Round of 16", "Women's 57kg", "16 強"],
]) assert.deepEqual(splitEventPhase(long, short), { event, phase, known: true }, long);
assert.equal(splitEventPhase("Men's Kayak Single Heat Repeat", "Heat Repeat").known, false, "unknown phases are reported, not guessed");
const tennis = convertArchiveUnit(unit("TENWDOUBLES-----------R32-000300--", "Women's Doubles First Round", "First Round", [
  { resultData: "2", resultWLT: "W", participant: team("Hsieh / Tsao", "TPE"), teamAthletes: [{ order: 2, athlete: { name: "TSAO Chia Yi" } }, { order: 1, athlete: { name: "HSIEH Su-Wei" } }] },
  { resultData: "0", resultWLT: "L", participant: team("Muchova / Noskova", "CZE") },
]), "TPE");
assert.equal(tennis.rows[0].name, "HSIEH Su-Wei / TSAO Chia Yi", "surname-only doubles names use the members' full names");
assert.equal(tennis.rows[1].name, "Muchova / Noskova", "without member names the official label is kept");
assert.deepEqual(convertArchiveUnit(unit("TTEMTEAM--------------QFNL00030002", "Men's Team Quarterfinal - Match 2", "Quarterfinal - Match 2", [
  { resultData: "3", resultWLT: "W", participant: team("Chinese Taipei", "TPE") }, { resultData: "2", resultWLT: "L", participant: team("Sweden", "SWE") },
]), "TPE").rows, [], "team-match rubbers are folded into the team score");
assert.equal(convertArchiveUnit(unit("TTEMTEAM--------------QFNL00030000", "Men's Team Quarterfinal", "Quarterfinal", [
  { resultData: "1", resultWLT: "L", participant: team("Chinese Taipei", "TPE") }, { resultData: "3", resultWLT: "W", participant: team("Sweden", "SWE") },
]), "TPE").rows.length, 2, "the team match itself is kept");
console.info("PASS olympics archive: head-to-head scores and medals, boxing bronze, rank-based finals, ranking rounds, non-official units, phase labels");
