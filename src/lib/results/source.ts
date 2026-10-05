import { inflateSync } from "node:zlib";
import { compareSchedule } from "./highlights";
import { isTpeUnit, normalizeResult, parseResultDate, parseSchedule, record, text, type ScheduleUnit } from "./model";
import type { TpeResultUnit } from "./types";
import { CONFIG } from "../../config";
import { TEAM } from "./team";

const BORNAN = CONFIG.source.type === "bornan" ? CONFIG.source : null;
const MAX_BYTES = 12 * 1024 * 1024;

export function decodeBornan(bytes: Uint8Array): unknown {
  if (bytes.byteLength > MAX_BYTES) throw new Error("來源資料超過大小限制");
  const buffer = Buffer.from(bytes);
  const string = buffer.toString("utf8");
  if (/^\s*[\[{]/.test(string)) return JSON.parse(string);
  // Bornan sends pako's binary string encoded as UTF-8, not HTTP Content-Encoding.
  const encoded = buffer[1] === 0x9c || buffer[1] === 0xda || buffer[1] === 0x01 ? buffer : Buffer.from(string, "latin1");
  return JSON.parse(inflateSync(encoded, { maxOutputLength: 24 * 1024 * 1024 }).toString("utf8"));
}

export type SourceReader = (path: string) => Promise<unknown>;
export async function readBornan(path: string): Promise<unknown> {
  if (!BORNAN) throw new Error("competition.config.json 的來源不是 bornan");
  if (path !== "ALL/medals/standings" && path !== `ALL/medals/org/${TEAM}` && !/^[A-Z0-9]{3}\/(?:schedule\/(?:day|daily)\/\d{4}-\d{2}-\d{2}|results\/[A-Z0-9._-]{4,90})$/.test(path)) throw new Error("來源路徑不符");
  // Serialized requests are spaced out; errors return to the persisted scheduler cooldown.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const response = await fetch(`${BORNAN.apiBase}/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; team-taiwan-results/1.0; +https://github.com/keanu77/team-taiwan-results)", Referer: `${BORNAN.webUrl}/`, Accept: "*/*" },
    cache: "no-store", signal: AbortSignal.timeout(20_000), redirect: "error",
  });
  if (!response.ok) throw new Error(`來源暫時無法讀取（HTTP ${response.status}）`);
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("來源資料超過大小限制");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("來源未回傳資料");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) throw new Error("來源資料超過大小限制");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return decodeBornan(Buffer.concat(chunks));
}

export async function mapLimited<T, R>(items: T[], mapper: (item: T) => Promise<R>, limit = 1): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; output[index] = await mapper(items[index]); }
  }));
  return output;
}

export async function fetchTpeDay(date: string, read: SourceReader = readBornan): Promise<TpeResultUnit[]> {
  if (!parseResultDate(date)) throw new Error("不支援的比賽日期");
  const index = parseSchedule(await read(`ALL/schedule/day/${date}`));
  const disciplines = [...new Set(index.map((u) => u.Disc))];
  const lists = await mapLimited(disciplines, async (disc) => {
    const list = parseSchedule(await read(`${disc}/schedule/daily/${date}`), disc);
    // A mysteriously empty sport response must not erase its previously known matches.
    if (!list.length && index.some((u) => u.Disc === disc)) throw new Error("來源分項賽程尚未完整");
    return list;
  });
  const selected = new Map<string, ScheduleUnit>();
  for (const unit of lists.flat()) {
    if (isTpeUnit(unit)) selected.set(`${unit.Disc}:${unit.Key}`, unit);
  }
  const normalized = await mapLimited([...selected.values()], async (unit) => {
    const shouldRead = !["SCHEDULED", "CANCELLED", "CANCELED", "POSTPONED", "DELAYED"].includes(unit.Status);
    if (!shouldRead) return normalizeResult(unit);
    const code = text(unit.ResCode) || unit.Key;
    const detail = await read(`${unit.Disc}/results/${code}`);
    if (detail === null) {
      if (unit.Status === "START_LIST") return normalizeResult(unit);
      throw new Error("成績來源尚未完整");
    }
    // Check object before normalization to distinguish malformed source from an empty start list.
    record(detail);
    return normalizeResult(unit, detail);
  });
  return normalized.sort(compareSchedule);
}
