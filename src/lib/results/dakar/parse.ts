import { load, type CheerioAPI } from "cheerio/slim";
import { DAKAR_BASE, isDakarDate } from "./config";
import { DAKAR_ATHLETES } from "./roster";
import type { DakarAthlete, DakarCompetitor, DakarMedals, DakarSet, DakarUnit } from "./types";

type Selection = ReturnType<CheerioAPI>;
const RSC = /^[A-Z0-9-]{20,48}$/;
const UUID = /^[a-f0-9-]{36}$/i;
const sports: Record<string, string> = { SWM: "游泳", ARC: "射箭", ATH: "田徑", BDM: "羽球", BS5: "五人制棒球", BK3: "籃球3×3", BOX: "拳擊", BKG: "霹靂舞", CRD: "自由車（公路）", FEN: "擊劍", JUD: "柔道", SAL: "帆船", SKB: "滑輪板", TTE: "桌球", TKW: "跆拳道", TRI: "鐵人三項", WST: "武術" };
const roster = new Map(DAKAR_ATHLETES.map(a => [a.id, a]));
const tidy = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 500);
const country = (node: Selection) => node.find('img[src*="/svg_flags/"]').first().attr("src")?.match(/\/([A-Z]{3})\.svg(?:\?|$)/)?.[1] ?? "";
const athleteId = (node: Selection) => node.find('a[href*="/ParticipantInfo/"]').first().attr("href")?.split("/").pop() ?? "";
const text = (node: Selection, selector: string) => tidy(node.find(selector).first().text());
function document(html: string) {
  if (!html || Buffer.byteLength(html) > 8 * 1024 * 1024) throw Error("官方資料大小不符");
  const $ = load(html); $("script,style").remove(); return $;
}
function status(raw: string, result = "") {
  const official = /^(Official Results|Official)$/i.test(tidy(result));
  if (official) return { status: "OFFICIAL", statusLabel: "正式成績", official: true };
  if (/unofficial|provisional/i.test(result)) return { status: "UNOFFICIAL", statusLabel: "暫定成績", official: false };
  const states: Record<string, [string, string]> = { scheduled: ["SCHEDULED", "未開賽"], "start list": ["START_LIST", "出賽名單"], "getting ready": ["START_LIST", "準備出賽"], finished: ["FINISHED", "已結束・待確認"], running: ["RUNNING", "進行中"], live: ["RUNNING", "進行中"], "in progress": ["RUNNING", "進行中"], postponed: ["POSTPONED", "延期"], delayed: ["DELAYED", "延賽"], cancelled: ["CANCELLED", "取消"], canceled: ["CANCELLED", "取消"], interrupted: ["SUSPENDED", "暫停"], suspended: ["SUSPENDED", "暫停"], rescheduled: ["RESCHEDULED", "時間調整"] };
  const pair = states[raw.toLowerCase()] ?? ["UNKNOWN", "狀態待確認"];
  return { status: pair[0], statusLabel: pair[1], official: false };
}
const hasScores = (state: string) => ["RUNNING", "OFFICIAL", "UNOFFICIAL", "FINISHED"].includes(state);
export class PendingDakarEntriesError extends Error {}
function sides($: CheerioAPI, parent: Selection, state: string): DakarCompetitor[] {
  return parent.find(".scoredevLeft,.scoredevRight").slice(0, 2).toArray().map(el => {
    const side = $(el), id = athleteId(side), known = roster.get(id);
    const noc = country(side) || (known ? "TPE" : "");
    return { id: id || noc, country: noc, name: text(side, ".team-name") || noc, nameZh: known?.nameZh ?? (noc === "TPE" ? "TPE" : ""),
      score: hasScores(state) ? text(side, ".score") : "", rank: "", qualification: "", irm: text(side, ".result-code"),
      winner: ["OFFICIAL", "UNOFFICIAL"].includes(state) && side.hasClass("isWinner") };
  }).filter(c => c.country || c.name);
}
function time(node: Selection, date: string): string | null {
  const ticks = node.find("[data-time-ticks]").first().attr("data-time-ticks");
  if (!ticks) return null;
  const d = new Date(Number(ticks));
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw Error("官方日期與查詢不符");
  return d.toISOString();
}
function athletes($: CheerioAPI, root: Selection, sportCode: string): DakarAthlete[] {
  const found = new Map<string, DakarAthlete>();
  root.find('a[href*="/ParticipantInfo/"]').each((_, el) => {
    const a = $(el), id = a.attr("href")?.split("/").pop() ?? "", known = roster.get(id);
    if (known && known.sportCode === sportCode) found.set(id, { ...known, name: tidy(a.text()) || known.name });
  });
  return [...found.values()];
}

