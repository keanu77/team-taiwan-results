import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const base = 'https://webresult.apps.dakar2026.org';
const athlete = { id:'athlete-1', name:'HSU Tzuyi', nameZh:'許梓奕', sportCode:'BS5' };
const side = (country,name,score,extra={}) => ({ id:country,name,nameZh:country==='TPE'?'TPE':'',country,score,rank:'',qualification:'',irm:'',winner:false,...extra });
const unit = (extra={}) => ({ id:'BS5-test',date:'2026-10-30',sportCode:'BS5',sport:'五人制棒球',event:'Mixed Opening Round Group A Game #2',startsAt:'2026-10-30T19:30:00Z',venue:'Dakar Court',status:'OFFICIAL',statusLabel:'正式成績',official:true,headToHead:true,competitors:[side('SEN','Senegal','0'),side('TPE','Chinese Taipei','2',{winner:true})],athletes:[athlete],sets:[{label:'1st Set - Official',scores:[{country:'SEN',score:'1'},{country:'TPE',score:'11'}]}],sourceUrl:`${base}/nh/en/Info/ResultList/BS5-test`,detailAvailable:true,...extra });
const coverage = (extra={}) => ({date:'2026-10-30',totalUnits:4,unconfirmedUnits:0,fetchedAt:'2026-10-30T20:00:00Z',lastAttemptAt:'2026-10-30T20:00:00Z',stale:false,warning:null,...extra});
const response = (extra={}) => ({success:true,source:'DAKAR2026',today:'2026-10-30',minDate:'2026-10-30',maxDate:'2026-11-13',units:[unit()],coverage:Array.from({length:15},(_,i)=>coverage({date:new Date(Date.UTC(2026,9,30+i)).toISOString().slice(0,10)})),medals:null,medalsFetchedAt:null,medalsStale:true,syncEnabled:true,syncIntervalMinutes:60,...extra});
function load(file, overrides={}, cache=new Map()) {
  const absolute=path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  if (!fs.existsSync(absolute)) return {};
  const exports={}; cache.set(absolute,exports);
  const runtime = {exports, process: { env: { NEXT_PUBLIC_BASE_PATH: "/dakar2026" } }, URL, Date, Intl, Set, Map, AbortController, console, ...overrides.globals,
    require(name){
      if (Object.hasOwn(overrides,name)) return overrides[name];
      if(name==='react') return React;
      if(name==='react/jsx-runtime') return jsxRuntime;
      if(name==='next/link') return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
      const target=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(absolute),name);
      for(const suffix of ['.ts','.tsx','']) if(fs.existsSync(target+suffix)) return load(target+suffix,overrides,cache);
      throw Error(name);
    }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,runtime);
  return exports;
}
const display=()=>load('src/components/results/dakarDisplay.ts');
const renderCard=(value=unit(),day=coverage())=>{
  const {DakarResultCard}=load('src/components/results/DakarResultCard.tsx');
  assert.equal(typeof DakarResultCard,'function','Dakar card must exist');
  return renderToStaticMarkup(React.createElement(DakarResultCard,{unit:value,coverage:day}));
};
function renderPage(data,extra={}) {
  const {DakarResults}=load('src/components/results/DakarResults.tsx',{'./useDakarResults':{useDakarResults:()=>({data,loading:false,error:null,refresh(){},...extra})}});
  return renderToStaticMarkup(React.createElement(DakarResults));
}

test('Dakar filtering supports date, sport, bilingual roster names and the matched athlete ID',()=>{
  const {filterDakarUnits}=display(); assert.equal(typeof filterDakarUnits,'function');
  const rows=[unit(),unit({id:'swim',sportCode:'SWM',sport:'游泳',date:'2026-10-31',status:'START_LIST',official:false})];
  const filters={view:'all',date:'',sport:'',search:''};
  assert.equal(filterDakarUnits(rows,{...filters,view:'today'},'2026-10-30').length,1);
  assert.equal(filterDakarUnits(rows,{...filters,date:'2026-10-31',sport:'SWM'},'2026-10-30')[0].id,'swim');
  for(const search of ['許梓奕','hsu tzuyi','HSU, Tzuyi','athlete-1']) assert.equal(filterDakarUnits(rows,{...filters,sport:'BS5',search},'2026-10-30').length,1);
  assert.equal(filterDakarUnits(rows,{...filters,search:'not present'},'2026-10-30').length,0);
  assert.equal(filterDakarUnits(rows,{...filters,view:'finished'},'2026-10-30')[0].id,'BS5-test');
  assert.equal(filterDakarUnits(rows,{...filters,view:'upcoming'},'2026-10-30')[0].id,'swim');
});

