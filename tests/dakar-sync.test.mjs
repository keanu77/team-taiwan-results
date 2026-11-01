import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
Module._extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { runDakarSync, emptyDakarState, dakarSnapshot, mergeDakarDay } = require('../src/lib/results/dakar/sync.ts');
const { parseDakarSchedule, parseDakarDetail } = require('../src/lib/results/dakar/parse.ts');
const { parseConfig } = require('../src/config-schema.ts');
const { DAKAR_ATHLETES } = require('../src/lib/results/dakar/roster.ts');
const { csvRecords } = require('../src/lib/csv.ts');
const fixture = name => fs.readFileSync(`tests/fixtures/dakar/${name}.html`, 'utf8');
const candidate = parseDakarSchedule(fixture('day30'), '2026-10-30').candidates.find(u => u.competitors.some(c => c.country === 'TPE'));
const unit = parseDakarDetail(fixture('bs5-official'), candidate);
const zero = { gold: 0, silver: 0, bronze: 0, entries: [] };
const at = '2026-11-01T10:00:00.000Z';
const clock = () => new Date(at);
const emptyDay = date => ({ date, units: [], totalUnits: 1, unconfirmedUnits: 1 });
const day = { date: unit.date, units: [unit], totalUnits: 4, unconfirmedUnits: 0 };
const row = (value, time = at) => ({ value, lastSuccessAt: time, lastAttemptAt: time, lastError: null });
const options = dir => ({ dir, now: clock, log() {}, fetchMedals: async () => zero, fetchDay: async date => date === unit.date ? day : emptyDay(date) });
const temporary = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dakar-sync-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('Dakar configuration cannot silently relabel another competition, team, or origin', () => {
  const c = JSON.parse(fs.readFileSync('events/dakar2026/competition.config.json', 'utf8'));
  assert.equal(parseConfig(c).source.type, 'dakar');
  for (const patch of [{ team: { ...c.team, noc: 'USA' } }, { startDate: '2026-10-29' }, { source: { ...c.source, code: 'AG2026' } }, { source: { ...c.source, webUrl: 'https://example.com' } }, { syncIntervalMinutes: 10 }]) assert.throws(() => parseConfig({ ...c, ...patch }));
});
test('All 37 public bilingual athletes agree with the event CSV; no handbook private fields are included', () => {
  const csv = csvRecords(fs.readFileSync('events/dakar2026/rosters/athletes.csv', 'utf8'), ['discipline','english_name','chinese_name','registration_id'], 'athletes');
  assert.equal(csv.length, 37);
  assert.deepEqual(csv.map(a => ({ id: a.registration_id, name: a.english_name, nameZh: a.chinese_name, sportCode: a.discipline })), DAKAR_ATHLETES);
  assert.ok(DAKAR_ATHLETES.some(a => a.nameZh === '安偉杰'));
});
test('Independent static sync persists all 15 days, official sets and zero medals; repeat is skipped', async t => {
  const dir = temporary(t);
  const first = await runDakarSync(options(dir));
  assert.equal(first.changed, true); assert.equal(Object.keys(first.days).length, 15);
  const snapshot = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  assert.equal(snapshot.units.length, 1); assert.equal(snapshot.units[0].official, true); assert.equal(snapshot.units[0].sets[0].scores.find(s => s.country === 'TPE').score, '11');
  assert.equal(snapshot.coverage.length, 15); assert.deepEqual(snapshot.medals, zero);
  const before = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
  const repeated = await runDakarSync({ ...options(dir), fetchDay() { throw Error('must not fetch'); }, fetchMedals() { throw Error('must not fetch'); } });
  assert.equal(repeated.changed, false); assert.equal(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'), before);
});
test('Source failure preserves successful records, reports stale, cools down, and does not starve healthy days', async t => {
  const dir = temporary(t); await runDakarSync(options(dir));
  const now = () => new Date('2026-11-01T17:00:00Z');
  const failed = await runDakarSync({ ...options(dir), now, fetchMedals: async () => { throw Error('unavailable'); } });
  assert.equal(failed.medals, 'failed');
  const snapshot = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  assert.deepEqual(snapshot.medals, zero); assert.equal(snapshot.medalsStale, true); assert.equal(snapshot.units.length, 1);
  assert.equal((await runDakarSync({ ...options(dir), now })).reason, 'source cooldown');
  const next = await runDakarSync({ ...options(dir), now: () => new Date('2026-11-01T17:16:00Z'), fetchMedals: async () => { throw Error('still unavailable'); } });
  assert.equal(Object.keys(next.days).length, 15); assert.equal(next.medals, 'failed');
});
test('Missing units survive rescans and a moved match cannot be revived by an old-date refresh', () => {
  const old = row(mergeDakarDay(undefined, day, at));
  const retained = mergeDakarDay(old, { ...day, units: [] }, '2026-11-02T10:00:00.000Z');
  assert.equal(retained.units[0].retained, true); assert.equal(retained.confirmedAt[unit.id], at);
  const moved = { ...unit, date: '2026-11-02', startsAt: '2026-11-02T11:30:00.000Z' };
  const state = emptyDakarState();
  state.days[unit.date] = row(retained, '2026-11-03T10:00:00.000Z');
  state.days[moved.date] = row(mergeDakarDay(undefined, { ...day, date: moved.date, units: [moved] }, '2026-11-02T11:00:00.000Z'));
  assert.equal(dakarSnapshot(state, clock()).units[0].date, moved.date);
});
test('Malformed existing snapshots are left byte-for-byte intact and no request is sent', async t => {
  const dir = temporary(t); const pathName = path.join(dir, 'state.json'); const bad = '{"source":"AG2026"}'; fs.writeFileSync(pathName, bad);
  await assert.rejects(runDakarSync({ ...options(dir), fetchMedals() { assert.fail('should not fetch'); } }));
  assert.equal(fs.readFileSync(pathName, 'utf8'), bad);
  fs.unlinkSync(pathName); fs.writeFileSync(path.join(dir, 'index.json'), '{}');
  await assert.rejects(runDakarSync(options(dir)), /同步狀態遺失/);
});
test('Invalid official dates do not replace previously saved units', async t => {
  const dir = temporary(t); await runDakarSync(options(dir));
  const bad = await runDakarSync({ ...options(dir), now: () => new Date('2026-11-01T17:00:00Z'), fetchDay: async () => day });
  assert.equal(bad.days['2026-11-01'], 'failed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).units[0].id, unit.id);
});
test('Outside sync window and exhausted budget do not read upstream or alter archived files', async t => {
  const dir = temporary(t); await runDakarSync(options(dir)); const before = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
  const forbidden = async () => assert.fail('no upstream request');
  assert.equal((await runDakarSync({ ...options(dir), now: () => new Date('2026-12-01'), fetchMedals: forbidden, fetchDay: forbidden })).changed, false);
  assert.equal((await runDakarSync({ ...options(dir), now: () => new Date('2026-11-02'), budgetMs: 0, fetchMedals: forbidden, fetchDay: forbidden })).changed, false);
  assert.equal(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'), before);
});