export function parseDakarSchedule(html: string, date: string): { candidates: DakarUnit[]; totalUnits: number; unconfirmedUnits: number } {
  if (!isDakarDate(date)) throw Error("不支援的達卡日期");
  const $ = document(html), nodes = $(".schedule-container .scheduleItem");
  if (!$(".schedule-container.byDate").length || nodes.length === 0 || nodes.length > 2000) throw Error("官方每日賽程尚未完整");
  const seen = new Set<string>(), candidates: DakarUnit[] = []; let unconfirmedUnits = 0;
  nodes.each((_, el) => {
    const item = $(el), id = item.find("[rscCode]").first().attr("rsccode") ?? item.find('a[href*="/Info/"]').first().attr("href")?.split("/").pop() ?? "";
    // The official feed removes both RSC and links from cancelled swimming heats.
    // Count the gap; never invent an identity or infer TPE participation from its title.
    if (!id && text(item, ".textStatus").toLowerCase() === "cancelled" && !item.find('a[href*="/Info/"]').length) {
      const icon = item.find('.sportimage img').attr('src')?.match(/\/sport_icons\/([A-Z0-9]{3})\.svg$/)?.[1];
      if (!icon || !text(item, ".competition-name") || !time(item, date)) throw Error("官方取消場次識別不完整");
      if (sports[icon]) unconfirmedUnits++;
      return;
    }
    if (!RSC.test(id) || seen.has(id)) throw Error("官方賽程缺少唯一場次碼");
    seen.add(id);
    const sportCode = id.slice(0, 3); if (!sports[sportCode]) return;
    const current = status(text(item, ".textStatus")), startsAt = time(item, date);
    const link = item.find('a[href*="/Info/"]').first().attr("href");
    if (!link) { unconfirmedUnits++; return; }
    if (!new RegExp(`^/nh/en/Info/(?:StartList|ResultList)/${id}$`).test(link)) throw Error("官方場次連結不符");
    const competitors = sides($, item, current.status), event = text(item, ".competition-name");
    if (!event) throw Error("官方場次名稱缺失");
    candidates.push({ id, date, sportCode, sport: sports[sportCode], event, startsAt,
      venue: [text(item, ".venue"), text(item, ".location")].filter(Boolean).join(" · "), ...current,
      headToHead: item.find(".h2h").length > 0, competitors, athletes: athletes($, item, sportCode), sets: [], sourceUrl: DAKAR_BASE + link, detailAvailable: false });
  });
  return { candidates, totalUnits: nodes.length, unconfirmedUnits };
}

/** Metadata is JSON embedded by the public page. Never execute upstream JavaScript. */
function metadata(html: string, expectedId: string) {
  const match = html.match(/Reload\.ReloadInformation\s*=\s*(\{[^\r\n]*\});/);
  if (!match) throw Error("官方成績狀態缺失");
  const value = JSON.parse(match[1]) as Record<string, unknown>;
  if (typeof value.PageTitle !== "string" || typeof value.UnitSelector !== "string") throw Error("官方成績識別缺失");
  const $ = document(value.UnitSelector), href = $(".unit.current a").first().attr("href");
  if (!href || href.split("/").pop() !== expectedId) throw Error("官方成績與場次不符");
  return document(value.PageTitle);
}

