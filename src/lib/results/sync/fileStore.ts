import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { RESULTS_SOURCE } from "../model";
import { isDataIndex, isStoredDay, isStoredMedals, type DataIndex, type StoredDay, type StoredMedals } from "../snapshot";

// data/ 目錄的讀寫。GitHub Actions 每次執行都從 data 分支取回上一輪的檔案，所以這裡就是「資料庫」。

function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 先寫暫存檔再改名，中途失敗不會留下半個 JSON */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 1)}\n`);
  renameSync(temp, path);
}

export interface FileStore {
  readIndex(): DataIndex;
  writeIndex(index: DataIndex): void;
  readDay(date: string): StoredDay | null;
  writeDay(day: StoredDay): void;
  readMedals(): StoredMedals | null;
  writeMedals(medals: StoredMedals): void;
}

export function fileStore(dir: string): FileStore {
  const indexPath = join(dir, "index.json");
  return {
    readIndex() {
      const value = readJson(indexPath);
      if (value === null) return { source: RESULTS_SOURCE, generatedAt: new Date(0).toISOString(), days: {}, medals: null };
      if (!isDataIndex(value)) throw new Error(`${indexPath} 格式不符`);
      // 換賽事後沿用舊資料會混在一起，直接擋下
      if (value.source !== RESULTS_SOURCE) throw new Error(`${indexPath} 屬於賽事 ${value.source}，與設定的 ${RESULTS_SOURCE} 不同；請改用新的賽事代號，或只刪除 data 分支裡的 ${dir}/ 資料夾（不要刪整個分支，其他賽事的資料也在裡面）`);
      return value;
    },
    writeIndex(index) { writeJson(indexPath, index); },
    readDay(date) {
      const path = join(dir, "days", `${date}.json`);
      const value = readJson(path);
      if (value === null) return null;
      if (!isStoredDay(value, date)) throw new Error(`${path} 格式不符`);
      return value;
    },
    writeDay(day) { writeJson(join(dir, "days", `${day.date}.json`), day); },
    readMedals() {
      const path = join(dir, "medals.json");
      const value = readJson(path);
      if (value === null) return null;
      if (!isStoredMedals(value)) throw new Error(`${path} 格式不符`);
      return value;
    },
    writeMedals(medals) { writeJson(join(dir, "medals.json"), medals); },
  };
}
