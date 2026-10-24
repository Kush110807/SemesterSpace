import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../../src/controller.js';
import {loadModel,saveModel,makeEmptyRelease,validateRelease} from '../../src/storage.js';
import {STORAGE_KEY} from '../../src/shared/constants.js';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';
import * as engine from '../../src/engine/index.js';
import {reconcileOfficialSnapshot} from '../../src/attendance/ledger.js';

const copy=x=>structuredClone(x);
function disk(existing=null,failWrite=false){
 const data=new Map(existing===null?[]:[[STORAGE_KEY,JSON.stringify(existing)]]);let writes=0;
 return {data,get writes(){return writes},getItem:key=>data.get(key)??null,setItem(key,value){if(failWrite)throw new Error('QUOTA_EXCEEDED');writes++;data.set(key,value)}};
}
function appHarness({attendance=null,revision=null,failWrite=false,clock=FIXED_CLOCK}={}){
 const model=makeCombinedModel(),storage=disk({schemaVersion:1,model},failWrite);
 const app=createController({engine,render(){},storage,clock:()=>copy(clock),attendance,revision});
 return {app,storage,model};
}
function validDay({model,journal,request,clock}){
 if(journal.closedDays.some(x=>x.dayKey===request.dayKey))return {ok:true,idempotent:true,registerTotals:copy(model.snapshots.at(-1).counts)};
 const proposedModel=copy(model),proposedJournal=copy(journal);
 const old=proposedModel.snapshots.at(-1),count=copy(old.counts);count.lecture.attended++;count.lecture.held++;
 proposedModel.snapshots.push({id:`${model.id}:snapshot:${old.sequence+1}`,sequence:old.sequence+1,date:request.date,
  counts:count,confirmed:true,completeToday:false,confirmedAt:copy(clock)});
 proposedModel.attendanceConfirmation={throughDate:request.date,noUnlistedClasses:true};
 const id=`record:${request.dayKey}`;
 proposedJournal.records.push({recordId:id,dayKey:request.dayKey,occurrenceId:'s1',registerId:'lecture',date:request.date,weight:1,
  disposition:'ATTENDED',confirmedAt:copy(clock),recordRevision:1,supersedesRecordId:null,
  sourceModelRevision:model.revision,note:''});
 proposedJournal.closedDays.push({dayKey:request.dayKey,date:request.date,recordIds:[id],confirmedAt:copy(clock),
  sourceModelRevision:model.revision,noUnlistedMeetings:true,supersedesDayKey:null});
 return {ok:true,proposedModel,proposedJournal,registerTotals:count};
}
const dayRequest={expectedModelRevision:0,date:'2026-11-02',dayKey:'day:2026-11-02:alpha',
 marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'ATTENDED',note:''}],
 confirmCompleteDay:true,confirmNoUnlistedMeetings:true};
const proposal={proposalVersion:1,proposalId:'rev:one',baseModelRevision:0,
 source:{sha256:'a'.repeat(64),fileName:'calendar-revised.pdf',role:'ACADEMIC_CALENDAR',coverage:'COMPLETE',section:'Q',pageRefs:['p1']},
 scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},
 changes:[{changeId:'h1',kind:'ADD_HOLIDAY',occurrenceId:null,before:null,
 after:{date:'2026-11-04',label:'Institution-confirmed holiday'},
 evidence:{sourceId:'p1',page:1,excerpt:'Holiday on November 4'},match:'ADDED',affectsConfirmedHistory:false}],
 unresolved:[],createdAtUntrusted:null};
function patchFrom(proposal,acceptedChangeIds){
 return {version:1,source:copy(proposal.source),scope:copy(proposal.scope),
   links:proposal.changes.filter(c=>acceptedChangeIds.includes(c.changeId)).map(c=>({
     sourceRef:c.changeId,changeId:c.changeId,kind:c.kind,
     targetId:['ADD_SESSION','EDIT_SESSION','CANCEL_SESSION'].includes(c.kind)?c.occurrenceId:
       c.after?.id??c.after?.date??c.before?.date,
     value:copy(c.after),evidence:copy(c.evidence)}))};
}
const revision={buildRevisionCandidate({model,proposal,acceptedChangeIds}){const m=copy(model);m.schedule.holidays.push({date:'2026-11-04',label:'Institution-confirmed holiday'});
 return {ok:true,proposedModel:m,sourceRevisionPatch:patchFrom(proposal,acceptedChangeIds)};}};
