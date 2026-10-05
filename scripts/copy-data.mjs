// build 前把同步資料（DATA_DIR，預設 data/）複製到 public/data/，讓靜態網站讀得到。沒有資料就放空的 index。
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("competition.config.json", "utf8"));
const DATA_DIR = process.env.DATA_DIR ?? "data";
rmSync("public/data", { recursive: true, force: true });
if (existsSync(`${DATA_DIR}/index.json`)) {
  cpSync(DATA_DIR, "public/data", { recursive: true, filter: (path) => !path.endsWith(".tmp") && !path.includes("/.git") });
  console.log(`[copy-data] ${DATA_DIR} → public/data/`);
} else {
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/index.json", JSON.stringify({ source: config.source.code, generatedAt: new Date(0).toISOString(), days: {}, medals: null }));
  console.log(`[copy-data] 沒有 ${DATA_DIR}，產生空的 index.json`);
}
