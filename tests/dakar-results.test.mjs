import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, {createRequire} from 'node:module';
import path from 'node:path';
import {test} from 'node:test';
import {load} from 'cheerio';
import ts from 'typescript';
const require=createRequire(import.meta.url);
Module._extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const parserFile=path.resolve('src/lib/results/dakar/parse.ts');
const parser=fs.existsSync(parserFile)?require(parserFile):{};
const fixture=name=>fs.readFileSync(`tests/fixtures/dakar/${name}.html`,'utf8');
const schedule=()=>parser.parseDakarSchedule(fixture('day30'),'2026-10-30');
const tpe=()=>schedule().candidates.find(u=>u.competitors.some(c=>c.country==='TPE'));

test('Dakar actual schedule selects confirmed TPE and keeps source identity, UTC time and venue',()=>{
  const day=schedule(); assert.equal(day.totalUnits,4); assert.equal(day.unconfirmedUnits,0);
  const u=tpe(); assert.equal(u.id,'BS5XTEAM5-------------GPA-00020000');
  assert.equal(u.startsAt,'2026-10-30T11:30:00.000Z'); assert.equal(u.sport,'五人制棒球');
  assert.equal(u.official,false,'Finished alone is not official');
  assert.equal(u.competitors.find(c=>c.country==='TPE').score,'2');
});
test('Dakar actual formal result separates sets won from run totals and maps eight athlete UUIDs',()=>{
  const u=parser.parseDakarDetail(fixture('bs5-official'),tpe());
  assert.equal(u.status,'OFFICIAL'); assert.equal(u.official,true); assert.equal(u.detailAvailable,true);
  assert.equal(u.competitors.find(c=>c.country==='TPE').score,'2');
  assert.equal(u.competitors.find(c=>c.country==='SEN').score,'0');
  assert.equal(u.competitors.find(c=>c.country==='TPE').winner,true);
  assert.deepEqual(u.sets.map(s=>s.scores.find(x=>x.country==='TPE').score),['11','10']);
  assert.deepEqual(u.sets.map(s=>s.scores.find(x=>x.country==='SEN').score),['1','0']);
  assert.equal(u.athletes.length,8); assert.ok(u.athletes.every(x=>x.nameZh));
  assert.ok(u.athletes.some(x=>x.nameZh==='安偉杰'));
});
test('Dakar unannounced table tennis draws are coverage gaps, never invented TPE appearances',()=>{
  const day=parser.parseDakarSchedule(fixture('day31'),'2026-10-31');
  assert.equal(day.totalUnits,41); assert.ok(day.unconfirmedUnits>0);
  assert.equal(day.candidates.filter(u=>u.competitors.some(c=>c.country==='TPE')).length,1);
  assert.ok(day.candidates.every(u=>u.sourceUrl.startsWith('https://webresult.apps.dakar2026.org/')));
});
test('Dakar malformed/truncated, duplicate and wrong-day schedules fail closed',()=>{
  assert.throws(()=>parser.parseDakarSchedule('<html>service unavailable</html>','2026-10-30'));
  assert.throws(()=>parser.parseDakarSchedule(fixture('day30'),'2026-10-31'));
  assert.throws(()=>parser.parseDakarSchedule(fixture('day30')+fixture('day30'),'2026-10-30'));
  assert.throws(()=>parser.parseDakarDetail('<html>please login</html>',tpe()));
  assert.throws(()=>parser.parseDakarDetail(fixture('bs5-official'),{...tpe(),id:'BS5XTEAM5-------------GPA-00010000'}));
});
test('Dakar scheduled placeholders do not become scores, wins, or medals',()=>{
  const html=fixture('day30').replaceAll('Finished','Scheduled');
  const u=parser.parseDakarSchedule(html,'2026-10-30').candidates.find(u=>u.competitors.some(c=>c.country==='TPE'));
  assert.ok(u.competitors.every(c=>c.score===''&&!c.winner)); assert.equal(u.status,'SCHEDULED');
});
test('Dakar official empty-medal notice is zero; arbitrary empty HTML is not zero',()=>{
  assert.deepEqual(parser.parseDakarMedals(fixture('medals-empty')),{gold:0,silver:0,bronze:0,entries:[]});
  assert.throws(()=>parser.parseDakarMedals('')); assert.throws(()=>parser.parseDakarMedals('<h1>Error</h1>'));
});