const applyRequest={expectedModelRevision:0,proposalId:'rev:one',acceptedChangeIds:['h1'],
 confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true};

test('old v1 envelope migrates only in memory; saves v2 in one key on confirmed change',()=>{
 const model=makeCombinedModel(),store=disk({schemaVersion:1,model});
 const loaded=loadModel(store,engine.validateModel,FIXED_CLOCK);
 assert.equal(loaded.persistence.status,'SAVED');assert.equal(store.writes,0);
 assert.deepEqual(loaded.release.attendance.records,[]);
 assert.deepEqual(loaded.release.attendance.officialSnapshotIds,['snapshot-1']);
 assert.deepEqual(loaded.model,model);
 assert.equal(saveModel(store,model,loaded.release).status,'SAVED');
 assert.equal(store.writes,1);
 const raw=JSON.parse(store.data.get(STORAGE_KEY));
 assert.equal(raw.schemaVersion,2);assert.equal(raw.model.schemaVersion,1);
 assert.deepEqual(loadModel(store,engine.validateModel,FIXED_CLOCK).model,model);
});
test('future schema and malformed v2 journal quarantine intact without writes',()=>{
 const model=makeCombinedModel(),rel=makeEmptyRelease(model);
 for (const envelope of [{schemaVersion:3,model,release:rel},
  {schemaVersion:2,model,release:{...rel,attendance:{...rel.attendance,officialSnapshotIds:['missing']}}},
  {schemaVersion:2,model,release:{...rel,attendance:{...rel.attendance,closedDays:[{dayKey:'x'}]}}}]){
  const store=disk(envelope),before=store.data.get(STORAGE_KEY);
  const loaded=loadModel(store,engine.validateModel,FIXED_CLOCK);
  assert.equal(loaded.model,null);assert.equal(loaded.persistence.status,'QUARANTINED');
  assert.equal(store.writes,0);assert.equal(store.data.get(STORAGE_KEY),before);
 }
});
test('new calendar callback stages without writes and applies one whole envelope',()=>{
 const {app,storage}=appHarness({revision});
 const before=app.getState().model;
 const staged=app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal});
 assert.equal(staged.code,'REVIEW_REQUIRED');assert.equal(storage.writes,0);assert.deepEqual(app.getState().model,before);
 const applied=app.callbacks.onApplyCalendarRevision(applyRequest);
 assert.equal(applied.code,'REVISION_APPLIED');assert.equal(applied.ok,true);
 assert.equal(app.getState().model.revision,1);assert.equal(storage.writes,1);
 assert.equal(app.getState().release.calendar.appliedRevisions.length,1);
 const loaded=loadModel(storage,engine.validateModel,FIXED_CLOCK);
 assert.equal(loaded.model.schedule.holidays[0].date,'2026-11-04');
 assert.deepEqual(loaded.model.snapshots,before.snapshots);
});
test('stale revision, ambiguity and missing worker all reject without writes',()=>{
 const {app,storage}=appHarness();
 assert.equal(app.callbacks.onApplyCalendarRevision(applyRequest).ok,false);
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:1,proposal}).ok,false);
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
 assert.equal(app.callbacks.onApplyCalendarRevision(applyRequest).ok,false);
 assert.equal(storage.writes,0);
});
test('calendar change cannot overwrite an elapsed/recorded session, even with a worker result',()=>{
 const badRevision={buildRevisionCandidate({model}){const m=copy(model);m.sessions[0].cancelled=true;return {ok:true,proposedModel:m};}};
 const {app,storage}=appHarness({revision:badRevision,clock:{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}});
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
 assert.equal(app.callbacks.onApplyCalendarRevision(applyRequest).ok,false);
 assert.equal(storage.writes,0);
});
test('atomic release persistence rejects quota failures without changing model or journal',()=>{
 const {app,storage}=appHarness({revision,failWrite:true});
 const before=app.getState().model,oldJournal=app.getState().release;
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
 const response=app.callbacks.onApplyCalendarRevision(applyRequest);
 assert.equal(response.code,'PERSISTENCE_FAILED');assert.equal(storage.writes,0);
 assert.deepEqual(app.getState().model,before);assert.deepEqual(app.getState().release,oldJournal);
 assert.equal(app.getState().persistence.status,'FAILED');
});
test('day closure saves journal + derived snapshot once, replay is idempotent',()=>{
 const {app,storage}=appHarness({attendance:{evaluateDayClose:validDay},
  clock:{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}});
 const first=app.callbacks.onConfirmAttendanceDay(dayRequest);
 assert.equal(first.code,'DAY_CONFIRMED');assert.equal(first.modelRevision,1);
 assert.equal(app.getState().model.snapshots.length,2);
 assert.deepEqual(app.getState().release.attendance.officialSnapshotIds,['snapshot-1']);
 assert.equal(storage.writes,1);
 const second=app.callbacks.onConfirmAttendanceDay({...dayRequest,expectedModelRevision:1});
 assert.equal(second.code,'ALREADY_CONFIRMED');assert.equal(second.modelRevision,1);
 assert.equal(storage.writes,1);
 assert.equal(loadModel(storage,engine.validateModel,{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}).release.attendance.records.length,1);
});
test('official snapshot confirmed via legacy callback remains authoritative in migrated release',()=>{
 const {app,storage}=appHarness();
 app.callbacks.onConfirmSnapshot({date:'2026-11-01',counts:{lecture:{attended:80,held:100}},confirmed:true,completeToday:false});
 assert.equal(storage.writes,1);
 assert.deepEqual(app.getState().release.attendance.officialSnapshotIds,['snapshot-1','synthetic-combined:snapshot:2']);
});


