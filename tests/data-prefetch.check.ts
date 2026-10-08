import assert from "node:assert/strict";
import { dataPrefetchScript, dataKey, takePrefetched } from "../src/components/results/dataPrefetch";

// 在模擬的瀏覽器環境執行預抓腳本，回傳它請求過的網址
async function run(search: string, index: unknown) {
  const requested: string[] = [];
  const win: Record<string, unknown> = { location: { search } };
  const fetch = (url: string) => {
    requested.push(url);
    const body = url.includes("/data/index.json") ? index : { ok: true };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
  new Function("window", "fetch", "Date", dataPrefetchScript("/ag2026"))(win, fetch, { now: () => 120_000 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { requested, win };
}

const meta = (at: string) => ({ lastSuccessAt: at, lastAttemptAt: at, lastError: null });
const index = { source: "AG2026", generatedAt: "x", days: { "2026-09-10": meta("2026-09-10T01:00:00Z"), "2026-09-11": meta("2026-09-11T01:00:00Z") }, medals: meta("2026-09-11T02:00:00Z") };

async function main() {
// 預設（整個賽期）：index 之後同時抓所有日期與獎牌榜，網址與 staticData 的請求一致
{
  const { requested, win } = await run("", index);
  assert.deepEqual(requested, [
    "/ag2026/data/index.json?v=2",
    "/ag2026/data/days/2026-09-10.json?v=2026-09-10T01%3A00%3A00Z",
    "/ag2026/data/days/2026-09-11.json?v=2026-09-11T01%3A00%3A00Z",
    "/ag2026/data/medals.json?v=2026-09-11T02%3A00%3A00Z",
  ]);
  (globalThis as Record<string, unknown>).window = win;
  const key = dataKey("days/2026-09-10.json", "2026-09-10T01:00:00Z");
  assert.ok(takePrefetched(key), "staticData can pick up the prefetched day");
  assert.equal(takePrefetched(key), undefined, "each prefetch is used once");
  delete (globalThis as Record<string, unknown>).window;
}

// 指定單日的網址只預抓那一天
{
  const { requested } = await run("?date=2026-09-11", index);
  assert.deepEqual(requested.slice(1), ["/ag2026/data/days/2026-09-11.json?v=2026-09-11T01%3A00%3A00Z", "/ag2026/data/medals.json?v=2026-09-11T02%3A00%3A00Z"]);
}

// index 格式不對時不抓其他檔案，也不丟錯
{
  const { requested } = await run("", null);
  assert.deepEqual(requested, ["/ag2026/data/index.json?v=2"]);
}

// 沒有 window（伺服器端建置）時取不到東西
assert.equal(takePrefetched("index.json?v=1"), undefined);
}

main().catch((error) => { console.error(error); process.exit(1); });
