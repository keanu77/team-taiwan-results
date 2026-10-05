// rosters/*.csv → src/generated/rosters.json（網站與同步程式都讀這份）。
// 每次 dev / build / test / sync 前自動執行；CSV 有錯就在這裡失敗，不會帶著錯資料上線。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { csvRecords } from "../src/lib/csv";

const MEDALS: Record<string, string> = { 金: "gold", 銀: "silver", 銅: "bronze", gold: "gold", silver: "silver", bronze: "bronze" };

function read(file: string, required: readonly string[]): Record<string, string>[] {
  const path = `rosters/${file}`;
  return existsSync(path) ? csvRecords(readFileSync(path, "utf8"), required, path) : [];
}

const athletes = read("athletes.csv", ["discipline", "english_name", "chinese_name"]).map((row, i) => {
  if (!/^[A-Z0-9]{3}$/.test(row.discipline)) throw new Error(`rosters/athletes.csv 第 ${i + 2} 列：discipline 是三碼項目代碼，例如 ATH`);
  if (!row.english_name || !row.chinese_name) throw new Error(`rosters/athletes.csv 第 ${i + 2} 列：缺少英文或中文姓名`);
  return {
    discipline: row.discipline, englishName: row.english_name, chineseName: row.chinese_name,
    ...(row.registration_id ? { registrationId: row.registration_id } : {}),
    ...(row.identity_group ? { identityGroup: row.identity_group } : {}),
  };
});

const eventNames: Record<string, string> = {};
read("event-names.csv", ["english", "chinese"]).forEach((row, i) => {
  if (!row.english || !row.chinese) throw new Error(`rosters/event-names.csv 第 ${i + 2} 列：english 與 chinese 都要填`);
  eventNames[row.english.toLowerCase().replace(/\s+/g, " ")] = row.chinese;
});

const teamMedals = read("team-medals.csv", ["medal", "date", "sport", "event", "athletes"]).map((row, i) => {
  const medal = MEDALS[row.medal.toLowerCase()] ?? MEDALS[row.medal];
  if (!medal) throw new Error(`rosters/team-medals.csv 第 ${i + 2} 列：medal 只能填 金／銀／銅`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`rosters/team-medals.csv 第 ${i + 2} 列：date 格式是 YYYY-MM-DD`);
  return { medal, date: row.date, sport: row.sport, event: row.event, athletes: row.athletes.split(/[、,;／/]/).map((n) => n.trim()).filter(Boolean) };
});

mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/rosters.json", `${JSON.stringify({ athletes, eventNames, teamMedals }, null, 1)}\n`);
console.log(`[rosters] 選手 ${athletes.length}、項目名稱 ${Object.keys(eventNames).length}、獎牌明細 ${teamMedals.length}`);
