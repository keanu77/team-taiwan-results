// 把 events/<代號>/ 的設定與名單轉成 src/generated/ 下的 JSON，網站與同步程式都讀這兩份。
// dev / build / test / sync 前自動執行；設定或 CSV 有錯就在這裡失敗，不會帶著錯資料上線。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfig } from "../src/config-schema";
import { csvRecords } from "../src/lib/csv";
import { currentEvent, eventDir } from "./event";

const MEDALS: Record<string, string> = { 金: "gold", 銀: "silver", 銅: "bronze", gold: "gold", silver: "silver", bronze: "bronze" };

const id = currentEvent();
const dir = eventDir(id);
const configPath = join(dir, "competition.config.json");
const config = parseConfig(JSON.parse(readFileSync(configPath, "utf8")), configPath);

function read(file: string, required: readonly string[]): [string, Record<string, string>[]] {
  const path = join(dir, "rosters", file);
  return [path, existsSync(path) ? csvRecords(readFileSync(path, "utf8"), required, path) : []];
}

const [athletesPath, athleteRows] = read("athletes.csv", ["discipline", "english_name", "chinese_name"]);
const athletes = athleteRows.map((row, i) => {
  if (!/^[A-Z0-9]{3}$/.test(row.discipline)) throw new Error(`${athletesPath} 第 ${i + 2} 列：discipline 是三碼項目代碼，例如 ATH`);
  if (!row.english_name || !row.chinese_name) throw new Error(`${athletesPath} 第 ${i + 2} 列：缺少英文或中文姓名`);
  return {
    discipline: row.discipline, englishName: row.english_name, chineseName: row.chinese_name,
    ...(row.registration_id ? { registrationId: row.registration_id } : {}),
    ...(row.identity_group ? { identityGroup: row.identity_group } : {}),
  };
});

const eventNames: Record<string, string> = {};
const [eventNamesPath, eventNameRows] = read("event-names.csv", ["english", "chinese"]);
eventNameRows.forEach((row, i) => {
  if (!row.english || !row.chinese) throw new Error(`${eventNamesPath} 第 ${i + 2} 列：english 與 chinese 都要填`);
  eventNames[row.english.toLowerCase().replace(/\s+/g, " ")] = row.chinese;
});

const [medalsPath, medalRows] = read("team-medals.csv", ["medal", "date", "sport", "event", "athletes"]);
const teamMedals = medalRows.map((row, i) => {
  const medal = MEDALS[row.medal.toLowerCase()] ?? MEDALS[row.medal];
  if (!medal) throw new Error(`${medalsPath} 第 ${i + 2} 列：medal 只能填 金／銀／銅`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`${medalsPath} 第 ${i + 2} 列：date 格式是 YYYY-MM-DD`);
  return { medal, date: row.date, sport: row.sport, event: row.event, athletes: row.athletes.split(/[、,;／/]/).map((n) => n.trim()).filter(Boolean) };
});

// 得牌日期必須落在賽期內：最常見的錯誤是複製上一屆賽事資料夾卻沒換掉名單
const outside = teamMedals.filter((m) => m.date < config.startDate || m.date > config.endDate);
if (outside.length) {
  throw new Error(`${medalsPath} 有 ${outside.length} 筆得牌日期不在賽期 ${config.startDate}–${config.endDate} 內（例如 ${outside[0].date} ${outside[0].sport} ${outside[0].event}）。是否複製了上一屆的名單？`);
}

const countries: Record<string, [string, string]> = {};
const [countriesPath, countryRows] = read("countries.csv", ["code", "chinese", "english"]);
countryRows.forEach((row, i) => {
  if (!/^[A-Z]{3}$/.test(row.code) || !row.chinese) throw new Error(`${countriesPath} 第 ${i + 2} 列：code 是三碼代表隊代碼、chinese 必填`);
  countries[row.code] = [row.chinese, row.english || row.code];
});

mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/competition.json", `${JSON.stringify({ id, ...config }, null, 1)}\n`);
writeFileSync("src/generated/rosters.json", `${JSON.stringify({ athletes, eventNames, teamMedals, countries }, null, 1)}\n`);
console.log(`[event] ${id}（${config.name}）：選手 ${athletes.length}、項目名稱 ${Object.keys(eventNames).length}、獎牌明細 ${teamMedals.length}`);
