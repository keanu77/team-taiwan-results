import raw from "./generated/competition.json";
import { parseConfig, type CompetitionConfig } from "./config-schema";

export { slashDate, utcOffsetLabel, type CompetitionConfig } from "./config-schema";

// 目前建置／同步的賽事。src/generated/competition.json 由 scripts/prepare-event.ts 依 EVENT 產生。
export const EVENT_ID: string = raw.id;
export const CONFIG: CompetitionConfig = parseConfig(raw, `events/${raw.id}/competition.config.json`);
