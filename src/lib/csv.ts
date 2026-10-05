// 最小的 CSV 解析（RFC 4180：逗號分隔、雙引號跳脫、欄位內可換行）。
// 名單與手動成績都用它讀；Excel 另存「CSV UTF-8」產生的 BOM 會自動去掉。

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("CSV 有未關閉的雙引號");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** 以第一列為欄名，回傳物件陣列；缺少必要欄位就丟錯並指出檔名 */
export function csvRecords(text: string, required: readonly string[], file: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const names = header.map((name) => name.trim());
  const missing = required.filter((name) => !names.includes(name));
  if (missing.length) throw new Error(`${file} 缺少欄位：${missing.join("、")}`);
  return rows.map((cells, index) => {
    if (cells.length > names.length) throw new Error(`${file} 第 ${index + 2} 列欄位比表頭多`);
    return Object.fromEntries(names.map((name, i) => [name, (cells[i] ?? "").trim()]));
  });
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\n")}\n`;
}
