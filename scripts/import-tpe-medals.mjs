#!/usr/bin/env node
// 匯入中華奧會代表團「成績公布總表」PDF → rosters/team-medals.csv，並更新 competition.config.json 的 teamMedals。
// 只適用這份總表的版面；格式改了會解析失敗（不會寫入半套資料），屆時改用手動編輯 CSV。
// 解析【依獎牌】頁的文字座標（需要 poppler 的 pdftotext），並以表內各色小計與總獎牌數交叉驗證。
// 用法：npm run import-medal-pdf -- <總表.pdf> [--dry-run]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUTPUT = join(process.cwd(), 'rosters/team-medals.csv')
const CONFIG = join(process.cwd(), 'competition.config.json')
const MEDALS = { 金: 'gold', 銀: 'silver', 銅: 'bronze' }
const MEDAL_ZH = { gold: '金', silver: '銀', bronze: '銅' }
const csvCell = (value) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
// 總表不同頁之間的筆誤，以其他頁的寫法為準。
const EVENT_FIXES = { 重女子57公斤級: '女子57公斤級' }
const Y_TOLERANCE = 3

const decode = (value) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

function readPages(pdf) {
  const html = execFileSync('pdftotext', ['-bbox', pdf, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return html.split(/<page\b/).slice(1).map((page) => Array.from(page.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g), (m) => ({
    x: Number(m[1]), y: Number(m[2]), xMax: Number(m[3]), text: decode(m[5]).trim(),
  })).filter((word) => word.text))
}

/** 同一行、間距很小的字合併成一個欄位（避免含空白的項目名被拆開）。 */
function mergeLine(words) {
  return [...words].sort((a, b) => a.x - b.x).reduce((cells, word) => {
    const last = cells[cells.length - 1]
    if (last && word.x - last.xMax < 4) return [...cells.slice(0, -1), { ...last, xMax: word.xMax, text: `${last.text}${word.text}` }]
    return [...cells, word]
  }, [])
}

function header(words, label) {
  const word = words.find((entry) => entry.text === label)
  if (!word) throw new Error(`找不到表頭「${label}」`)
  return word
}

export function parseMedalPage(words, year) {
  const date = header(words, '日期')
  const sport = header(words, '種類')
  const top = date.y + Y_TOLERANCE
  const body = words.filter((word) => word.y > top)
  const dateWords = body.filter((word) => /^\d{1,2}\/\d{1,2}$/.test(word.text) && word.x >= date.x - 20 && word.xMax <= date.xMax + 20)
  const rows = dateWords.sort((a, b) => a.y - b.y).map((dateWord) => {
    const cells = mergeLine(body.filter((word) => Math.abs(word.y - dateWord.y) < Y_TOLERANCE && word.x >= sport.x - 20 && word.xMax < date.x - 5))
    if (cells.length < 2) throw new Error(`第 ${dateWord.y.toFixed(0)} 行缺少種類或項目`)
    const [month, day] = dateWord.text.split('/').map(Number)
    return { y: dateWord.y, sport: cells[0].text, event: cells[1].text, nameX: cells[2]?.x, date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  })
  const nameX = Math.min(...rows.map((row) => row.nameX).filter((x) => x !== undefined)) - 1
  const nameLines = body.filter((word) => word.x >= nameX && word.xMax < date.x - 5 && !/^[\d\s/]+$/.test(word.text)).sort((a, b) => a.y - b.y)
  // PDF 內部文字順序不保證符合視覺順序；先依座標排序，避免小計正確卻套錯獎牌。
  const counts = body.filter((word) => word.x > date.xMax).sort((a, b) => a.y - b.y || a.x - b.x).map((word) => word.text)
  const medalCounts = Array.from(counts.join('').matchAll(/(\d+)\s*([金銀銅])/g), (m) => [MEDALS[m[2]], Number(m[1])])
  const total = counts.join('').match(/(\d+)面/)
  return { rows: assignNames(rows, nameLines), medalCounts, total: total ? Number(total[1]) : null }
}

/** 多行姓名在表格中垂直置中：每一列取「首末行中點落在該列」的最短連續姓名行。 */
export function assignNames(rows, lines) {
  let next = 0
  return rows.map((row) => {
    for (let size = 1; size <= 8 && next + size <= lines.length; size++) {
      const middle = (lines[next].y + lines[next + size - 1].y) / 2
      if (Math.abs(middle - row.y) < Y_TOLERANCE) {
        const text = lines.slice(next, next + size).map((line) => line.text).join('')
        next += size
        const athletes = text.split(/[、及/]/).map((name) => name.trim()).filter(Boolean)
        return { sport: row.sport, event: EVENT_FIXES[row.event] ?? row.event, athletes, date: row.date }
      }
    }
    throw new Error(`${row.sport} ${row.event} 找不到對應的姓名`)
  }).concat(next === lines.length ? [] : (() => { throw new Error(`有 ${lines.length - next} 行姓名未對應到項目`) })())
}

function main() {
  const [pdf, flag] = process.argv.slice(2)
  if (!pdf) throw new Error('用法：node scripts/import-tpe-medals.mjs <總表.pdf> [--dry-run]')
  const pages = readPages(pdf)
  const all = pages.flat().map((word) => word.text).join('')
  const year = all.match(/(\d{4})年/)?.[1]
  const updated = all.match(/更新時間：(\d{1,2})\/(\d{1,2})\([^)]*\)(\d{1,2}):(\d{2})/)
  if (!year || !updated) throw new Error('找不到年份或更新時間')
  const medalPages = pages.filter((words) => words.some((word) => word.text.includes('【依獎牌】')))
  if (!medalPages.length) throw new Error('找不到【依獎牌】頁')
  const parsed = medalPages.map((words) => parseMedalPage(words, year))
  const rows = parsed.flatMap((page) => page.rows)
  const counts = parsed.flatMap((page) => page.medalCounts)
  const total = parsed.map((page) => page.total).find((value) => value !== null)
  // 依獎牌頁的列依金 → 銀 → 銅排列，各色小計決定每列的獎牌。
  const colors = counts.flatMap(([color, count]) => Array(count).fill(color))
  if (colors.length !== rows.length) throw new Error(`小計 ${colors.length} 面與明細 ${rows.length} 列不符`)
  if (total !== undefined && total !== rows.length) throw new Error(`總獎牌數 ${total} 面與明細 ${rows.length} 列不符`)
  const pad = (value) => String(value).padStart(2, '0')
  const data = {
    updatedAt: `${year}-${pad(updated[1])}-${pad(updated[2])}T${pad(updated[3])}:${updated[4]}:00+08:00`,
    source: '中華奧會代表團成績公布總表',
    medals: rows.map((row, index) => ({ medal: colors[index], ...row })),
  }
  // 1150929 版第 1 頁誤列鍾孟宇為 9/29；第 2 頁依日期、第 3 頁依種類均為 9/22。
  // 僅修正這一版本與這一筆，避免影響未來總表。
  if (data.updatedAt === '2026-09-29T23:00:00+08:00') {
    const entry = data.medals.find((row) => row.sport === '空手道' && row.event === '對打男子84公斤級' && row.athletes.join() === '鍾孟宇' && row.date === '2026-09-29')
    if (entry) entry.date = '2026-09-22'
  }
  const summary = Object.entries(MEDALS).map(([label, color]) => `${data.medals.filter((m) => m.medal === color).length}${label}`).join(' ')
  console.info(`解析完成：${summary}，共 ${rows.length} 面（更新 ${data.updatedAt}）`)
  if (flag === '--dry-run') return console.info(JSON.stringify(data, null, 2))
  const lines = [['medal', 'date', 'sport', 'event', 'athletes'], ...data.medals.map((m) => [MEDAL_ZH[m.medal], m.date, m.sport, m.event, m.athletes.join('、')])]
  writeFileSync(OUTPUT, `\uFEFF${lines.map((row) => row.map(csvCell).join(',')).join('\n')}\n`)
  const config = JSON.parse(readFileSync(CONFIG, 'utf8'))
  config.teamMedals = { source: data.source, updatedAt: data.updatedAt }
  writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`)
  console.info(`已寫入 ${OUTPUT}，並更新 competition.config.json 的 teamMedals`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main() } catch (error) { console.error(`匯入失敗：${error.message}`); process.exit(1) }
}
