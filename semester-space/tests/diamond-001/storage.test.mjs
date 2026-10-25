import test from 'node:test';
import assert from 'node:assert/strict';
import {saveModel,makeEmptyRelease} from '../../src/storage.js';
import {makeCombinedModel} from '../../src/shared/fixtures.js';
const clone=structuredClone,native=JSON.stringify;
const fixture=()=>{const model=makeCombinedModel();return {schemaVersion:2,model,release:makeEmptyRelease(model)}};
const existing={expectedRevision:0,expectedModelId:makeCombinedModel().id},empty={expectedRevision:null};
function run(id,{stored=fixture(),options=existing,change=()=>{},candidate=fixture(),readError=false,writeError=false,serializer=null}={},code,reason) {
 stored=structuredClone(stored);
 test(id,()=>{
  let raw=stored===null?null:typeof stored==='string'?stored:native(stored),reads=0,writes=0,hooks=0;
  const before=raw;change(candidate,()=>hooks++);
  const storage={getItem(){reads++;if(readError)throw Object.assign(Error('STALE'),{code:'PERSISTED_CONFLICT'});return raw},setItem(k,v){writes++;if(writeError)throw Object.assign(Error('STALE quota'),{code:'PERSISTED_CONFLICT'});raw=v}};
  let result;
  try{if(serializer)JSON.stringify=(v,...args)=>v?.schemaVersion===2&&v?.model?serializer(v):native(v,...args);result=saveModel(storage,candidate.model,candidate.release,options)}finally{JSON.stringify=native}
  assert.equal(result.code,code,native(result));if(reason)assert.equal(result.reason,reason);
  assert.equal(hooks,0);assert.equal(reads,id==='S26'?0:1);
  assert.equal(writes,code==='SAVE_OK'||code==='STORAGE_WRITE_FAILED'?1:0);
  if(code!=='SAVE_OK')assert.equal(raw,before);
  else assert.deepEqual(JSON.parse(raw),candidate);
  console.log(native({case:id,result,reads,writes,hooks,before,after:raw}));
 });
}
run('S01',{stored:'{' ,options:empty},'PERSISTED_DATA_INVALID');
for(const id of ['S02','S03']){let e=fixture();if(id==='S02')e.model.id='different';run(id,{stored:e,options:empty},'PERSISTED_CONFLICT','EXPECTED_EMPTY')}
for(const [id,mut] of [['S04',e=>e.schemaVersion=3],['S05',e=>e.model.schemaVersion=2],['S06',e=>e.release={version:2}],['S07',e=>{e.model.id='other';e.release.version=2}]]){let e=fixture();mut(e);run(id,{stored:e,options:id==='S07'?existing:empty},'UNSUPPORTED_PERSISTED_VERSION')}
let legacy=fixture();delete legacy.release;legacy.schemaVersion=1;
run('S08',{stored:legacy,options:empty},'PERSISTED_CONFLICT','EXPECTED_EMPTY');run('S09',{stored:legacy},'SAVE_OK');run('S10',{stored:null},'PERSISTED_CONFLICT','MISSING');
for(const [i,value] of ['null','1','[]','false','"x"','{'].entries())run('S11-root-'+i,{stored:value},'PERSISTED_DATA_INVALID');
for(const [i,mut] of [e=>e.model.id=null,e=>e.model.revision=-1,e=>e.model.snapshots[0].counts.lecture.held=-1,e=>e.release.attendance.records=[{}]].entries()){let e=fixture();mut(e);run('S11-core-'+i,{stored:e},'PERSISTED_DATA_INVALID')}
let other=fixture();other.model.id='other';other.model.revision=8;run('S12',{stored:other},'PERSISTED_CONFLICT','MODEL_ID');other=fixture();other.model.revision=8;run('S13',{stored:other},'PERSISTED_CONFLICT','MODEL_REVISION');
let hash=fixture();hash.release.calendar.sourceRevision={sha256:'A'.repeat(64),fileName:'legacy.PDF'};run('S14',{stored:hash,candidate:clone(hash)},'SAVE_OK');
let v1=fixture();v1.schemaVersion=1;run('S15',{stored:v1},'PERSISTED_REWRITE_UNSUPPORTED');v1.release.version=2;run('S15-future',{stored:v1},'UNSUPPORTED_PERSISTED_VERSION');
run('S16',{readError:true},'STORAGE_READ_FAILED');run('S17',{writeError:true},'STORAGE_WRITE_FAILED');run('S18',{change:e=>e.model.id=''},'CANDIDATE_INVALID');run('S19',{serializer:e=>native({...e,model:{...e.model,events:[]}}),candidate:(()=>{let e=fixture();e.model.events.push({id:'b',title:'b',cancelled:false,sessionId:null,date:'2026-11-03',start:'14:00',end:'15:00'});return e})()},'SERIALIZATION_FAILED','ROUNDTRIP_MISMATCH');
run('S20',{stored:null,options:empty},'SAVE_OK');run('S21',{},'SAVE_OK');
for(const key of ['attendance','calendar']){let e=fixture();e.release[key].version=2;run('S22-'+key,{stored:e},'UNSUPPORTED_PERSISTED_VERSION')}
function sourceFixture(){let e=fixture();const event={id:'A',title:'Exam',cancelled:false,sessionId:null,date:'2026-11-03',start:'14:00',end:'15:00'};e.model.events.push(event);e.release.calendar.sourceRevision={version:1,sha256:'a'.repeat(64),fileName:'source.pdf',source:{sha256:'a'.repeat(64),fileName:'source.pdf'},scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:null,programmingGroup:null},links:[{sourceRef:'r',changeId:'r',kind:'UPSERT_EVENT',targetId:'A',value:{...event,opaque:{nested:[1,null,{unfamiliar:true}]}},evidence:{sourceId:'s',page:1,excerpt:'Exam',basis:'DIRECT_SOURCE'},sourceSha256:'a'.repeat(64)}],sourceHistory:[]};return e}
let sf=sourceFixture();sf.release.calendar.sourceRevision.version=2;run('S22-source',{stored:sf},'UNSUPPORTED_PERSISTED_VERSION');
for(const [name,mut] of [['root',e=>e.extension=1],['snapshot',e=>e.model.snapshots[0].extension=1],['evidence',e=>e.release.calendar.sourceRevision.links[0].evidence.extension=1],['source',e=>e.release.calendar.sourceRevision.source.extension=1]]) {
 let e=sourceFixture();mut(e);run('S23-'+name,{stored:e,candidate:clone(e)},'PERSISTED_REWRITE_UNSUPPORTED','UNRECOGNIZED_RETAINED_FIELD');
 for(const [base,options] of [['match',existing],['empty',empty],['id',{...existing,expectedModelId:'different'}]])run('S28-'+name+'-'+base,{stored:e,options,candidate:clone(e)},'PERSISTED_REWRITE_UNSUPPORTED');
}
run('S28d',{stored:sourceFixture(),candidate:sourceFixture()},'SAVE_OK');
for(const [name,stored,code] of [['bad','{','PERSISTED_DATA_INVALID'],['future',{schemaVersion:3},'UNSUPPORTED_PERSISTED_VERSION'],['valid',fixture(),'SAVE_OK']])run('S24-'+name,{stored,options:{}},code);
run('S25',{options:{...existing,expectedRevision:3}},'PERSISTED_CONFLICT','MODEL_REVISION');run('S26',{options:{expectedRevision:'bad'},readError:true},'CANDIDATE_INVALID','INVALID_EXPECTATION');
const paths=[['schemaVersion'],['model','schemaVersion'],['release','version'],['release','attendance','version'],['release','calendar','version'],['release','calendar','sourceRevision','version']];
for(const [i,path] of paths.entries())for(const [j,bad] of ['1',null,false,0,-1,1.5].entries()) {
 let e=sourceFixture(),node=e;for(const k of path.slice(0,-1))node=node[k];node[path.at(-1)]=bad;e.model.id='other';
 run(`S27a-${i}-${j}`,{stored:e},'PERSISTED_DATA_INVALID');
 if(i!==0){e.schemaVersion=2;e.release.version=2;run(`S27b-${i}-${j}`,{stored:e},'UNSUPPORTED_PERSISTED_VERSION')}
}
run('S29a',{change:(e,hit)=>e.release.toJSON=()=>{hit();return {}}},'CANDIDATE_INVALID','NON_JSON_DATA');
const invalids={getter:(e,hit)=>Object.defineProperty(e.release,'x',{enumerable:true,get(){hit();return 1}}),prototype:e=>Object.setPrototypeOf(e.release,{toJSON(){throw Error()}}),undefined:e=>e.release.x=undefined,nan:e=>e.release.x=NaN,infinity:e=>e.release.x=Infinity,negativeZero:e=>e.release.x=-0,bigint:e=>e.release.x=1n,symbol:e=>e.release[Symbol()]=1,sparse:e=>e.release.x=Array(1),arrayExtra:e=>{e.release.x=[];e.release.x.extra=1},cycle:e=>e.release.x=e.release,nonenumerable:e=>Object.defineProperty(e.release,'x',{value:1}),date:e=>e.release.x=new Date()};
for(const [name,change] of Object.entries(invalids))run('S29b-'+name,{change},'CANDIDATE_INVALID','NON_JSON_DATA');
for(const [name,mut] of Object.entries({source:e=>e.release.calendar.sourceRevision.links[0].value.opaque.nested.pop(),hash:e=>e.release.calendar.sourceRevision.sha256='B'.repeat(64),counts:e=>e.model.snapshots[0].counts.lecture.attended--,clock:e=>e.model.snapshots[0].confirmedAt.time='00:01',array:e=>e.model.sessions.pop(),key:e=>delete e.model.preferences.notes}))run('S29c-'+name,{stored:sourceFixture(),candidate:sourceFixture(),serializer:e=>{e=JSON.parse(native(e));mut(e);return native(e)}},'SERIALIZATION_FAILED','ROUNDTRIP_MISMATCH');
for(const [name,serializer,reason] of [['invalid',()=>'{','INVALID_SERIALIZED_JSON'],['nonstring',()=>null,'NONSTRING'],['throw',()=>{throw Error('STALE')},'THREW']])run('S29d-'+name,{serializer},'SERIALIZATION_FAILED',reason);
run('S29d-equal',{serializer:e=>native(Object.fromEntries(Object.entries(e).reverse()),null,2)},'SAVE_OK');
run('S30a',{stored:'{',change:invalids.getter},'PERSISTED_DATA_INVALID');run('S30b',{change:invalids.getter,writeError:true},'CANDIDATE_INVALID');run('S30c',{change:invalids.getter,options:{...existing,expectedModelId:'other'}},'PERSISTED_CONFLICT','MODEL_ID');
export {sourceFixture};
// Complete current journal fixture produced by the actual ledger, not a shape stub.
const {evaluateDayClose}=await import('../../src/attendance/ledger.js');
const journalFixture=()=>{const e=fixture();const r=evaluateDayClose({model:e.model,journal:e.release.attendance,request:{expectedModelRevision:0,dayKey:'day',date:'2026-11-02',marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'ATTENDED',note:''}],confirmCompleteDay:true,confirmNoUnlistedMeetings:true},clock:{date:'2026-11-02',time:'10:00',timeZone:'Asia/Kolkata'}});assert.ok(r.ok,JSON.stringify(r));e.model=r.proposedModel;e.release.attendance=r.proposedJournal;return e};
let journal=journalFixture();journal.release.attendance.records[0].extension={retained:true};run('S28c-record',{stored:journal,candidate:clone(journal)},'PERSISTED_REWRITE_UNSUPPORTED','UNRECOGNIZED_RETAINED_FIELD');
for(const [name,mut] of [['clock',e=>e.model.snapshots[0].confirmedAt.extension=1],['sourceHistory',e=>e.release.calendar.sourceRevision.sourceHistory=[{sha256:'b'.repeat(64),fileName:'old.pdf',extension:1}]]]){let e=sourceFixture();mut(e);run('S28c-'+name,{stored:e,candidate:clone(e)},'PERSISTED_REWRITE_UNSUPPORTED');}
for(const [name,mut] of [['undefined',e=>e.model.preferences.notes=undefined],['getter',(e,hit)=>Object.defineProperty(e.model.preferences,'notes',{enumerable:true,get(){hit();return ''}})]])run('S30c-revision-'+name,{change:mut,options:{...existing,expectedRevision:2}},'PERSISTED_CONFLICT','MODEL_REVISION');
let extended=fixture();extended.retained={x:1};run('S28b-revision',{stored:extended,options:{...existing,expectedRevision:99}},'PERSISTED_REWRITE_UNSUPPORTED','UNRECOGNIZED_RETAINED_FIELD');
run('S29c-legacy-hash-spelling',{stored:hash,candidate:clone(hash),serializer:e=>{const v=JSON.parse(native(e));v.release.calendar.sourceRevision.sha256=v.release.calendar.sourceRevision.sha256.toLowerCase();return native(v)}},'SERIALIZATION_FAILED','ROUNDTRIP_MISMATCH');

for(const [i,bad] of ['1',null,false,0,-1,1.5].entries()){let e=fixture();e.schemaVersion=1;e.model.schemaVersion=bad;run('S27a-legacy-combination-'+i,{stored:e},'PERSISTED_DATA_INVALID');}
