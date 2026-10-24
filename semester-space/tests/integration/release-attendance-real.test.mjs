import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../../src/controller.js';
import {loadModel} from '../../src/storage.js';
import {STORAGE_KEY} from '../../src/shared/constants.js';
import {makeCombinedModel} from '../../src/shared/fixtures.js';
import * as engine from '../../src/engine/index.js';
import * as attendance from '../../src/attendance/ledger.js';

const copy=x=>structuredClone(x);
const CLOCK={date:'2026-11-05',time:'18:00',timeZone:'Asia/Kolkata'};
function harness({writeFails=false,engineModule=engine}={}) {
 const memory=new Map([[STORAGE_KEY,JSON.stringify({schemaVersion:1,model:makeCombinedModel()})]]);
 let writes=0;
 const storage={getItem:k=>memory.get(k)??null,setItem(k,v){if(writeFails)throw Error('SIMULATED_WRITE_FAILURE');memory.set(k,v);writes++;}};
 const create=()=>createController({engine:engineModule,attendance,storage,clock:()=>copy(CLOCK),render(){}});
 return {app:create(),create,storage,memory,get writes(){return writes;}};
}
const request=(app,date,dayKey,marks,extra={})=>({expectedModelRevision:app.getState().model.revision,
 date,dayKey,marks,confirmCompleteDay:true,confirmNoUnlistedMeetings:true,...extra});
const mark=(id,disposition='ATTENDED',note='')=>({occurrenceId:id,registerId:'lecture',disposition,note});

test('real B daily module: closure, retry, correction, continuous day, official supersession and reload',()=>{
 const h=harness(),a=h.app;
 const initial=request(a,'2026-11-02','day:2:one',[mark('s1')]);
 const confirmed=a.callbacks.onConfirmAttendanceDay(initial);
 assert.equal(confirmed.ok,true,JSON.stringify(confirmed));
 assert.equal(a.getState().model.snapshots.at(-1).counts.lecture.attended,80);
 assert.equal(h.writes,1);
 assert.equal(a.callbacks.onConfirmAttendanceDay(initial).code,'ALREADY_CONFIRMED');
 assert.equal(h.writes,1);
 const conflicted={...initial,marks:[mark('s1','MISSED')]};
 assert.equal(a.callbacks.onConfirmAttendanceDay(conflicted).ok,false);
 const correction=request(a,'2026-11-02','day:2:correct',[mark('s1','MISSED','verified')],{correctionOfDayKey:'day:2:one'});
 const corrected=a.callbacks.onConfirmAttendanceDay(correction);
 assert.equal(corrected.ok,true,JSON.stringify(corrected));
 assert.equal(a.getState().model.snapshots.at(-1).counts.lecture.attended,79);
 assert.equal(a.getState().model.snapshots.at(-1).counts.lecture.held,101);
 assert.equal(h.writes,2);
 const ahead=request(a,'2026-11-04','day:4:premature',[]);
 assert.equal(a.callbacks.onConfirmAttendanceDay(ahead).ok,false);
 assert.equal(h.writes,2);
 const day3=request(a,'2026-11-03','day:3:one',[mark('s2','ATTENDED')]);
 const third=a.callbacks.onConfirmAttendanceDay(day3);
 assert.equal(third.ok,true,JSON.stringify(third));
 assert.deepEqual(a.getState().model.snapshots.at(-1).counts.lecture,{attended:80,held:102});
 assert.equal(h.writes,3);
 a.callbacks.onConfirmSnapshot({date:'2026-11-03',counts:{lecture:{attended:90,held:110}},confirmed:true,completeToday:false});
 assert.equal(h.writes,4,`Official snapshot failed: ${a.getState().notice}`);
 assert.deepEqual(a.getState().model.snapshots.at(-1).counts.lecture,{attended:90,held:110});
 assert.equal(a.getState().release.attendance.records.length,3);
 assert.ok(a.getState().release.attendance.reconciliationIssues.some(x=>x.startsWith('OFFICIAL_COUNT_DISCREPANCY:')));
 const day4=request(a,'2026-11-04','day:4:zero',[]);
 assert.equal(a.callbacks.onConfirmAttendanceDay(day4).ok,true);
 assert.deepEqual(a.getState().model.snapshots.at(-1).counts.lecture,{attended:90,held:110});
 assert.equal(h.writes,5);
 const reload=h.create();
 assert.equal(reload.getState().persistence.status,'SAVED');
 assert.deepEqual(reload.getState().model,a.getState().model);
 assert.deepEqual(reload.getState().release,a.getState().release);
 assert.equal(reload.callbacks.onConfirmAttendanceDay(initial).code,'ALREADY_CONFIRMED');
 assert.equal(h.writes,5);
 assert.equal(reload.callbacks.onConfirmAttendanceDay({...correction,expectedModelRevision:5,dayKey:'day:2:another',correctionOfDayKey:correction.dayKey}).ok,false);
 assert.equal(h.writes,5);
});

