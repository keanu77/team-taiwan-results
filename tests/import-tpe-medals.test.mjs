import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assignNames, parseMedalPage } from '../scripts/import-tpe-medals.mjs'

test('PDF content order does not change medal color assignments', () => {
  const word = (text, x, y, width = 10) => ({ text, x, y, xMax: x + width })
  const words = [word('種類', 50, 10), word('日期', 300, 10)]
  for (const [index, name] of ['甲', '乙', '丙'].entries()) {
    const y = 30 + index * 20
    words.push(word('田徑', 50, y), word('男子跳高', 100, y), word(name, 200, y), word('09/27', 300, y))
  }
  // 新版 PDF 先輸出銀、銅小計，最後才輸出畫面最上方的金牌小計。
  words.push(word('1銀', 350, 50), word('1銅', 350, 70), word('1金', 350, 30), word('3面', 350, 90))
  const parsed = parseMedalPage(words, '2026')
  assert.deepEqual(parsed.medalCounts, [['gold', 1], ['silver', 1], ['bronze', 1]])
  assert.equal(parsed.total, 3)
  assert.deepEqual(parsed.rows.map((row) => row.athletes), [['甲'], ['乙'], ['丙']])
})

test('slash-delimited rosters preserve names wrapped across lines', () => {
  const rows = [{ y: 50, sport: '棒球', event: '男子棒球', date: '2026-09-27' }]
  const lines = [{ y: 40, text: '游宗儒/林昱' }, { y: 60, text: '珉/張翔' }]
  assert.deepEqual(assignNames(rows, lines)[0].athletes, ['游宗儒', '林昱珉', '張翔'])
})
