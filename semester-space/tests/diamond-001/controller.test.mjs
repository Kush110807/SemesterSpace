import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../../src/controller.js';
import * as engine from '../../src/engine/index.js';
import * as attendance from '../../src/attendance/ledger.js';
import * as revision from '../../src/import/revision.js';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';
import {makeEmptyRelease} from '../../src/storage.js';
const clone=structuredClone;
function fixture(){const m=makeCombinedModel();m.events=[];return {schemaVersion:2,model:m,release:makeEmptyRelease(m)}}
function enriched(e,kind='UPSERT_EVENT',targetId='A') {
 e.release.calendar.sourceRevision={version:1,sha256:'a'.repeat(64),fileName:'source.pdf',source:{sha256:'a'.repeat(64),fileName:'source.pdf'},scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:null,programmingGroup:null},links:[{sourceRef:'r',changeId:'r',kind,targetId,value:null,evidence:{sourceId:'source',page:1,excerpt:'Exam',basis:'DIRECT_SOURCE'},sourceSha256:'a'.repeat(64)}],sourceHistory:[]};return e;
}
const event=(id='B',changes={})=>({id,title:'Local event',cancelled:false,sessionId:null,date:'2026-11-03',start:'14:00',end:'15:00',...changes});
function harness(e=fixture(),engineInput=engine,initialClock=FIXED_CLOCK) {
 let raw=JSON.stringify(e),reads=0,writes=0,c=clone(initialClock),readFault=false,writeFault=false;
 const storage={getItem(){reads++;if(readFault)throw Object.assign(Error('STALE'),{code:'PERSISTED_CONFLICT'});return raw},setItem(k,v){writes++;if(writeFault)throw Object.assign(Error('STALE'),{code:'PERSISTED_CONFLICT'});raw=v}};
 const open=()=>createController({engine:engineInput,attendance,revision,storage,clock:()=>clone(c),render(){}});
 const app=open();
 return {app,open,storage,get raw(){return raw},set raw(v){raw=v},set clock(v){c=v},get reads(){return reads},get writes(){return writes},fault(read,write){readFault=read;writeFault=write}};
}
function command(h,e,operation='CREATE',extra={}){let s=h.app.getState();return {requestVersion:1,mode:s.mode,expectedModelId:s.model.id,expectedModelRevision:s.model.revision,operation,targetEventId:operation==='CREATE'?null:e.id,event:e,...extra}}
function act(h,id,request,expected,reason) {
 const before=h.app.getState(),bytes=h.raw,reads=h.reads,writes=h.writes;
 const response=h.app.callbacks.onUpsertEvent(request),after=h.app.getState();
 assert.equal(response.code,expected,JSON.stringify(response));if(reason)assert.equal(response.reason,reason);
 if(!['COMMITTED','DEMO_APPLIED'].includes(expected)) {
  for(const k of ['model','release','batch','manualDates','stagedCalendarRevision'])assert.deepEqual(after[k],before[k],k);
  assert.equal(h.raw,bytes);
  assert.equal(h.writes-writes,request._writeFault?1:0);
  if(expected==='NO_CHANGE')assert.equal(h.reads,reads);
 }else {
  assert.equal(after.model.revision,before.model.revision+1);assert.deepEqual(after.release,before.release);
  const stripped=clone(after.model);stripped.revision=before.model.revision;stripped.events=clone(before.model.events);assert.deepEqual(stripped,before.model);
  assert.equal(h.writes-writes,expected==='COMMITTED'?1:0);
 }
 console.log(JSON.stringify({case:id,response,reads:h.reads-reads,writes:h.writes-writes,before,after,bytesBefore:bytes,bytesAfter:h.raw}));return response;
}
const create=(h,id='B',changes={})=>act(h,'setup-CREATE',command(h,event(id,changes)),'COMMITTED');
const update=(h,id='B',changes={})=>command(h,{...h.app.getState().model.events.find(e=>e.id===id),...changes},'UPDATE');
test('B1-M1 mixed resolvable, local CREATE/update; source binding wins',()=>{
 let e=fixture();e.model.events.push(event('A'));enriched(e);const h=harness(e);
 create(h);act(h,'B1-M1 local',update(h,'B',{title:'Changed'}),'COMMITTED');act(h,'B1-M1 source',update(h,'A',{cancelled:true}),'SOURCE_CHANGE_BLOCKED');
});
test('B1-M2 reopen expires; B1-M3 loaded labels and request flags cannot prove entry',()=>{
 const h=harness();create(h);const reopened=h.open();h.app=reopened;
 act(h,'B1-M2',update(h,'B',{title:'Changed'}),'SOURCE_REVIEW_REQUIRED','LOCAL_ORIGIN_UNPROVEN');
 act(h,'B1-M3',update(h,'B',{title:'Changed',origin:'local'}),'VALIDATION_REJECTED');
});
for(const mode of ['legacy','import','dangling','lost-marker-bound','lost-all-traces','retained-cancelled'])test('B1-M4–M8 '+mode,()=>{
 let e=fixture();e.model.events.push(event('A',{cancelled:mode==='retained-cancelled'}));
 if(mode==='legacy')e.release.calendar.sourceRevision={sha256:'A'.repeat(64),fileName:'old.pdf'};
 if(mode==='import')e.model.context.sourceLabel='Document import (manual calendar coverage): old.pdf';
 if(['dangling','lost-marker-bound','retained-cancelled'].includes(mode))enriched(e,'UPSERT_EVENT',mode==='dangling'?'missing':'A');
 const h=harness(e);create(h);
 const bound=['lost-marker-bound','retained-cancelled'].includes(mode),unknown=mode==='lost-all-traces';
 act(h,mode,update(h,'A',{title:'Changed'}),bound?'SOURCE_CHANGE_BLOCKED':'SOURCE_REVIEW_REQUIRED',bound?undefined:unknown?'LOCAL_ORIGIN_UNPROVEN':'DATASET_SOURCE_RESTRICTION');
 if(!bound&&!unknown)act(h,mode+' witnessed-B',update(h,'B',{title:'Changed'}),'SOURCE_REVIEW_REQUIRED','DATASET_SOURCE_RESTRICTION');
 act(h,mode+' no-op',update(h,'A',{}),'NO_CHANGE');
});
test('B1-M9 future independent/linked conversions, relink and started control',()=>{
 const h=harness();create(h);
 for(const changes of [{title:'New'}, {cancelled:true},{sessionId:'s2',date:null,start:null,end:null},{sessionId:'s1'}, {sessionId:null,date:'2026-11-03',start:'12:00',end:'13:00'}])act(h,'B1-M9',update(h,'B',changes),'COMMITTED');
 act(h,'B1-M9 to s1',update(h,'B',{sessionId:'s1',date:null,start:null,end:null}),'COMMITTED');
 h.clock={...FIXED_CLOCK,time:'09:00'};act(h,'B1-M9 started',update(h,'B',{title:'Blocked'}),'HISTORY_PROTECTED');
});
test('B1-M10 stale before equality; equality ignores key order and preserves batch/stage',()=>{
 const h=harness();create(h);h.app.callbacks.onSetManualDates({dates:['2026-11-03']});h.app.callbacks.onCheckManual();
 let req=update(h);req.event=Object.fromEntries(Object.entries(req.event).reverse());act(h,'B1-M10 exact',req,'NO_CHANGE');
 act(h,'B1-M10 stale',{...req,expectedModelRevision:0},'STALE_REVISION');
 act(h,'B1-M10 extra',{...req,event:{...req.event,reason:'x'}},'VALIDATION_REJECTED');
});
test('B1-M11 failed CREATE, unrelated mutation and context switch',()=>{
 const h=harness();h.fault(false,true);const before=h.app.getState();let result=h.app.callbacks.onUpsertEvent(command(h,event()));assert.equal(result.code,'PERSISTENCE_FAILED');assert.deepEqual(h.app.getState().model,before.model);h.fault(false,false);
 create(h);h.app.callbacks.onSetPreferences({...h.app.getState().model.preferences,notes:'unrelated'});
 act(h,'B1-M11 unrelated',update(h,'B',{title:'x'}),'SOURCE_REVIEW_REQUIRED');
 const h2=harness();create(h2);h2.app.callbacks.onEnterDemo();h2.app.callbacks.onExitDemo();act(h2,'B1-M11 mode',update(h2,'B',{title:'x'}),'SOURCE_REVIEW_REQUIRED');
});
test('B1-M12 source binding after local entry invalidates witness',()=>{
 const h=harness();create(h);
 // Legitimate retained API route is separately known source-authorization-unsafe.
 const m=h.app.getState().model,old=m.events.find(e=>e.id==='B');
 const p={proposalVersion:1,proposalId:'p',baseModelRevision:m.revision,unresolved:[],source:{sha256:'a'.repeat(64),fileName:'source.pdf',role:'ACADEMIC_CALENDAR',coverage:'SUPPORTED',section:'Q',pageRefs:[]},scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:null,programmingGroup:null},changes:[{changeId:'c',kind:'UPSERT_EVENT',match:'REVIEWED_CROSSWALK',before:old,after:{...old,title:'source change'},evidence:{sourceId:'s',page:1,excerpt:'change',basis:'REVIEWED_OFFICIAL_CORRECTION'},affectsConfirmedHistory:false}]};
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:m.revision,proposal:p}).ok,true);
 assert.equal(h.app.callbacks.onApplyCalendarRevision({confirmation:true,confirmedSourceCoverage:true,expectedModelRevision:m.revision,proposalId:'p',acceptedChangeIds:['c']}).ok,true);
 act(h,'B1-M12',update(h,'B',{title:'attempt'}),'SOURCE_CHANGE_BLOCKED');
});
for(const [name,changes] of [['snapshot',{date:'2026-11-01'}],['past',{date:'2026-11-01'}],['exact',{date:'2026-11-02',start:'08:00'}],['earlier',{date:'2026-11-02',start:'07:30'}]])test('H1 historical CREATE '+name,()=>{let h=harness();act(h,name,command(h,event('B',changes)),'HISTORY_PROTECTED')});
test('H1 old/new sides, cancelled historical, fresh historical equality',()=>{
 const e=fixture();e.model.events.push(event('A',{date:'2026-11-01',cancelled:true}));const h=harness(e);
 act(h,'H1 old',update(h,'A',{date:'2026-11-03'}),'HISTORY_PROTECTED');act(h,'H1 no-op',update(h,'A'),'NO_CHANGE');create(h);
 act(h,'H1 new',update(h,'B',{date:'2026-11-01'}),'HISTORY_PROTECTED');
});
test('H2 invalid canonical references and seven-field unions',()=>{
 const h=harness();create(h);
 for(const changes of [{sessionId:'missing',date:null,start:null,end:null},{sessionId:'s1'},{date:'2026-02-30'},{start:'24:00'},{id:'new'}])act(h,'H2 invalid',update(h,'B',changes),'VALIDATION_REJECTED');
});
test('H3 strict operation and scalar profile; retry; fresh equality',()=>{
 const h=harness();const req=command(h,event());
 for(const bad of [{event:event()},{...req,operation:'DELETE'},{...req,operation:'REMOVE'},{...req,event:null},{...req,before:{}},{...req,clock:FIXED_CLOCK},{...req,reason:'override'},{...req,ownership:true}])act(h,'H3 strict',bad,'VALIDATION_REJECTED');
 act(h,'H3 commit',req,'COMMITTED');act(h,'H3 retry',req,'STALE_REVISION');act(h,'H3 fresh equality',update(h),'NO_CHANGE');act(h,'H3 duplicate',command(h,event()),'VALIDATION_REJECTED');
});
test('H3 clock conflict beats no-op but stale beats clock',()=>{
 const e=fixture();e.model.events.push(event('A'));const h=harness(e);h.clock={...FIXED_CLOCK,date:'2026-10-31'};
 act(h,'H3 clock',update(h,'A'),'CLOCK_CONFLICT');act(h,'H3 stale',update(h,'A',{}),'CLOCK_CONFLICT');
 act(h,'H3 stale-first',{...update(h,'A'),expectedModelRevision:7},'STALE_REVISION');
});
test('IO typed read/quota/serializer failures preserve state; conflict; demo',()=>{
 for(const fault of ['read','write','serialize']){
 const h=harness();create(h);const before=h.app.getState(),bytes=h.raw,writes=h.writes,native=JSON.stringify;
 h.fault(fault==='read',fault==='write');let response;
 try {if(fault==='serialize')JSON.stringify=(v,...args)=>v?.schemaVersion===2&&v.model?'{}':native(v,...args);response=h.app.callbacks.onUpsertEvent(update(h,'B',{title:'x'}));}finally{JSON.stringify=native}
 assert.equal(response.code,'PERSISTENCE_FAILED');assert.deepEqual(h.app.getState().model,before.model);assert.deepEqual(h.app.getState().release,before.release);assert.equal(h.raw,bytes);assert.equal(h.writes-writes,fault==='write'?1:0);console.log(JSON.stringify({case:'IO-'+fault,response,before,after:h.app.getState(),bytes}));
 }
 const h=harness();create(h);const disk=JSON.parse(h.raw);disk.model.revision+=1;h.raw=JSON.stringify(disk);act(h,'IO external',update(h,'B',{title:'x'}),'STALE_REVISION');
 const personal=h.raw;h.app.callbacks.onEnterDemo();act(h,'IO demo',command(h,event('demo')),'DEMO_APPLIED');assert.equal(h.raw,personal);
});
test('H3 full retained attendance original/correction and day-close clock registry',()=>{
 const h=harness();h.clock={...FIXED_CLOCK,time:'10:00'};
 const req={expectedModelRevision:0,dayKey:'day1',date:'2026-11-02',marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'ATTENDED',note:''}],confirmCompleteDay:true,confirmNoUnlistedMeetings:true};
 assert.equal(h.app.callbacks.onConfirmAttendanceDay(req).ok,true);
 h.clock={...FIXED_CLOCK,time:'11:00'};
 assert.equal(h.app.callbacks.onConfirmAttendanceDay({...req,expectedModelRevision:1,dayKey:'day2',correctionOfDayKey:'day1',marks:[{...req.marks[0],disposition:'MISSED'}]}).ok,true);
 h.clock={...FIXED_CLOCK,time:'09:00'};
 const r=act(h,'H3 attendance clocks',command(h,event()),'CLOCK_CONFLICT');
 for(const path of ['release.attendance.records[0].confirmedAt','release.attendance.records[1].confirmedAt','release.attendance.closedDays[0].confirmedAt','release.attendance.closedDays[1].confirmedAt'])assert.ok(r.offending.some(x=>x.path===path));
});
test('H3 applied revision older/latest, equal clock and untrusted dates',()=>{
 const e=fixture();e.release.calendar.appliedRevisions=[{proposalId:'old',sourceSha256:'a'.repeat(64),appliedAt:{...FIXED_CLOCK,time:'09:00'},modelRevision:0,changeIds:['a']},{proposalId:'new',sourceSha256:'b'.repeat(64),appliedAt:{...FIXED_CLOCK,time:'08:00'},modelRevision:0,changeIds:['b']}];
 const h=harness(e);let r=act(h,'H3 calendar',command(h,event()),'CLOCK_CONFLICT');assert.ok(r.offending.some(x=>x.path==='release.calendar.appliedRevisions[0].appliedAt'));
 h.clock={...FIXED_CLOCK,time:'09:00'};create(h);
 const e2=fixture();e2.model.context.sourceLabel='2039-12-31 quoted filename';e2.model.context.preparedOn='2039-12-31';const h2=harness(e2);create(h2);
});
test('H3 decision observation rollback blocks acceptance and preserves batch',()=>{
 const h=harness();h.app.callbacks.onSuggest();const before=h.app.getState();assert.ok(before.batch);
 h.clock={...FIXED_CLOCK,time:'07:59'};
 act(h,'H3 decision',command(h,event()),'CLOCK_CONFLICT');h.app.callbacks.onAccept({dates:[before.batch.dates[0]],modelRevision:0});assert.deepEqual(h.app.getState().batch,before.batch);assert.equal(h.writes,0);
});
test('H2 cancelled canonical session and recorded identity protect both sides',()=>{
 const e=fixture();e.model.sessions[0].cancelled=true;const h=harness(e);create(h,'B',{sessionId:'s1',date:null,start:null,end:null});
 h.clock={...FIXED_CLOCK,time:'09:00'};act(h,'H2 cancelled session',update(h,'B',{sessionId:'s2'}),'HISTORY_PROTECTED');
});
test('B1-M7 valid REMOVE_HOLIDAY absence does not restrict witnessed B',()=>{
 const e=enriched(fixture(),'REMOVE_HOLIDAY','2026-11-03');const h=harness(e);create(h);act(h,'B1 removal absence',update(h,'B',{title:'eligible'}),'COMMITTED');
});
for(const date of ['2026-11-01','2026-11-02'])for(const start of date==='2026-11-01'?['09:00']:['07:30','08:00'])for(const cancelled of [false,true])for(const mutation of [{title:'changed'},{cancelled:!cancelled},{date:'2026-11-03'}])test(`ADV-H1 old ${date} ${start} ${cancelled} ${JSON.stringify(mutation)}`,()=>{
 const e=fixture();e.model.events=[event('A',{date,start,cancelled})];const h=harness(e);act(h,'ADV-H1-old',update(h,'A',mutation),'HISTORY_PROTECTED');
});
for(const changes of [{date:'2026-11-01'},{date:'2026-11-02',start:'08:00'}])test('ADV-H1 future to protected '+JSON.stringify(changes),()=>{const h=harness();create(h);act(h,'ADV-H1-new',update(h,'B',changes),'HISTORY_PROTECTED')});
test('ADV-H1 exact start minus one minute and after',()=>{const h=harness();create(h,'B',{date:'2026-11-02',start:'08:01',end:'09:00'});act(h,'before-start',update(h,'B',{title:'before'}),'COMMITTED');h.clock={...FIXED_CLOCK,time:'08:01'};act(h,'exact-start',update(h,'B',{title:'at'}),'HISTORY_PROTECTED');h.clock={...FIXED_CLOCK,time:'08:02'};act(h,'after-start',update(h,'B',{cancelled:true}),'HISTORY_PROTECTED')});
test('UI-T1-06 valid stage survives no-op/reject and mutation revokes it',()=>{
 const h=harness();create(h);h.app.callbacks.onSuggest();
 const s=h.app.getState(),proposal={proposalVersion:1,proposalId:'stage',baseModelRevision:s.model.revision,unresolved:[],changes:[],source:{sha256:'a'.repeat(64)}};
 assert.ok(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:s.model.revision,proposal}).ok);
 act(h,'UI-T1-06-noop',update(h),'NO_CHANGE');act(h,'UI-T1-06-reject',{...update(h),operation:'REMOVE'},'VALIDATION_REJECTED');
 act(h,'UI-T1-06-mutate',update(h,'B',{title:'accepted'}),'COMMITTED');assert.equal(h.app.getState().stagedCalendarRevision,null);assert.equal(h.app.getState().batch,null);
});
test('REG-13 new event retains and invalidates committed break',()=>{
 const h=harness();h.app.callbacks.onSuggest();const s=h.app.getState();assert.ok(s.batch.dates.includes('2026-11-03'));h.app.callbacks.onAccept({dates:['2026-11-03'],modelRevision:0});const before=h.app.getState();assert.equal(before.model.commitments.length,1);
 const r=act(h,'REG-13',command(h,event()),'COMMITTED');assert.equal(r.engineStatus,'PLAN_BLOCKED');assert.deepEqual(h.app.getState().model.commitments,before.model.commitments);
});
test('ADV-H1-03 startup quarantine is unchanged, not repaired',()=>{
 const h=harness();h.clock={...FIXED_CLOCK,date:'2026-10-31'};assert.equal(h.open().getState().persistence.status,'QUARANTINED');
});
for(const label of ['inactive','superseded'])test('B1-M8 retained '+label+' never sheds binding',()=>{
 const e=fixture();e.model.events.push(event('A',{cancelled:true}));enriched(e);e.release.calendar.sourceRevision.links[0][label]=true;const h=harness(e);
 act(h,'B1-M8 '+label,update(h,'A',{sessionId:'s2',date:null,start:null,end:null}),'SOURCE_CHANGE_BLOCKED');act(h,'B1-M8 '+label+' equality',update(h,'A'),'NO_CHANGE');
});
test('B1-M12 exact tracked-value mismatch cannot use witness',()=>{
 let disturb=false;
 const wrapped={...engine,evaluatePlan(m,req){const result=engine.evaluatePlan(m,req);if(disturb){m.events.find(e=>e.id==='B').title='unexpected external in-memory change';disturb=false;}return result}};
 const h=harness(fixture(),wrapped);create(h);disturb=true;h.app.callbacks.onRefresh();
 act(h,'B1-M12 mismatched value',update(h,'B',{title:'overwrite'}),'SOURCE_REVIEW_REQUIRED','LOCAL_ORIGIN_UNPROVEN');
});
test('H3 rollback hold requires explicit revalidation after clock catches up',()=>{
 const h=harness();h.app.callbacks.onSuggest();const before=h.app.getState();h.clock={...FIXED_CLOCK,time:'07:59'};act(h,'clock hold',command(h,event()),'CLOCK_CONFLICT');assert.ok(h.app.getState().clockConflict);
 h.clock=clone(FIXED_CLOCK);h.app.callbacks.onRefresh();assert.ok(h.app.getState().clockConflict);h.app.callbacks.onAccept({dates:[before.batch.dates[0]],modelRevision:0});assert.equal(h.writes,0);
 h.app.callbacks.onRefresh({explicit:true});assert.equal(h.app.getState().clockConflict,null);
});
test('H3 old official confirmation later than captured command, including nonlatest snapshot',()=>{
 const e=fixture();e.model.snapshots[0].confirmedAt={...FIXED_CLOCK,time:'09:00'};const h=harness(e,engine,{...FIXED_CLOCK,time:'10:00'});assert.ok(h.app.getState().model);
 const req={expectedModelRevision:0,dayKey:'day',date:'2026-11-02',marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'ATTENDED',note:''}],confirmCompleteDay:true,confirmNoUnlistedMeetings:true};assert.ok(h.app.callbacks.onConfirmAttendanceDay(req).ok);
 h.clock=clone(FIXED_CLOCK);const r=act(h,'H3 older official clock',command(h,event()),'CLOCK_CONFLICT');assert.ok(r.offending.some(x=>x.path==='model.snapshots[0].confirmedAt'));
});
test('IO engine exception before save rejects without phantom acceptance',()=>{
 const wrapped={...engine,evaluatePlan(m,req){if(m.revision>0)throw Object.assign(Error('STALE'),{code:'PERSISTED_CONFLICT'});return engine.evaluatePlan(m,req)}};
 const h=harness(fixture(),wrapped);act(h,'IO engine',command(h,event()),'VALIDATION_REJECTED');
});
test('H3 ordinary command accessors are rejected without invoking them',()=>{
 const h=harness();let calls=0;const req=command(h,event());Object.defineProperty(req.event,'title',{enumerable:true,get(){calls++;return 'fake'}});act(h,'H3 event accessor',req,'VALIDATION_REJECTED');assert.equal(calls,0);
});