function setScores($: CheerioAPI, root: Selection): DakarSet[] {
  const output: DakarSet[] = [];
  root.find(".groupPanel > .group").each((_, el) => {
    const group = $(el), label = tidy(group.children(".header").text());
    if (!/\b(set|period|quarter|game)\b/i.test(label) || /statistics/i.test(label)) return;
    const table = group.children(".content").find("table").first();
    if (!table.length) return;
    // Baseball5 has five innings, then Total. Do not confuse hits or innings with set wins.
    const headers = table.find("thead tr").first().children("th"); let totalIndex = -1, column = 0;
    headers.each((_, head) => { const h = $(head); if (/^Total(?:\s|$)/i.test(tidy(h.text()))) totalIndex = column; column += Number(h.attr("colspan") || 1); });
    if (totalIndex < 0) return;
    const scores = table.find("tbody > tr").toArray().map(row => { const r = $(row); return { country: country(r), score: tidy(r.children("td").eq(totalIndex).text()) }; }).filter(x => x.country && x.score);
    if (scores.length === 2) output.push({ label, scores });
  });
  return output;
}

export function parseDakarDetail(html: string, unit: DakarUnit): DakarUnit | null {
  const $ = document(html), heading = metadata(html, unit.id);
  const current = status(tidy(heading(".textStatus").text()), tidy(heading(".textResultStatus").text()));
  const root = $(".ResultList,.StartList").first();
  if (!root.length || !root.hasClass(unit.sportCode)) throw Error("官方出賽／成績格式不符");
  const startsAt = time(heading.root(), unit.date) ?? unit.startsAt;
  const competitors = sides($, root.children(".scoredev").first(), current.status);
  if (["SCHEDULED", "START_LIST"].includes(current.status) && root.find('.scoredev .emptyTeam').length) throw new PendingDakarEntriesError("官方晉級對戰名單尚未確定");
  if (!root.find('a[href*="/ParticipantInfo/"],.noc-element').length && ["SCHEDULED", "START_LIST"].includes(current.status)) throw new PendingDakarEntriesError("官方出賽名單尚未公布");
  if (unit.headToHead && (competitors.length !== 2 || competitors.some(c => !c.id || !c.name || !c.country) || new Set(competitors.map(c => c.id)).size !== 2 || (current.official && competitors.some(c => !c.score && !c.irm)))) throw Error("官方對戰資料尚未完整");
  if (!competitors.length) {
    // Individual sports: only summary rows with explicit result/rank headings, never split/technical tables.
    root.children("table").add(root.children(".table-wrapper").children("table")).each((_, tableEl) => {
      const table = $(tableEl), heads = table.find("thead tr").last().children("th").toArray().map(h => tidy($(h).text()));
      const scoreIndex = heads.findIndex(h => /^(Result|Time|Points|Score|Total)(\s|$)/i.test(h));
      const rankIndex = heads.findIndex(h => /^(Rank|Rk|Pos)(\s|$)/i.test(h));
      const qualIndex = heads.findIndex(h => /^(Q|Qualified|Qualification)$/i.test(h));
      if (current.status !== "SCHEDULED" && current.status !== "START_LIST" && scoreIndex < 0 && rankIndex < 0) return;
      table.find("tbody > tr").each((_, row) => {
        const r = $(row), id = athleteId(r), known = roster.get(id), noc = country(r) || (known ? "TPE" : "");
        if (noc !== "TPE" || r.hasClass("detail")) return;
        const cells = r.children("td"), name = text(r, ".athleteName") || known?.name || "";
        if (!name || competitors.some(c => c.id === id)) return;
        competitors.push({ id: id || `${noc}:${name}`, name, nameZh: known?.nameZh ?? "", country: noc,
          score: hasScores(current.status) && scoreIndex >= 0 ? tidy(cells.eq(scoreIndex).text()) : "",
          rank: hasScores(current.status) && rankIndex >= 0 ? tidy(cells.eq(rankIndex).text()) : "",
          qualification: hasScores(current.status) && qualIndex >= 0 ? tidy(cells.eq(qualIndex).text()) : "", irm: text(r, ".irm,.result-code"), winner: false });
      });
    });
  }
  if (!competitors.some(c => c.country === "TPE")) {
    if (!root.find('a[href*="/ParticipantInfo/"],.noc-element').length && ["SCHEDULED", "START_LIST"].includes(current.status)) throw new PendingDakarEntriesError("官方出賽名單尚未公布");
    if (unit.competitors.some(c => c.country === "TPE") || athletes($, root, unit.sportCode).length) throw Error("官方 TPE 詳細資料未完整");
    if (!root.find('a[href*="/ParticipantInfo/"],.noc-element').length) throw Error("官方出賽名單尚未公布");
    return null;
  }
  if (current.official && !competitors.some(c => c.country === "TPE" && (c.score || c.rank || c.irm))) throw Error("正式成績缺少數值");
  return { ...unit, ...current, startsAt, competitors, athletes: athletes($, $.root(), unit.sportCode),
    sets: hasScores(current.status) ? setScores($, root) : [], detailAvailable: true,
    sourceUrl: `${DAKAR_BASE}/nh/en/Info/${["SCHEDULED", "START_LIST"].includes(current.status) ? "StartList" : "ResultList"}/${unit.id}` };
}