test('Dakar card keeps TPE score and per-set country scores together; times include both dates',()=>{
  const html=renderCard();
  assert.ok(html.indexOf('data-country="TPE"') < html.indexOf('data-country="SEN"'));
  assert.match(html,/TPE/); assert.match(html,/>2</); assert.match(html,/>0</);
  assert.match(html,/TPE 11/); assert.match(html,/SEN 1/);
  assert.match(html,/臺灣.*10\/31.*03:30/); assert.match(html,/達卡.*10\/30.*19:30/);
  assert.match(html,/正式成績/); assert.match(html,/許梓奕/); assert.match(html,/HSU Tzuyi/);
  assert.match(html,/代表隊名單／選手/); assert.doesNotMatch(html,/先發/);
  assert.match(html,/官方原始資料/); assert.match(html,/本日資料更新/);
});

test('Dakar card uses round rank, provisional status, and never invents a pending score or outcome',()=>{
  const html=renderCard(unit({official:false,status:'UNOFFICIAL',statusLabel:'暫定成績',competitors:[side('TPE','HSU Tzuyi','12.1',{id:'athlete-1',nameZh:'',rank:'1'})]}));
  assert.match(html,/本輪名次/); assert.match(html,/暫定成績/); assert.match(html,/許梓奕/); assert.doesNotMatch(html,/最終名次|金牌/);
  const pending=renderCard(unit({official:false,status:'START_LIST',statusLabel:'出賽名單',competitors:[side('TPE','Chinese Taipei','',{winner:true})],sets:[]}));
  assert.match(pending,/—/); assert.doesNotMatch(pending,/勝方|負方|獲勝/);
  assert.doesNotMatch(pending,/>0</);
});

test('Dakar page distinguishes never fetched, pending entries, stale retained records and unconfirmed medals',()=>{
  const html=renderPage(response({coverage:[coverage({fetchedAt:null,stale:true,unconfirmedUnits:3,warning:'此日期尚未取得完整資料。'})],medals:null}));
  assert.match(html,/尚未取得/); assert.match(html,/出賽名單.*待確認/); assert.match(html,/已確認.*TPE/);
  assert.match(html,/獎牌.*尚未確認/); assert.doesNotMatch(html,/沒有 TPE|金牌 0/);
  const stale=renderCard(unit({retained:true}),coverage({stale:true,warning:'官方資料暫時無法更新'}));
  assert.match(stale,/尚未重新確認/); assert.match(stale,/最近成功更新/);
  const zero=renderPage(response({medals:{gold:0,silver:0,bronze:0,entries:[]},medalsStale:false,medalsFetchedAt:'2026-10-30T20:00:00Z'}));
  assert.match(zero,/尚無已確認獎牌/);
});

test('Dakar response validation rejects nested malformed data and external source links',()=>{
  const {isDakarResponse}=display(); assert.equal(typeof isDakarResponse,'function');
  assert.equal(isDakarResponse(response()),true);
  assert.equal(isDakarResponse(response({units:[unit({athletes:null})]})),false);
  assert.equal(isDakarResponse(response({units:[unit({sets:[{label:'Set',scores:null}]})]})),false);
  assert.equal(isDakarResponse(response({units:[unit({sourceUrl:'javascript:alert(1)'})]})),false);
  assert.equal(isDakarResponse(response({coverage:[coverage({fetchedAt:'bad'})]})),false);
  assert.equal(isDakarResponse(response({medals:{gold:-1,silver:0,bronze:0,entries:[]}})),false);
});

