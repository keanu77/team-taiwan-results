// 網站首頁：列出 events/ 底下的所有賽事。只有一個賽事時直接轉到那個賽事。
// 用法：node scripts/build-index.mjs <site 目錄> <賽事代號...>（由 build-site.sh 呼叫）
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [siteDir, ...ids] = process.argv.slice(2);
if (!siteDir || !ids.length) throw new Error("用法：node scripts/build-index.mjs <site 目錄> <賽事代號...>");

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slash = (date) => date.replaceAll("-", "/");

const EVENTS_DIR = process.env.EVENTS_DIR ?? "events";
const events = ids
  .map((id) => ({ id, ...JSON.parse(readFileSync(join(EVENTS_DIR, id, "competition.config.json"), "utf8")) }))
  .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id));

// 圖片：site-assets/ 的主視覺，與各賽事 events/<代號>/cover.webp 封面（選填），複製到 site/assets/
mkdirSync(join(siteDir, "assets", "covers"), { recursive: true });
for (const name of ["hero.webp", "hero-sm.webp"]) {
  if (existsSync(join("site-assets", name))) copyFileSync(join("site-assets", name), join(siteDir, "assets", name));
}
const hasHero = existsSync(join(siteDir, "assets", "hero.webp"));
for (const e of events) {
  const cover = join(EVENTS_DIR, e.id, "cover.webp");
  e.cover = null;
  if (existsSync(cover)) {
    copyFileSync(cover, join(siteDir, "assets", "covers", `${e.id}.webp`));
    e.cover = `./assets/covers/${e.id}.webp`;
  }
}

// 各賽事獎牌數：讀代表團得牌明細 rosters/team-medals.csv 的第一欄（金／銀／銅）
const MEDAL_KEYS = { 金: "gold", 銀: "silver", 銅: "bronze" };
for (const e of events) {
  const file = join(EVENTS_DIR, e.id, "rosters", "team-medals.csv");
  e.medals = { gold: 0, silver: 0, bronze: 0 };
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).slice(1)) {
    const key = MEDAL_KEYS[line.split(",")[0]?.trim()];
    if (key) e.medals[key] += 1;
  }
}

const medalChips = (m) => (m.gold + m.silver + m.bronze
  ? `<span class="medals" aria-label="金牌 ${m.gold}、銀牌 ${m.silver}、銅牌 ${m.bronze}"><span class="m gold">金 ${m.gold}</span><span class="m silver">銀 ${m.silver}</span><span class="m bronze">銅 ${m.bronze}</span></span>`
  : `<span class="medals none">尚無得牌明細</span>`);

const cards = events.map((e) => `
      <li><a class="card" href="./${escape(e.id)}/" data-start="${escape(e.startDate)}" data-end="${escape(e.endDate)}" data-tz="${escape(e.timeZone)}">
        <span class="cover">${e.cover ? `<img src="${e.cover}" alt="" loading="lazy" width="720" height="405">` : ""}<span class="status" hidden></span></span>
        <span class="body">
          <strong>${escape(e.name)}</strong>
          <span class="meta">${escape(e.team.label)}（${escape(e.team.noc)}）・${slash(e.startDate)}–${slash(e.endDate).slice(5)}</span>
          ${medalChips(e.medals)}
        </span>
      </a></li>`).join("");

// 依各賽事主辦地的「今天」標示狀態；在瀏覽器算，網站不用每天重建
const statusScript = `document.querySelectorAll(".card").forEach(function(a){try{var t=new Intl.DateTimeFormat("en-CA",{timeZone:a.dataset.tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());var s=t<a.dataset.start?["即將開始","soon"]:t>a.dataset.end?["已結束","done"]:["進行中","live"];var el=a.querySelector(".status");el.textContent=s[0];el.className="status "+s[1];el.hidden=false;}catch(e){}});`;

const REPO = "https://github.com/keanu77/team-taiwan-results";

// 首頁說明：賽事頁內容、資料怎麼來、怎麼加新賽事
const about = `
  <section class="info" aria-label="關於本站">
    <article>
      <h2>賽事頁可以看什麼</h2>
      <ul class="points">
        <li>累計獎牌與得牌選手</li>
        <li>依運動項目分組的每場比賽：階段、對手、比分、名次、勝負</li>
        <li>選手中文姓名，可用中英文搜尋</li>
        <li>主辦地與台灣時間並列</li>
        <li>手機版、夜間模式、字級調整</li>
      </ul>
    </article>
    <article>
      <h2>資料來源</h2>
      <ul class="points">
        <li><strong>即時同步</strong>（如 2026 亞運）：賽期中約每 30 分鐘向官方成績系統同步，連不上時保留最後一次成功的資料，閉幕後補正一次即封存。</li>
        <li><strong>賽後回補</strong>（2024 巴黎、2020 東京奧運）：取自網際網路檔案館（Wayback Machine）保存的官方逐場成績與官方成績總冊；中文姓名與得牌依代表團公布的名單。</li>
        <li>「接續前場」表示官方只公布接在前一場之後，沒有確切開賽時間。</li>
      </ul>
    </article>
    <article>
      <h2>想追蹤其他賽事？</h2>
      <p>用 GitHub 的「<a href="${REPO}/issues/new?template=new-event.yml">新增賽事</a>」表單提出，或照 <a href="${REPO}#readme">README</a> 自己架一份（免費，不需要伺服器）。</p>
      <p class="repo">原始碼：<a href="${REPO}">${REPO.replace("https://", "")}</a></p>
    </article>
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
const latest = events[0];
const hero = `
<header class="hero${hasHero ? " has-image" : ""}">
  ${hasHero ? `<picture class="hero-art"><source media="(max-width: 720px)" srcset="./assets/hero-sm.webp"><img src="./assets/hero.webp" alt="" width="1600" height="900" fetchpriority="high"></picture>` : ""}
  <div class="hero-text">
    <p class="kicker">TEAM TAIWAN・RESULTS</p>
    <h1>中華隊<br>賽程與賽果追蹤</h1>
    <p class="lead">${single ? "正在前往賽事頁面…" : "奧運、亞運等綜合運動會，本隊每一場比賽的對手、比分與獎牌，一頁看完。"}</p>
    <a class="cta" href="./${escape(latest.id)}/">看 ${escape(latest.name)} →</a>
  </div>
