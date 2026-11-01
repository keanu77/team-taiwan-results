// build 前把這個賽事的同步資料（DATA_DIR，預設 data/<賽事>/）複製到 public/data/，讓靜態網站讀得到。沒有資料就放空的 index。
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";

// prepare-event 已經產生這份（含賽事代號）
const config = JSON.parse(readFileSync("src/generated/competition.json", "utf8"));
const DATA_DIR = process.env.DATA_DIR ?? `data/${config.id}`;
rmSync("public/data", { recursive: true, force: true });
if (existsSync(`${DATA_DIR}/index.json`)) {
  cpSync(DATA_DIR, "public/data", { recursive: true, filter: (path) => !path.endsWith(".tmp") && !path.includes("/.git") && !path.endsWith("/state.json") });
  console.log(`[copy-data] ${DATA_DIR} → public/data/`);
} else {
  mkdirSync("public/data", { recursive: true });
  const empty = config.source.type === "dakar" ? {
    success: true, source: "DAKAR2026", today: new Date().toISOString().slice(0, 10), minDate: config.startDate, maxDate: config.endDate,
    units: [], medals: null, medalsFetchedAt: null, medalsStale: true, syncEnabled: true, syncIntervalMinutes: 60,
    coverage: Array.from({ length: 15 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 30 + i)).toISOString().slice(0, 10), totalUnits: 0, unconfirmedUnits: 0, fetchedAt: null, lastAttemptAt: null, stale: true, warning: "此日期尚未取得完整資料。" })),
  } : { source: config.source.code, generatedAt: new Date(0).toISOString(), days: {}, medals: null };
  writeFileSync("public/data/index.json", JSON.stringify(empty));
  console.log(`[copy-data] 沒有 ${DATA_DIR}，產生空的 index.json`);
}
