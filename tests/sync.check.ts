import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig } from "../src/config";
import { csvRecords, parseCsv, toCsv } from "../src/lib/csv";
import { dayResponse, medalResponse, sourceCooldown } from "../src/lib/results/snapshot";
import { fileStore } from "../src/lib/results/sync/fileStore";
import { hostTimeToIso, parseManualResults, runManualSync } from "../src/lib/results/sync/manual";
import { runSync, SCHEDULE_GRACE_MS } from "../src/lib/results/sync/run";
import { isTeamLabel, replaceTeamAliases } from "../src/lib/results/team";
import type { TpeResultUnit } from "../src/lib/results/types";

const tmp = () => mkdtempSync(join(tmpdir(), "results-sync-"));

// CSV：引號、逗號、換行、BOM、空白列
assert.deepEqual(parseCsv('﻿a,b\n"x, y","say ""hi"""\r\n\n"multi\nline",z\n'), [["a", "b"], ["x, y", 'say "hi"'], ["multi\nline", "z"]]);
assert.throws(() => parseCsv('a\n"open'), /雙引號/);
assert.throws(() => csvRecords("a,b\n1,2", ["a", "c"], "x.csv"), /x\.csv 缺少欄位：c/);
assert.deepEqual(parseCsv(toCsv(["n"], [["a,b"], ['q"']])), [["n"], ["a,b"], ['q"']]);

// 設定檔驗證：錯的欄位直接指名
const base = JSON.parse(readFileSync("competition.config.json", "utf8"));
assert.equal(parseConfig(base).team.noc, "TPE");
assert.throws(() => parseConfig({ ...base, endDate: "2026-01-01" }), /endDate/);
assert.throws(() => parseConfig({ ...base, timeZone: "Mars/Base" }), /timeZone/);
assert.throws(() => parseConfig({ ...base, team: { ...base.team, noc: "TAIWAN" } }), /team\.noc/);
assert.throws(() => parseConfig({ ...base, source: { ...base.source, type: "omega" } }), /source\.type/);
assert.throws(() => parseConfig({ ...base, syncIntervalMinutes: 5 }), /syncIntervalMinutes/);
assert.equal(parseConfig({ ...base, source: { type: "manual", code: "X2027", webUrl: "https://example.org/" } }).source.webUrl, "https://example.org");

// 代表隊別名
assert.equal(replaceTeamAliases("Chinese  Taipei vs JPN"), "TPE vs JPN");
assert.ok(isTeamLabel("中華臺北 2") && isTeamLabel("tpe") && !isTeamLabel("LIN Chun-yi"));

// 主辦地時間 → UTC（Asia/Tokyo 無夏令時間）
assert.equal(hostTimeToIso("2026-09-20", "09:30", "Asia/Tokyo"), "2026-09-20T00:30:00.000Z");
assert.equal(hostTimeToIso("2026-07-01", "12:00", "Europe/Paris"), "2026-07-01T10:00:00.000Z");

// 手動成績 CSV
const manualCsv = [
  "unit_id,date,time,sport,event,phase,venue,status,name,organisation,result,rank,medal,outcome",
  "BDM-1,2026-09-20,10:00,羽球,男子單打,決賽,體育館,正式成績,CHOU Tien-chen,TPE,2-0,,金,勝",
  "BDM-1,2026-09-20,10:00,羽球,男子單打,決賽,體育館,正式成績,SHI Yuqi,CHN,0-2,,銀,負",
  "XYZ-1,2026-09-21,,滑板,街道式,預賽,,未開賽,LEE A,TPE,,,,",
].join("\n");
const manual = parseManualResults(manualCsv);
const final = manual.get("2026-09-20")![0];
assert.equal(final.headToHead, true);
assert.equal(final.discipline, "BDM");
assert.equal(final.startsAt, "2026-09-20T01:00:00.000Z");
assert.deepEqual(final.competitors.map((c) => [c.medal, c.outcome]), [["GOLD", "W"], ["SILVER", "L"]]);
const skate = manual.get("2026-09-21")![0];
assert.equal(skate.discipline, "M01", "unknown sports get their own group instead of merging");
assert.equal(skate.timeNote, "時間待定");
assert.throws(() => parseManualResults(manualCsv.replace("正式成績,CHOU", "好像贏了,CHOU")), /第 2 列：status 不認得/);
assert.throws(() => parseManualResults(manualCsv.replace("2026-09-21", "2027-01-01")), /第 4 列：date/);
assert.throws(() => parseManualResults(manualCsv.replace("正式成績,SHI", "進行中,SHI")), /同一個 unit_id/);

