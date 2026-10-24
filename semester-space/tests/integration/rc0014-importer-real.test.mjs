import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,completeSyntheticCoverage} from '../import/coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {parseCalendar} from '../../src/import/parse.js';
import {suggestRevisionEffects} from '../../src/import/revision-extract.js';
import * as revision from '../../src/import/revision.js';
import * as engine from '../../src/engine/index.js';
import {createController} from '../../src/controller.js';
import {makeEmptyRelease,loadModel,validateRelease} from '../../src/storage.js';
import {STORAGE_KEY} from '../../src/shared/constants.js';
const c=x=>structuredClone(x),clock={date:'2026-10-24',time:'20:00',timeZone:'Asia/Kolkata'};
function harness({fail=false}={}){
 const {d,o}=fixture();completeSyntheticCoverage(d,o);
 const compiled=compileConfirmedImport(d,o);assert.equal(compiled.ok,true,JSON.stringify(compiled.issues));
 const model=compiled.model;
 const expanded=engine.expandSchedule({schedule:model.schedule,courses:model.courses,registers:model.registers,extraSessions:[],overrides:[]});
 assert.equal(expanded.ok,true);model.schedule.initialized=true;model.sessions=expanded.sessions;
 const release=makeEmptyRelease(model);let writes=0;
 const mem=new Map([[STORAGE_KEY,JSON.stringify({schemaVersion:2,model,release})]]);
 const storage={getItem:key=>mem.get(key)??null,setItem(key,val){if(fail)throw Error('FAKE_QUOTA');writes++;mem.set(key,val)}};
 const app=createController({engine,revision,storage,clock:()=>c(clock),render(){}});
 return {app,storage,get writes(){return writes},model};
}
function draft(model,{text='Holiday 02.11.2026',sha='c'.repeat(64)}={}){
 const source={id:`source:${sha}`,sha256:sha,fileName:'reviewed-source.pdf',role:'ACADEMIC_CALENDAR',coverage:'PARTIAL',section:'Q',pageRefs:[`source:${sha}#page=1`]};
 const page={sourceId:source.id,page:1,method:'OCR',text,width:1000,height:1000,items:[{text,x:10,y:10,w:600,h:30}]};
 const rows=parseCalendar(source,[page],source.id).calendarEntries;
 const scope={start:'2026-10-24',end:'2026-11-09',section:'Q',subgroup:'Q3',programmingGroup:'Q23'};
 const d={revisionDraftVersion:1,status:'PARTIAL',source,pages:[page],calendarEntries:rows,issues:[],
  review:{proposalKey:`review:${sha.slice(0,8)}`,scope,scopeConfirmed:true,sourceCoverageConfirmed:true,
  coverageNote:'Synthetic explicit QA check of every source page, not an institutional confirmation.',
  academicScope:{institution:'Synthetic college',academicYear:'2026-27',term:'ODD',degreeGroup:'UG',semesterNumber:1,programme:'Synthetic UG',isTeachingAssistant:false},
  effects:suggestRevisionEffects(rows),exclusions:[],missing:[]}};
 for(const effect of d.review.effects)Object.assign(effect,{confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true});
 return d;
}
test('actual Codex candidate: reviewed future change commits once and retains source provenance across native reload',()=>{
 const h=harness();assert.equal(h.app.getState().persistence.status,'SAVED');
 const model=h.app.getState().model,reviewed=draft(model),previous={version:1,source:{sha256:'b'.repeat(64),fileName:'old.pdf'},links:[]};
 const {proposal}=revision.prepareCalendarRevision({currentModel:model,existingSourceRevision:previous,extractedDraft:reviewed});
 assert.deepEqual(proposal.unresolved,[]);
 const staged=h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:model.revision,proposal});
 assert.equal(staged.ok,true);assert.equal(h.writes,0);
 const acceptedChangeIds=proposal.changes.map(x=>x.changeId);
 const result=h.app.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:proposal.proposalId,acceptedChangeIds,confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true});
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(h.writes,1);
 const saved=h.app.getState();assert.equal(saved.model.revision,model.revision+1);
 assert.deepEqual(saved.model.commitments,model.commitments);assert.deepEqual(saved.model.snapshots,model.snapshots);
 assert.equal(saved.release.calendar.sourceRevision.version,1);
 assert.equal(saved.release.calendar.sourceRevision.links.length,acceptedChangeIds.length);
 assert.equal(saved.release.calendar.sourceRevision.links[0].sourceSha256,reviewed.source.sha256);
 assert.equal(saved.release.calendar.sourceRevision.links[0].evidence.excerpt,'Holiday 02.11.2026');
 assert.equal(validateRelease(saved.release,saved.model),saved.release);
 const second=createController({engine,revision,storage:h.storage,clock:()=>c(clock),render(){}});
 assert.deepEqual(second.getState().release,saved.release);
 assert.deepEqual(second.getState().model,saved.model);
 assert.equal(second.getState().stagedCalendarRevision,null);
 assert.equal(second.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:proposal.proposalId,acceptedChangeIds,confirmedSourceCoverage:true,confirmation:true}).ok,false);
 assert.equal(h.writes,1);
});
test('unreviewed omissions block staging acceptance and cannot delete existing restrictions',()=>{
 const h=harness(),model=h.app.getState().model,d=draft(model),prior={version:1,source:{sha256:'b'.repeat(64)},links:[{sourceRef:'old-event',kind:'UPSERT_EVENT',targetId:'old-exam',value:{id:'old-exam',date:'2026-11-04',title:'Exam',start:'10:00',end:'11:00',cancelled:false,sessionId:null}}]};
 const {proposal}=revision.prepareCalendarRevision({currentModel:model,existingSourceRevision:prior,extractedDraft:d});
 assert.ok(proposal.unresolved.some(i=>i.code==='POSSIBLE_REMOVAL'));
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:model.revision,proposal}).ok,true);
 const result=h.app.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:proposal.proposalId,acceptedChangeIds:proposal.changes.map(c=>c.changeId),confirmedSourceCoverage:true,confirmation:true,historicalResolutions:[]});
 assert.equal(result.ok,false);assert.equal(h.writes,0);
});
test('actual Codex builder respects atomic rollback with release provenance preserved',()=>{
 const h=harness({fail:true}),model=h.app.getState().model,d=draft(model),prior={version:1,source:{sha256:'b'.repeat(64)},links:[]};
 const p=revision.prepareCalendarRevision({currentModel:model,existingSourceRevision:prior,extractedDraft:d}).proposal;
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:model.revision,proposal:p}).ok,true);
 const before=h.app.getState(),res=h.app.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:p.proposalId,acceptedChangeIds:p.changes.map(c=>c.changeId),confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true});
 assert.equal(res.code,'PERSISTENCE_FAILED');assert.equal(h.writes,0);
 assert.deepEqual(h.app.getState().model,before.model);assert.deepEqual(h.app.getState().release,before.release);
});
test('crosswalk validator fails closed on malformed persisted provenance',()=>{
 const h=harness();const raw=JSON.parse(h.storage.getItem(STORAGE_KEY));
 raw.release.calendar.sourceRevision={version:1,sha256:'x',fileName:'x.pdf',source:{sha256:'x',fileName:'x.pdf'},scope:{start:'2026-11-01',end:'2026-11-09'},sourceHistory:[],links:[{sourceRef:'bad',kind:'ADD_HOLIDAY',targetId:'date',sourceSha256:'x',evidence:{sourceId:'x',page:0,excerpt:''}}]};
 h.storage.setItem(STORAGE_KEY,JSON.stringify(raw));
 const result=loadModel(h.storage,engine.validateModel,clock);
 assert.equal(result.persistence.status,'QUARANTINED');assert.equal(result.model,null);
});
test('second reviewed revision merges old unselected links, retains old restriction and records source lineage',()=>{
 const h=harness();let model=h.app.getState().model;
 const prior={version:1,source:{sha256:'b'.repeat(64),fileName:'old.pdf'},links:[]};
 const first=revision.prepareCalendarRevision({currentModel:model,existingSourceRevision:prior,extractedDraft:draft(model)}).proposal;
 assert.deepEqual(first.unresolved,[]);
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:model.revision,proposal:first}).ok,true);
 assert.equal(h.app.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:first.proposalId,acceptedChangeIds:first.changes.map(c=>c.changeId),confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true}).ok,true);
 model=h.app.getState().model;
 const oldSource=h.app.getState().release.calendar.sourceRevision;
 assert.equal(oldSource.links.length,1);
 const newer=draft(model,{text:'Holiday 03.11.2026',sha:'d'.repeat(64)});
 newer.review.missing=[{sourceRef:oldSource.links[0].sourceRef,decision:'KEEP_EXISTING',confirmed:true,reason:'Previous holiday was not withdrawn in the new notice.'}];
 const next=revision.prepareCalendarRevision({currentModel:model,existingSourceRevision:oldSource,extractedDraft:newer});
 assert.deepEqual(next.proposal.unresolved,[],JSON.stringify(next.proposal.unresolved));
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:model.revision,proposal:next.proposal}).ok,true);
 const ret=h.app.callbacks.onApplyCalendarRevision({expectedModelRevision:model.revision,proposalId:next.proposal.proposalId,acceptedChangeIds:next.proposal.changes.map(c=>c.changeId),confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true});
 assert.equal(ret.ok,true,JSON.stringify(ret));
 const loaded=h.app.getState().release.calendar.sourceRevision;
 assert.equal(h.writes,2);
 assert.equal(loaded.links.length,2);
 assert.equal(loaded.sourceHistory.some(s=>s.sha256===oldSource.sha256),true);
 assert.equal(loaded.links.find(l=>l.sourceRef===oldSource.links[0].sourceRef).sourceSha256,oldSource.sha256);
 assert.equal(h.app.getState().model.schedule.holidays.some(r=>r.date==='2026-11-02'),true);
 assert.equal(h.app.getState().model.schedule.holidays.some(r=>r.date==='2026-11-03'),true);
});
