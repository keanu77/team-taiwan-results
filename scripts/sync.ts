// GitHub Actions 每輪執行一次：npm run sync
// 一次處理一個賽事（EVENT）。全部賽事用 npm run sync:all。
// 環境變數：EVENT、DATA_DIR（預設 data/<賽事>）、SYNC_BUDGET_MINUTES（預設 20）、MANUAL_CSV（預設 events/<賽事>/results/manual.csv）、
// SYNC_CHANGED_FILE（有變動時寫入賽事代號，給 workflow 用）
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CONFIG, EVENT_ID } from "../src/config";
import { fileStore } from "../src/lib/results/sync/fileStore";
import { runManualSync } from "../src/lib/results/sync/manual";
import { fetchSheetCsv } from "../src/lib/results/sync/sheet";
import { runSync, type SyncSummary } from "../src/lib/results/sync/run";

const MANUAL_CSV = process.env.MANUAL_CSV ?? `${process.env.EVENTS_DIR ?? "events"}/${EVENT_ID}/results/manual.csv`;

async function main() {
  const store = fileStore(process.env.DATA_DIR ?? `data/${EVENT_ID}`);
  let summary: SyncSummary;
  if (CONFIG.source.type === "sheet") {
    summary = runManualSync(store, await fetchSheetCsv(CONFIG.source.csvUrl), new Date(), { guardDrop: true });
  } else if (CONFIG.source.type === "manual") {
    if (!existsSync(MANUAL_CSV)) throw new Error(`來源設定為 manual，但找不到 ${MANUAL_CSV}`);
    summary = runManualSync(store, readFileSync(MANUAL_CSV, "utf8"));
  } else {
    summary = await runSync({ store, budgetMs: Number(process.env.SYNC_BUDGET_MINUTES ?? 20) * 60_000 });
  }
  console.log(`[sync] ${EVENT_ID} ${JSON.stringify(summary)}`);
  const failed = summary.medals === "failed" || Object.values(summary.days).includes("failed");
  // 給 workflow 判斷要不要 commit 與重新部署：任何賽事有變動就建立這個檔案
  if (process.env.SYNC_CHANGED_FILE && summary.changed) writeFileSync(process.env.SYNC_CHANGED_FILE, `${EVENT_ID}\n`, { flag: "a" });
  // 已抓到的資料都存好了；官網失敗仍回傳非 0，讓 Actions 標紅，才不會默默停更
  if (failed) {
    console.error(`::warning title=${EVENT_ID} 同步失敗::${summary.reason ?? "官方來源暫時無法讀取"}；已保留上一份資料，下一輪會重試`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[sync] ${process.env.EVENT ?? ""} 失敗：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
