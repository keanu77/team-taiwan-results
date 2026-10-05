import { lookupTpeAthleteName } from "./athleteNameLookup";
import { eventNameZh } from "./eventNames";
import { disciplineSportLabel } from "./sportGroups";
import type { MedalColor, TpeMedal } from "./tpeMedalList";
import { isTeamLabel, TEAM } from "./team";
import { CONFIG } from "../../config";

// 官方 ALL/medals/org/<代表隊>：本隊每一面獎牌（即時）。團體列名為「Chinese Taipei」，隊員在 Members；代表團總表補中文項目名。
export interface OfficialTpeMedal {
  medal: MedalColor;
  discipline: string;
  eventCode: string;
  event: string;
  date: string;
  gender: string;
  /** A 個人、D 雙打、T 團體（官方代碼）。 */
  type: string;
  athletes: { name: string; registrationId: string }[];
}

const MEDALS: Record<string, MedalColor> = { ME_GOLD: "gold", ME_SILVER: "silver", ME_BRONZE: "bronze" };
const MEDAL_RANK: Record<MedalColor, number> = { gold: 0, silver: 1, bronze: 2 };
const HOST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

function field(row: Record<string, unknown>, key: string, pattern: RegExp): string {
  const value = row[key];
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`官方獎牌名單欄位 ${key} 格式不符`);
  return value.trim();
}

function teamMembers(value: unknown): { name: string; registrationId: string }[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 60) throw new Error("官方獎牌名單隊員格式不符");
  return value.map((member) => {
    if (!member || typeof member !== "object" || Array.isArray(member)) throw new Error("官方獎牌名單隊員格式不符");
    const row = member as Record<string, unknown>;
    if (row.Org !== undefined && row.Org !== TEAM) throw new Error("官方獎牌名單隊員代表隊不符");
    const registrationId = typeof row.Reg === "string" && /^[A-Za-z0-9-]{0,40}$/.test(row.Reg) ? row.Reg : "";
    return { name: field(row, "Name", /^[^<>]{1,200}$/), registrationId };
  });
}

export function parseTpeOrgMedals(value: unknown): OfficialTpeMedal[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("官方獎牌名單格式不符");
  const events = new Map<string, OfficialTpeMedal>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("官方獎牌名單格式不符");
    const row = entry as Record<string, unknown>;
    if (row.Org !== TEAM) throw new Error("官方獎牌名單代表隊不符");
    const medal = MEDALS[field(row, "Medal", /^ME_(?:GOLD|SILVER|BRONZE)$/)];
    const discipline = field(row, "Disc", /^[A-Z0-9]{3}$/);
    const eventCode = field(row, "Event", /^[A-Za-z0-9._-]{1,80}$/);
    const event = field(row, "EventDesc", /^[^<>]{1,200}$/);
    const name = field(row, "Name", /^[^<>]{1,200}$/);
    const registrationId = typeof row.Reg === "string" && /^[A-Za-z0-9-]{0,40}$/.test(row.Reg) ? row.Reg : "";
    // 多數是含時區的時間；全能項目只給日期（已是主辦地日期）。
    const raw = field(row, "DateRaw", /^\d{4}-\d{2}-\d{2}(?:T|$)/);
    const time = Date.parse(raw);
    if (!Number.isFinite(time)) throw new Error("官方獎牌名單日期格式不符");
    const date = raw.length === 10 ? raw : HOST_DATE.format(time);
    const key = `${discipline}|${eventCode}|${medal}`;
    const type = typeof row.Type === "string" ? row.Type : "";
    // 團體列的 Name 是「Chinese Taipei」，實際隊員在 Members（只取姓名與報名編號）。
    const members = type === "T" ? teamMembers(row.Members) : [];
    const athletes = members.length ? members : [{ name, registrationId }];
    const existing = events.get(key);
    events.set(key, existing
      ? { ...existing, athletes: [...existing.athletes, ...athletes.filter((a) => !existing.athletes.some((b) => b.name === a.name))] }
      : { medal, discipline, eventCode, event, date, gender: typeof row.Gender === "string" ? row.Gender : "", type, athletes });
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || MEDAL_RANK[a.medal] - MEDAL_RANK[b.medal] || a.eventCode.localeCompare(b.eventCode));
}

export function isOfficialTpeMedal(value: unknown): value is OfficialTpeMedal {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return typeof m.medal === "string" && m.medal in MEDAL_RANK && typeof m.discipline === "string" && typeof m.eventCode === "string"
    && typeof m.event === "string" && typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && typeof m.gender === "string" && typeof m.type === "string"
    && Array.isArray(m.athletes) && m.athletes.every((a) => a && typeof a === "object" && typeof (a as Record<string, unknown>).name === "string");
}