test('concurrent-tab stale persistence is rejected before writing',()=>{
 const {app,storage}=appHarness({revision});
 app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal});
 const outside=copy(JSON.parse(storage.data.get(STORAGE_KEY)));
 outside.model.revision=5;storage.data.set(STORAGE_KEY,JSON.stringify(outside));
 const result=app.callbacks.onApplyCalendarRevision(applyRequest);
 assert.equal(result.code,'PERSISTENCE_FAILED');assert.equal(app.getState().model.revision,0);
 assert.equal(storage.writes,0);
});
test('a cancellation lacking affirmative source evidence is blocked before worker invocation',()=>{
 let called=0;
 const cancellation=copy(proposal);cancellation.proposalId='rev:cancel';
 cancellation.changes=[{changeId:'c1',kind:'CANCEL_SESSION',occurrenceId:'s2',before:null,after:{cancelled:true},
  evidence:{sourceId:'p1',page:1,excerpt:''},match:'EXACT_ID',affectsConfirmedHistory:false}];
 const {app,storage}=appHarness({revision:{buildRevisionCandidate(){called++;return{ok:false,issues:[]};}}});
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal:cancellation}).ok,true);
 const result=app.callbacks.onApplyCalendarRevision({...applyRequest,proposalId:'rev:cancel',acceptedChangeIds:['c1']});
 assert.equal(result.ok,false);assert.equal(called,0);assert.equal(storage.writes,0);
});
test('day close cannot omit active occurrence or double-credit same day key with changed marks',()=>{
 const {app,storage}=appHarness({attendance:{evaluateDayClose:validDay},
 clock:{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}});
 assert.equal(app.callbacks.onConfirmAttendanceDay({...dayRequest,marks:[]}).ok,false);
 assert.equal(storage.writes,0);
 assert.equal(app.callbacks.onConfirmAttendanceDay(dayRequest).ok,true);
 const altered={...dayRequest,expectedModelRevision:1,marks:[{...dayRequest.marks[0],disposition:'MISSED'}]};
 assert.equal(app.callbacks.onConfirmAttendanceDay(altered).ok,false);
 assert.equal(storage.writes,1);
});
test('official snapshot update rejects failed storage without advancing confirmed baseline',()=>{
 const {app,storage}=appHarness({failWrite:true});
 const original=app.getState().model;
 app.callbacks.onConfirmSnapshot({date:'2026-11-01',counts:{lecture:{attended:80,held:100}},confirmed:true,completeToday:false});
 assert.equal(storage.writes,0);assert.deepEqual(app.getState().model,original);
});


