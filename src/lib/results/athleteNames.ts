import ROSTERS from "../../generated/rosters.json";

export interface TpeAthleteNameEntry {
  /** Official discipline code; the same name in another sport is a different identity. */
  discipline: string;
  englishName: string;
  chineseName: string;
  /** Official athlete registration ID, when supplied with the verified roster. */
  registrationId?: string;
  /** Explicitly verified identity shared by multiple official registrations. */
  identityGroup?: string;
}

/** 選手中英文名對照；來源是 events/<賽事>/rosters/athletes.csv（npm run event 轉成 src/generated/rosters.json）。 */
export const TPE_ATHLETE_NAMES: readonly TpeAthleteNameEntry[] = ROSTERS.athletes;
