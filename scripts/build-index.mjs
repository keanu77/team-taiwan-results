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
footer{margin-top:32px;font-size:.8rem;color:var(--muted)}footer a{color:inherit}
</style>
</head>
<body>
<main>
  <h1>賽程與賽果追蹤</h1>
  <p class="lead">${single ? "正在前往賽事頁面…" : "選擇賽事，查看代表隊的賽程、比分與獎牌。"}</p>
  <ul>${cards}
  </ul>
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
