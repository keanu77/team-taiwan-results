import assert from "node:assert/strict";
import { isResultsResponse } from "../src/components/results/resultDisplay";
import { normalizeResult } from "../src/lib/results/model";
import { combineResultDays } from "../src/lib/results/period";
import type { TpeResultsResponse } from "../src/lib/results/types";

function day(date: string, overrides: Partial<TpeResultsResponse> = {}): TpeResultsResponse {
  return { success: true, source: "AG2026", competition: "亞運", date, minDate: "2026-09-10", maxDate: "2026-10-04", fetchedAt: `${date}T02:00:00.000Z`, lastAttemptAt: `${date}T01:00:00.000Z`, syncIntervalMinutes: 30, nextSyncAt: null, syncEnabled: true, syncing: false, stale: false, warning: null, units: [], ...overrides };
}
const unit = normalizeResult({ Disc: "TTE", Key: "X.DOUBLES-----------.R32-.000100--", Status: "START_LIST", Orgs: ["TPE"], isH2H: true });
const fresh = { ...unit, status: "OFFICIAL", competitors: [{ id: "TPE1", name: "TPE", organisation: "TPE", result: "3", rank: "", outcome: "W", qualification: "", irm: "", medal: "" }] };
const first = day("2026-09-10", { units: [fresh], fetchedAt: "2026-09-23T02:00:00.000Z" });
const second = day("2026-09-11", { units: [unit] });
const missing = day("2026-09-12", { fetchedAt: null, stale: true, units: [{ ...unit, id: "not-committed" }] });
const result = combineResultDays([missing, second, first]);
assert.equal(result.date, "2026-09-12");
assert.deepEqual(result.period, { startDate: "2026-09-10", endDate: "2026-09-12", availableDays: 2, totalDays: 3 });
assert.equal(result.units.length, 1, "same match cannot inflate cumulative outcomes");
assert.equal(result.units[0].status, "OFFICIAL", "latest successful snapshot wins over older content");
assert.equal(result.units[0].scheduleDate, "2026-09-10");
assert.equal(first.units[0].scheduleDate, undefined, "aggregation cannot mutate a daily snapshot");
assert.equal(result.stale, true);
assert.match(result.warning!, /1 天/);
assert.equal(isResultsResponse(result, "2026-09-12", true), true);
assert.equal(isResultsResponse(result, "2026-09-12"), false, "a late range response cannot replace daily data");
assert.equal(isResultsResponse(first, "2026-09-10", true), false, "a late daily response cannot replace period data");
assert.equal(isResultsResponse({ ...result, units: [{ ...result.units[0], scheduleDate: "2026-10-04" }] }, "2026-09-12", true), false);
const empty = combineResultDays([day("2026-09-10"), day("2026-09-11")]);
assert.equal(empty.period!.availableDays, 2, "a successfully synced empty day still counts as covered");
assert.equal(empty.units.length, 0);
assert.equal(empty.stale, false);
assert.equal(empty.warning, null);
console.info("PASS period aggregation: coverage, missing days, deduplication, freshness, immutable daily data, range response identity");
