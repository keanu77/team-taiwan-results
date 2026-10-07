// 賽後回補：從 Wayback 存檔讀奧運官方逐場成績，轉成 events/<賽事>/results/manual.csv。
// 官網 API 在閉幕後就下線，只剩網際網路檔案館的存檔；一次性匯入，不進排程。
//
//   EVENT=og2024 npm run import-wayback -- --comp OG2024 --disc BDM,BOX [--only BDMMDOUBLES,BOXW57KG] [--dry-run]
//
// 只替換 --disc 列出的項目，CSV 裡其他項目的列原樣保留，可以分批匯入。
// 原始檔快取在 .cache/wayback/<comp>/，重跑不會重抓。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CONFIG, EVENT_ID } from "../src/config";
import { csvRecords } from "../src/lib/csv";
import { convertArchiveUnit, type ManualRow } from "../src/lib/results/import/olympicsArchive";
import { MANUAL_COLUMNS } from "../src/lib/results/sync/manual";

const PAUSE_MS = 2_500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv: string[]) {
  const value = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? "" : ""; };
  const list = (name: string) => value(name).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const comp = value("comp").toUpperCase();
  const disciplines = list("disc");
  if (!/^[A-Z]{2}\d{4}$/.test(comp)) throw new Error("--comp 是官方賽事代碼，例如 OG2024");
  if (!disciplines.length || disciplines.some((d) => !/^[A-Z0-9]{3}$/.test(d))) throw new Error("--disc 是三碼項目代碼，逗號分隔，例如 BDM,BOX");
  return { comp, disciplines, only: list("only"), dryRun: argv.includes("--dry-run") };
}

/** Wayback 偶爾回 429／5xx，退避重試；其他錯誤直接丟出 */
async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch((error: Error) => error);
    if (!(response instanceof Error) && response.ok) return response.text();
    const status = response instanceof Error ? response.message : `HTTP ${response.status}`;
    const retryable = response instanceof Error || response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 4) throw new Error(`${status}：${url}`);
    console.warn(`  ${status}，${15 * attempt} 秒後重試`);
    await wait(15_000 * attempt);
  }
}

type Capture = { timestamp: string; url: string };

/** 每個場次代碼的所有存檔，新到舊（最早的常是賽前名單；最新的偶爾是空白檔） */
async function listUnits(comp: string, discipline: string): Promise<Map<string, Capture[]>> {
  const query = new URLSearchParams({ url: `olympics.com/${comp}/data/RES_ByRSC`, matchType: "prefix", fl: "timestamp,original", limit: "20000" });
  query.append("filter", "statuscode:200");
  query.append("filter", `original:.*comp=${comp}.*disc=${discipline}.*lang=ENG.*`);
  const text = await fetchText(`https://web.archive.org/cdx/search/cdx?${query}`);
  const units = new Map<string, Capture[]>();
  for (const line of text.split("\n")) {
    const [timestamp, url] = line.trim().split(" ");
    const code = url?.match(/~(?:rscResult|rsc)=([A-Z0-9-]+)~/)?.[1];
    // 逐場代碼固定 34 碼（項目 22＋階段 4＋場次 8）；較短的是項目層級或其他頁面
    if (!code || code.length !== 34 || !code.startsWith(discipline)) continue;
    units.set(code, [...(units.get(code) ?? []), { timestamp, url }]);
  }
  for (const captures of units.values()) captures.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return units;
}

const hasUnit = (json: unknown) => Boolean((json as { results?: { eventUnitCode?: string } })?.results?.eventUnitCode);
const MAX_CAPTURES = 3;

/** 從最新的存檔往回試，跳過空白或壞掉的檔案；只快取有內容的 */
async function loadUnit(cacheDir: string, code: string, captures: Capture[]): Promise<unknown> {
  const file = `${cacheDir}/${code}.json`;
  // 試過所有存檔都是空白的場次記一個標記，重跑時不再打 Wayback
  const blank = `${cacheDir}/${code}.blank`;
  if (existsSync(blank)) return null;
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, "utf8"));
    if (hasUnit(cached)) return cached;
  }
  for (const capture of captures.slice(0, MAX_CAPTURES)) {
    const text = await fetchText(`https://web.archive.org/web/${capture.timestamp}id_/${capture.url}`).catch(() => "");
    await wait(PAUSE_MS);
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { continue; }
    if (!hasUnit(json)) continue;
    writeFileSync(file, text);
    return json;
  }
  writeFileSync(blank, "");
  return null;
}