test('real B adapter + A persistence: no writes or in-memory changes on failure',()=>{
 const h=harness({writeFails:true}),initial=h.app.getState();
 const response=h.app.callbacks.onConfirmAttendanceDay(request(h.app,'2026-11-02','day:fail',[mark('s1')]));
 assert.equal(response.code,'PERSISTENCE_FAILED');
 assert.equal(h.writes,0);
 assert.deepEqual(h.app.getState().model,initial.model);
 assert.deepEqual(h.app.getState().release,initial.release);
 assert.equal(loadModel(h.storage,engine.validateModel,CLOCK).release.attendance.records.length,0);
});

test('real B snapshot reconciliation refuses backdated snapshot and preserves everything',()=>{
 const h=harness();
 assert.equal(h.app.callbacks.onConfirmAttendanceDay(request(h.app,'2026-11-02','day:closed',[mark('s1')])).ok,true);
 const prior=h.app.getState();
 h.app.callbacks.onConfirmSnapshot({date:'2026-11-01',counts:{lecture:{attended:90,held:110}},confirmed:true,completeToday:false});
 assert.equal(h.writes,1);
 assert.deepEqual(h.app.getState().model,prior.model);
 assert.deepEqual(h.app.getState().release,prior.release);
});

test('real B rejects incomplete marks and protects day after unresolved gap',()=>{
 const h=harness();
 const incomplete=h.app.callbacks.onConfirmAttendanceDay(request(h.app,'2026-11-02','day:incomplete',[]));
 assert.equal(incomplete.ok,false);
 assert.equal(h.writes,0);
 const skipped=h.app.callbacks.onConfirmAttendanceDay(request(h.app,'2026-11-03','day:skipped',[mark('s2')]));
 assert.equal(skipped.ok,false);
 assert.equal(h.writes,0);
});

test('stored attendance record with moved occurrence is quarantined rather than silently rewritten',()=>{
 const h=harness();
 assert.equal(h.app.callbacks.onConfirmAttendanceDay(request(h.app,'2026-11-02','day:recorded',[mark('s1')])).ok,true);
 const envelope=JSON.parse(h.memory.get(STORAGE_KEY));
 envelope.model.sessions.find(s=>s.id==='s1').date='2026-11-04';
 const persisted=JSON.stringify(envelope);
 h.memory.set(STORAGE_KEY,persisted);
 const loaded=loadModel(h.storage,engine.validateModel,CLOCK);
 assert.equal(loaded.persistence.status,'QUARANTINED');
 assert.equal(loaded.model,null);
 assert.equal(h.memory.get(STORAGE_KEY),persisted);
});

test('dayKey replay cannot swap its original correction target',()=>{
 const h=harness(),a=h.app;
 const original=request(a,'2026-11-02','day:one',[mark('s1')]);
 assert.equal(a.callbacks.onConfirmAttendanceDay(original).ok,true);
 const second=request(a,'2026-11-02','day:two',[mark('s1','MISSED','changed')],{correctionOfDayKey:'day:one'});
 assert.equal(a.callbacks.onConfirmAttendanceDay(second).ok,true);
 const tampered={...second,correctionOfDayKey:'day:unrelated',expectedModelRevision:0};
 assert.equal(a.callbacks.onConfirmAttendanceDay(tampered).code,'IDEMPOTENCY_CONFLICT');
 assert.equal(h.writes,2);
});
