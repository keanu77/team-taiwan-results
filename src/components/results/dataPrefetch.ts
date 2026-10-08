// 賽果資料預抓：<head> 的內嵌腳本在 JS 下載期間就先抓 index.json 與當頁要用的日期檔，
// staticData 再從這裡取用，省掉「HTML → JS → index → 各日期」的串行等待。

type Prefetched = Promise<unknown>;
const STORE = "__resultsPrefetch";

/** 預抓與 staticData 共用的鍵：data/ 底下的路徑＋版本，要與實際請求的網址一致 */
export const dataKey = (path: string, version: string) => `${path}?v=${encodeURIComponent(version)}`;

/** 取出預抓結果（每筆只用一次）；沒有預抓或不在瀏覽器時回傳 undefined */
export function takePrefetched(key: string): Prefetched | undefined {
  const store = (globalThis as unknown as { window?: Record<string, unknown> }).window?.[STORE] as Record<string, Prefetched> | undefined;
  const value = store?.[key];
  if (store && value) delete store[key];
  return value;
}

/**
 * 內嵌在 <head> 的腳本。版本規則與 staticData 相同：index 用分鐘數，其他檔案用各自的同步時間。
 * 預設網址顯示整個賽期，所以抓 index 裡的所有日期；網址指定單日（?date=）時只抓那一天。
 * 失敗一律靜默，staticData 會照常自己再抓。
 */
export function dataPrefetchScript(basePath: string): string {
  return `(function(){try{var w=window,s=w.${STORE}={},b=${JSON.stringify(basePath)}+"/data/";
function v(m){return encodeURIComponent(m&&(m.lastSuccessAt||m.lastAttemptAt)||"none")}
function g(k){var p=fetch(b+k,{credentials:"omit"}).then(function(r){if(r.status===404)return null;if(!r.ok)throw new Error(String(r.status));return r.json()});p.catch(function(){});s[k]=p;return p}
var q=new URLSearchParams(w.location.search),d=q.get("range")!=="period"&&q.get("date");
g("index.json?v="+Math.floor(Date.now()/60000)).then(function(x){if(!x||typeof x!=="object"||!x.days)return;
Object.keys(x.days).forEach(function(k){if(!d||k===d)g("days/"+k+".json?v="+v(x.days[k]))});
if(x.medals)g("medals.json?v="+v(x.medals))}).catch(function(){})}catch(e){}})();`;
}
