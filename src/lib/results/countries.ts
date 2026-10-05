import { isTeamLabel, TEAM } from "./team";
// NOC codes and English names: official Asian Games NOC list.
// https://www.ocagames.com/HZ_Info/AG2022-/en/results/all-sports/nocs-list.htm
// Chinese labels are Traditional Chinese display names. The tracked team is shown by its code.
// ART is listed by the 2026 official NOC page: https://results.asiangames2026.org/#/participants/orgs
const COUNTRIES: Record<string, readonly [string, string]> = {
  ART: ["亞洲難民代表隊", "Asian Refugee Team"],
  AFG: ["阿富汗", "Afghanistan"], BRN: ["巴林", "Bahrain"], BAN: ["孟加拉", "Bangladesh"],
  BHU: ["不丹", "Bhutan"], BRU: ["汶萊", "Brunei Darussalam"], CAM: ["柬埔寨", "Cambodia"],
  CHN: ["中國", "People's Republic of China"], PRK: ["北韓", "Democratic People's Republic of Korea"],
  HKG: ["香港", "Hong Kong, China"], IND: ["印度", "India"], INA: ["印尼", "Indonesia"],
  IRI: ["伊朗", "Islamic Republic of Iran"], IRQ: ["伊拉克", "Iraq"], JPN: ["日本", "Japan"],
  JOR: ["約旦", "Jordan"], KAZ: ["哈薩克", "Kazakhstan"], KOR: ["韓國", "Republic of Korea"],
  KUW: ["科威特", "Kuwait"], KGZ: ["吉爾吉斯", "Kyrgyzstan"], LAO: ["寮國", "Lao People's Democratic Republic"],
  LBN: ["黎巴嫩", "Lebanon"], MAC: ["澳門", "Macao, China"], MAS: ["馬來西亞", "Malaysia"],
  MDV: ["馬爾地夫", "Maldives"], MGL: ["蒙古", "Mongolia"], MYA: ["緬甸", "Myanmar"],
  NEP: ["尼泊爾", "Nepal"], OMA: ["阿曼", "Oman"], PAK: ["巴基斯坦", "Pakistan"],
  PLE: ["巴勒斯坦", "Palestine"], PHI: ["菲律賓", "Philippines"], QAT: ["卡達", "Qatar"],
  KSA: ["沙烏地阿拉伯", "Saudi Arabia"], SGP: ["新加坡", "Singapore"], SRI: ["斯里蘭卡", "Sri Lanka"],
  SYR: ["敘利亞", "Syrian Arab Republic"], TJK: ["塔吉克", "Tajikistan"], THA: ["泰國", "Thailand"],
  TLS: ["東帝汶", "Democratic Republic of Timor-Leste"], TKM: ["土庫曼", "Turkmenistan"],
  UAE: ["阿拉伯聯合大公國", "United Arab Emirates"], UZB: ["烏茲別克", "Uzbekistan"],
  VIE: ["越南", "Viet Nam"], YEM: ["葉門", "Yemen"],
};

export function countryName(organisation: string): string {
  const code = organisation.trim().toUpperCase();
  if (code === TEAM || isTeamLabel(organisation)) return TEAM;
  const names = Object.hasOwn(COUNTRIES, code) ? COUNTRIES[code] : undefined;
  return names ? names.join(" · ") : organisation.trim() || "代表隊待確認";
}

/** Only exact NOC names/codes identify a national team; never translate personal names. */
export function isCountryTeamName(name: string, organisation: string): boolean {
  const code = organisation.trim().toUpperCase();
  const normalized = name.trim().toUpperCase();
  if (!normalized || !code) return false;
  if (normalized === code) return true;
  if (code === TEAM) return countryName(name) === TEAM;
  return Object.hasOwn(COUNTRIES, code) && normalized === COUNTRIES[code][1].toUpperCase();
}