test('release read rejects two independent closed days for one date (no double count)',()=>{
 const model=makeCombinedModel(),release=makeEmptyRelease(model);
 const closure=key=>({dayKey:key,date:'2026-11-02',recordIds:[],confirmedAt:copy(FIXED_CLOCK),
   sourceModelRevision:0,noUnlistedMeetings:true,supersedesDayKey:null});
 release.attendance.closedDays.push(closure('day-a'),closure('day-b'));
 assert.throws(()=>validateRelease(release,model),/Multiple independent attendance closures/);
 const store=disk({schemaVersion:2,model,release}),saved=store.data.get(STORAGE_KEY);
 assert.equal(loadModel(store,engine.validateModel,FIXED_CLOCK).persistence.status,'QUARANTINED');
 assert.equal(store.data.get(STORAGE_KEY),saved);assert.equal(store.writes,0);
});

test('B adapter cannot credit a different mark than the user confirmed',()=>{
 const dishonest={evaluateDayClose(args){const proposed=validDay(args);
   proposed.proposedJournal.records.at(-1).disposition='MISSED';return proposed;}};
 const {app,storage}=appHarness({attendance:dishonest,clock:{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}});
 const before=app.getState().model;
 const response=app.callbacks.onConfirmAttendanceDay(dayRequest);
 assert.equal(response.ok,false);assert.deepEqual(app.getState().model,before);assert.equal(storage.writes,0);
});

test('B adapter cannot mutate a prior day while appending a new day',()=>{
 const worker={evaluateDayClose(args){
   const {model,journal,request,clock}=args;
   if(request.date==='2026-11-02')return validDay(args);
   const proposedModel=copy(model),proposedJournal=copy(journal),old=model.snapshots.at(-1);
   const counts=copy(old.counts);counts.lecture.attended++;counts.lecture.held++;
   proposedModel.snapshots.push({id:`${model.id}:snapshot:${old.sequence+1}`,sequence:old.sequence+1,
     date:request.date,counts,confirmed:true,completeToday:false,confirmedAt:copy(clock)});
   proposedModel.attendanceConfirmation={throughDate:request.date,noUnlistedClasses:true};
   const recordId=`record:${request.dayKey}`;
   proposedJournal.records.push({recordId,dayKey:request.dayKey,occurrenceId:'s2',registerId:'lecture',
     date:request.date,weight:1,disposition:'ATTENDED',confirmedAt:copy(clock),recordRevision:1,
     supersedesRecordId:null,sourceModelRevision:model.revision,note:''});
   proposedJournal.closedDays.push({dayKey:request.dayKey,date:request.date,recordIds:[recordId],
     confirmedAt:copy(clock),sourceModelRevision:model.revision,noUnlistedMeetings:true,supersedesDayKey:null});
   proposedJournal.records[0].disposition='MISSED'; // forged alteration of previously confirmed day
   return {ok:true,proposedModel,proposedJournal,registerTotals:counts};
 }};
 const {app,storage}=appHarness({attendance:worker,clock:{date:'2026-11-04',time:'08:00',timeZone:'Asia/Kolkata'}});
 assert.equal(app.callbacks.onConfirmAttendanceDay(dayRequest).ok,true);
 const before=app.getState().model,journal=app.getState().release.attendance;
 const result=app.callbacks.onConfirmAttendanceDay({expectedModelRevision:1,date:'2026-11-03',dayKey:'day-nov-3',
   marks:[{occurrenceId:'s2',registerId:'lecture',disposition:'ATTENDED',note:''}],
   confirmCompleteDay:true,confirmNoUnlistedMeetings:true});
 assert.equal(result.ok,false);assert.deepEqual(app.getState().model,before);
 assert.deepEqual(app.getState().release.attendance,journal);assert.equal(storage.writes,1);
});

