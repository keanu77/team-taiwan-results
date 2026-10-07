import { SPORTS } from "../model";
import { MANUAL_COLUMNS } from "../sync/manual";

// 奧運官方成績系統（olympics.com/OG2024/data/RES_ByRSC*）的逐場 JSON → results/manual.csv 的列。
// 賽後官網 API 已下線，原始檔取自 Wayback 存檔；這裡只做轉換，不連網。純函式，測試可直接餵 JSON。

export type ManualRow = Record<(typeof MANUAL_COLUMNS)[number], string>;

interface ArchiveItem {
  resultData?: string;
  resultRank?: string;
  resultWLT?: string;
  resultIrm?: string;
  resultType?: string;
  resultDataText?: string;
  participant?: { name?: string; organisation?: { code?: string } };
  teamAthletes?: { order?: number; athlete?: { name?: string } }[];
}
interface ArchiveUnit {
  date?: string;
  eventUnitCode?: string;
  eventUnit?: { longDescription?: string; shortDescription?: string };
  status?: { code?: string };
  schedule?: { startDate?: string; venue?: { description?: string } };
  items?: ArchiveItem[];
}

export type ConvertResult = { rows: ManualRow[]; skipped?: string; unknownPhase?: string };

const PHASES: readonly [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Round (\d+) Race (\d+)$/i, (m) => `第 ${m[1]} 輪第 ${m[2]} 組`], [/^Repechage Race (\d+)$/i, (m) => `復活賽第 ${m[1]} 組`],
  [/^Repechage (\d+)$/i, (m) => `復活賽第 ${m[1]} 組`], [/^Semi-?final of Table \w$/i, () => "四強"],
  [/^Semi-?final ([A-Z]\/[A-Z]) (\d+)$/i, (m) => `準決賽 ${m[1]} 第 ${m[2]} 組`], [/^Final ([A-Z])$/, (m) => (m[1] === "A" ? "決賽" : `${m[1]} 組決賽`)],
  [/^Elimination Round - Pool (\w+)$/i, (m) => `分組賽 ${m[1]} 組`], [/^Group ([A-Z])$/, (m) => `${m[1]} 組`],
  [/^Qualification Stage (\d+)$/i, (m) => `資格賽第 ${m[1]} 階段`], [/^Qualifier$/i, () => "資格賽"],
  [/^Bronze Medal Play-?off$/i, () => "銅牌延長賽"], [/^Round (\d+)$/i, (m) => `第 ${m[1]} 輪`],
  [/^Repechage(?: Round)? - Heat (\d+)$/i, (m) => `復活賽第 ${m[1]} 組`], [/^Qualification Subdivision (\d+)$/i, (m) => `資格賽第 ${m[1]} 組`],
  [/^Group Play Stage - Group (\w+)$/i, (m) => `分組賽 ${m[1]} 組`], [/^Pool (\w+)$/i, (m) => `分組賽 ${m[1]} 組`],
  [/^Round Robin - Group (\w+)$/i, (m) => `循環賽 ${m[1]} 組`], [/^Table of (\d+)$/i, (m) => `${m[1]} 強`],
  [/^(First|Second|Third) Round$/i, (m) => `第 ${{ first: 1, second: 2, third: 3 }[m[1].toLowerCase()]} 輪`],
  [/^Qualification - Day (\d+)$/i, (m) => `資格賽第 ${m[1]} 天`], [/^Qualification Precision$/i, () => "資格賽（慢射）"],
  [/^Qualification Rapid$/i, () => "資格賽（快射）"], [/^Subdivision (\d+)$/i, (m) => `資格賽第 ${m[1]} 組`],
  [/^Round (\d+) - Heat (\d+)$/i, (m) => `第 ${m[1]} 輪第 ${m[2]} 組`], [/^Preliminary Round - Heat (\d+)$/i, (m) => `資格預賽第 ${m[1]} 組`],
  [/^Semi-?final (\d+)$/i, (m) => `準決賽第 ${m[1]} 組`],
  [/^Qualification - Group (\w+)$/i, (m) => `資格賽 ${m[1]} 組`], [/^Heats (1st|2nd) Run$/i, (m) => `預賽第 ${m[1] === "1st" ? 1 : 2} 趟`],
  [/^Time Trial$/i, () => "計時賽"], [/^Race (\d+)$/i, (m) => `第 ${m[1]} 組`],
  [/^Quarter-?final (\d+)$/i, (m) => `八強賽第 ${m[1]} 組`],
  [/^Ranking Round$/i, () => "排名賽"], [/Round of (\d+)$/i, (m) => `${m[1]} 強`], [/^1\/(\d+) Elimination/i, (m) => `${Number(m[1]) * 2} 強`],
  [/^Quarter-?finals?$/i, () => "八強"], [/^Semi-?finals?$/i, () => "四強"], [/^Repechage/i, () => "復活賽"],
  [/^Bronze Medal (Match|Contest|Bout)s?$/i, () => "銅牌戰"], [/^Gold Medal (Match|Contest|Bout)s?$/i, () => "金牌戰"],
  [/^Finals?$/i, () => "決賽"], [/^Heat (\d+)$/i, (m) => `預賽第 ${m[1]} 組`], [/^Qualification$/i, () => "資格賽"],
];
const BOX_DECISIONS: Record<string, string> = { WP: "點數判定", RSC: "主審停止比賽", KO: "擊倒", WO: "不戰而勝", DSQ: "取消資格", ABD: "棄權" };
const MEDALS = ["金", "銀", "銅"];

