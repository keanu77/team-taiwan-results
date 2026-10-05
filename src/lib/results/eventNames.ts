import ROSTERS from "../../generated/rosters.json";
// 官方項目名稱（英文）→ 中文的受控對照。每個字詞都認得才翻，否則回傳 null 保留英文，
// 寧可顯示原文也不猜譯（例如綜合格鬥 Modern / Traditional）。

// 電競以遊戲名辨識；中文名取自代表團名單（2026 亞運），官方名稱格式多變（含類別前綴、Finals 後綴）。
const ESPORTS: readonly [RegExp, string][] = [
  [/NARAKA\s*:\s*BLADEPOINT/i, "永劫無間"],
  [/Puyo Puyo/i, "魔法氣泡"],
  [/League of Legends/i, "英雄聯盟"],
  [/Pok[ée]mon UNITE/i, "寶可夢大集結"],
  [/PUBG MOBILE/i, "絕地求生M 亞運版"],
  [/Identity V/i, "第五人格 亞運版"],
  [/^Fighting Games\b/i, "競技武術"],
];

const GENDERS: readonly [RegExp, string][] = [
  [/\bWomen(?:'s)?(?![A-Za-z])/, "女子"],
  [/\bMen(?:'s)?(?![A-Za-z])/, "男子"],
  [/\bMixed(?![A-Za-z])/, "混合"],
];

const PHRASES: Record<string, string> = {
  "Individual Time Trial": "個人計時賽", "Road Race": "公路賽", "Cross-country": "越野賽",
  "Half Marathon Race Walk": "半程馬拉松競走", "Race Walk": "競走", Marathon: "馬拉松",
  "Individual Medley": "個人混合式", "Medley Relay": "混合式接力", "Freestyle Relay": "自由式接力",
  Freestyle: "自由式", Backstroke: "仰式", Breaststroke: "蛙式", Butterfly: "蝶式",
  Hurdles: "跨欄", Steeplechase: "障礙賽", Decathlon: "十項全能", Heptathlon: "七項全能",
  "Shot Put": "鉛球", "Discus Throw": "鐵餅", "Javelin Throw": "標槍", "Hammer Throw": "鏈球",
  "Long Jump": "跳遠", "High Jump": "跳高", "Triple Jump": "三級跳遠", "Pole Vault": "撐竿跳高", Relay: "接力",
  Singles: "單打", Doubles: "雙打", "Team Kata": "團體形", "Individual Kata": "個人形", Kata: "形", Kumite: "對打",
  Team: "團體", Individual: "個人", Park: "公園式", Street: "街道式",
  Compound: "複合弓", Recurve: "反曲弓",
  "Air Pistol": "空氣手槍", "Air Rifle": "空氣步槍", "Rifle 3 Positions": "步槍三姿", "Rapid Fire Pistol": "快射手槍",
  Skeet: "定向飛靶", Trap: "不定向飛靶",
  Dressage: "盛裝舞步", Jumping: "障礙超越", Eventing: "三項賽",
  Foil: "鈍劍", "Épée": "銳劍", Sabre: "軍刀",
  "Horizontal Bar": "單槓", "Parallel Bars": "雙槓", "Pommel Horse": "鞍馬", Rings: "吊環",
  "Floor Exercise": "地板", Vault: "跳馬", "Uneven Bars": "高低槓", "Balance Beam": "平衡木", "All-Around": "全能",
  "Single Sculls": "單人雙槳", "Double Sculls": "雙人雙槳", Shortboard: "短板",
  Changquan: "長拳", Taijiquan: "太極拳", Taijijian: "太極劍", Nanquan: "南拳", Nangun: "南棍", Nandao: "南刀", Daoshu: "刀術", Gunshu: "棍術", "Nanquan & Nangun": "南拳、南棍全能", "Nanquan & Nandao": "南拳、南刀全能",
  "Taijiquan & Taijijian": "太極拳、太極劍全能", "Daoshu & Gunshu": "刀術、棍術全能", "Jianshu & Qiangshu": "劍術、槍術全能",
  Baseball: "棒球", Softball: "壘球",
  Pistol: "手槍", Poomsae: "品勢", Wrestling: "角力", "B-Boys": "男子", "B-Girls": "女子",
  Keirin: "凱林賽", Madison: "麥迪遜賽", Omnium: "全能賽", "Team Pursuit": "團體追逐賽", "Team Sprint": "團體競速賽", Sprint: "爭先賽",
  Springboard: "跳板", Synchronised: "雙人", "Stroke Play": "比桿賽", "Group All-Around": "團體全能",
  "Canoe Single": "C1", "Canoe Double": "C2", "Kayak Single": "K1", "Kayak Double": "K2", "Kayak Four": "K4",
};
const PHRASE_KEYS = Object.keys(PHRASES).sort((a, b) => b.length - a.length);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PHRASE_PATTERN = new RegExp(`^(?:${PHRASE_KEYS.map(escape).join("|")})(?![A-Za-z])`);
const NUMERIC: readonly [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d+)\s*x\s*(\d+)m(?![A-Za-z])/, (m) => `${m[1]}×${m[2]}公尺`],
  [/^\+(\d+(?:\.\d+)?)kg(?![A-Za-z])/, (m) => `${m[1]}公斤以上級`],
  [/^-?(\d+(?:\.\d+)?)kg(?![A-Za-z])/, (m) => `${m[1]}公斤級`],
  [/^(\d+)m(?![A-Za-z])/, (m) => `${m[1]}公尺`],
  [/^(\d+) Metres(?![A-Za-z])/, (m) => `${m[1]}公尺`],
];

function joinParts(parts: string[]): string {
  return parts.reduce((text, part) => text && /[A-Za-z0-9]$/.test(text) && /^[A-Za-z0-9]/.test(part) ? `${text} ${part}` : text + part, "");
}

export function eventNameZh(event: string): string | null {
  // 官方偶爾用彎引號（Men’s Finals）。
  let rest = event.trim().replace(/[\u2018\u2019]/g, "'");
  if (!rest) return null;
  // rosters/event-names.csv 的對照優先（完整名稱、不分大小寫）
  const custom = (ROSTERS.eventNames as Record<string, string>)[rest.toLowerCase().replace(/\s+/g, " ")];
  if (custom) return custom;
  const esports = ESPORTS.find(([pattern]) => pattern.test(rest));
  if (esports) return esports[1];
  let gender = "";
  for (const [pattern, label] of GENDERS) {
    if (pattern.test(rest)) { gender = label; rest = rest.replace(pattern, " "); break; }
  }
  const parts: string[] = [];
  rest = rest.trim();
  while (rest) {
    const phrase = rest.match(PHRASE_PATTERN);
    if (phrase) { parts.push(PHRASES[phrase[0]]); rest = rest.slice(phrase[0].length).trimStart(); continue; }
    const numeric = NUMERIC.map(([pattern, format]) => { const m = rest.match(pattern); return m ? { m, format } : null; }).find(Boolean);
    if (!numeric) return null;
    parts.push(numeric.format(numeric.m));
    rest = rest.slice(numeric.m[0].length).trimStart();
  }
  // 棒壘等項目名稱把性別放在後面（Softball Women），中文一律性別在前。
  const text = gender + joinParts(parts);
  return text || null;
}

const UNIT_EXACT: Record<string, string> = {
  final: "決賽", finals: "決賽", qualification: "資格賽", "qualification round": "資格賽",
  quarterfinal: "八強賽", quarterfinals: "八強賽", "quarter-finals": "八強賽",
  semifinal: "四強賽", semifinals: "四強賽", "semi-finals": "四強賽",
  "gold medal match": "金牌戰", "gold medal bout": "金牌戰", prelims: "預賽", preliminaries: "預賽", heats: "預賽",
};
const GROUP_PREFIX: Record<string, string> = { "group phase": "分組賽 ", "preliminary round": "預賽 ", "round robin": "循環賽 " };

const NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const TABLE_OF: Record<string, string> = { "64": "六十四強賽", "32": "三十二強賽", "16": "十六強賽", "8": "八強賽" };

/** 輪次／場次標籤的中文；不認得的原樣回傳。官方場次名常重複項目名（Men's 100m Butterfly Final），先去掉。 */
export function unitLabelZh(label: string, event = ""): string {
  const trimmed = label.trim();
  const value = event && trimmed.toLowerCase().startsWith(event.trim().toLowerCase()) ? trimmed.slice(event.trim().length).trim() : trimmed;
  const exact = UNIT_EXACT[value.toLowerCase()];
  if (exact) return exact;
  const group = value.match(/^(?:(Group Phase|Preliminary Round|Round Robin) - |(Round Robin) )?(?:Group|Pool) ([A-Z])$/i);
  if (group) return `${GROUP_PREFIX[(group[1] || group[2] || "").toLowerCase()] ?? ""}${group[3].toUpperCase()} 組`;
  const finalLetter = value.match(/^Finals? ([A-Z])$/i);
  if (finalLetter) return `${finalLetter[1].toUpperCase()} 組決賽`;
  const bronze = value.match(/^Bronze Medal (?:Bout|Match|Game)(?: ([A-Z]))?$/i);
  if (bronze) return `銅牌戰${bronze[1] ? ` ${bronze[1].toUpperCase()}` : ""}`;
  const day = value.match(/^Day (\d+)$/i);
  if (day) return `第 ${day[1]} 日`;
  const round = value.match(/^(\d+)(?:st|nd|rd|th) Round$/i) ?? value.match(/^Round (\d+)$/i);
  if (round) return `第${NUMERALS[Number(round[1])] ?? ` ${round[1]} `}輪`;
  const numbered = value.match(/^(Match|Game|Heat|Bout) (\d+)$/i);
  if (numbered) return `第 ${numbered[2]} ${({ match: "場", bout: "場", game: "戰", heat: "組" } as Record<string, string>)[numbered[1].toLowerCase()]}`;
  const table = value.match(/^Table of (\d+)$/i);
  if (table && TABLE_OF[table[1]]) return TABLE_OF[table[1]];
  const ofRound = value.match(/^Round of (\d+)$/i);
  if (ofRound && TABLE_OF[ofRound[1]]) return TABLE_OF[ofRound[1]];
  // 全能項目的分項（High Jump）、武術套路（Taijijian Final）沿用項目名稱對照；階段已另外顯示「決賽」。
  return eventNameZh(value.replace(/\s+Finals?$/i, "")) ?? value;
}