function hookHarness({respectAbort=false}={}) {
  const state=[],effects=[],requests=[],timers=new Map(),timeouts=new Map(); let cursor=0,timerId=0;
  const slot=(value)=>{const i=cursor++;if(!(i in state))state[i]=value;return i;};
  const react={useState(initial){const i=slot(typeof initial==='function'?initial():initial);return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useRef(initial){return state[slot({current:initial})];},useCallback:fn=>fn,useEffect(fn,deps){const i=cursor++;const old=state[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){state[i]={deps,setup:fn,cleanup:old?.cleanup};effects.push(()=>{state[i].cleanup?.();state[i].cleanup=fn();});}}};
  const exports=load('src/components/results/useDakarResults.ts',{'react':react,globals:{fetch:(url,options)=>new Promise((resolve,reject)=>{requests.push({url,options,resolve,reject});if(respectAbort)options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});}),window:{setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),setTimeout:(fn,ms)=>{timeouts.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timeouts.delete(id)},document:{visibilityState:'visible'}}});
  assert.equal(typeof exports.useDakarResults,'function');
  const render=()=>{cursor=0;return exports.useDakarResults();};
  const flush=()=>{while(effects.length)effects.shift()();};
  const reply=async(index,data,status=200)=>{requests[index].resolve({ok:status===200,status,json:async()=>data});await new Promise(r=>setImmediate(r));};
  render();flush();
  return {render,flush,requests,reply,timeouts:()=>[...timeouts.values()].map(timer=>timer.ms),expire:async()=>{for(const [id,timer] of timeouts){timeouts.delete(id);timer.fn();}await new Promise(resolve=>setImmediate(resolve));},tick:()=>[...timers.values()].forEach(fn=>fn()),unmount:()=>state.forEach(s=>s?.cleanup?.()),restart:()=>state.forEach(s=>{if(s?.setup){s.cleanup?.();s.cleanup=s.setup();}})};
}

test('Dakar hook loads the public cache, avoids overlapping reads and retains the last success after failure',async()=>{
  const h=hookHarness();assert.equal(h.render().loading,true);h.tick();assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].url,'/dakar2026/data/index.json');assert.equal(h.requests[0].options.credentials,'omit');
  await h.reply(0,response());assert.equal(h.render().data.units[0].id,'BS5-test');
  h.render().refresh();h.flush();h.tick();assert.equal(h.requests.length,2);
  await h.reply(1,{error:'upstream'},500);assert.match(h.render().error,/無法讀取/);assert.equal(h.render().data.units[0].id,'BS5-test');
  h.render().refresh();h.flush();await h.reply(2,{success:true});assert.match(h.render().error,/格式/);assert.equal(h.render().data.units[0].id,'BS5-test');
});

test('Dakar hook unmount aborts its request and ignores a late response',async()=>{
  const h=hookHarness();h.unmount();assert.equal(h.requests[0].options.signal.aborted,true);
  await h.reply(0,response());assert.equal(h.render().data,null);
});

test('Dakar validator requires complete, unique date coverage before reporting availability',()=>{
  const {isDakarResponse}=display();
  assert.equal(isDakarResponse(response({coverage:[]})),false);
  assert.equal(isDakarResponse(response({coverage:Array.from({length:15},()=>coverage())})),false);
});

test('Dakar coverage follows the selected day and excludes unrelated past days for upcoming',()=>{
  const {relevantDakarCoverage}=display();assert.equal(typeof relevantDakarCoverage,'function');
  const rows=[coverage(),coverage({date:'2026-10-31'}),coverage({date:'2026-11-01'})];
  assert.equal(relevantDakarCoverage(rows,{view:'all',date:'2026-10-31',sport:'',search:''},'2026-10-31').length,1);
  assert.equal(relevantDakarCoverage(rows,{view:'upcoming',date:'',sport:'',search:''},'2026-10-31',[]).length,2);
  assert.equal(relevantDakarCoverage(rows,{view:'upcoming',date:'',sport:'',search:''},'2026-10-31',[unit({status:'POSTPONED'})]).length,3);
});

