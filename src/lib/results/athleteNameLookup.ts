import { TPE_ATHLETE_NAMES, type TpeAthleteNameEntry } from "./athleteNames";
import type { TpeCompetitor } from "./types";
import { isTeamLabel, replaceTeamAliases, TEAM } from "./team";

export type { TpeAthleteNameEntry } from "./athleteNames";

export interface AthleteNameQuery {
  discipline: string;
  englishName: string;
  organisation: string;
  registrationId?: string;
}

export interface AthleteNameDisplay {
  primaryName: string;
  /** Original source name, present only when at least one name has a verified translation. */
  englishName: string | null;
  translatedCount: number;
}

/** Only case and whitespace are normalized. Punctuation, order, initials and accents remain significant. */
export function normalizeAthleteEnglishName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function isTeamName(name: string): boolean {
  return isTeamLabel(name) && !/\d/.test(name);
}

function uniqueTranslation(entries: readonly TpeAthleteNameEntry[]): string | null {
  const identities = new Map<string, string>();
  for (const entry of entries) {
    const chineseName = entry.chineseName.trim();
    const identity = entry.identityGroup ? JSON.stringify(["verified", entry.identityGroup, chineseName]) : JSON.stringify([
      normalizeAthleteEnglishName(entry.englishName),
      chineseName,
      entry.registrationId?.trim() ? entry.registrationId : "",
    ]);
    identities.set(identity, chineseName);
  }
  // Identical duplicate rows are harmless; conflicting IDs, English identities or translations are not.
  return identities.size === 1 ? identities.values().next().value ?? null : null;
}

export function lookupTpeAthleteName(
  query: AthleteNameQuery,
  registry: readonly TpeAthleteNameEntry[] = TPE_ATHLETE_NAMES,
): string | null {
  const englishName = normalizeAthleteEnglishName(query.englishName);
  if (query.organisation.trim().toUpperCase() !== TEAM || !query.discipline.trim() || !englishName || isTeamName(query.englishName)) return null;
  const registrationId = query.registrationId?.trim() ? query.registrationId : undefined;

  const entries = registry.filter((entry) =>
    entry.discipline === query.discipline &&
    normalizeAthleteEnglishName(entry.englishName) && entry.chineseName.trim(),
  );
  if (registrationId) {
    const byId = entries.filter((entry) => entry.registrationId === registrationId);
    // An ambiguous ID must not fall through to a less reliable name match.
    if (byId.length > 0) return uniqueTranslation(byId);
  }

  const byName = entries.filter((entry) => normalizeAthleteEnglishName(entry.englishName) === englishName);
  // A known but different registration ID is evidence against a same-name match.
  if (registrationId && byName.some((entry) => entry.registrationId?.trim() && entry.registrationId !== registrationId)) return null;
  return uniqueTranslation(byName);
}

export function getAthleteNameDisplay(
  competitor: Pick<TpeCompetitor, "id" | "name" | "organisation">,
  discipline: string,
  registry: readonly TpeAthleteNameEntry[] = TPE_ATHLETE_NAMES,
): AthleteNameDisplay {
  const sourceName = replaceTeamAliases(competitor.name);
  const fallback = {
    primaryName: sourceName.trim() ? sourceName : replaceTeamAliases(competitor.organisation).trim() || "參賽者待確認",
    englishName: null,
    translatedCount: 0,
  };
  if (!sourceName.trim() || isTeamName(sourceName)) return fallback;

  const names = competitor.name.split("/").map((name) => name.trim());
  if (names.some((name) => !name)) return fallback;
  let translatedCount = 0;
  const primaryNames = names.map((name) => {
    const chineseName = lookupTpeAthleteName({
      discipline,
      englishName: name,
      organisation: competitor.organisation,
      // A doubles/team registration ID does not identify either individual athlete.
      registrationId: names.length === 1 && !competitor.id.includes(":") ? competitor.id || undefined : undefined,
    }, registry);
    if (!chineseName) return replaceTeamAliases(name);
    translatedCount += 1;
    return chineseName;
  });
  return translatedCount > 0 ? {
    primaryName: primaryNames.join(" / "),
    englishName: sourceName,
    translatedCount,
  } : fallback;
}