export function parseDakarMedals(html: string): DakarMedals {
  const $ = document(html);
  if (/No medals are awarded yet for your selection\./.test($("h2").text()) && $(".MedalsInfo").length) return { gold: 0, silver: 0, bronze: 0, entries: [] };
  // Future medal pages are accepted only when each row explicitly declares its medal and event.
  const entries: DakarMedals["entries"] = [];
  if (!$(".MedalsInfo").length) throw Error("官方獎牌摘要缺失");
  $("table tbody tr").each((_, row) => {
    const r = $(row), headers = r.closest("table").find("thead th").toArray().map(h => tidy($(h).text())).join(" ");
    if (!tidy(r.text()) && !r.find("img").length) return;
    if (!/\bMedal\b/i.test(headers) || !/\bEvent\b/i.test(headers) || !/\b(Name|Athlete)\b/i.test(headers) || country(r) !== "TPE") throw Error("官方獎牌表格尚未完整");
    const medalEl = r.find('[title="Gold"],[title="Silver"],[title="Bronze"],img[alt="Gold"],img[alt="Silver"],img[alt="Bronze"]').first();
    const medal = (medalEl.attr("title") || medalEl.attr("alt") || "").toLowerCase();
    if (!["gold", "silver", "bronze"].includes(medal)) throw Error("官方獎牌種類尚未確認");
    const eventLink = r.find('a[href*="/Info/"]').first(), event = tidy(eventLink.text());
    const link = eventLink.attr("href") ?? "";
    if (!event || !/^\/nh\/en\/Info\/(?:MedalList|Standing|ResultList)\/[A-Z0-9-]{20,48}$/.test(link)) throw Error("獎牌項目識別缺失");
    const id = athleteId(r), name = text(r, ".athleteName") || "TPE";
    if (id && !UUID.test(id)) throw Error("獎牌選手識別不符");
    entries.push({ medal, event, name, nameZh: roster.get(id)?.nameZh ?? "", sourceUrl: DAKAR_BASE + link });
  });
  if (!entries.length) throw Error("官方獎牌資料尚未完整");
  // One team event is one medal; repeated team-member rows do not multiply the medal count.
  const unique = new Map(entries.map(e => [`${e.medal}:${e.sourceUrl}`, e]));
  return { gold: [...unique.values()].filter(e => e.medal === "gold").length, silver: [...unique.values()].filter(e => e.medal === "silver").length,
    bronze: [...unique.values()].filter(e => e.medal === "bronze").length, entries: [...unique.values()] };
}
