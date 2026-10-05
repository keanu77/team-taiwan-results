import assert from "node:assert/strict";
import { eventNameZh, unitLabelZh } from "../src/lib/results/eventNames";

const cases: [string, string | null][] = [
  ["Men's Doubles", "男子雙打"],
  ["Mixed Doubles", "混合雙打"],
  ["Women's Team", "女子團體"],
  ["Men's 200m Butterfly", "男子200公尺蝶式"],
  ["Men's 4 x 100m Medley Relay", "男子4×100公尺混合式接力"],
  ["Women's 200m Individual Medley", "女子200公尺個人混合式"],
  ["Men's 110m Hurdles", "男子110公尺跨欄"],
  ["Men's Half Marathon Race Walk", "男子半程馬拉松競走"],
  ["Women's Heptathlon", "女子七項全能"],
  ["Men's Shot Put", "男子鉛球"],
  ["Men's 70kg", "男子70公斤級"],
  ["Men's Kumite -67kg", "男子對打67公斤級"],
  ["Women's Team Kata", "女子團體形"],
  ["Compound Men's Individual", "男子複合弓個人"],
  ["10m Air Pistol Mixed Team", "混合10公尺空氣手槍團體"],
  ["50m Rifle 3 Positions Women Individual", "女子50公尺步槍三姿個人"],
  ["Skeet Men Team", "男子定向飛靶團體"],
  ["Men's Canoe Single 500m", "男子C1 500公尺"],
  ["Men's Kayak Double 500m", "男子K2 500公尺"],
  ["Men's Foil Individual", "男子鈍劍個人"],
  ["Men's Épée Individual", "男子銳劍個人"],
  ["Men's Pommel Horse", "男子鞍馬"],
  ["Women's Double Sculls", "女子雙人雙槳"],
  ["Men's Taijiquan & Taijijian", "男子太極拳、太極劍全能"],
  ["Men's Park", "男子公園式"],
  ["Women's Individual Time Trial", "女子個人計時賽"],
  ["Dressage Team", "盛裝舞步團體"],
  ["Softball Women", "女子壘球"],
  ["Women", "女子"],
  ["Men’s", "男子"],
  ["Men +100kg", "男子100公斤以上級"],
  ["Men's +110kg", "男子110公斤以上級"],
  ["25m Pistol Women Team", "女子25公尺手槍團體"],
  ["Men Individual Poomsae", "男子個人品勢"],
  ["Women's Wrestling 50kg", "女子角力50公斤級"],
  ["Women's Synchronised 3m Springboard", "女子雙人3公尺跳板"],
  ["Men's Individual Stroke Play", "男子個人比桿賽"],
  ["Men's Team Pursuit", "男子團體追逐賽"],
  ["Women's Team Sprint", "女子團體競速賽"],
  ["Women's Sprint", "女子爭先賽"],
  ["Men's Keirin", "男子凱林賽"],
  ["Group All-Around", "團體全能"],
  ["B-Girls", "女子"],
  // 電競：代表團名單的遊戲中文名。
  ["MOBA [Pokémon UNITE]", "寶可夢大集結"],
  ["NARAKA : BLADEPOINT Finals", "永劫無間"],
  ["Puyo Puyo Champions", "魔法氣泡"],
  ["Battle Royale [PUBG MOBILE - Asian Games Version]", "絕地求生M 亞運版"],
  ["1v4 asymmetrical survival game [Identity V - Asian Games Version]", "第五人格 亞運版"],
  ["Fighting Games [Street Fighter 6, TEKKEN™ 8, THE KING OF FIGHTERS XV]", "競技武術"],
  // 沒把握的詞保留英文，不硬翻。
  ["Men's Modern -60kg", null],
  ["Men's Traditional -77kg", null],
  ["Men's Kayak Cross", null],
  ["Men's Dinghy", null],
  ["Men's Something New", null],
  ["", null],
];
for (const [english, chinese] of cases) assert.equal(eventNameZh(english), chinese, english);

assert.equal(unitLabelZh("1st Round"), "第一輪");
assert.equal(unitLabelZh("Round 2"), "第二輪");
assert.equal(unitLabelZh("Match 12"), "第 12 場");
assert.equal(unitLabelZh("Game 2"), "第 2 戰");
assert.equal(unitLabelZh("Heat 3"), "第 3 組");
assert.equal(unitLabelZh("Bout 13"), "第 13 場");
assert.equal(unitLabelZh("Table of 16"), "十六強賽");
assert.equal(unitLabelZh("Tie 2"), "Tie 2", "uncertain team-tie terms stay English");
assert.equal(unitLabelZh("八強賽"), "八強賽");
assert.equal(unitLabelZh("Final"), "決賽");
assert.equal(unitLabelZh("Men's 100m Butterfly Final", "Men's 100m Butterfly"), "決賽", "a unit name repeating the event keeps only its own part");
assert.equal(unitLabelZh("Men's 100m Butterfly", "Men's 100m Butterfly"), "", "a unit name identical to the event adds nothing");
for (const [label, expected] of [
  ["Qualification Round", "資格賽"], ["Quarterfinal", "八強賽"], ["Semifinal", "四強賽"], ["Round of 16", "十六強賽"],
  ["Gold Medal Match", "金牌戰"], ["Bronze Medal Bout A", "銅牌戰 A"], ["Final A", "A 組決賽"],
  ["Group C", "C 組"], ["Pool A", "A 組"], ["Group Phase - Group B", "分組賽 B 組"], ["Preliminary Round - Pool C", "預賽 C 組"],
  ["Round Robin Pool B", "循環賽 B 組"], ["Day 2", "第 2 日"], ["Prelims", "預賽"], ["High Jump", "跳高"], ["100 Metres Hurdles", "100公尺跨欄"],
  ["Taijijian Final", "太極劍"], ["Nanquan", "南拳"], ["Play-in", "Play-in"],
] as const) assert.equal(unitLabelZh(label), expected, label);
console.info("PASS TPE event names: controlled Chinese translations, unknown terms kept in English");