test('replayed confirmed day is idempotent with original expected revision, changed marks conflict',()=>{
 const {app,storage}=appHarness({attendance:{evaluateDayClose:validDay},
 clock:{date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'}});
 assert.equal(app.callbacks.onConfirmAttendanceDay(dayRequest).ok,true);
 const replay=app.callbacks.onConfirmAttendanceDay(dayRequest);
 assert.equal(replay.code,'ALREADY_CONFIRMED');assert.equal(storage.writes,1);
 const conflict=app.callbacks.onConfirmAttendanceDay({...dayRequest,marks:[{...dayRequest.marks[0],disposition:'MISSED'}]});
 assert.equal(conflict.code,'IDEMPOTENCY_CONFLICT');assert.equal(storage.writes,1);
});

test('staged proposal is immutable under reuse of the same identifier',()=>{
 const {app,storage}=appHarness({revision});
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
 const tampered=copy(proposal);tampered.changes[0].after.label='Different holiday';
 const rejection=app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal:tampered});
 assert.equal(rejection.code,'IDEMPOTENCY_CONFLICT');
 assert.equal(app.callbacks.onApplyCalendarRevision(applyRequest).ok,true);
 assert.equal(app.getState().model.schedule.holidays[0].label,'Institution-confirmed holiday');
 assert.equal(storage.writes,1);
});

test('ordinary preference/session edits roll back on write failure, preserving both tree and commitments',()=>{
 const {app,storage}=appHarness({failWrite:true}),before=app.getState().model;
 app.callbacks.onSetPreferences({...before.preferences,requestedDays:3});
 assert.deepEqual(app.getState().model,before);
 app.callbacks.onEditSession({sessionId:'s2',changes:{start:'13:00'},teachingOnHolidayConfirmed:false});
 assert.deepEqual(app.getState().model,before);
 assert.equal(app.getState().persistence.status,'FAILED');assert.equal(storage.writes,0);
});

test('explicit daily correction appends history, recalculates totals, and reloads exactly once',()=>{
 const worker={evaluateDayClose(args){
   if(!args.request.correctionOfDayKey)return validDay(args);
   const {model,journal,request,clock}=args;
   const m=copy(model),j=copy(journal),latest=m.snapshots.at(-1),counts=copy(latest.counts);
   // Fixture: 79/100 baseline; replacing the previously attended unit with
   // one missed unit yields 79/101. This is a controlled B test double.
   counts.lecture.attended--;
   m.snapshots.push({id:`${m.id}:snapshot:${latest.sequence+1}`,sequence:latest.sequence+1,
     date:latest.date,counts,confirmed:true,completeToday:false,confirmedAt:copy(clock)});
   m.attendanceConfirmation={throughDate:latest.date,noUnlistedClasses:true};
   const old=j.records.find(r=>r.dayKey===request.correctionOfDayKey),id=`record:${request.dayKey}`;
   j.records.push({recordId:id,dayKey:request.dayKey,occurrenceId:'s1',registerId:'lecture',
     date:request.date,weight:1,disposition:'MISSED',confirmedAt:copy(clock),recordRevision:2,
     supersedesRecordId:old.recordId,sourceModelRevision:model.revision,note:'corrected'});
   j.closedDays.push({dayKey:request.dayKey,date:request.date,recordIds:[id],
     confirmedAt:copy(clock),sourceModelRevision:model.revision,noUnlistedMeetings:true,
     supersedesDayKey:request.correctionOfDayKey});
   return {ok:true,proposedModel:m,proposedJournal:j,registerTotals:counts};
 }};
 const clock={date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'};
 const {app,storage}=appHarness({attendance:{...worker,reconcileOfficialSnapshot},clock});
 assert.equal(app.callbacks.onConfirmAttendanceDay(dayRequest).ok,true);
 const corrected={...dayRequest,expectedModelRevision:1,dayKey:'day:2026-11-02:correction-1',
   correctionOfDayKey:dayRequest.dayKey,
   marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'MISSED',note:'corrected'}]};
 const result=app.callbacks.onConfirmAttendanceDay(corrected);
 assert.equal(result.code,'DAY_CONFIRMED');assert.equal(result.modelRevision,2);
 assert.equal(app.getState().model.snapshots.length,3);
 assert.equal(app.getState().model.snapshots.at(-1).counts.lecture.attended,79);
 assert.equal(app.getState().model.snapshots.at(-1).counts.lecture.held,101);
 assert.equal(app.getState().release.attendance.records.length,2);
 assert.equal(app.getState().release.attendance.closedDays.length,2);
 assert.equal(storage.writes,2);
 const reload=createController({engine,render(){},storage,clock:()=>copy(clock),attendance:{...worker,reconcileOfficialSnapshot}});
 assert.equal(reload.getState().persistence.status,'SAVED');
 assert.deepEqual(reload.getState().model,app.getState().model);
 assert.deepEqual(reload.getState().release,app.getState().release);
 assert.equal(reload.callbacks.onConfirmAttendanceDay(corrected).code,'ALREADY_CONFIRMED');
 assert.equal(storage.writes,2);
 // A newly entered official count supersedes the calculation baseline, while
 // preserving the independent journal instead of manufacturing corrections.
 clock.date='2026-11-04';
 reload.callbacks.onConfirmSnapshot({date:'2026-11-03',counts:{lecture:{attended:85,held:108}},
   confirmed:true,completeToday:false});
 const after=reload.getState();
 assert.equal(after.model.snapshots.at(-1).counts.lecture.attended,85);
 assert.equal(after.release.attendance.records.length,2);
 assert.equal(after.release.attendance.officialSnapshotIds.length,2);
 assert.equal(reload.callbacks.onConfirmAttendanceDay({...corrected,dayKey:'another-correction',
   correctionOfDayKey:corrected.dayKey,expectedModelRevision:3}).ok,false);
 assert.equal(storage.writes,3);
});

