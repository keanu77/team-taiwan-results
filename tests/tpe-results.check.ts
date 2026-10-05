import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { defaultResultDate, isTpeUnit, normalizeResult, parseResultDate, parseSchedule, resultDate, syncDue, nextResultSyncAt, RESULTS_RETRY_MS } from "../src/lib/results/model";
import { scheduledResultDates } from "../src/lib/results/schedulePlan";
import { decodeBornan, fetchTpeDay, readBornan, mapLimited } from "../src/lib/results/source";

const unit = {
  Disc: "KAB", Key: "M.TEAM7-------------.GPA-.000600--", ResCode: "M.TEAM7-------------.GPA-.000600--",
  Status: "OFFICIAL", DateTimeRaw: "2026-09-23T09:30:00+09:00", isH2H: true,
  Orgs: ["KOR", "TPE"], EventDesc: "Men", UnitDesc: "Game 6", Medal: "1",
  Home: { Reg: "KOR01", Org: "KOR", Name: "Republic of Korea", Result: "37" },
  Away: { Reg: "TPE01", Org: "TPE", Name: "Chinese Taipei", Result: "43", Winner: true },
};

async function main() {
  assert.equal(parseResultDate("2026-09-23"), "2026-09-23");
  for (const value of ["2026-09-31", "2026-9-23", "2026-09-23T00:00Z", "../env", "2025-09-23", "2026-10-05", null]) assert.equal(parseResultDate(value), null);
  assert.equal(resultDate(new Date("2026-09-22T15:30:00Z")), "2026-09-23");
  assert.equal(defaultResultDate(new Date("2027-01-01Z")), "2026-10-04");
  const original = { test: "UTF-8 中文", rows: [1, 2] };
  const compressed = deflateSync(JSON.stringify(original));
  assert.deepEqual(decodeBornan(Buffer.from(compressed.toString("latin1"), "utf8")), original);
  assert.deepEqual(decodeBornan(compressed), original);
  assert.deepEqual(decodeBornan(Buffer.from(JSON.stringify(original))), original);
  assert.throws(() => decodeBornan(Buffer.from("<html>error</html>")));
  assert.throws(() => decodeBornan(new Uint8Array(13 * 1024 * 1024)));
  assert.throws(() => decodeBornan(deflateSync("x".repeat(25 * 1024 * 1024))));
  assert.throws(() => parseSchedule({ items: [] }));
  assert.throws(() => parseSchedule([{ ...unit, Disc: "../../" }]));
  assert.throws(() => parseSchedule([{ ...unit, Orgs: "TPE" }]));
  assert.throws(() => parseSchedule([unit], "SWM"));
  assert.throws(() => parseSchedule([{ ...unit, Orgs: undefined }], "KAB"));
  assert.throws(() => parseSchedule([{ ...unit, isH2H: undefined }], "KAB"));
  assert.equal(isTpeUnit(unit), true);
  assert.equal(isTpeUnit({ ...unit, Orgs: ["CHN"], Home: undefined, Away: undefined }), false);

  const match = normalizeResult(unit);
  assert.deepEqual(match.competitors.map((c) => [c.organisation, c.name, c.result]), [["KOR", "Republic of Korea", "37"], ["TPE", "TPE", "43"]]);
  assert.equal(match.competitors[1].outcome, "W");
  assert.ok(match.competitors.every((c) => c.medal === ""), "schedule medal flag cannot assign a medal");
  assert.equal(match.startsAt, "2026-09-23T00:30:00.000Z");
  assert.equal(new Date(match.startsAt!).toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" }), "08:30");
  const waiting = normalizeResult({ ...unit, Status: "START_LIST" });
  assert.ok(waiting.competitors.every((c) => !c.result && !c.outcome));
  const live = normalizeResult({ ...unit, Status: "RUNNING", Home: { ...unit.Home, WLT: "T" } });
  assert.ok(live.competitors.every((c) => !c.outcome), "live placeholder flags cannot declare a final win, loss or tie");
  assert.equal(live.competitors[0].result, "37", "live scores remain visible");
  const later = normalizeResult({ ...unit, EstText: "FOLLOWED BY" });
  assert.equal(later.startsAt, null);
  assert.equal(later.timeNote, "接續前場");

  const individual = { ...unit, isH2H: false, Disc: "ATH", Orgs: ["TPE"] };
  const detail = { Info: { ...individual, Status: "UNOFFICIAL" }, Competitors: [
    { Reg: "1", Org: "CHN", Name: "Not TPE", Rk: "1", Result: "1:23:32", Medal: "" },
    { Reg: "2275275", Org: "TPE", Name: "LO Sheng-qin", Rk: "6", Result: "1:35:20", IRM: "OK", Medal: "" },
    { Reg: "2", Org: "TPE", Name: "Runner", Rk: "", Result: "", IRM: "DNF" },
  ] };
  const walk = normalizeResult(individual, detail);
  assert.equal(walk.statusLabel, "非正式成績");
  assert.equal(walk.competitors.length, 2);
  assert.equal(walk.competitors[0].rank, "6");
  assert.equal(walk.competitors[1].irm, "DNF");
  assert.notEqual(match.id, walk.id, "same key in two sports must not collide");
  assert.throws(() => normalizeResult(individual, { ...detail, Info: unit }));
  assert.throws(() => normalizeResult(individual, { ...detail, Competitors: {} }));
  assert.throws(() => normalizeResult(individual, { ...detail, Info: { ...individual, Status: undefined } }));
  assert.equal(normalizeResult({ ...unit, Status: "NEW_STATUS" }).statusLabel, "狀態待確認");

  const calls: string[] = [];
  const units = await fetchTpeDay("2026-09-23", async (path) => {
    calls.push(path);
    if (path.startsWith("ALL/")) return [{ ...unit, Home: undefined, Away: undefined, Orgs: undefined }];
    if (path.includes("schedule/daily")) return [unit, unit];
    return { Info: unit, Competitors: [unit.Home, unit.Away] };
  });
  assert.equal(units.length, 1, "deduplicate by discipline and key");
  assert.ok(calls.includes("KAB/schedule/daily/2026-09-23"), "nationality missing in all-day index must be resolved from sport");
  await assert.rejects(fetchTpeDay("2026-09-23", async (path) => path.startsWith("ALL/") ? [unit] : []));

  // 已是正式成績的場次：上一份也是正式成績時沿用，不再請求明細
  const official = { ...unit, Status: "OFFICIAL" };
  const officialRead = (log: string[]) => async (path: string) => {
    log.push(path);
    if (path.startsWith("ALL/")) return [{ ...official, Home: undefined, Away: undefined, Orgs: undefined }];
    if (path.includes("schedule/daily")) return [official];
    return { Info: official, Competitors: [official.Home, official.Away] };
  };
  const firstCalls: string[] = [];
  const firstPass = await fetchTpeDay("2026-09-23", officialRead(firstCalls));
  assert.equal(firstPass[0].status, "OFFICIAL");
  assert.ok(firstCalls.some((p) => p.includes("/results/")), "first pass reads the result detail");
  const reuseCalls: string[] = [];
  const reused = await fetchTpeDay("2026-09-23", officialRead(reuseCalls), firstPass);
  assert.ok(!reuseCalls.some((p) => p.includes("/results/")), "an official result already saved is not requested again");
  assert.deepEqual(reused, firstPass);
  const liveCalls: string[] = [];
  await fetchTpeDay("2026-09-23", officialRead(liveCalls), firstPass.map((u) => ({ ...u, status: "UNOFFICIAL" })));
  assert.ok(liveCalls.some((p) => p.includes("/results/")), "a result that was not yet official is read again");
  const now = new Date("2026-09-23T01:00:00Z");
  assert.equal(syncDue("2026-09-23", null, null, now), true);
  assert.equal(syncDue("2026-09-23", null, new Date(now.getTime() - 1000), now), false);
  assert.equal(syncDue("2026-09-23", new Date(now.getTime() - 31 * 60000), null, now), true);
  assert.equal(syncDue("2026-09-22", new Date(now.getTime() - 31 * 60000), null, now), false);
  const attempt = new Date(now.getTime() - RESULTS_RETRY_MS + 1);
  assert.equal(syncDue("2026-09-23", null, attempt, now), false, "no retry a millisecond before cooldown ends");
  assert.equal(syncDue("2026-09-23", null, new Date(attempt.getTime() - 1), now), true);
  assert.equal(nextResultSyncAt("2026-09-23", now, now, now).getTime(), now.getTime() + 30 * 60000);
  assert.equal(nextResultSyncAt("2026-09-22", now, now, now).getTime(), now.getTime() + 6 * 60 * 60000);
  assert.equal(nextResultSyncAt("2026-09-10", now, now, now).getTime(), now.getTime() + 24 * 60 * 60000);
  const visited: number[] = [];
  await assert.rejects(mapLimited([1, 2, 3], async (n) => { visited.push(n); throw Error("source failure"); }));
  assert.deepEqual(visited, [1], "serial fetch stops the remaining queue on failure");
  const savedFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response("", { status: 429 }); };
  try {
    await assert.rejects(readBornan("ALL/schedule/day/2026-09-23"), /HTTP 429/);
    assert.equal(attempts, 1, "source refusal must not trigger an immediate retry");
  } finally { globalThis.fetch = savedFetch; }
  const priorSnapshot = { date: "2026-09-19", lastSuccessAt: new Date("2026-09-19T04:00:00Z"), lastAttemptAt: new Date("2026-09-19T04:00:00Z"), lastError: null };
  assert.ok(scheduledResultDates(now, [priorSnapshot]).includes("2026-09-19"), "restart must revisit a saved but unfinished historical day");
  const failedFuture = { date: "2026-09-29", lastSuccessAt: null, lastAttemptAt: new Date(now.getTime() - 31 * 60000), lastError: "source_unavailable" };
  assert.ok(scheduledResultDates(now, [failedFuture]).includes("2026-09-29"), "persisted failures retry after restart without an in-memory request");
  assert.deepEqual(scheduledResultDates(now, [{ ...failedFuture, lastAttemptAt: now }]), [], "a failed date pauses all source jobs, including today, across restarts");
  const afterEvent = new Date("2026-10-10T01:00:00Z");
  assert.ok(scheduledResultDates(afterEvent, [priorSnapshot]).includes("2026-09-19"), "downtime past event end must not prevent the final correction pass");
  const finalized = { ...priorSnapshot, lastSuccessAt: new Date("2026-10-07T04:00:00Z"), lastAttemptAt: new Date("2026-10-07T04:00:00Z") };
  assert.ok(!scheduledResultDates(afterEvent, [finalized]).includes("2026-09-19"), "finalized archive stops automatic source polling");
  console.info("PASS TPE results: source decoding, data integrity, identities, statuses, time zones, and retry");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
