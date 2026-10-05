// GitHub Actions 每輪執行一次：npm run sync
// 環境變數：DATA_DIR（預設 data）、SYNC_BUDGET_MINUTES（預設 20）、MANUAL_CSV（預設 results/manual.csv）
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { CONFIG } from "../src/config";
import { fileStore } from "../src/lib/results/sync/fileStore";
import { runManualSync } from "../src/lib/results/sync/manual";
import { runSync, type SyncSummary } from "../src/lib/results/sync/run";

const MANUAL_CSV = process.env.MANUAL_CSV ?? "results/manual.csv";

async function main() {
  const store = fileStore(process.env.DATA_DIR ?? "data");
  let summary: SyncSummary;
  if (CONFIG.source.type === "manual") {
    if (!existsSync(MANUAL_CSV)) throw new Error(`來源設定為 manual，但找不到 ${MANUAL_CSV}`);
    summary = runManualSync(store, readFileSync(MANUAL_CSV, "utf8"));
  } else {
    summary = await runSync({ store, budgetMs: Number(process.env.SYNC_BUDGET_MINUTES ?? 20) * 60_000 });
  }
  console.log(`[sync] ${JSON.stringify(summary)}`);
  // 給 workflow 判斷要不要 commit 與重新部署
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${summary.changed}\n`);
}

main().catch((error) => {
  console.error(`[sync] 失敗：${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
