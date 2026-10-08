// 網站首頁：列出 events/ 底下的所有賽事。只有一個賽事時直接轉到那個賽事。
// 用法：node scripts/build-index.mjs <site 目錄> <賽事代號...>（由 build-site.sh 呼叫）
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [siteDir, ...ids] = process.argv.slice(2);
if (!siteDir || !ids.length) throw new Error("用法：node scripts/build-index.mjs <site 目錄> <賽事代號...>");

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slash = (date) => date.replaceAll("-", "/");

const events = ids
  .map((id) => ({ id, ...JSON.parse(readFileSync(join(process.env.EVENTS_DIR ?? "events", id, "competition.config.json"), "utf8")) }))
  .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id));

const cards = events.map((e) => `
      <li><a class="card" href="./${escape(e.id)}/" data-start="${escape(e.startDate)}" data-end="${escape(e.endDate)}" data-tz="${escape(e.timeZone)}">
        <span class="status" hidden></span>
        <strong>${escape(e.name)}</strong>
        <span class="meta">${escape(e.team.label)}（${escape(e.team.noc)}）・${slash(e.startDate)}–${slash(e.endDate).slice(5)}</span>
      </a></li>`).join("");

// 依各賽事主辦地的「今天」標示狀態；在瀏覽器算，網站不用每天重建
const statusScript = `document.querySelectorAll(".card").forEach(function(a){try{var t=new Intl.DateTimeFormat("en-CA",{timeZone:a.dataset.tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());var s=t<a.dataset.start?["即將開始","soon"]:t>a.dataset.end?["已結束","done"]:["進行中","live"];var el=a.querySelector(".status");el.textContent=s[0];el.className="status "+s[1];el.hidden=false;}catch(e){}});`;

const REPO = "https://github.com/keanu77/team-taiwan-results";

// 首頁說明：這個網站是什麼、資料怎麼來、怎麼加新賽事
const about = `
  <section>
    <h2>這是什麼</h2>
    <p>綜合運動會（奧運、亞運等）中華台北代表隊的賽程與賽果整理。每個賽事一頁，把官方成績系統的英文資料整理成依運動項目分組的中文頁面，方便快速查本隊選手的比賽時間、對手、比分與獎牌。</p>
  </section>
  <section>
    <h2>賽事頁可以看什麼</h2>
    <ul class="points">
      <li>累計獎牌與得牌選手，依代表團公布的得牌明細</li>
      <li>依運動項目分組的每場比賽：階段、對手、比分或成績、名次、勝負</li>
      <li>選手中文姓名、項目中文名稱，可用中英文搜尋選手</li>
      <li>單日或整個賽期查詢，並列主辦地與台灣時間</li>
      <li>手機版、夜間模式、字級調整</li>
    </ul>
  </section>
  <section>
    <h2>資料來源</h2>
    <ul class="points">
      <li><strong>即時同步的賽事</strong>（如 2026 愛知・名古屋亞運）：賽期中由 GitHub Actions 定時向官方成績系統同步（約每 30 分鐘一輪），官網暫時連不上時保留最後一次成功的資料；閉幕後再補正一次即封存。</li>
      <li><strong>已結束的賽事</strong>（2024 巴黎、2020 東京奧運）：官網即時資料已下線，改由網際網路檔案館（Wayback Machine）保存的官方逐場成績與官方成績總冊回補；選手中文姓名與得牌依代表團公布的名單。</li>
      <li>標示「接續前場」的場次，官方只公布接在前一場之後，沒有確切開賽時間。</li>
    </ul>
  </section>
  <section>
    <h2>想追蹤其他賽事？</h2>
    <p>到 GitHub 用「<a href="${REPO}/issues/new?template=new-event.yml">新增賽事</a>」表單提出，或照 <a href="${REPO}#readme">README</a> 的步驟自己架一份（免費，不需要伺服器）。原始碼公開於 <a href="${REPO}">${REPO.replace("https://", "")}</a>。</p>
  </section>`;