test('Dakar fetch assembles only confirmed TPE; source requests have fixed origins and bounded routes',async()=>{
  const {fetchDakarDay,allowedDakarPath}=require(path.resolve('src/lib/results/dakar/source.ts'));
  const paths=[];
  const day=await fetchDakarDay('2026-10-30',async p=>{paths.push(p);return p.includes('ScheduleDatePartial')?fixture('day30'):fixture('bs5-official');});
  assert.equal(day.units.length,1); assert.equal(day.units[0].official,true); assert.equal(paths.length,2);
  assert.equal(allowedDakarPath('https://evil.invalid/'),false);
  assert.equal(allowedDakarPath('/nh/en/Comp/ListPartial?pagetype=ResultList&rsc=../secret'),false);
  await assert.rejects(fetchDakarDay('2026-09-01',async()=>{throw Error('should never fetch');}));
});

test('Dakar provisional results keep provisional label; arbitrary script is never executed',()=>{
  const html=fixture('bs5-official').replaceAll('Official Results','Unofficial Results')+'<script>throw new Error("must never execute")</script>';
  const unit=parser.parseDakarDetail(html,tpe()); assert.equal(unit.status,'UNOFFICIAL'); assert.equal(unit.official,false);
});

test('Dakar unknown medal tables and technical splits cannot masquerade as TPE final results',()=>{
  const fakeMedals='<div class="MedalsInfo">After 1 of 153 events</div><table><tbody><tr><td title="Gold">Gold</td><td><a href="/nh/en/Info/MedalList/BS5XTEAM5-------------GPA-00020000">Mixed</a></td><td class="athleteName">Senegal</td></tr></tbody></table>';
  assert.throws(()=>parser.parseDakarMedals(fakeMedals));
  const u={...tpe(),sportCode:'SWM',headToHead:false,competitors:[]};
  const metadata=fixture('bs5-official').slice(fixture('bs5-official').lastIndexOf('<script>'));
  const row='<tr><td>1</td><td class="athleteName"><a href="/nh/en/Participant/ParticipantInfo/decd87ee-63d2-4210-b99c-11c621876e85">LEE Han</a></td><td>25.1</td></tr>';
  const html='<span class="ResultList SWM"><div class="split"><table><thead><tr><th>Rank</th><th>Athlete</th><th>Time</th></tr></thead><tbody>'+row+'</tbody></table></div></span>'+metadata;
  assert.throws(()=>parser.parseDakarDetail(html,u));
});

test('Dakar individual start list and result use official UUID without assuming final overall rank',()=>{
  const u={...tpe(),sportCode:'SWM',headToHead:false,competitors:[]};
  const metadata=fixture('bs5-official').slice(fixture('bs5-official').lastIndexOf('<script>'));
  const html='<span class="ResultList SWM"><div class="table-wrapper"><table><thead><tr><th>Rank</th><th>Athlete</th><th>Time</th><th>Q</th></tr></thead><tbody><tr><td>2</td><td class="athleteName"><a href="/nh/en/Participant/ParticipantInfo/decd87ee-63d2-4210-b99c-11c621876e85">LEE Han</a></td><td>50.1</td><td>Q</td></tr></tbody></table></div></span>'+metadata;
  const result=parser.parseDakarDetail(html,u);
  assert.equal(result.competitors[0].nameZh,'李瀚'); assert.equal(result.competitors[0].score,'50.1');
  assert.equal(result.competitors[0].rank,'2');assert.equal(result.competitors[0].qualification,'Q');
});

test('Dakar incomplete head-to-head result cannot be labeled an official win',()=>{
  const $=load(fixture('bs5-official'));$('.ResultList > .scoredev .scoredevLeft').remove();
  assert.throws(()=>parser.parseDakarDetail($.html(),tpe()));
});

test('Dakar pending individual start list increments coverage without losing the completed TPE result',async()=>{
  const {fetchDakarDay}=require(path.resolve('src/lib/results/dakar/source.ts'));
  const id='TTEWTEAM--------------PREL00010000';
  const $=load(fixture('day30'));$('.schedule-container').append(`<div class="scheduleItem"><a href="/nh/en/Info/StartList/${id}"><span class="textStatus">Scheduled</span><div class="competition-name">Women Preliminary</div><div class="unit-details h2h"></div></a><span class="reportInfo" rscCode="${id}"></span></div>`);
  const pending='<span class="StartList TTE"></span><script>Reload.ReloadInformation = '+JSON.stringify({PageTitle:'<span class="textStatus">Scheduled</span>',UnitSelector:`<div class="unit current"><a href="/nh/en/Info/StartList/${id}"></a></div>`})+';</script>';
  const requests=[];
  const day=await fetchDakarDay('2026-10-30',async p=>{requests.push(p);return p.includes('ScheduleDatePartial')?$.html():p.includes(id)?pending:fixture('bs5-official');});
  assert.equal(requests.length,3);assert.equal(day.units.length,1);assert.equal(day.units[0].official,true);assert.equal(day.unconfirmedUnits,1);
});

