import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCombinedModel,makeSession} from '../../src/shared/fixtures.js';
import {createAttendanceJournal,validateAttendanceJournal,deriveAttendanceTotals,evaluateDayClose,reconcileOfficialSnapshot,viewAttendanceDay} from '../../src/attendance/ledger.js';

const clock={date:'2026-11-05',time:'20:00',timeZone:'Asia/Kolkata'};
const mark=(id='s1',disposition='ATTENDED',registerId='lecture',note='')=>({occurrenceId:id,registerId,disposition,note});
const mk=()=>{const model=makeCombinedModel();model.attendanceConfirmation={throughDate:'2026-11-01',noUnlistedClasses:true};return {model,journal:createAttendanceJournal(model)};};
function request(model,date='2026-11-02',dayKey='day:nov02',marks=[mark()]) {return {expectedModelRevision:model.revision,date,dayKey,marks,confirmCompleteDay:true,confirmNoUnlistedMeetings:true};}
const close=(model,journal,date,key,marks,extra={})=>evaluateDayClose({model,journal,request:{...request(model,date,key,marks),...extra},clock});
const next=r=>{assert.equal(r.ok,true,JSON.stringify(r.issues));return {model:r.proposedModel,journal:r.proposedJournal};};

test('migration initializes an empty official-tagged journal without fabricating records',()=>{
  const {model,journal}=mk();assert.equal(journal.records.length,0);assert.deepEqual(journal.officialSnapshotIds,['snapshot-1']);
  assert.equal(validateAttendanceJournal(model,journal).ok,true);
});
test('first day close increments exactly the scheduled confirmed units, with correct record metadata',()=>{
  let {model,journal}=mk();const input=structuredClone({model,journal});
  const r=close(model,journal,'2026-11-02','key-1',[mark()]);assert.equal(r.ok,true);assert.equal(r.code,'DAY_CONFIRMED');
  assert.equal(r.proposedModel.revision,1);assert.deepEqual(r.registerTotals,{lecture:{attended:80,held:101}});
  assert.equal(r.proposedJournal.records[0].weight,1);assert.equal(r.proposedJournal.records[0].sourceModelRevision,0);
  assert.deepEqual(r.proposedJournal.records[0].confirmedAt,clock);assert.equal(r.proposedJournal.records[0].recordRevision,1);
  assert.deepEqual({model,journal},input,'pure evaluation may not mutate inputs');
});
test('missed meeting increases held but not attended',()=>{const {model,journal}=mk();assert.deepEqual(close(model,journal,'2026-11-02','k',[mark('s1','MISSED')]).registerTotals,{lecture:{attended:79,held:101}});});
test('NOT_HELD is explicit cancelled/not held: adds neither held nor attended',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','k',[mark('s1','NOT_HELD')]);
  assert.deepEqual(r.registerTotals,{lecture:{attended:79,held:100}});assert.equal(r.proposedJournal.records[0].disposition,'NOT_HELD');
});
test('UNKNOWN remains draft only and prevents closed day',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','k',[mark('s1','UNKNOWN')]);assert.equal(r.ok,false);assert.equal(r.code,'UNRESOLVED_OCCURRENCES');assert.equal(r.proposedJournal,null);
});
test('duplicate occurrence marks fail closed',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','k',[mark(),mark('s1','MISSED')]);assert.equal(r.ok,false);assert.equal(r.issues[0].code,'DUPLICATE_MARK');
});
test('omitted active scheduled occurrence fails closed',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','k',[]);assert.equal(r.ok,false);assert.equal(r.issues[0].code,'MISSING_MARK');
});
test('unknown or cancelled occurrence cannot be smuggled into a daily close',()=>{
  const {model,journal}=mk();assert.equal(close(model,journal,'2026-11-02','k',[mark('not-scheduled')]).ok,false);
  model.sessions[0].cancelled=true;
  assert.equal(close(model,journal,'2026-11-02','k',[mark()]).ok,false);
  assert.equal(close(model,journal,'2026-11-02','k',[]).ok,true,'no active sessions can close explicitly');
});
test('register binding is immutable and checked for each mark',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','k',[mark('s1','ATTENDED','lab')]);assert.equal(r.ok,false);assert.equal(r.issues[0].code,'REGISTER_MISMATCH');
});
test('day without meetings requires explicit closure and is recorded with empty recordIds',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  ({model,journal}=next(close(model,journal,'2026-11-03','b',[mark('s2')])));
  const r=close(model,journal,'2026-11-04','c',[]);assert.equal(r.ok,true);assert.equal(r.proposedJournal.closedDays.at(-1).recordIds.length,0);
});
test('confirmNoUnlistedMeetings must be explicitly true even on empty dates',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  ({model,journal}=next(close(model,journal,'2026-11-03','b',[mark('s2')])));
  assert.equal(close(model,journal,'2026-11-04','c',[],{confirmNoUnlistedMeetings:false}).ok,false);
});
test('complete-day flag must be explicitly true',()=>{
  const {model,journal}=mk();assert.equal(close(model,journal,'2026-11-02','k',[mark()],{confirmCompleteDay:false}).ok,false);
});
test('multi-day gap cannot silently advance confirmed counts',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-03','b',[mark('s2')]);assert.equal(r.code,'UNRESOLVED_PAST_DAY');assert.equal(r.proposedModel,null);
});
test('earlier zero-session gap cannot be skipped',()=>{
  const {model,journal}=mk();model.sessions=[makeSession('s4','2026-11-04')];
  const r=close(model,journal,'2026-11-04','k',[mark('s4')]);assert.equal(r.code,'UNRESOLVED_PAST_DAY');
});
test('repeated normalized request with same key is true idempotent replay even after revision bump',()=>{
  let {model,journal}=mk();const r=close(model,journal,'2026-11-02','stable',[mark()]);({model,journal}=next(r));
  const replay=close(model,journal,'2026-11-02','stable',[mark()]);assert.equal(replay.ok,true);assert.equal(replay.idempotent,true);
  assert.equal(replay.proposedModel,model);assert.equal(replay.proposedJournal,journal);
  assert.equal(replay.proposedModel.revision,1);
});
test('normalized mark order does not affect replay',()=>{
  let {model,journal}=mk();model.sessions.push(makeSession('b','2026-11-02','lecture',2,'11:00','12:00'));
  ({model,journal}=next(close(model,journal,'2026-11-02','stable',[mark('b'),mark('s1')])));
  const replay=close(model,journal,'2026-11-02','stable',[mark('s1'),mark('b')]);assert.equal(replay.idempotent,true);
});
test('reusing a day key with different disposition conflicts',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','stable',[mark()])));
  const changed=close(model,journal,'2026-11-02','stable',[mark('s1','MISSED')]);assert.equal(changed.code,'IDEMPOTENCY_CONFLICT');
});
test('fresh dayKey without correctionOf cannot duplicate a closed date',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','stable',[mark()])));
  assert.equal(close(model,journal,'2026-11-02','different',[mark()]).code,'DAY_ALREADY_CLOSED');
});
test('stale expected revision fails for a new close; state stays unchanged',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','stable',[mark()])));
  const r=close(model,journal,'2026-11-03','next',[mark('s2')],{expectedModelRevision:0});
  assert.equal(r.code,'STALE_REVISION');assert.equal(r.proposedJournal,null);
});
test('correction needs exact active previous dayKey and new key',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','old',[mark()])));
  assert.equal(close(model,journal,'2026-11-02','new',[mark()],{correctionOfDayKey:'not-old'}).code,'INVALID_CORRECTION_TARGET');
});
test('correction appends superseding records, recalculates later days, retains original revisions',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark('s1','MISSED')])));
  ({model,journal}=next(close(model,journal,'2026-11-03','b',[mark('s2','ATTENDED')])));
  ({model,journal}=next(close(model,journal,'2026-11-04','c',[])));
  const before=structuredClone(journal);const r=close(model,journal,'2026-11-02','fix',[mark('s1','ATTENDED')],{correctionOfDayKey:'a'});
  assert.equal(r.ok,true);assert.equal(r.code,'DAY_CORRECTED');assert.deepEqual(r.registerTotals,{lecture:{attended:81,held:102}});
  assert.equal(r.proposedModel.snapshots.at(-1).date,'2026-11-04');assert.equal(r.proposedJournal.records.at(-1).recordRevision,2);
  assert.equal(r.proposedJournal.records.at(-1).supersedesRecordId,journal.records[0].recordId);
  assert.equal(r.proposedJournal.closedDays.at(-1).supersedesDayKey,'a');assert.deepEqual(journal,before);
  assert.equal(validateAttendanceJournal(r.proposedModel,r.proposedJournal).ok,true);
});
test('second correction must supersede latest close, not original',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  ({model,journal}=next(close(model,journal,'2026-11-02','b',[mark('s1','MISSED')],{correctionOfDayKey:'a'})));
  assert.equal(close(model,journal,'2026-11-02','c',[mark()],{correctionOfDayKey:'a'}).code,'INVALID_CORRECTION_TARGET');
  const nextFix=close(model,journal,'2026-11-02','c',[mark()],{correctionOfDayKey:'b'});
  assert.equal(nextFix.ok,true);assert.equal(nextFix.proposedJournal.records.at(-1).recordRevision,3);
});
test('a pre-official-baseline historical correction requires reconciliation',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  const baseline={id:'official-2',date:'2026-11-03',counts:{lecture:{attended:12,held:20}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:3};
  const cut=reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:baseline,clock});
  assert.equal(cut.ok,true);({model,journal}=next(cut));
  const r=close(model,journal,'2026-11-02','new',[mark('s1','MISSED')],{correctionOfDayKey:'a'});
  assert.equal(r.code,'REQUIRES_OFFICIAL_RECONCILIATION');
});
test('moved occurrence cannot be counted on another day or silently rewritten after recording',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  model.sessions.find(s=>s.id==='s1').date='2026-11-04';
  const r=close(model,journal,'2026-11-03','b',[mark('s2')]);assert.equal(r.code,'INVALID_JOURNAL');
  assert.ok(r.issues.some(i=>i.code==='HISTORICAL_OCCURRENCE_CONFLICT'));
});
test('changed recorded weight or register causes historical conflict',()=>{
  for(const change of [{weight:2},{registerId:'other'}]){
    let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
    Object.assign(model.sessions.find(s=>s.id==='s1'),change);
    const r=close(model,journal,'2026-11-03','b',[mark('s2')]);assert.equal(r.ok,false);
    assert.ok(r.issues.some(i=>i.code==='HISTORICAL_OCCURRENCE_CONFLICT'||i.code==='UNKNOWN_REGISTER'));
  }
});
test('completed session later marked cancelled cannot erase prior attendance',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  model.sessions.find(s=>s.id==='s1').cancelled=true;
  const r=close(model,journal,'2026-11-03','b',[mark('s2')]);assert.equal(r.code,'INVALID_JOURNAL');
});
test('future dates and unfinished current day are not closable',()=>{
  const {model,journal}=mk();
  assert.equal(close(model,journal,'2026-11-02','a',[mark()],{date:'2026-11-06'}).ok,false);
  const unfinished=evaluateDayClose({model,journal,request:request(model),clock:{...clock,date:'2026-11-02',time:'09:59'}});
  assert.equal(unfinished.code,'SESSION_NOT_FINISHED');
  const started=evaluateDayClose({model,journal,request:request(model),clock:{...clock,date:'2026-11-02',time:'10:00'}});
  assert.equal(started.ok,true);
});
test('all registers have complete totals and only relevant register gets credited',()=>{
  const {model,journal}=mk();model.registers.push({id:'lab',courseId:'physics',name:'Lab',requiredBps:7500,personalMinBps:null,bufferBps:0});
  model.snapshots[0].counts.lab={attended:2,held:4};model.sessions.push(makeSession('lab-1','2026-11-02','lab',2,'11:00','12:00'));
  const r=close(model,journal,'2026-11-02','a',[mark('s1','MISSED'),mark('lab-1','ATTENDED','lab')]);
  assert.deepEqual(r.registerTotals,{lecture:{attended:79,held:101},lab:{attended:4,held:6}});
});
test('daily totals do not absorb planned break commitments',()=>{
  let {model,journal}=mk();model.commitments=[{id:'break-1',date:'2026-11-02',createdAtRevision:0}];
  const r=close(model,journal,'2026-11-02','a',[mark('s1','ATTENDED')]);
  assert.equal(r.ok,true);assert.deepEqual(r.registerTotals,{lecture:{attended:80,held:101}});assert.deepEqual(r.proposedModel.commitments,model.commitments);
});
test('invalid journal duplicate record is rejected',()=>{
  const {model,journal}=mk();const r=close(model,journal,'2026-11-02','a',[mark()]);const bad=r.proposedJournal;
  bad.records.push({...bad.records[0]});const v=validateAttendanceJournal(r.proposedModel,bad);
  assert.equal(v.ok,false);assert.ok(v.issues.some(i=>i.code==='DUPLICATE_RECORD_ID'));
});
test('official snapshot conflicts are logged without changing historical marks',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark('s1','MISSED')])));
  ({model,journal}=next(close(model,journal,'2026-11-03','b',[mark('s2','ATTENDED')])));
  const original=structuredClone(journal.records);
  const snap={id:'official-next',date:'2026-11-03',counts:{lecture:{attended:99,held:120}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:4};
  const r=reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:snap,clock});assert.equal(r.ok,true,r.issues.map(i=>i.message).join(' '));
  assert.ok(r.proposedJournal.reconciliationIssues.some(s=>s.startsWith('OFFICIAL_COUNT_DISCREPANCY:official-next:lecture')));
  assert.deepEqual(r.proposedJournal.records,original);assert.equal(r.proposedJournal.officialSnapshotIds.at(-1),'official-next');
});
test('official cutover excludes prior closed records and counts only later confirmed sessions',()=>{
  let {model,journal}=mk();model.schedule.teachingEnd='2026-11-06';model.sessions.push(makeSession('s5','2026-11-05'));
  ({model,journal}=next(close(model,journal,'2026-11-02','a',[mark('s1','MISSED')])));
  const official={id:'official-cutover',date:'2026-11-04',counts:{lecture:{attended:20,held:30}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:3};
  ({model,journal}=next(reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:official,clock})));
  const r=close(model,journal,'2026-11-05','new',[mark('s5')]);assert.equal(r.ok,true);
  assert.deepEqual(r.registerTotals,{lecture:{attended:21,held:31}});
  assert.equal(r.proposedJournal.records.length,2,'old records must survive cutover');
});
test('an official snapshot may report unreconciled missing intervals but never invent marks',()=>{
  let {model,journal}=mk();const official={id:'official-new',date:'2026-11-03',counts:{lecture:{attended:50,held:60}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:2};
  const r=reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:official,clock});assert.equal(r.ok,true);
  assert.equal(r.proposedJournal.records.length,0);assert.ok(r.proposedJournal.reconciliationIssues.some(s=>s.includes('INCOMPLETE')));
});
test('official snapshot may not regress behind a daily-derived snapshot',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  const official={id:'official-old',date:'2026-11-01',counts:{lecture:{attended:20,held:30}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:3};
  assert.equal(reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:official,clock}).code,'INVALID_OFFICIAL_SNAPSHOT');
});
test('reconciliation rejects malformed official count and clock',()=>{
  const {model,journal}=mk();const official={id:'official-invalid',date:'2026-11-01',counts:{lecture:{attended:4,held:2}},confirmed:true,completeToday:false,confirmedAt:clock,sequence:2};
  assert.equal(reconcileOfficialSnapshot({previousModel:model,journal,officialSnapshot:official,clock}).ok,false);
});
test('draft viewing shows UNKNOWN for untouched day, confirmed dispositions after closure',()=>{
  let {model,journal}=mk();let v=viewAttendanceDay({model,journal,date:'2026-11-02'});
  assert.equal(v.marks[0].disposition,'UNKNOWN');assert.equal(v.confirmed,false);
  ({model,journal}=next(close(model,journal,'2026-11-02','a',[mark('s1','NOT_HELD')])));
  v=viewAttendanceDay({model,journal,date:'2026-11-02'});assert.equal(v.confirmed,true);assert.equal(v.marks[0].disposition,'NOT_HELD');
});
test('invalid journal official snapshot marker cannot be silently guessed',()=>{
  const {model,journal}=mk();journal.officialSnapshotIds=[];
  assert.equal(evaluateDayClose({model,journal,request:request(model),clock}).code,'INVALID_JOURNAL');
});
test('unconfirmed day is not appended to records or snapshots',()=>{
  const {model,journal}=mk();const before=JSON.stringify({model,journal});
  const r=close(model,journal,'2026-11-02','key',[mark('s1','UNKNOWN')]);assert.equal(r.ok,false);
  assert.equal(JSON.stringify({model,journal}),before);
});
test('caller cannot inject weight, confirmedAt or observedAt',()=>{
  const {model,journal}=mk();
  assert.equal(close(model,journal,'2026-11-02','k',[{...mark(),weight:500}]).code,'INVALID_MARK');
  assert.equal(close(model,journal,'2026-11-02','k',[mark()],{confirmedAt:clock}).code,'INVALID_REQUEST');
  assert.equal(close(model,journal,'2026-11-02','k',[mark()],{observedAt:clock}).code,'INVALID_REQUEST');
});
test('an old journal confirmation from the future is rejected',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  model.snapshots.at(-1).confirmedAt={...clock,date:'2026-11-02',time:'10:00'};
  model.snapshots.at(-1).completeToday=true;
  const incoming=evaluateDayClose({model,journal,request:request(model,'2026-11-03','b',[mark('s2')]),clock:{...clock,date:'2026-11-03',time:'10:00'}});
  assert.equal(incoming.code,'FUTURE_JOURNAL_CLOCK');
});
test('tampered journal with incomplete closed day does not count anything',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  journal.closedDays[0].recordIds=[];
  const r=deriveAttendanceTotals({model,journal,throughDate:'2026-11-02'});
  assert.equal(r.ok,false);assert.ok(r.issues.some(i=>i.code==='INCOMPLETE_DAY_LINKS'||i.code==='INCOMPLETE_CONFIRMED_DAY'));
});
test('foreign official marker and reused record linkage are not accepted',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  journal.officialSnapshotIds.push('foreign');
  assert.equal(validateAttendanceJournal(model,journal).ok,false);
});
test('snapshot id conflict cannot silently overwrite an older snapshot',()=>{
  const {model,journal}=mk();model.snapshots[0].id=`${model.id}:snapshot:2`;model.snapshots[0].sequence=1;
  journal.officialSnapshotIds=[model.snapshots[0].id];
  const r=close(model,journal,'2026-11-02','a',[mark()]);
  assert.equal(r.code,'SNAPSHOT_ID_CONFLICT');
});
test('same-day confirmation requires all active meetings to finish',()=>{
  const {model,journal}=mk();model.sessions.push(makeSession('s1-late','2026-11-02','lecture',1,'15:00','16:00'));
  const r=evaluateDayClose({model,journal,request:request(model,'2026-11-02','a',[mark(),mark('s1-late')]),clock:{...clock,date:'2026-11-02',time:'15:59'}});
  assert.equal(r.code,'SESSION_NOT_FINISHED');
});
test('tampered same-day close timestamp before the last session end is rejected',()=>{
  let {model,journal}=mk();({model,journal}=next(close(model,journal,'2026-11-02','a',[mark()])));
  journal.closedDays[0].confirmedAt={...clock,date:'2026-11-02',time:'09:59'};
  journal.records[0].confirmedAt={...journal.closedDays[0].confirmedAt};
  assert.ok(validateAttendanceJournal(model,journal).issues.some(i=>i.code==='PREMATURE_DAY_CLOSE'));
});
test('pure proposal can be evaluated by unchanged engine before A commits',async()=>{
  const {evaluatePlan}=await import('../../src/engine/plan.js');
  const {model,journal}=mk();const result=close(model,journal,'2026-11-02','a',[mark()]);
  assert.equal(result.ok,true);
  const evaluation=evaluatePlan(result.proposedModel,{additionalDates:[],clock});
  assert.equal(evaluation.contractVersion,'1.1.0');
  assert.notEqual(evaluation.status,'INVALID_SETUP');
  assert.equal(model.revision,0,'engine evaluation did not mutate baseline');
});
test('deterministic varied weighted outcomes independently match exact register sums',()=>{
  const outcomes=['ATTENDED','MISSED','NOT_HELD'];
  for(let i=0;i<75;i++){
    const {model,journal}=mk();
    model.sessions=[makeSession('unit-a','2026-11-02','lecture',1+i%7,'09:00','10:00'),makeSession('unit-b','2026-11-02','lecture',1+(i*3)%5,'11:00','12:00')];
    const a=outcomes[i%3],b=outcomes[Math.floor(i/3)%3],wa=model.sessions[0].weight,wb=model.sessions[1].weight;
    const r=close(model,journal,'2026-11-02',`weight-${i}`,[mark('unit-b',b),mark('unit-a',a)]);
    assert.equal(r.ok,true,`weighted case ${i}: ${JSON.stringify(r.issues)}`);
    const expectedAttended=79+(a==='ATTENDED'?wa:0)+(b==='ATTENDED'?wb:0);
    const expectedHeld=100+(a!=='NOT_HELD'?wa:0)+(b!=='NOT_HELD'?wb:0);
    assert.deepEqual(r.registerTotals.lecture,{attended:expectedAttended,held:expectedHeld});
  }
});