{
  const dir = tmp();
  try {
    const store = fileStore(dir);
    const first = runManualSync(store, manualCsv, new Date("2026-09-21T00:00:00Z"));
    assert.deepEqual(first.days, { "2026-09-20": "updated", "2026-09-21": "updated" });
    const again = runManualSync(store, manualCsv, new Date("2026-09-21T01:00:00Z"));
    assert.equal(again.changed, false, "unchanged CSV must not rewrite files or trigger a deploy");
    const removed = runManualSync(store, manualCsv.split("\n").slice(0, 3).join("\n"), new Date("2026-09-21T02:00:00Z"));
    assert.deepEqual(removed.days, { "2026-09-21": "updated" }, "rows deleted from the CSV disappear from that day");
    assert.deepEqual(store.readDay("2026-09-21")!.units, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 讀到別的賽事留下的資料要擋下
{
  const dir = tmp();
  try {
    writeFileSync(join(dir, "index.json"), JSON.stringify({ source: "OLD2020", generatedAt: "2020-01-01T00:00:00Z", days: {}, medals: null }));
    assert.throws(() => fileStore(dir).readIndex(), /OLD2020/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 同步：成功、失敗保留舊資料、冷卻、GitHub 排程提早觸發
const unit = (id: string): TpeResultUnit => ({ id, discipline: "BDM", sport: "羽球", event: "Men's Singles", phase: "", unit: "", startsAt: null, timeNote: "", venue: "", status: "SCHEDULED", statusLabel: "未開賽", headToHead: false, competitors: [], sourceUrl: "", detailAvailable: false });
const standings = [{ Championship: "AG2026", Discipline: "ALL", Org: "TPE", Rk: "1", RkEq: false, Count: { ME_GOLD: { total: 1 }, ME_SILVER: { total: 0 }, ME_BRONZE: { total: 0 }, total: { total: 1 } } }];

async function main() {
  const dir = tmp();
  try {
    const store = fileStore(dir);
    let clock = new Date("2026-09-20T03:00:00Z");
    const now = () => clock;
    let fail = false;
    const read = async (path: string) => {
      if (fail) throw new Error("HTTP 503");
      if (path === "ALL/medals/standings") return standings;
      if (path === "ALL/medals/org/TPE") return [];
      throw new Error(`unexpected ${path}`);
    };
    const fetched: string[] = [];
    const fetchDay = async (date: string) => { fetched.push(date); if (fail) throw new Error("HTTP 503"); return [unit(`AG2026:BDM:${date}`)]; };
    const logs: string[] = [];
    const log = (m: string) => logs.push(m);

    const first = await runSync({ store, now, read, fetchDay, log });
    assert.equal(first.medals, "updated");
    assert.equal(first.days["2026-09-20"], "updated", "today is synced");
    assert.ok(Object.keys(first.days).includes("2026-09-10"), "earlier days get their first pass");
    assert.equal(store.readMedals()!.standings[0].org, "TPE");

    // 29 分 40 秒後觸發（GitHub 排程提早）：寬限期內，今天仍算到期
    clock = new Date(clock.getTime() + 29 * 60_000 + 40_000);
    fetched.length = 0;
    const early = await runSync({ store, now, read, fetchDay, log });
    assert.equal(early.medals, "updated");
    assert.deepEqual(fetched, ["2026-09-20"], "only today is due again; older days wait 6–24 h");
    assert.ok(SCHEDULE_GRACE_MS >= 60_000);

    // 來源失敗：保留上一份場次，記錄錯誤，並進入冷卻
    clock = new Date(clock.getTime() + 31 * 60_000);
    fail = true;
    const failed = await runSync({ store, now, read, fetchDay, log });
    assert.equal(failed.medals, "failed");
    assert.equal(failed.changed, true, "the failure is persisted so the next run sees the cooldown");
    assert.equal(store.readMedals()!.standings.length, 1, "last good standings are kept");
    assert.equal(store.readMedals()!.lastError, "source_unavailable");
    const index = store.readIndex();
    assert.ok(sourceCooldown(index) > clock.getTime());
    fail = false;
    clock = new Date(clock.getTime() + 10 * 60_000);
    const cooling = await runSync({ store, now, read, fetchDay, log });
    assert.match(cooling.reason ?? "", /冷卻/);

    // 單日失敗也不覆蓋場次
    clock = new Date(clock.getTime() + 40 * 60_000);
    const dayFail = async (date: string): Promise<TpeResultUnit[]> => { throw new Error(`down ${date}`); };
    const partial = await runSync({ store, now, read, fetchDay: dayFail, log });
    assert.equal(partial.days["2026-09-20"], "failed");
    assert.equal(store.readDay("2026-09-20")!.units.length, 1, "a failed day keeps its last good units");
    assert.equal(Object.keys(partial.days).length, 1, "the run stops after the first failed day");

    // 網頁端看到的回應
    const day = dayResponse("2026-09-20", store.readDay("2026-09-20"), sourceCooldown(store.readIndex()), clock);
    assert.equal(day.units.length, 1);
    assert.match(day.warning ?? "", /暫時無法完整更新/);
    assert.equal(medalResponse(store.readMedals(), clock).standings.length, 1);
    assert.equal(dayResponse("2026-09-25", null, 0, clock).fetchedAt, null);

    // 賽前兩天以前不抓
    const before = await runSync({ store: fileStore(tmp()), now: () => new Date("2026-08-01T00:00:00Z"), read, fetchDay, log });
    assert.match(before.reason ?? "", /尚未開始/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.info("PASS sync: CSV, config validation, team aliases, manual results, file store, schedule grace, failure retention and cooldown");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