// 項目名稱後面接的第一個階段字眼；長描述常比短描述多資訊（「Round 1 Race 9」對「Race 9」）
const PHASE_START = /\s*-?\s+(?=(?:Gold Medal|Bronze Medal|Repechage|Quarter-?final|Semi-?final|Finals?\b|Round\b|Ranking Round|Qualification|Heats?\b|Group Play|Table of|Preliminary|Race \d|Subdivision|Pool\b|(?:First|Second|Third) Round|Time Trial|(?:1\/\d+ )?Elimination|Preliminar(?:y|ies)|Qualifier$|Group [A-Z]$))/i;

function translatePhase(text: string): string | null {
  for (const [re, label] of PHASES) {
    const m = text.match(re);
    if (m) return label(m);
  }
  return null;
}

/** 官方 long/short description → [英文項目名, 中文階段]。單一場次的項目（如舉重）兩者相同，視為決賽。 */
export function splitEventPhase(long: string, short: string, headToHead = false): { event: string; phase: string; known: boolean } {
  if (!short || long === short) return { event: long, phase: "決賽", known: true };
  const found = long.search(PHASE_START);
  const cut = found > 0 ? found : long.endsWith(short) ? long.length - short.length : long.length;
  const event = long.slice(0, cut).replace(/\s*-?\s*$/, "");
  const tail = long.slice(cut).replace(/^\s*-?\s*/, "");
  const translated = (tail && translatePhase(tail)) || translatePhase(short);
  // 對戰的「Quarterfinal 2」是第幾場，不是分組，只留「八強」
  const phase = headToHead && translated ? translated.replace(/^(八強|四強)賽?第 \d+ 組$/, "$1").replace(/^準決賽第 \d+ 組$/, "四強") : translated;
  return phase ? { event, phase, known: true } : { event, phase: short, known: false };
}

/** 只有一行標題（東京奧運每日賽程頁）：從第一個階段字眼切開；沒有階段字眼就是單一場次的決賽 */
export function splitTitle(title: string, headToHead = false): { event: string; phase: string; known: boolean } {
  const found = title.search(PHASE_START);
  return found > 0 ? splitEventPhase(title, title.slice(found).replace(/^\s*-?\s*/, ""), headToHead) : { event: title, phase: "決賽", known: true };
}

const parseText = (item: ArchiveItem): { extra?: Record<string, string> } => {
  try { return JSON.parse(item.resultDataText || "{}"); } catch { return {}; }
};

