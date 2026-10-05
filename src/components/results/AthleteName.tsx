import { getAthleteNameDisplay } from "@/lib/results/athleteNameLookup";
import { countryName, isCountryTeamName } from "@/lib/results/countries";
import type { TpeCompetitor } from "@/lib/results/types";

/** 雙打以斜線分隔兩人：在斜線後放零寬空白，讓換行優先落在兩人之間，而不是名字中間。 */
function breakAtSlash(name: string): string {
  return name.replace(/\s*\/\s*/g, " /\u200B");
}

export interface AthleteNameProps {
  competitor: TpeCompetitor;
  discipline: string;
  compact?: boolean;
}

export function AthleteName({ competitor, discipline, compact = false }: AthleteNameProps) {
  const name = getAthleteNameDisplay(competitor, discipline);
  return (
    <span className="block min-w-0 [overflow-wrap:anywhere]">
      <span className={`block font-semibold text-gray-900 ${compact ? "text-sm" : ""}`}>{isCountryTeamName(competitor.name, competitor.organisation) ? countryName(competitor.organisation) : breakAtSlash(name.primaryName)}</span>
      {name.englishName && <span className="mt-0.5 block text-xs font-normal text-gray-500">{breakAtSlash(name.englishName)}</span>}
    </span>
  );
}
