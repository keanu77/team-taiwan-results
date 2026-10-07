// 建立新賽事資料夾：設定檔＋只有表頭的空白名單，避免複製上一屆時夾帶舊名單。
// 用法：npm run new-event -- --id aimag2026 --name "2026 利雅德亞洲室內暨武藝運動會" \
//   --start 2026-11-12 --end 2026-11-21 --tz Asia/Riyadh --tz-label 沙烏地 \
//   --noc TPE --label 中華台北 --source manual --web-url https://example.org
// bornan 另需 --api-base；sheet 另需 --csv-url。其他選項見 README。
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfig } from "../src/config-schema";
import { EVENT_ID, EVENTS_ROOT } from "./event";

export interface NewEventFields {
  id: string; name: string; start: string; end: string;
  tz: string; tzLabel: string; viewerTz?: string; viewerTzLabel?: string;
  noc: string; label: string; aliases?: string[];
  source: string; code?: string; webUrl: string; apiBase?: string; csvUrl?: string;
}

const HEADERS: Record<string, string> = {
  "rosters/athletes.csv": "discipline,english_name,chinese_name,registration_id,identity_group",
  "rosters/event-names.csv": "english,chinese",
  "rosters/team-medals.csv": "medal,date,sport,event,athletes",
  "rosters/countries.csv": "code,chinese,english",
};
const MANUAL_HEADER = "unit_id,date,time,sport,event,phase,venue,status,name,organisation,result,rank,medal,outcome,discipline";

/** 檢查欄位並建立 events/<id>/；回傳建立的資料夾 */
export function createEvent(fields: NewEventFields, root = EVENTS_ROOT): string {
  const id = fields.id.trim().toLowerCase();
  if (!EVENT_ID.test(id)) throw new Error("賽事代號只能用小寫英數字與減號（2–40 字），例如 aimag2026");
  const dir = join(root, id);
  if (existsSync(dir)) throw new Error(`${dir} 已經存在`);
  const source = fields.source === "bornan" ? { type: "bornan", code: "", apiBase: fields.apiBase, webUrl: fields.webUrl }
    : fields.source === "sheet" ? { type: "sheet", code: "", webUrl: fields.webUrl, csvUrl: fields.csvUrl }
    : { type: "manual", code: "", webUrl: fields.webUrl };
  source.code = (fields.code || id).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const config = {
    name: fields.name, startDate: fields.start, endDate: fields.end,
    timeZone: fields.tz, timeZoneLabel: fields.tzLabel,
    viewerTimeZone: fields.viewerTz || "Asia/Taipei", viewerTimeZoneLabel: fields.viewerTzLabel || "台灣",
    team: { noc: fields.noc.toUpperCase(), label: fields.label, aliases: fields.aliases ?? [] },
    source,
    syncIntervalMinutes: 30,
  };
  // 跟 build 用同一套檢查：寫入前就擋下錯誤
  parseConfig(config, `${dir}/competition.config.json`);
  mkdirSync(join(dir, "rosters"), { recursive: true });
  writeFileSync(join(dir, "competition.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  for (const [file, header] of Object.entries(HEADERS)) writeFileSync(join(dir, file), `﻿${header}\n`);
  if (source.type === "manual") {
    mkdirSync(join(dir, "results"), { recursive: true });
    writeFileSync(join(dir, "results/manual.csv"), `﻿${MANUAL_HEADER}\n`);
  }
  return dir;
}

function cli() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const need = (name: string) => get(name) ?? (() => { throw new Error(`缺少 --${name}`); })();
  const dir = createEvent({
    id: need("id"), name: need("name"), start: need("start"), end: need("end"),
    tz: need("tz"), tzLabel: need("tz-label"), viewerTz: get("viewer-tz"), viewerTzLabel: get("viewer-tz-label"),
    noc: need("noc"), label: need("label"), aliases: get("aliases")?.split(",").map((a) => a.trim()).filter(Boolean),
    source: need("source"), code: get("code"), webUrl: need("web-url"), apiBase: get("api-base"), csvUrl: get("csv-url"),
  });
  console.log(`已建立 ${dir}。接著：填名單（選填）→ commit／push，Actions 會自動同步並發布。`);
}

if (process.argv[1]?.endsWith("new-event.ts")) {
  try { cli(); } catch (error) { console.error(`建立失敗：${error instanceof Error ? error.message : error}`); process.exit(1); }
}