/**
 * 同一輪的場次編號應該連號（000100、000200… 或 000001、000002…）；跳號代表 Wayback 沒存到，要人工補。
 * 代碼 = 項目 22 碼＋階段 4 碼＋場次 8 碼（6 位編號＋「--」）；編號前有字母的（如十項全能分組）不檢查。
 */
function coverageGaps(codes: string[]): string[] {
  const rounds = new Map<string, number[]>();
  for (const code of codes) {
    const m = code.match(/^(.{26})(\d{6})--$/);
    if (m) rounds.set(m[1], [...(rounds.get(m[1]) ?? []), Number(m[2])]);
  }
  return [...rounds].flatMap(([round, numbers]) => {
    const step = numbers.every((n) => n % 100 === 0) ? 100 : 1;
    const max = Math.max(...numbers) / step;
    return Array.from({ length: max }, (_, i) => (i + 1) * step).filter((n) => !numbers.includes(n))
      .map((n) => `${round}${String(n).padStart(6, "0")}--`);
  });
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

function mergeCsv(path: string, disciplines: string[], rows: ManualRow[]): string {
  const kept = existsSync(path)
    ? csvRecords(readFileSync(path, "utf8"), [], path).filter((r) => !disciplines.includes(r.discipline ?? ""))
    : [];
  const all = [...kept, ...rows].sort((a, b) => `${a.date} ${a.time} ${a.unit_id}`.localeCompare(`${b.date} ${b.time} ${b.unit_id}`));
  return `﻿${[MANUAL_COLUMNS.join(","), ...all.map((r) => MANUAL_COLUMNS.map((c) => csvCell(r[c] ?? "")).join(","))].join("\n")}\n`;
}

async function importDiscipline(comp: string, discipline: string, only: string[], noc: string) {
  const cacheDir = `.cache/wayback/${comp}`;
  mkdirSync(cacheDir, { recursive: true });
  const units = await listUnits(comp, discipline);
  const codes = [...units.keys()].filter((code) => !only.length || only.some((prefix) => code.startsWith(prefix))).sort();
  console.log(`${discipline}：Wayback 有 ${codes.length} 個場次`);
  const rows: ManualRow[] = [];
  const notes: string[] = [];
  for (const [i, code] of codes.entries()) {
    if (i && i % 50 === 0) console.log(`  ${discipline} ${i}/${codes.length}`);
    const json = await loadUnit(cacheDir, code, units.get(code)!);
    if (!json) { notes.push(`Wayback 只有空白檔：${code}（無法判斷是否有 ${noc}）`); continue; }
    const result = convertArchiveUnit(json, noc);
    rows.push(...result.rows);
    if (result.skipped) notes.push(`略過：${result.skipped}`);
    if (result.unknownPhase && result.rows.length) notes.push(`未翻譯的階段（保留英文）：${code} ${result.unknownPhase}`);
  }
  notes.push(...coverageGaps(codes).map((code) => `Wayback 缺：${code}（無法判斷是否有 ${noc}）`));
  return { rows, notes };
}

async function main() {
  const { comp, disciplines, only, dryRun } = parseArgs(process.argv.slice(2));
  const noc = CONFIG.team.noc;
  const rows: ManualRow[] = [];
  for (const discipline of disciplines) {
    const result = await importDiscipline(comp, discipline, only, noc);
    rows.push(...result.rows);
    for (const note of result.notes) console.warn(`  ${note}`);
  }
  const mine = rows.filter((r) => r.organisation === noc);
  const medals = mine.filter((r) => r.medal).map((r) => `${r.medal} ${r.sport} ${r.event} ${r.name}`);
  console.log(`${noc} 共 ${new Set(mine.map((r) => r.unit_id)).size} 個場次；獎牌 ${medals.length} 面${medals.length ? `：\n  ${medals.join("\n  ")}` : ""}`);
  const path = `${process.env.EVENTS_DIR ?? "events"}/${EVENT_ID}/results/manual.csv`;
  if (dryRun) return console.log("--dry-run：未寫入");
  writeFileSync(path, mergeCsv(path, disciplines, rows));
  console.log(`已寫入 ${path}`);
}

main().catch((error) => {
  console.error(`[import-wayback] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
