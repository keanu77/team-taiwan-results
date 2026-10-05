// 決定這次要處理哪個賽事：EVENT 環境變數，或 events/ 底下唯一（或第一個）資料夾。
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const EVENT_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function listEvents(root = "events"): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && EVENT_ID.test(entry.name) && existsSync(join(root, entry.name, "competition.config.json")))
    .map((entry) => entry.name)
    .sort();
}

export function currentEvent(): string {
  const events = listEvents();
  if (!events.length) throw new Error("events/ 底下沒有任何賽事（需要 events/<代號>/competition.config.json）");
  const requested = process.env.EVENT?.trim();
  if (requested) {
    if (!events.includes(requested)) throw new Error(`找不到賽事 ${requested}；目前有：${events.join("、")}`);
    return requested;
  }
  return events[0];
}

export const eventDir = (id: string) => join("events", id);
