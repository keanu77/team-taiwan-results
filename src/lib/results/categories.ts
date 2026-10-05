import { CONFIG } from "../../config";
import type { TpeResultUnit } from "./types";

// 只有本賽事代碼開頭、完整符合官方格式的 ID 才算證據。
const CANONICAL_ID = new RegExp(`^${CONFIG.source.code}:([A-Z0-9]{3}):([MWXO])\\.[A-Z0-9-]+\\.[A-Z0-9-]+\\.[A-Z0-9-]+$`);

export type ResultCategoryKey = "men" | "women" | "mixed" | "open" | "unclassified";
export interface ResultCategory { key: ResultCategoryKey; label: string }

type ClassifiedCategoryKey = Exclude<ResultCategoryKey, "unclassified">;
const CATEGORY_ORDER: ResultCategoryKey[] = ["men", "women", "mixed", "open", "unclassified"];
const LABELS: Record<ResultCategoryKey, string> = { men: "男子", women: "女子", mixed: "混合", open: "公開組", unclassified: "未分類" };
const CODES: Record<string, ClassifiedCategoryKey> = { M: "men", W: "women", X: "mixed", O: "open" };
const EVENT_PATTERNS: Array<[ClassifiedCategoryKey, RegExp]> = [
  ["men", /(?:^|[^\p{L}\p{N}_])(?:men(?:['’‘ʼ＇]s)?|male)(?=$|[^\p{L}\p{N}_])|男子/iu],
  ["women", /(?:^|[^\p{L}\p{N}_])(?:women(?:['’‘ʼ＇]s)?|female)(?=$|[^\p{L}\p{N}_])|女子/iu],
  ["mixed", /(?:^|[^\p{L}\p{N}_])mixed(?=$|[^\p{L}\p{N}_])|混合/iu],
  ["open", /(?:^|[^\p{L}\p{N}_])open(?=$|[^\p{L}\p{N}_])|公開/iu],
];

function codeCategory(unit: TpeResultUnit): ClassifiedCategoryKey | undefined {
  const match = unit.id.match(CANONICAL_ID);
  // Match the entire canonical ID, including rejecting a trailing newline that
  // JavaScript's $ anchor alone accepts. A different discipline is not evidence.
  if (!match || match[0] !== unit.id || match[1] !== unit.discipline) return undefined;
  return CODES[match[2]];
}

export function resultCategory(unit: TpeResultUnit): ResultCategory {
  // Only event labels describe the category. Athlete names and other display
  // fields must never be used to infer a competitor's sex or event category.
  const textCategories = EVENT_PATTERNS.filter(([, pattern]) => pattern.test(unit.event)).map(([key]) => key);
  const code = codeCategory(unit);
  const text = textCategories[0];
  const conflict = textCategories.length > 1 || (code !== undefined && text !== undefined && code !== text);
  const key = conflict ? "unclassified" : code ?? text ?? "unclassified";
  return { key, label: LABELS[key] };
}

export function groupByCategory(units: TpeResultUnit[]): Array<ResultCategory & { entries: TpeResultUnit[] }> {
  const entriesByCategory = new Map<ResultCategoryKey, TpeResultUnit[]>();
  for (const unit of units) {
    const { key } = resultCategory(unit);
    const entries = entriesByCategory.get(key) || [];
    entries.push(unit);
    entriesByCategory.set(key, entries);
  }
  return CATEGORY_ORDER.flatMap((key) => {
    const entries = entriesByCategory.get(key);
    return entries ? [{ key, label: LABELS[key], entries }] : [];
  });
}