test('calendar revision retains an invalidated commitment and persists PLAN_BLOCKED across reload',()=>{
 const model=makeCombinedModel();model.commitments=[{id:'commit:nov3',date:'2026-11-03',createdAtRevision:0}];
 const storage=disk({schemaVersion:1,model}),clock=()=>copy(FIXED_CLOCK);
 const worker={buildRevisionCandidate({model:m,proposal,acceptedChangeIds}){const candidate=copy(m);
   candidate.sessions.find(s=>s.id==='s2').protected=true;
   return {ok:true,proposedModel:candidate,sourceRevisionPatch:patchFrom(proposal,acceptedChangeIds)};}};
 const app=createController({engine,render(){},storage,clock,revision:worker});
 assert.equal(app.getResults().evaluation.status,'MEETS_PLANNING_RULES');
 const p=copy(proposal);p.proposalId='rev:protect-s2';p.changes=[{changeId:'protect-s2',
   kind:'EDIT_SESSION',occurrenceId:'s2',before:{protected:false},after:{protected:true},
   evidence:{sourceId:'p1',page:1,excerpt:'Compulsory meeting'},match:'EXACT_ID',affectsConfirmedHistory:false}];
 assert.equal(app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal:p}).ok,true);
 const applied=app.callbacks.onApplyCalendarRevision({...applyRequest,proposalId:p.proposalId,
   acceptedChangeIds:['protect-s2']});
 assert.equal(applied.code,'REVISION_APPLIED');assert.equal(applied.engineStatus,'PLAN_BLOCKED');
 assert.deepEqual(applied.preservedCommitmentIds,['commit:nov3']);
 assert.equal(app.getState().model.commitments[0].id,'commit:nov3');
 const reload=createController({engine,render(){},storage,clock});
 assert.equal(reload.getResults().evaluation.status,'PLAN_BLOCKED');
 assert.equal(reload.getState().model.commitments[0].id,'commit:nov3');
 assert.equal(reload.getState().release.calendar.appliedRevisions.length,1);
 assert.equal(storage.writes,1);
});
