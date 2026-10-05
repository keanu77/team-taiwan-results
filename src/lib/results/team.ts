import { CONFIG } from "../../config";

/** 追蹤的代表隊代碼（competition.config.json 的 team.noc） */
export const TEAM = CONFIG.team.noc;
export const TEAM_LABEL = CONFIG.team.label;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
const ALIASES = CONFIG.team.aliases.map(escapeRegExp);

/** 把官方資料裡代表隊的全名（例如 Chinese Taipei）換成代碼 */
export function replaceTeamAliases(value: string): string {
  return ALIASES.length ? value.replace(new RegExp(ALIASES.join("|"), "gi"), TEAM) : value;
}

/** 名稱本身就是代表隊（代碼或全名），可帶隊伍編號，例如「TPE 2」 */
export function isTeamLabel(name: string): boolean {
  return new RegExp(`^(?:${[escapeRegExp(TEAM), ...ALIASES].join("|")})(?:\\s*\\d+)?$`, "i").test(name.trim());
}
