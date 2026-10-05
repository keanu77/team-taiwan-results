import assert from "node:assert/strict";
import {
  getAthleteNameDisplay,
  lookupTpeAthleteName,
  type TpeAthleteNameEntry,
} from "../src/lib/results/athleteNameLookup";
import { TPE_ATHLETE_NAMES } from "../src/lib/results/athleteNames";

// Synthetic identities only; these test fixtures are not an athlete roster.
const roster: readonly TpeAthleteNameEntry[] = [
  { discipline: "TEN", englishName: "ALPHA One", chineseName: "測試甲", registrationId: "ten-a" },
  { discipline: "TEN", englishName: "BETA Two", chineseName: "測試乙" },
  { discipline: "SWM", englishName: "ALPHA One", chineseName: "游泳甲", registrationId: "swm-a" },
];
const base = { discipline: "TEN", englishName: "ALPHA One", organisation: "TPE" };

assert.equal(lookupTpeAthleteName({ ...base, englishName: " alpha\t ONE " }, roster), "測試甲");
assert.equal(lookupTpeAthleteName({ ...base, englishName: "ONE ALPHA" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, englishName: "ALPHA-One" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, englishName: "ÁLPHA One" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, discipline: "SWM" }, roster), "游泳甲");
assert.equal(lookupTpeAthleteName({ ...base, discipline: "BDM", registrationId: "ten-a" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, organisation: "JPN", registrationId: "ten-a" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, organisation: "" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, discipline: " " }, [{ ...roster[0], discipline: " " }]), null);

assert.equal(lookupTpeAthleteName({ ...base, englishName: "SOURCE NAME VARIANT", registrationId: "ten-a" }, roster), "測試甲");
assert.equal(lookupTpeAthleteName({ ...base, registrationId: "different-person" }, roster), null);
assert.equal(lookupTpeAthleteName({ ...base, englishName: "BETA Two", registrationId: "source-only-id" }, roster), "測試乙");
assert.equal(lookupTpeAthleteName({ ...base, registrationId: " " }, [{ ...roster[0], englishName: "Different Name", registrationId: " " }]), null);

const nameCollision = [...roster, { discipline: "TEN", englishName: "alpha one", chineseName: "同名另一人", registrationId: "ten-other" }];
assert.equal(lookupTpeAthleteName(base, nameCollision), null);
assert.equal(lookupTpeAthleteName({ ...base, registrationId: "ten-a" }, nameCollision), "測試甲");
const idCollision = [...roster, { discipline: "TEN", englishName: "OTHER Person", chineseName: "另一人", registrationId: "ten-a" }];
assert.equal(lookupTpeAthleteName({ ...base, registrationId: "ten-a" }, idCollision), null);
assert.equal(lookupTpeAthleteName(base, [...roster, { ...roster[0], chineseName: "衝突譯名" }]), null);
assert.equal(lookupTpeAthleteName(base, [...roster, roster[0]]), "測試甲");
assert.equal(lookupTpeAthleteName(base, [...roster, { ...roster[0], registrationId: "another-id" }]), null);
assert.equal(lookupTpeAthleteName(base, [
  { ...roster[0], identityGroup: "verified-one" },
  { ...roster[0], registrationId: "another-id", identityGroup: "verified-one" },
]), "測試甲", "only explicitly verified duplicate registrations share an identity");
assert.equal(getAthleteNameDisplay({ id: "TPE:ALPHA One", name: "ALPHA One", organisation: "TPE" }, "TEN", roster).primaryName, "測試甲", "source-generated fallback IDs are not registration evidence");

const doubles = getAthleteNameDisplay({ id: "pair-id", name: "alpha ONE / Unknown Player", organisation: "TPE" }, "TEN", roster);
assert.deepEqual(doubles, { primaryName: "測試甲 / Unknown Player", englishName: "alpha ONE / Unknown Player", translatedCount: 1 });
assert.deepEqual(getAthleteNameDisplay({ id: "ten-a", name: "Unknown A / Unknown B", organisation: "TPE" }, "TEN", roster), {
  primaryName: "Unknown A / Unknown B", englishName: null, translatedCount: 0,
});
assert.deepEqual(getAthleteNameDisplay({ id: "pair-id", name: "ALPHA One / BETA Two", organisation: "JPN" }, "TEN", roster), {
  primaryName: "ALPHA One / BETA Two", englishName: null, translatedCount: 0,
});

assert.deepEqual(getAthleteNameDisplay({ id: "ten-a", name: "ALPHA One", organisation: "TPE" }, "TEN", []), {
  primaryName: "ALPHA One", englishName: null, translatedCount: 0,
});
assert.equal(lookupTpeAthleteName({ ...base, englishName: "" }, roster), null);
assert.equal(lookupTpeAthleteName(base, [{ ...roster[0], chineseName: " " }]), null);
assert.deepEqual(getAthleteNameDisplay({ id: "", name: "", organisation: "" }, "TEN", roster), {
  primaryName: "參賽者待確認", englishName: null, translatedCount: 0,
});
assert.deepEqual(getAthleteNameDisplay({ id: "ten-a", name: "Chinese Taipei", organisation: "TPE" }, "TEN", roster), {
  primaryName: "TPE", englishName: null, translatedCount: 0,
});
assert.equal(getAthleteNameDisplay({ id: "ten-a", name: "ALPHA One /", organisation: "TPE" }, "TEN", roster).translatedCount, 0);

// Audit the real registry too: a silent collision would hide names throughout the published page.
for (const entry of TPE_ATHLETE_NAMES) {
  assert.equal(lookupTpeAthleteName({ ...entry, organisation: "TPE" }), entry.chineseName, `${entry.discipline}:${entry.englishName} must have an unambiguous translation`);
}
assert.deepEqual(getAthleteNameDisplay({ id: "mixed-pair", name: "LIN Yun-ju/CHENG I-ching", organisation: "TPE" }, "TTE"), {
  primaryName: "林昀儒 / 鄭怡靜", englishName: "LIN Yun-ju/CHENG I-ching", translatedCount: 2,
});
assert.equal(lookupTpeAthleteName({ discipline: "ELS", englishName: "CHEN You-gang", organisation: "TPE" }), "陳又綱");
assert.equal(lookupTpeAthleteName({ discipline: "GAR", englishName: "LIN Yi-chen", organisation: "TPE", registrationId: "15976727" }), null, "an unmatched official athlete must not inherit another roster member's Chinese name");

console.info("PASS TPE athlete names: strict sport and identity matching, ambiguous-name fallback, doubles, normalization and absent roster");
