import { CONFIG } from "../../config";
import ROSTERS from "../../generated/rosters.json";
import type { TpeMedalList } from "./tpeMedalList";

// 代表團公布的得牌明細（中文項目名與團體隊員）；來源是 events/<賽事>/rosters/team-medals.csv。
// 可手動填，或用 npm run import-medal-pdf 從中華奧會「成績公布總表」PDF 匯入。
export const TPE_MEDAL_DATA = {
  updatedAt: CONFIG.teamMedals.updatedAt,
  source: CONFIG.teamMedals.source,
  medals: ROSTERS.teamMedals,
} as TpeMedalList;