function find(node,predicate) {
  if(!node||typeof node!=='object')return null;
  if(predicate(node))return node;
  return [node.props?.children].flat(Infinity).map(child=>find(child,predicate)).find(Boolean);
}
function pageHarness(data,props={},initialNow='2026-10-30T23:59:30Z') {
  const state=[],effects=[],timers=new Map();let cursor=0,timerId=0,now=initialNow,error=null;
  class ClockDate extends Date { constructor(...args){super(...(args.length?args:[now]));} }
  const react={...React,useId:()=> 'dakar-test',useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useEffect(fn,deps){const i=cursor++;const old=state[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){state[i]={deps,cleanup:old?.cleanup};effects.push(()=>{state[i].cleanup?.();state[i].cleanup=fn();});}}};
  const {DakarResults}=load('src/components/results/DakarResults.tsx',{'react':react,'./useDakarResults':{useDakarResults:()=>({data,loading:!data,error,refresh(){}})},globals:{Date:ClockDate,window:{setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearInterval:id=>timers.delete(id)}}});
  const render=()=>{cursor=0;return DakarResults(props);};
  return {render,html:()=>renderToStaticMarkup(render()),click:label=>find(render(),node=>node.type==='button'&&(node.props['aria-label']===label||node.props.children===label)).props.onClick(),change:(type,value)=>find(render(),node=>node.type===type||node.props.type===type).props.onChange({target:{value}}),mount:()=>{render();while(effects.length)effects.shift()();},tick:()=>[...timers.values()].forEach(timer=>timer.fn()),setNow:value=>{now=value;},setError:value=>{error=value;},intervals:()=>[...timers.values()].map(timer=>timer.ms),unmount:()=>state.forEach(value=>value?.cleanup?.())};
}

test('Dakar page controls change displayed cards and compact mode omits large filters',()=>{
  const data=response({units:[unit(),unit({id:'next',date:'2026-10-31',sportCode:'SWM',sport:'游泳',event:'Women 100m Freestyle',status:'START_LIST',statusLabel:'出賽名單',official:false})]});
  const h=pageHarness(data);assert.doesNotMatch(h.html(),/<h3[^>]*>Women 100m/);
  h.click('全部');assert.match(h.html(),/<h3[^>]*>Women 100m/);
  h.click('日期、運動與選手篩選');
  h.change('select','SWM');assert.doesNotMatch(h.html(),/<h3[^>]*>Mixed Opening/);
  h.click('日期、運動與選手篩選');assert.equal(find(h.render(),node=>node.props['aria-controls']==='dakar-test-filters').props['aria-expanded'],false);assert.match(h.html(),/目前篩選：游泳/);assert.equal(find(h.render(),node=>node.type==='select').props.value,'SWM');
  h.change('search','missing athlete');assert.match(h.html(),/尚無符合條件/);
  h.click('清除篩選與搜尋');h.change('date','2026-10-31');assert.doesNotMatch(h.html(),/<h3[^>]*>Mixed Opening/);
  const compact=pageHarness(data,{compact:true}).html();assert.doesNotMatch(compact,/<input|<select/);assert.match(compact,/最近賽況/);assert.match(compact,/接下來的出賽/);assert.match(compact,/查看完整 TPE/);
});

test('Dakar page exposes loading, failures and a stopped sync without erasing saved results',()=>{
  assert.match(renderPage(null,{loading:true}),/role="status"/);
  const html=renderPage(response({syncEnabled:false}),{error:'讀取失敗'});
  assert.match(html,/role="alert"/);assert.match(html,/保留最近一次/);assert.match(html,/背景同步已停止/);assert.match(html,/Mixed Opening/);
  assert.doesNotMatch(renderPage(response()),/背景同步已停止/);
});


test('Dakar hook Strict Mode restart ignores an older response after a newer generation succeeds',async()=>{
  const h=hookHarness();h.restart();assert.equal(h.requests.length,2);assert.equal(h.requests[0].options.signal.aborted,true);
  await h.reply(1,response({units:[unit({id:'new-snapshot'})]}));assert.equal(h.render().data.units[0].id,'new-snapshot');
  await h.reply(0,response({units:[unit({id:'old-snapshot'})]}));assert.equal(h.render().data.units[0].id,'new-snapshot');
});

test('Dakar latest view prioritizes live entries and sorts completed results newest first without mutating input',()=>{
  const rows=[unit({id:'early'}),unit({id:'newer',date:'2026-10-31',startsAt:'2026-10-31T12:00:00Z'}),unit({id:'live',status:'RUNNING',official:false})];
  const output=display().filterDakarUnits(rows,{view:'latest',date:'',sport:'',search:''},'2026-10-31');
  assert.equal(output.map(row=>row.id).join(','),'live,newer,early');assert.equal(rows.map(row=>row.id).join(','),'early,newer,live');
});


