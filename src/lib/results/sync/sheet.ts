// Google 試算表來源：下載「發布到網路」的 CSV，欄位與 manual.csv 相同，之後走手動成績同一條路。
// 網址格式已在 config-schema 檢查過；這裡再限制大小、時間與轉址後的網域。

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_HOSTS = /(^|\.)(docs\.google\.com|googleusercontent\.com)$/;

export async function fetchSheetCsv(url: string): Promise<string> {
  // Google 會把發布網址轉到 googleusercontent.com 的實際檔案
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { Accept: "text/csv" } });
  if (!ALLOWED_HOSTS.test(new URL(response.url).hostname)) throw new Error("試算表網址轉到非 Google 網域，已停止");
  if (!response.ok) throw new Error(`試算表暫時無法讀取（HTTP ${response.status}）`);
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/csv/.test(type)) throw new Error("試算表沒有回傳 CSV：請確認「發布到網路」選的是 CSV、且已發布");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("試算表超過 2 MB，請拆成多個賽事或刪掉不需要的分頁");
  return text;
}