/** 對戰比分：有局分就附上（羽球、桌球），拳擊附判定方式 */
function headToHeadResult(item: ArchiveItem, other: ArchiveItem): string {
  if (item.resultIrm) return item.resultIrm;
  const mine = parseText(item).extra ?? {};
  const theirs = parseText(other).extra ?? {};
  const games = Object.keys(mine).filter((k) => /^resultG\d+$/.test(k)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((k) => `${mine[k]}-${theirs[k] ?? ""}`);
  const decision = mine.resCode ?? theirs.resCode;
  const score = `${item.resultData ?? ""}-${other.resultData ?? ""}`;
  if (games.length) return `${score}（${games.join(", ")}）`;
  return decision ? `${score}（${BOX_DECISIONS[decision] ?? decision}）` : score;
}

/** 對戰的獎牌：金牌戰勝負＝金銀、銅牌戰勝方＝銅；拳擊不打銅牌戰，四強敗方都是銅牌 */
function headToHeadMedal(disc: string, phase: string, won: boolean): string {
  if (phase === "金牌戰" || phase === "決賽") return won ? "金" : "銀";
  if (phase === "銅牌戰") return won ? "銅" : "";
  if (phase === "四強" && disc === "BOX" && !won) return "銅";
  return "";
}

/** 雙打組合有時只給姓（網球「Hsieh / Tsao」），改用隊員全名，中文對照才找得到人 */
function participantName(item: ArchiveItem): string {
  const name = item.participant?.name ?? "";
  const members = [...(item.teamAthletes ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((a) => a.athlete?.name ?? "");
  return name.includes("/") && members.length >= 2 && members.every(Boolean) ? members.join(" / ") : name;
}

export function convertArchiveUnit(json: unknown, noc: string): ConvertResult {
  const unit = (json as { results?: ArchiveUnit })?.results;
  const code = unit?.eventUnitCode ?? "";
  if (!unit || !code) return { rows: [], skipped: "不是逐場成績檔" };
  // 團體對戰（桌球團體）的單點場次：代碼結尾是 0001、0002…，只留團體總比分（結尾 0000）
  if (/\d{4}(?<!0000)$/.test(code)) return { rows: [] };
  const items = unit.items ?? [];
  if (!items.some((i) => i.participant?.organisation?.code === noc)) return { rows: [] };
  if (unit.status?.code !== "OFFICIAL") return { rows: [], skipped: `${code} 狀態是 ${unit.status?.code ?? "未知"}，不是正式成績` };

  const disc = code.slice(0, 3);
  const headToHead = items.length === 2 && items.some((i) => i.resultWLT);
  const { event, phase, known } = splitEventPhase(unit.eventUnit?.longDescription ?? "", unit.eventUnit?.shortDescription ?? "", headToHead);
  // startDate 帶主辦地時差（+02:00），直接取字面的日期與時間就是當地時間
  const start = unit.schedule?.startDate ?? unit.date ?? "";
  const base = {
    unit_id: code.replace(/-+/g, "-").replace(/-$/, ""), date: start.slice(0, 10), time: start.slice(11, 16),
    sport: SPORTS[disc] ?? disc, event, phase, venue: unit.schedule?.venue?.description ?? "", status: "OFFICIAL", discipline: disc,
  };
  const row = (item: ArchiveItem, fields: Pick<ManualRow, "result" | "rank" | "medal" | "outcome">): ManualRow =>
    ({ ...base, name: participantName(item), organisation: item.participant?.organisation?.code ?? "", ...fields });

  const unknownPhase = known ? undefined : phase;
  // 對戰以勝負欄位判斷，不能只看人數：多人同場也可能剛好只剩兩人
  if (headToHead) {
    const rows = items.map((item, i) => {
      const won = item.resultWLT === "W";
      return row(item, { result: headToHeadResult(item, items[1 - i]), rank: "", medal: headToHeadMedal(disc, phase, won), outcome: won ? "勝" : item.resultWLT === "L" ? "負" : item.resultWLT === "T" ? "和" : "" });
    });
    return { rows, unknownPhase };
  }
  // 多人同場（舉重、射箭排名賽、田徑…）：只收本隊，名次與成績照官方
  const medalRound = phase === "決賽";
  const rows = items.filter((i) => i.participant?.organisation?.code === noc).map((item) => {
    const rank = item.resultIrm ? "" : item.resultRank ?? "";
    return row(item, { result: item.resultIrm || item.resultData || "", rank, medal: medalRound ? MEDALS[Number(rank) - 1] ?? "" : "", outcome: "" });
  });
  return { rows, unknownPhase };
}