test('Dakar today crosses Dakar midnight even when polling fails, retaining filters and cached next-day units',()=>{
  const data=response({units:[unit(),unit({id:'tomorrow',date:'2026-10-31',startsAt:'2026-10-31T08:00:00Z',sportCode:'SWM',sport:'游泳',event:'Women 100m Freestyle',status:'START_LIST',statusLabel:'出賽名單',official:false})]});
  const h=pageHarness(data);h.mount();
  assert.match(h.html(),/<h3[^>]*>Mixed Opening/);assert.doesNotMatch(h.html(),/<h3[^>]*>Women 100m/);
  h.change('search','許梓奕');h.change('select','SWM');h.setError('讀取失敗');h.setNow('2026-10-31T00:00:30Z');h.tick();
  assert.match(h.html(),/2026-10-31（達卡今日）/);assert.match(h.html(),/<h3[^>]*>Women 100m/);assert.doesNotMatch(h.html(),/<h3[^>]*>Mixed Opening/);
  assert.match(h.html(),/role="alert"/);assert.equal(find(h.render(),n=>n.props.type==='search').props.value,'許梓奕');assert.equal(find(h.render(),n=>n.type==='select').props.value,'SWM');
  h.change('date','2026-10-30');h.setNow('2026-11-01T00:00:30Z');h.tick();assert.equal(find(h.render(),n=>n.props.type==='date').props.value,'2026-10-30');
  assert.deepEqual(h.intervals(),[60_000]);h.unmount();assert.deepEqual(h.intervals(),[]);
});

test('Dakar clock keeps initial rendering deterministic and uses client date only after mount',()=>{
  const h=pageHarness(null,{},'2026-11-01T00:00:30Z');
  assert.equal(find(h.render(),n=>n.props.type==='date').props.value,'');assert.match(h.html(),/正在讀取達卡/);
  h.mount();assert.equal(find(h.render(),n=>n.props.type==='date').props.value,'2026-11-01');
  const cached=pageHarness(response(),{},'2026-11-01T00:00:30Z');assert.equal(find(cached.render(),n=>n.props.type==='date').props.value,'2026-10-30');
  cached.mount();assert.equal(find(cached.render(),n=>n.props.type==='date').props.value,'2026-11-01');
});


test('Dakar hung cache request times out, preserves saved results and permits a successful manual retry',async()=>{
  const h=hookHarness({respectAbort:true});await h.reply(0,response());assert.deepEqual(h.timeouts(),[]);
  h.render().refresh();assert.deepEqual(h.timeouts(),[20_000]);assert.equal(h.render().loading,true);
  await h.expire();assert.equal(h.requests[1].options.signal.aborted,true);assert.equal(h.render().loading,false);assert.match(h.render().error,/逾時.*重試/);assert.equal(h.render().data.units[0].id,'BS5-test');
  h.render().refresh();assert.equal(h.requests.length,3);await h.reply(2,response({units:[unit({id:'retry-success'})]}));assert.equal(h.render().error,null);assert.equal(h.render().data.units[0].id,'retry-success');assert.deepEqual(h.timeouts(),[]);
  h.render().refresh();assert.equal(h.timeouts().length,1);h.unmount();assert.deepEqual(h.timeouts(),[]);
});

test('Static snapshots become stale even when no new deployment or successful poll occurs',()=>{
  const {withDakarFreshness}=display();
  const saved=response({medals:{gold:0,silver:0,bronze:0,entries:[]},medalsFetchedAt:'2026-10-30T20:00:00Z',medalsStale:false});
  const aged=withDakarFreshness(saved,new Date('2026-10-30T22:01:00Z'));
  assert.equal(aged.coverage[0].stale,true);assert.equal(aged.medalsStale,true);
  assert.equal(saved.coverage[0].stale,false,'must not mutate the cached snapshot');
  assert.equal(withDakarFreshness(saved,new Date('2026-12-01')).syncEnabled,false);
});

test('Hourly UI accepts a previously published 15-minute snapshot during deployment transition',()=>{
  const {isDakarResponse}=display();assert.equal(isDakarResponse(response({syncIntervalMinutes:15})),true);assert.equal(isDakarResponse(response()),true);assert.equal(isDakarResponse(response({syncIntervalMinutes:'60'})),false);
});
