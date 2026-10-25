// Served dist; real modules and UI. Synthetic isolated profile. No HTTP/module replacement.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';
import {makeEmptyRelease} from '../../src/storage.js';
export async function run(){
 const out=process.env.DIAMOND_EVIDENCE_DIR??'/tmp/diamond-browser';await mkdir(out,{recursive:true});
 const profile=await mkdtemp(join(tmpdir(),'diamond-profile-')),origin=process.env.SS_ORIGIN??'http://127.0.0.1:5174';
 const report={origin,clock:FIXED_CLOCK,instrumentation:'CDP breakpoint at main.js:13 observes the actual module-local app after construction. Native Storage prototype methods delegate unchanged except named injected faults. Playwright controls the clock. No second controller, module, response or callback-result replacement.',cases:[],errors:[],console:[]};
 let context;
 async function launch(){
 context=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:1280,height:900}});
 await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.console.push(m.text())});
 const cdp=await context.newCDPSession(page);await cdp.send('Debugger.enable');
 await cdp.send('Debugger.setBreakpointByUrl',{url:origin+'/src/main.js',lineNumber:12});
 cdp.on('Debugger.paused',async({callFrames})=>{await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:callFrames[0].callFrameId,expression:'globalThis.diamondApp=app'});await cdp.send('Debugger.resume')});
 await page.clock.install({time:new Date('2026-11-02T02:30:00Z')});await page.goto(origin);return page;
 }
 async function bootstrap(page){await page.evaluate(()=>{
 if(!window.diamondApp)throw Error('Native main controller not observed');
 window.reads=0;window.writes=0;window.fault=null;
 window.nativeGet=Storage.prototype.getItem;window.nativeSet=Storage.prototype.setItem;
 Storage.prototype.getItem=function(k){window.reads++;if(window.fault==='read')throw Object.assign(Error('STALE'),{code:'PERSISTED_CONFLICT'});return nativeGet.call(this,k)};
 Storage.prototype.setItem=function(k,v){window.writes++;if(window.fault==='write')throw Object.assign(Error('STALE quota'),{code:'PERSISTED_CONFLICT'});return nativeSet.call(this,k,v)};
 });}
 async function record(page,id,fn){const before=await page.evaluate(()=>({state:diamondApp.getState(),bytes:nativeGet.call(localStorage,'semesterspace.v1'),reads,writes}));await fn();const after=await page.evaluate(()=>({state:diamondApp.getState(),bytes:nativeGet.call(localStorage,'semesterspace.v1'),reads,writes,focus:document.activeElement?.dataset.uiKey}));after.body=await page.locator('body').innerText();report.cases.push({id,before,after});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));return after}
 try {
 let page=await launch();
 const model=makeCombinedModel();model.events=[{id:'A',title:'Source exam',cancelled:false,sessionId:null,date:'2026-11-03',start:'16:00',end:'17:00'}];
 const release=makeEmptyRelease(model);release.calendar.sourceRevision={version:1,sha256:'a'.repeat(64),fileName:'source.pdf',source:{sha256:'a'.repeat(64),fileName:'source.pdf'},scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:null,programmingGroup:null},links:[{sourceRef:'r',changeId:'r',kind:'UPSERT_EVENT',targetId:'A',value:model.events[0],evidence:{sourceId:'s',page:1,excerpt:'Exam',basis:'DIRECT_SOURCE'},sourceSha256:'a'.repeat(64)}],sourceHistory:[]};
 await page.evaluate(e=>localStorage.setItem('semesterspace.v1',JSON.stringify(e)),{schemaVersion:2,model,release});await page.reload();await bootstrap(page);
 await page.getByRole('button',{name:'Setup & history',exact:true}).click();await page.locator('details').evaluateAll(rows=>rows.forEach(e=>e.open=true));
 await page.getByLabel('Event title',{exact:true}).fill('Local B');await page.getByLabel('Independent event date',{exact:true}).fill('2026-11-03');
 let a=await record(page,'UI-CREATE',()=>page.getByRole('button',{name:'Add compulsory event',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'COMMITTED');const id=a.state.model.events.find(e=>e.title==='Local B').id;
 await page.locator('[data-ui-key="choose-event::id"]').selectOption(id);await page.getByLabel('Event title',{exact:true}).fill('B updated');a=await record(page,'UI-UPDATE',()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'COMMITTED');
 a=await record(page,'UI-NO_CHANGE',()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'NO_CHANGE');assert.equal(a.reads,report.cases.at(-1).before.reads);
 // Actual UI cancellation, conversion and future relink under the witness.
 for(const step of ['cancel','link-s2','relink-s1','independent']) {
  if(step==='cancel')await page.getByLabel('Cancel this event',{exact:true}).check();
  else if(step==='independent'){
   await page.locator(`[data-ui-key="event:${id}::linked"]`).selectOption('');
   await page.getByLabel('Independent event date',{exact:true}).fill('2026-11-03');
   await page.getByLabel('Independent event start',{exact:true}).fill('14:00');await page.getByLabel('Independent event end',{exact:true}).fill('15:00');
  }else await page.locator(`[data-ui-key="event:${id}::linked"]`).selectOption(step==='link-s2'?'s2':'s1');
  a=await record(page,'UI-'+step,()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'COMMITTED');
 }
 // Dirty draft survives a real unrelated accepted change and does not rebind base.
 await page.getByLabel('Event title',{exact:true}).fill('Dirty B');await page.getByLabel('Event title',{exact:true}).focus();
 await page.evaluate(()=>diamondApp.callbacks.onSetPreferences({...diamondApp.getState().model.preferences,notes:'unrelated'}));
 assert.equal(await page.getByLabel('Event title',{exact:true}).inputValue(),'Dirty B');
 a=await record(page,'UI-DIRTY-BASE',()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'STALE_REVISION');assert.equal(await page.getByLabel('Event title',{exact:true}).inputValue(),'Dirty B');
 await page.getByRole('button',{name:'Discard event draft and review current data',exact:true}).click();
 await page.locator('[data-ui-key="choose-event::id"]').selectOption('A');await page.getByLabel('Event title',{exact:true}).fill('Blocked A');a=await record(page,'UI-SOURCE',()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'SOURCE_CHANGE_BLOCKED');
 // Native close/reopen with same profile/origin, no seed after this point.
 const saved=await page.evaluate(()=>localStorage.getItem('semesterspace.v1'));await context.tracing.stop({path:join(out,'first.trace.zip')});await context.close();page=await launch();
 assert.equal(await page.evaluate(()=>localStorage.getItem('semesterspace.v1')),saved);await bootstrap(page);report.nativeReopen={equalBytes:true,noReseed:true};
 await page.getByRole('button',{name:'Setup & history',exact:true}).click();await page.locator('details').evaluateAll(rows=>rows.forEach(e=>e.open=true));await page.locator('[data-ui-key="choose-event::id"]').selectOption(id);await page.getByLabel('Event title',{exact:true}).fill('After reopen');a=await record(page,'UI-REOPEN-WITNESS',()=>page.getByRole('button',{name:'Save event changes',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'SOURCE_REVIEW_REQUIRED');
 // New UI draft for native read/write/serializer faults, stable identity until success.
 await page.locator('[data-ui-key="choose-event::id"]').selectOption('new');await page.getByLabel('Event title',{exact:true}).fill('Fault draft');await page.getByLabel('Independent event date',{exact:true}).fill('2026-11-03');
 for(const fault of ['read','write','serialize']) {
 await page.evaluate(f=>{window.fault=f;if(f==='serialize'){window.originalStringify=JSON.stringify;JSON.stringify=(v,...args)=>v?.schemaVersion===2&&v.model?'{}':originalStringify(v,...args)}},fault);
 a=await record(page,'UI-FAULT-'+fault,()=>page.getByRole('button',{name:'Add compulsory event',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'PERSISTENCE_FAILED');assert.equal(a.bytes,report.cases.at(-1).before.bytes);assert.equal(await page.getByLabel('Event title',{exact:true}).inputValue(),'Fault draft');
 await page.evaluate(()=>{window.fault=null;if(window.originalStringify){JSON.stringify=originalStringify;delete window.originalStringify}});
 }
 a=await record(page,'UI-FAULT-RECOVERY',()=>page.getByRole('button',{name:'Add compulsory event',exact:true}).click());assert.equal(a.state.eventCommandResult.code,'COMMITTED');
 await page.setViewportSize({width:320,height:800});await page.screenshot({path:join(out,'mobile.png'),fullPage:true});report.mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 await page.getByLabel('Event title',{exact:true}).focus();await page.keyboard.press('Tab');report.keyboardFocus=await page.evaluate(()=>document.activeElement?.dataset.uiKey);
 // Boundary tests use actual callback, not a fabricated result.
 for(const [name,overrides,code] of [['history',{event:{id:'history',title:'Past',cancelled:false,sessionId:null,date:'2026-11-01',start:'14:00',end:'15:00'}},'HISTORY_PROTECTED'],['unsupported',{operation:'DELETE'},'VALIDATION_REJECTED'],['stale',{expectedModelRevision:0},'STALE_REVISION']]) {
 const result=await page.evaluate(overrides=>{const s=diamondApp.getState();return diamondApp.callbacks.onUpsertEvent({requestVersion:1,mode:s.mode,expectedModelId:s.model.id,expectedModelRevision:s.model.revision,operation:'CREATE',targetEventId:null,event:{id:'new',title:'New',cancelled:false,sessionId:null,date:'2026-11-03',start:'14:00',end:'15:00'},...overrides})},overrides);assert.equal(result.code,code);report.cases.push({id:'boundary-'+name,result});
 }
 await page.clock.setSystemTime(new Date('2026-11-02T02:29:00Z'));const clockResult=await page.evaluate(()=>{const s=diamondApp.getState();return diamondApp.callbacks.onUpsertEvent({requestVersion:1,mode:s.mode,expectedModelId:s.model.id,expectedModelRevision:s.model.revision,operation:'UPDATE',targetEventId:s.model.events[0].id,event:s.model.events[0]})});assert.equal(clockResult.code,'CLOCK_CONFLICT');report.cases.push({id:'boundary-clock',result:clockResult});
 await context.tracing.stop({path:join(out,'second.trace.zip')});assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.failure=e.stack;throw e}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));if(context)await context.close()}
 console.log(JSON.stringify({complete:report.complete,cases:report.cases.map(c=>c.id),nativeReopen:report.nativeReopen,mobile:report.mobile,errors:report.errors}));
}
if(process.argv.includes('--run'))await run();
