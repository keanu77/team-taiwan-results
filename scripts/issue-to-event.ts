// GitHub Actions 用：把「新增賽事」issue 表單的內容轉成 events/<代號>/。
// issue 內容一律當作不可信的資料：從環境變數讀，逐欄檢查，不會進 shell。
import { appendFileSync } from "node:fs";
import { createEvent } from "./new-event";

const LABELS: Record<string, string> = {
  賽事代號: "id", 賽事名稱: "name", 開始日期: "start", 結束日期: "end", 主辦地時區: "tz", 主辦地顯示名稱: "tzLabel",
  代表隊代碼: "noc", 代表隊名稱: "label", 成績來源: "source", 官方成績網站: "webUrl",
  "Bornan API 網址（選 bornan 才需要）": "apiBase", "Google 試算表 CSV 網址（選 sheet 才需要）": "csvUrl",
};

/** issue 表單送出後的格式是「### 欄位標題」加一段內容；沒填的欄位是 _No response_ */
export function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const section of body.split(/^### /m).slice(1)) {
    const [title, ...rest] = section.split("\n");
    const key = LABELS[title.trim()];
    const value = rest.join("\n").trim();
    if (key && value && value !== "_No response_") fields[key] = value.slice(0, 300);
  }
  return fields;
}

function main() {
  const fields = parseIssueForm(process.env.ISSUE_BODY ?? "");
  const required = ["id", "name", "start", "end", "tz", "tzLabel", "noc", "label", "source", "webUrl"];
  const missing = required.filter((key) => !fields[key]);
  if (missing.length) throw new Error(`表單缺少欄位：${missing.join("、")}`);
  const dir = createEvent({
    id: fields.id, name: fields.name, start: fields.start, end: fields.end, tz: fields.tz, tzLabel: fields.tzLabel,
    noc: fields.noc, label: fields.label, source: fields.source.split(/[（(]/)[0].trim(),
    webUrl: fields.webUrl, apiBase: fields.apiBase, csvUrl: fields.csvUrl,
  });
  const id = dir.split("/").pop()!;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `id=${id}\n`);
  console.log(`已建立 ${dir}`);
}

if (process.argv[1]?.endsWith("issue-to-event.ts")) {
  try { main(); } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `error<<EOF_ERR\n${message}\nEOF_ERR\n`);
    console.error(`建立失敗：${message}`);
    process.exit(1);
  }
}
