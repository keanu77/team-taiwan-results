import assert from "node:assert/strict";
import { matchesAthlete, normalizeSearch } from "../src/lib/results/resultSearch";
import type { TpeCompetitor, TpeResultUnit } from "../src/lib/results/types";

const person = (name: string, organisation = "TPE"): TpeCompetitor => ({ id: name, name, organisation, result: "", rank: "", outcome: "", qualification: "", irm: "", medal: "" });
const unit = (competitors: TpeCompetitor[], discipline = "BDM"): TpeResultUnit => ({ id: "u", discipline, sport: "羽球", event: "Men's Doubles", phase: "1st Round", unit: "Match 3", startsAt: null, timeNote: "", venue: "", status: "OFFICIAL", statusLabel: "正式成績", headToHead: true, competitors, sourceUrl: "", detailAvailable: true });

assert.equal(normalizeSearch("  Lin  Chun-Yi "), "linchunyi");
assert.equal(normalizeSearch(""), "");
const match = unit([person("LIN Chun-Yi"), person("JARGALSAIKHAN Gerelsukh", "MGL")]);
assert.equal(matchesAthlete(match, "lin chun"), true, "romanized, case and spacing insensitive");
assert.equal(matchesAthlete(match, "chunyi"), true, "hyphen insensitive");
assert.equal(matchesAthlete(match, "Gerelsukh"), true, "opponents are searchable too");
assert.equal(matchesAthlete(match, "WANG"), false);
const linChunYi = unit([{ ...person("LIN Chun-Yi"), id: "2068886" }]);
assert.equal(matchesAthlete(linChunYi, "林俊易"), true, "verified Chinese names are searchable");
assert.equal(matchesAthlete(linChunYi, "俊易"), true, "partial Chinese names match");
assert.equal(matchesAthlete(match, "   "), true, "an empty query keeps every result");
assert.equal(matchesAthlete(unit([person("YANG Po-Hsuan/LEE Jhe-Huei")]), "lee jhe"), true, "doubles pairs match either player");
console.info("PASS TPE result search: normalized romanized names, opponents and doubles pairs");
