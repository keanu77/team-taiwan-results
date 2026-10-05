// GitHub Actions 每輪執行一次：npm run sync
// 一次處理一個賽事（EVENT）。全部賽事用 npm run sync:all。
// 環境變數：EVENT、DATA_DIR（預設 data/<賽事>）、SYNC_BUDGET_MINUTES（預設 20）、MANUAL_CSV（預設 events/<賽事>/results/manual.csv）
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { CONFIG, EVENT_ID } from "../src/config";
import { fileStore } from "../src/lib/results/sync/fileStore";
import { runManualSync } from "../src/lib/results/sync/manual";
import { runSync, type SyncSummary } from "../src/lib/results/sync/run";

const MANUAL_CSV = process.env.MANUAL_CSV ?? `events/${EVENT_ID}/results/manual.csv`;

async function main() {
  const store = fileStore(process.env.DATA_DIR ?? `data/${EVENT_ID}`);
  let summary: SyncSummary;
  if (CONFIG.source.type === "manual") {
    if (!existsSync(MANUAL_CSV)) throw new Error(`來源設定為 manual，但找不到 ${MANUAL_CSV}`);
    summary = runManualSync(store, readFileSync(MANUAL_CSV, "utf8"));
  } else {
    summary = await runSync({ store, budgetMs: Number(process.env.SYNC_BUDGET_MINUTES ?? 20) * 60_000 });
  }
  console.log(`[sync] ${EVENT_ID} ${JSON.stringify(summary)}`);
  const failed = summary.medals === "failed" || Object.values(summary.days).includes("failed");
  // 給 workflow 判斷要不要 commit 與重新部署。多個賽事依序寫入，只寫 true；預設的 false 由 sync-all.sh 先寫
  if (process.env.GITHUB_OUTPUT && summary.changed) appendFileSync(process.env.GITHUB_OUTPUT, "changed=true\n");
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