// 製作者與追蹤連結（與運動傷害影片圖鑑 injury.sportsmedicine.tw 一致）
const FOLLOW = [
  ["個人網站", "https://sportsmedicine.tw/"],
  ["衛教部落格", "https://blog.sportsmedicine.tw/"],
  ["Facebook", "https://www.facebook.com/EthanWuMD/"],
  ["Instagram", "https://www.instagram.com/ethan77wu/"],
  ["LINE", "https://line.me/R/ti/p/@521cvffb"],
  ["GitHub", "https://github.com/keanu77"],
];
const credit = `
  <section class="credit">
    <p>製作者：<a href="https://sportsmedicine.tw/" target="_blank" rel="noopener">運動醫學科 吳易澄醫師</a></p>
    <nav aria-label="追蹤連結"><ul class="follow">${FOLLOW.map(([label, href]) => `<li><a href="${href}" target="_blank" rel="noopener" aria-label="${label}（在新分頁開啟）">${label}</a></li>`).join("")}</ul></nav>
  </section>`;

const single = events.length === 1;
const html = `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>賽程與賽果追蹤</title>
<meta name="description" content="綜合運動會國家隊賽程、賽果與獎牌追蹤，定時同步官方成績系統。">
${single ? `<meta http-equiv="refresh" content="0; url=./${escape(events[0].id)}/">` : ""}
<style>
:root{color-scheme:light dark;--bg:#f6f8fb;--card:#fff;--ink:#182651;--muted:#5b6478;--line:#dde4ee;--brand:#254ecf}
@media (prefers-color-scheme:dark){:root{--bg:#071018;--card:#0f1a26;--ink:#e9f0f7;--muted:#93a3b5;--line:#1e2e3e;--brand:#4d8bff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.6}
main{max-width:720px;margin:0 auto;padding:40px 16px 64px}h1{font-size:1.75rem;margin:0 0 4px}p.lead{margin:0 0 24px;color:var(--muted)}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.card{display:grid;gap:4px;padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:inherit;text-decoration:none}
.card:hover{border-color:var(--brand)}.card:focus-visible{outline:2px solid var(--brand);outline-offset:2px}.card strong{font-size:1.1rem}.meta{color:var(--muted);font-size:.9rem}
.status{justify-self:start;font-size:.75rem;font-weight:600;padding:2px 10px;border-radius:999px}.live{background:#e8f0ff;color:#0847c4}.soon{background:#fff1e7;color:#9a3412}.done{background:#e9eef6;color:#5b6478}
section{margin-top:32px}h2{font-size:1.1rem;margin:0 0 8px}section p{margin:0}section a,footer a{color:var(--brand)}
ul.points{display:block;list-style:disc;padding-left:1.25em}ul.points li{margin:4px 0}
.credit{padding-top:24px;border-top:1px solid var(--line)}.credit p{font-weight:600}
ul.follow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}ul.follow a{display:inline-block;min-height:36px;padding:6px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);text-decoration:none;font-size:.9rem}ul.follow a:hover{border-color:var(--brand);color:var(--brand)}ul.follow a:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
footer{margin-top:32px;font-size:.8rem;color:var(--muted)}
</style>
</head>
<body>
<main>
  <h1>賽程與賽果追蹤</h1>
  <p class="lead">${single ? "正在前往賽事頁面…" : "選擇賽事，查看代表隊的賽程、比分與獎牌。"}</p>
  <ul>${cards}
  </ul>${single ? "" : about}${credit}
  <footer>資料定時同步各賽會官方成績系統，以官方公告為準。本站與主辦單位無關。</footer>
</main>
<script>${statusScript}</script>
</body>
</html>
`;

writeFileSync(join(siteDir, "index.html"), html);
// GitHub Pages 找不到網址時顯示根目錄的 404.html。它會出現在任何深度的網址下（例如 /og2020/），
// 相對連結要以網站根目錄為準，否則點下去會變成 /og2020/og2024/
const base = `${(process.env.BASE_PATH ?? "").replace(/\/+$/, "")}/`;
writeFileSync(join(siteDir, "404.html"), html.replace("<head>", `<head>\n<base href="${escape(base)}">`).replace("<title>賽程與賽果追蹤</title>", "<title>找不到頁面｜賽程與賽果追蹤</title>")
  .replace(/<meta http-equiv="refresh"[^>]*>/, "")
  .replace(/<p class="lead">[^<]*<\/p>/, '<p class="lead">找不到這個頁面，請從下面選擇賽事。</p>'));
console.log(`[index] ${events.length} 個賽事：${events.map((e) => e.id).join("、")}`);
