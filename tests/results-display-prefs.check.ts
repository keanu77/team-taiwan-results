import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PREFS, DISPLAY_PREPAINT_SCRIPT, parseDisplayPrefs, resolveDark, stepScale } from "../src/components/results/displayPrefs";

assert.deepEqual(parseDisplayPrefs(null), DEFAULT_PREFS);
assert.deepEqual(parseDisplayPrefs("not json"), DEFAULT_PREFS);
assert.deepEqual(parseDisplayPrefs('{"theme":"dark","scale":"xl"}'), { theme: "dark", scale: "xl" });
assert.deepEqual(parseDisplayPrefs('{"theme":"purple","scale":"huge"}'), DEFAULT_PREFS, "unknown values fall back");

assert.equal(stepScale("md", 1), "lg");
assert.equal(stepScale("xxl", 1), "xxl", "clamped at largest");
assert.equal(stepScale("sm", -1), "sm", "clamped at smallest");

assert.equal(resolveDark(null, true), true, "follows system when unset");
assert.equal(resolveDark("light", true), false);
assert.equal(resolveDark("dark", false), true);

assert.doesNotThrow(() => new Function(DISPLAY_PREPAINT_SCRIPT), "prepaint script must be valid JS");
assert.match(DISPLAY_PREPAINT_SCRIPT, /prefers-color-scheme/, "prepaint follows the system theme until the viewer picks one");

// 夜間對照表必須涵蓋賽果頁用到的每個淺色 utility，否則夜間會露出白底或深字。
const theme = readFileSync(join(process.cwd(), "src/app/results-theme.css"), "utf8");
const listDir = (dir: string) => readdirSync(join(process.cwd(), dir)).filter((name) => /\.tsx?$/.test(name)).map((name) => `${dir}/${name}`);
const sources = ["src/app/page.tsx", ...listDir("src/components/results"), ...listDir("src/lib/results")]
  .map((path) => readFileSync(join(process.cwd(), path), "utf8")).join("\n");
const KEPT = /^(bg-(amber-400|orange-500|sky-500|slate-300|slate-400|brand-[5-9]00|brand-950))$/; // 色塊本身在深底上仍清楚
const used = new Set(Array.from(sources.matchAll(/(?<![\w-])((?:hover:|disabled:|open:)?(?:bg|text|border|ring|divide)-(?:white|gray|slate|zinc|neutral|stone|amber|yellow|lime|green|orange|brand|red|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|teal|accent)(?:-\d+)?(?:\/\d+)?)(?![\w/-])/g), (m) => m[1]));
const missing = Array.from(used).filter((cls) => !KEPT.test(cls) && !/^(text-white|ring-brand|border-blue-600)/.test(cls) && !theme.includes(`.${cls.replace(/[:/]/g, (c) => `\\${c}`)}`));
assert.deepEqual(missing, [], "every light utility on the results page has a night mapping");
console.info("PASS results display prefs parsing, scale clamping, system theme and night palette coverage");