</header>`;

const STYLE = `
:root{color-scheme:light dark;--bg:#f4f7fb;--card:#fff;--ink:#14204a;--muted:#5b6478;--line:#dde4ee;--brand:#254ecf;--navy:#08143a}
@media (prefers-color-scheme:dark){:root{--bg:#060d1a;--card:#0e1828;--ink:#e9f0f7;--muted:#93a3b5;--line:#1e2e42;--brand:#5b93ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.65}
a{color:var(--brand)}a:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.hero{position:relative;background:var(--navy);color:#fff;overflow:hidden}
.hero-art img{display:block;width:100%;height:auto}
.hero-text{position:relative;padding:24px 16px 32px;max-width:1100px;margin:0 auto}
.kicker{margin:0 0 8px;font-size:.75rem;letter-spacing:.2em;color:#ffb86b;font-weight:700}
.hero h1{margin:0;font-size:clamp(1.8rem,5vw,3rem);line-height:1.2;letter-spacing:.02em}
.hero .lead{margin:12px 0 0;color:#c9d6f2;max-width:30em}
.cta{display:inline-block;margin-top:20px;padding:10px 20px;border-radius:999px;background:#ff9a3c;color:#1b1206;font-weight:700;text-decoration:none}.cta:hover{background:#ffb066}.cta:focus-visible{outline:2px solid #fff;outline-offset:3px}
@media (min-width:721px){
.hero.has-image{height:min(56.25vw,720px)}
.hero.has-image .hero-art img{position:absolute;inset:0;height:100%;object-fit:cover;object-position:left 35%}
.hero.has-image::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 35%,rgba(8,20,58,.85) 62%)}
.hero.has-image .hero-text{position:absolute;z-index:1;right:max(16px,calc((100vw - 1100px)/2));top:50%;transform:translateY(-50%);width:min(44%,460px);padding:0}}
main{max-width:1100px;margin:0 auto;padding:32px 16px 64px}
h2.section{font-size:1.25rem;margin:0 0 16px}
ul{list-style:none;margin:0;padding:0}
.events{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.card{display:flex;flex-direction:column;height:100%;border:1px solid var(--line);border-radius:18px;background:var(--card);color:inherit;text-decoration:none;overflow:hidden;transition:transform .15s,box-shadow .15s,border-color .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(8,20,58,.18);border-color:var(--brand)}.card:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
@media (prefers-reduced-motion:reduce){.card{transition:none}.card:hover{transform:none}}
.cover{position:relative;display:block;aspect-ratio:16/9;background:linear-gradient(135deg,#1b3a8f,#08143a)}.cover img{width:100%;height:100%;object-fit:cover;display:block}
.status{position:absolute;top:10px;left:10px;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:999px;backdrop-filter:blur(4px)}.live{background:#e8f0ff;color:#0847c4}.soon{background:#fff1e7;color:#9a3412}.done{background:rgba(255,255,255,.88);color:#3d4658}
.body{display:grid;gap:6px;padding:14px 16px 16px}.body strong{font-size:1.1rem}.meta{color:var(--muted);font-size:.875rem}
.medals{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.m{font-size:.8rem;font-weight:700;padding:2px 10px;border-radius:999px}
.gold{background:#fdf0c4;color:#7a5600}.silver{background:#e8ecf2;color:#45505f}.bronze{background:#f8e1cf;color:#8a4a17}.medals.none{font-size:.8rem;color:var(--muted)}
.info{display:grid;gap:16px;margin-top:40px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.info article{padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--card)}
.info h2{font-size:1.05rem;margin:0 0 8px}.info p{margin:0 0 8px}.repo{font-size:.85rem;color:var(--muted);overflow-wrap:anywhere}
ul.points{list-style:disc;padding-left:1.2em}ul.points li{margin:4px 0;font-size:.95rem}
.credit{margin-top:40px;padding-top:24px;border-top:1px solid var(--line)}.credit p{margin:0;font-weight:600}
ul.follow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}ul.follow a{display:inline-block;min-height:36px;padding:6px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);text-decoration:none;font-size:.9rem}ul.follow a:hover{border-color:var(--brand);color:var(--brand)}
footer{margin-top:24px;font-size:.8rem;color:var(--muted)}
`;

const html = `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>賽程與賽果追蹤</title>
<meta name="description" content="奧運、亞運等綜合運動會中華隊的賽程、賽果與獎牌追蹤。">
${single ? `<meta http-equiv="refresh" content="0; url=./${escape(events[0].id)}/">` : ""}
<style>${STYLE}</style>
</head>
<body>
${hero}
<main>
  <h2 class="section">選擇賽事</h2>
  <ul class="events">${cards}
  </ul>${single ? "" : about}${credit}
  <footer>資料取自各賽會官方成績系統與其存檔，以官方公告為準。本站與主辦單位無關。主視覺與封面為示意插畫。</footer>
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