test('Dakar individually flagged scheduled match still needs a detailed starting list',async()=>{
  const {fetchDakarDay}=require(path.resolve('src/lib/results/dakar/source.ts'));
  const $=load(fixture('day30'));$('.scheduleItem').filter((_,el)=>!$(el).find('img[src$="TPE.svg"]').length).remove();
  const item=$('.scheduleItem');item.find('.textStatus').text('Scheduled');
  const html=$.html().replaceAll('BS5XTEAM5-------------GPA-00020000','BOXW57KG-------------PREL00010000');
  let reads=0;
  await assert.rejects(fetchDakarDay('2026-10-30',async()=>++reads===1?html:'<h1>Unavailable</h1>'));
  assert.equal(reads,2);
});

test('Dakar medal parser never silently publishes a partial positive table',()=>{
  const good='<tr><td><img src="/skins/flags/svg_flags/TPE.svg"></td><td title="Gold">Gold</td><td><a href="/nh/en/Info/MedalList/BS5XTEAM5-------------GPA-00020000">Mixed</a></td><td class="athleteName">TPE</td></tr>';
  const table=rows=>'<div class="MedalsInfo">After 1 of 153 events</div><table><thead><tr><th>NOC</th><th>Medal</th><th>Event</th><th>Name</th></tr></thead><tbody>'+rows+'</tbody></table>';
  assert.equal(parser.parseDakarMedals(table(good+good)).gold,1,'team members do not multiply medals');
  assert.throws(()=>parser.parseDakarMedals(table(good+good.replace('title="Gold"','class="new-icon"'))));
});

test('Official cancelled heats without RSC stay a coverage gap and do not discard other matches',()=>{
  const $=load(fixture('day30'));
  $('.schedule-container').append('<div class="scheduleItem"><div class="sportimage"><img src="/skins/SYOG2026/images/sport_icons/SWM.svg"></div><span class="textStatus">Cancelled</span><div class="competition-name">Men 800m Freestyle</div><span class="time-value" data-time-ticks="1793359800000" data-time="11:30">11:30</span></div>');
  const day=parser.parseDakarSchedule($.html(),'2026-10-30');assert.equal(day.unconfirmedUnits,1);assert.ok(day.candidates.some(u=>u.competitors.some(c=>c.country==='TPE')));
  $('.scheduleItem').last().find('.textStatus').text('Scheduled');assert.throws(()=>parser.parseDakarSchedule($.html(),'2026-10-30'));
});

test('Unresolved scheduled knockout opponent is pending, never a failed complete day or inferred TPE match',()=>{
  const id='JUDM55KG--------------QFNL000100--';
  const metadata='<script>Reload.ReloadInformation = '+JSON.stringify({PageTitle:'<span class="textStatus">Scheduled</span><span class="textResultStatus">Start List</span>',UnitSelector:`<div class="unit current"><a href="/nh/en/Info/StartList/${id}"></a></div>`})+';</script>';
  const html='<span class="StartList JUD"><div class="scoredev"><div class="scoredevLeft"><div class="noc-element"><img src="/skins/flags/svg_flags/AZE.svg"></div><div class="team-name">Player A</div></div><div class="scoredevRight"><div class="team-name emptyTeam">Winner #1</div></div></div></span>'+metadata;
  assert.throws(()=>parser.parseDakarDetail(html,{...tpe(),id,sportCode:'JUD',competitors:[]}),parser.PendingDakarEntriesError);
});

test('Official Getting Ready state is an upcoming start list with no inferred scores',()=>{
  const day=parser.parseDakarSchedule(fixture('day30').replaceAll('Finished','Getting Ready'),'2026-10-30');
  const u=day.candidates.find(u=>u.competitors.some(c=>c.country==='TPE'));
  assert.equal(u.status,'START_LIST');assert.equal(u.statusLabel,'準備出賽');assert.ok(u.competitors.every(c=>c.score===''&&!c.winner));
});
