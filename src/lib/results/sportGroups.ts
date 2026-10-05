import { CONFIG } from "../../config";
import { groupByCategory, resultCategory } from "./categories";
import type { TpeResultUnit } from "./types";

const TKW_EVENT = new RegExp(`^${CONFIG.source.code}:TKW:[MWXO]\\.([A-Z0-9_-]+)\\.`);

// The user's preferred navigation names and order. Unlisted sports remain visible.
const SPORT_ORDER = ["羽球", "桌球", "壘球", "棒球", "女子籃球", "男子籃球", "網球", "軟網", "女子足球", "女子排球", "男子排球", "跆拳品勢", "跆拳對打", "空手道", "舉重", "拳擊", "田徑", "射箭", "射擊", "競技體操", "韻律體操", "擊劍", "柔道", "克拉術", "柔術", "游泳", "划船", "輕艇", "帆船", "女子卡巴迪", "男子卡巴迪", "霹靂舞", "武術", "綜合格鬥", "角力", "電競", "高爾夫球", "鐵人三項", "自由車", "曲棍球", "滑板", "跳水", "衝浪"];
const SPORTS: Record<string, string> = {
  BDM: "羽球", TTE: "桌球", SBL: "壘球", BBL: "棒球", TEN: "網球", TST: "軟網",
  KTE: "空手道", WLF: "舉重", BOX: "拳擊", ATH: "田徑", ARC: "射箭", SHO: "射擊",
  GAR: "競技體操", GRY: "韻律體操", FEN: "擊劍", JUD: "柔道", KUR: "克拉術", JJI: "柔術",
  SWM: "游泳", ROW: "划船", SAL: "帆船", BKG: "霹靂舞", WSU: "武術", MMA: "綜合格鬥",
  WRE: "角力", ELS: "電競", GLF: "高爾夫球", GOL: "高爾夫球", TRI: "鐵人三項",
  HOC: "曲棍球", SKB: "滑板", DIV: "跳水", SRF: "衝浪", EQU: "馬術",
};
const CYCLING: Record<string, string> = { CRD: "公路賽", CTR: "場地賽", MTB: "登山車", BMF: "BMX 自由式", BMX: "BMX 競速" };
const CANOE: Record<string, string> = { CSP: "靜水競速", CSL: "激流標竿" };

const TEAM_SPORTS: Record<string, string> = { BK3: "籃球", BKB: "籃球", FBL: "足球", VVO: "排球", KAB: "卡巴迪", TKW: "跆拳道" };

/** 只有項目代碼時（例如官方獎牌名單）的運動名稱，與賽果頁命名一致。 */
export function disciplineSportLabel(discipline: string): string {
  return SPORTS[discipline] ?? (CYCLING[discipline] ? "自由車" : CANOE[discipline] ? "輕艇" : TEAM_SPORTS[discipline] ?? discipline);
}

export interface ResultSport { key: string; label: string; detail: string }
export interface ResultSportGroup extends ResultSport {
  entries: TpeResultUnit[];
  sections: { key: string; label: string; entries: TpeResultUnit[] }[];
}

export function resultSport(unit: TpeResultUnit): ResultSport {
  const disc = unit.discipline;
  const category = resultCategory(unit);
  const teamSport = ({ BK3: "籃球", BKB: "籃球", FBL: "足球", VVO: "排球", KAB: "卡巴迪" } as Record<string, string>)[disc];
  if (teamSport) {
    const key = disc === "BK3" || disc === "BKB" ? "BASKETBALL" : disc;
    const label = category.key === "men" || category.key === "women" ? `${category.label}${teamSport}` : `${teamSport}（${category.label}）`;
    return { key: `${key}-${category.key}`, label, detail: disc === "BK3" ? "3×3" : disc === "BKB" ? "5×5" : "" };
  }
  if (CYCLING[disc]) return { key: "CYCLING", label: "自由車", detail: CYCLING[disc] };
  if (CANOE[disc]) return { key: "CANOE", label: "輕艇", detail: CANOE[disc] };
  if (disc === "TKW") {
    // Official examples: M/W.INDPOOM and M.68KG / M.O80KG. A head-to-head
    // flag alone is insufficient: poomsae may also use a knockout format.
    const eventCode = unit.id.match(TKW_EVENT)?.[1] ?? "";
    const poomsae = /\bpoomsae\b|品勢/i.test(unit.event) || /POOM/.test(eventCode);
    const sparring = /\b(?:kyorugi|sparring)\b|對打|搏擊|\b\d+(?:\.\d+)?\s*kg\b/i.test(unit.event) || /^(?:O|U)?\d+(?:KG)[_-]*$/.test(eventCode);
    if (poomsae !== sparring) return { key: poomsae ? "TKW-POOMSAE" : "TKW-KYORUGI", label: poomsae ? "跆拳品勢" : "跆拳對打", detail: "" };
    return { key: "TKW-OTHER", label: "跆拳道（項目待確認）", detail: "" };
  }
  return { key: disc === "GOL" ? "GLF" : disc, label: SPORTS[disc] || unit.sport || disc, detail: "" };
}

export function groupResultSports(units: TpeResultUnit[]): ResultSportGroup[] {
  const groups = new Map<string, ResultSportGroup>();
  for (const unit of units) {
    const sport = resultSport(unit);
    if (!groups.has(sport.key)) groups.set(sport.key, { ...sport, entries: [], sections: [] });
    groups.get(sport.key)!.entries.push(unit);
  }
  for (const group of groups.values()) {
    for (const category of groupByCategory(group.entries)) {
      const sections = new Map<string, ResultSportGroup["sections"][number]>();
      for (const unit of category.entries) {
        const detail = resultSport(unit).detail;
        const key = `${category.key}-${detail ? unit.discipline : "all"}`;
        if (!sections.has(key)) sections.set(key, { key, label: detail ? `${category.label} · ${detail}` : category.label, entries: [] });
        sections.get(key)!.entries.push(unit);
      }
      group.sections.push(...sections.values());
    }
  }
  const order = (label: string) => { const index = SPORT_ORDER.indexOf(label); return index < 0 ? SPORT_ORDER.length : index; };
  return [...groups.values()].sort((a, b) => order(a.label) - order(b.label) || a.label.localeCompare(b.label, "zh-Hant") || a.key.localeCompare(b.key));
}