// 代表團總表的種類名稱 → 官方項目代碼（同一種類可能對應多個代碼）。
const SPORT_DISCIPLINES: Record<string, string[]> = {
  軟式網球: ["TST"], 軟網: ["TST"], 網球: ["TEN"], 游泳: ["SWM"], 跳水: ["DIV"], 武術: ["WSU"], 滑板: ["SKB"], 空手道: ["KTE"],
  體操: ["GAR", "GRY"], 競技體操: ["GAR"], 韻律體操: ["GRY"], 射擊: ["SHO"], 射箭: ["ARC"], 桌球: ["TTE"], 羽球: ["BDM"],
  電子競技: ["ELS"], 電競: ["ELS"], 輕艇: ["CSP", "CSL"], 舉重: ["WLF"], 卡巴迪: ["KAB"], 田徑: ["ATH"], 拳擊: ["BOX"],
  跆拳道: ["TKW"], 柔道: ["JUD"], 柔術: ["JJI"], 角力: ["WRE"], 克拉術: ["KUR"], 綜合格鬥: ["MMA"], 擊劍: ["FEN"],
  划船: ["ROW"], 帆船: ["SAL"], 自由車: ["CRD", "CTR", "MTB", "BMF", "BMX"], 高爾夫: ["GLF", "GOL"], 高爾夫球: ["GLF", "GOL"],
  棒球: ["BBL"], 壘球: ["SBL"], 籃球: ["BKB", "BK3"], 足球: ["FBL"], 排球: ["VVO"], 霹靂舞: ["BKG"], 衝浪: ["SRF"],
  馬術: ["EQU"], 鐵人三項: ["TRI"], 曲棍球: ["HOC"],
};

function pdfGender(event: string): string | null {
  return /混合/.test(event) ? "X" : /女子/.test(event) ? "W" : /男子/.test(event) ? "M" : null;
}

function chineseName(discipline: string, athlete: { name: string; registrationId: string }): string | null {
  return lookupTpeAthleteName({ discipline, englishName: athlete.name, organisation: TEAM, registrationId: athlete.registrationId || undefined });
}


/** 官方雙打把兩人寫在同一列（YU Kai-wen / HUANG Shih-yuan），拆開後各自對照中文；團體用 Members 的隊員。 */
function officialAthleteNames(medal: OfficialTpeMedal): string[] {
  // 舊快照的團體只有「Chinese Taipei」，視為尚無隊員。
  return medal.athletes.filter((athlete) => !isTeamLabel(athlete.name)).flatMap((athlete) => {
    const parts = athlete.name.split("/").map((name) => name.trim()).filter(Boolean);
    return parts.map((name) => chineseName(medal.discipline, { name, registrationId: parts.length === 1 ? athlete.registrationId : "" }) ?? name);
  });
}

const GENDER_ONLY = /^(?:男子|女子|混合)$/;

function stripRound(event: string): string {
  return event.replace(/\s+(?:Finals?|All Groups)$/i, "").trim();
}

/**
 * 官方名單決定「有哪些獎牌」（即時）；代表團總表優先提供中文項目名與隊員，對不到時用官方隊員。
 * 對應依據：同獎牌、同日、同項目，個人以中文姓名、團體以性別辨識；無法唯一對應就不套用總表。
 */
export function mergeTpeMedals(official: readonly OfficialTpeMedal[], delegation: readonly TpeMedal[]): readonly TpeMedal[] {
  if (!official.length) return delegation;
  const unused = new Set(delegation.map((_, index) => index));
  return official.map((medal) => {
    const names = officialAthleteNames(medal);
    let candidates = [...unused].filter((index) => {
      const entry = delegation[index];
      return entry.medal === medal.medal && entry.date === medal.date && (SPORT_DISCIPLINES[entry.sport] ?? []).includes(medal.discipline);
    });
    // 團體以性別辨識（總表隊員可能與官方登錄略有出入）；個人以中文姓名。
    if (names.length && medal.type !== "T") candidates = candidates.filter((index) => names.every((name) => delegation[index].athletes.includes(name)));
    else if (["M", "W", "X"].includes(medal.gender) && candidates.length > 1) candidates = candidates.filter((index) => pdfGender(delegation[index].event) === medal.gender);
    const match = candidates.length === 1 ? delegation[candidates[0]] : null;
    if (match) unused.delete(candidates[0]);
    const eventText = stripRound(medal.event);
    const sport = disciplineSportLabel(medal.discipline);
    const translated = eventNameZh(eventText);
    // 官方只寫性別的項目（棒球 Men’s Finals）直接以運動名稱表示。
    const officialEvent = translated && GENDER_ONLY.test(translated) ? sport : translated ?? eventText;
    return {
      id: `${medal.discipline}|${medal.eventCode}|${medal.medal}`,
      medal: medal.medal,
      sport,
      event: match?.event ?? officialEvent,
      athletes: match?.athletes ?? names,
      date: medal.date,
      pending: !match && medal.type === "T" && !names.length,
    };
  });
}
