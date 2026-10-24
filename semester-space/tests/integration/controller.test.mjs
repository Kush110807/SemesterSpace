import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../src/controller.js';
import { loadModel, saveModel } from '../../src/storage.js';
import { makeCombinedModel, FIXED_CLOCK, makeInvalidInputCases } from '../../src/shared/fixtures.js';
import * as realEngine from '../../src/engine/index.js';
import { STORAGE_KEY, CONTRACT_VERSION } from '../../src/shared/constants.js';

// Explicit dependency test double: these tests verify A's wiring, NOT B's attendance math.
const result=(model,clock,status='MEETS_PLANNING_RULES')=>({contractVersion:CONTRACT_VERSION,status,modelRevision:model.revision,evaluatedAt:structuredClone(clock),issues:[],firstFailure:null,registers:[],dates:[],combinedAbsenceDates:[],assumptions:[]});
function harness({saved=makeCombinedModel(),failSave=false,stale=false}={}) {
  const calls=[],writes=[],disk=new Map(saved?[[STORAGE_KEY,JSON.stringify({schemaVersion:1,model:saved})]]:[]);
  let clock=structuredClone(FIXED_CLOCK);
  const storage={getItem:k=>disk.get(k)??null,setItem(k,v){if(failSave)throw new Error('Quota');writes.push([k,v]);disk.set(k,v);}};
  const engine={
    validateModel:()=>({ok:true,issues:[]}),
    evaluatePlan(m,req){calls.push(structuredClone(req));return result(m,req.clock,stale&&req.clock.time>='09:00'?'ATTENDANCE_UPDATE_NEEDED':'MEETS_PLANNING_RULES');},
    suggestPlan(m,{clock}){const evaluation=result(m,clock);return{evaluation,batch:{modelRevision:m.revision,evaluatedAt:structuredClone(clock),dates:['2026-11-02','2026-11-03'],evaluation},search:{requested:2,found:2,outcome:'COMPLETE',considered:2,rejections:[],preferenceWarnings:[]}};}
  };
  const app=createController({engine,render(){},storage,clock:()=>structuredClone(clock)});
  return{app,engine,storage,writes,disk,calls,setClock:c=>{clock=c;}};
}
test('controller wiring: demo is in memory and restores personal state',()=>{
  const h=harness(),before=h.app.getState().model;h.app.callbacks.onEnterDemo();
  assert.equal(h.app.getState().mode,'demo');assert.deepEqual(h.calls.at(-1).clock,FIXED_CLOCK);
  h.app.callbacks.onSetPreferences({...h.app.getState().model.preferences,requestedDays:1});
  assert.equal(h.writes.length,0);h.app.callbacks.onExitDemo();assert.deepEqual(h.app.getState().model,before);
});
test('controller wiring: checked subset is re-evaluated and committed once atomically',()=>{
  const h=harness();h.app.callbacks.onSuggest();h.app.callbacks.onAccept({dates:['2026-11-03'],modelRevision:0});
  assert.deepEqual(h.calls.at(-2).additionalDates,['2026-11-03']);
  assert.deepEqual(h.app.getState().model.commitments.map(c=>c.date),['2026-11-03']);
  assert.equal(h.app.getState().model.revision,1);assert.equal(h.app.getState().batch,null);
  assert.equal(h.writes.length,1);assert.equal(JSON.parse(h.writes[0][1]).model.snapshots[0].counts.lecture.attended,79);
});
test('controller wiring: matching revision cannot bypass current-time freshness',()=>{
  const h=harness({stale:true});h.app.callbacks.onSuggest();h.setClock({...FIXED_CLOCK,time:'09:00'});
  h.app.callbacks.onAccept({dates:['2026-11-02'],modelRevision:0});
  assert.equal(h.app.getResults().evaluation.status,'ATTENDANCE_UPDATE_NEEDED');
  assert.deepEqual(h.app.getState().model.commitments,[]);assert.equal(h.writes.length,0);assert.equal(h.app.getState().batch,null);
});
test('D B3: clock crossing between preflight and final evaluation aborts every write',()=>{
  const h=harness({stale:true});h.setClock({...FIXED_CLOCK,time:'08:59'});h.app.callbacks.onSuggest();
  const before=h.app.getState().model,original=h.engine.evaluatePlan;
  h.engine.evaluatePlan=(m,request)=>{
    const evaluation=original(m,request);
    if(m.revision===0 && request.additionalDates.length)h.setClock({...FIXED_CLOCK,time:'09:00'});
    return evaluation;
  };
  h.app.callbacks.onAccept({dates:['2026-11-02'],modelRevision:0});
  assert.equal(h.app.getResults().evaluation.status,'ATTENDANCE_UPDATE_NEEDED');
  assert.deepEqual(h.app.getState().model,before);
  assert.equal(h.writes.length,0);assert.equal(h.app.getState().batch,null);
  assert.doesNotMatch(h.app.getState().notice,/Selected dates committed/);
});
test('D B4: initialization rejects a changed draft roster without expanding or saving',()=>{
  const saved=makeCombinedModel();saved.schedule.initialized=false;
  const h=harness({saved}),before=h.app.getState().model;
  let expansions=0;
  h.engine.expandSchedule=()=>{expansions++;return{ok:true,issues:[],sessions:[{...saved.sessions[0],registerId:'new-reg'}]};};
  h.app.callbacks.onInitializeSchedule({draft:{schedule:structuredClone(saved.schedule),courses:[{id:'new-course',name:'New',mustAttend:false}],registers:[{...saved.registers[0],id:'new-reg',courseId:'new-course'}],extraSessions:[],overrides:[]}});
  assert.deepEqual(h.app.getState().model,before);assert.equal(h.writes.length,0);assert.equal(expansions,0);
});
test('D B4: matching roster initializes without replacing actual counts or roster',()=>{
  const saved=makeCombinedModel();saved.schedule.initialized=false;
  const h=harness({saved}),before=h.app.getState().model;
  h.engine.expandSchedule=()=>({ok:true,issues:[],sessions:structuredClone(saved.sessions)});
  h.app.callbacks.onInitializeSchedule({draft:{schedule:structuredClone(saved.schedule),courses:structuredClone(saved.courses),registers:structuredClone(saved.registers),extraSessions:[],overrides:[]}});
  assert.equal(h.app.getState().model.schedule.initialized,true);assert.equal(h.writes.length,1);
  assert.deepEqual(h.app.getState().model.courses,before.courses);assert.deepEqual(h.app.getState().model.registers,before.registers);assert.deepEqual(h.app.getState().model.snapshots,before.snapshots);
});
test('D B3: post-commit PLAN_BLOCKED also aborts while ordinary edits may retain conflicts',()=>{
  const h=harness();h.app.callbacks.onSuggest();const original=h.engine.evaluatePlan;
  h.engine.evaluatePlan=(m,request)=>result(m,request.clock,m.commitments.length?'PLAN_BLOCKED':'MEETS_PLANNING_RULES');
  h.app.callbacks.onAccept({dates:['2026-11-02'],modelRevision:0});
  assert.deepEqual(h.app.getState().model.commitments,[]);assert.equal(h.writes.length,0);
  h.engine.evaluatePlan=(m,request)=>({...original(m,request),status:'ATTENDANCE_UPDATE_NEEDED'});
  h.app.callbacks.onSetPreferences({...h.app.getState().model.preferences,requestedDays:1});
  assert.equal(h.writes.length,1);assert.equal(h.app.getResults().evaluation.status,'ATTENDANCE_UPDATE_NEEDED');
});
test('D B1: controller does not print an invented requested K for invalid input',()=>{
  const h=harness();h.engine.suggestPlan=()=>structuredClone(makeInvalidInputCases().find(c=>c.id==='invalid-k').expectedSearch);
  h.app.callbacks.onSuggest();assert.equal(h.app.getResults().evaluation.status,'INVALID_SETUP');
  assert.doesNotMatch(h.app.getState().notice,/requested null|requested 0|Found/);assert.equal(h.app.getState().batch,null);
});
test('D B2 initial setup: controller stamps confirmation and uses one clock without changing caller counts',()=>{
  const h=harness({saved:null}),incoming=makeCombinedModel(),before=structuredClone(incoming);
  const transactionClock={...FIXED_CLOCK,time:'08:30'},validations=[];
  h.setClock(transactionClock);
  h.engine.validateModel=(m,clock)=>{
    validations.push({clock:structuredClone(clock),confirmedAt:structuredClone(m.snapshots[0].confirmedAt)});
    h.setClock({...FIXED_CLOCK,time:'08:31'});
    return {ok:true,issues:[]};
  };
  h.app.callbacks.onReplaceSetup({model:incoming});
  assert.deepEqual(validations,[{clock:transactionClock,confirmedAt:transactionClock}]);
  assert.deepEqual(h.calls.at(-1).clock,transactionClock);
  const saved=JSON.parse(h.writes[0][1]).model;
  assert.deepEqual(saved.snapshots[0].confirmedAt,transactionClock);
  assert.equal(saved.snapshots[0].date,before.snapshots[0].date);
  assert.deepEqual(saved.snapshots[0].counts,before.snapshots[0].counts);
  assert.deepEqual(incoming,before);assert.equal(h.writes.length,1);
});
test('controller wiring: preference change clears a batch and keeps commitments',()=>{
  const h=harness();h.app.callbacks.onSuggest();h.app.callbacks.onSetPreferences({...h.app.getState().model.preferences,requestedDays:1});
  assert.equal(h.app.getState().batch,null);assert.equal(h.app.getState().model.revision,1);
  h.app.callbacks.onAccept({dates:['2026-11-02'],modelRevision:0});assert.deepEqual(h.app.getState().model.commitments,[]);
});
test('controller wiring: duplicate/foreign selections cannot commit any dates',()=>{
  for(const dates of [['2026-11-02','2026-11-02'],['2026-11-04']]){
    const h=harness();h.app.callbacks.onSuggest();h.app.callbacks.onAccept({dates,modelRevision:0});
    assert.deepEqual(h.app.getState().model.commitments,[]);assert.equal(h.writes.length,0);
  }
});
test('controller wiring: invalid manual replacement cannot recheck an old selection',()=>{
  const h=harness();h.app.callbacks.onSetManualDates({dates:['2026-11-02']});h.app.callbacks.onCheckManual();
  assert.ok(h.app.getState().batch);
  h.app.callbacks.onSetManualDates({dates:['2026-11-03','2026-11-03']});h.app.callbacks.onCheckManual();
  assert.deepEqual(h.app.getState().manualDates,[]);assert.equal(h.app.getState().batch,null);
});
test('controller wiring: snapshots append without changing old actual counts',()=>{
  const h=harness(),old=structuredClone(h.app.getState().model.snapshots[0]);
  h.app.callbacks.onConfirmSnapshot({date:'2026-11-01',counts:{lecture:{attended:80,held:100}},confirmed:true,completeToday:false});
  const snapshots=h.app.getState().model.snapshots;assert.deepEqual(snapshots[0],old);assert.equal(snapshots[1].sequence,2);assert.equal(snapshots[1].counts.lecture.attended,80);
});
test('controller wiring: regressed snapshot is rejected without touching state',()=>{
  const h=harness(),old=h.app.getState().model;
  h.app.callbacks.onConfirmSnapshot({date:'2026-10-31',counts:{lecture:{attended:80,held:100}},confirmed:true,completeToday:false});
  assert.deepEqual(h.app.getState().model,old);assert.equal(h.writes.length,0);
});
test('controller wiring: unexpected engine failure cannot partially commit',()=>{
  const h=harness();h.app.callbacks.onSuggest();const old=h.app.getState().model;
  const original=h.engine.evaluatePlan;h.engine.evaluatePlan=(m,r)=>{if(m.revision>0)throw new Error('Engine bug');return original(m,r);};
  h.app.callbacks.onAccept({dates:['2026-11-02'],modelRevision:0});
  assert.deepEqual(h.app.getState().model,old);assert.equal(h.writes.length,0);assert.equal(h.app.getResults().runtime,'ERROR');
});
test('storage: corrupt data is quarantined without overwriting it',()=>{
  let writes=0;const storage={getItem:()=>'{bad',setItem(){writes++;}};
  const loaded=loadModel(storage,()=>({ok:true,issues:[]}),FIXED_CLOCK);
  assert.equal(loaded.model,null);assert.equal(loaded.persistence.status,'QUARANTINED');assert.equal(writes,0);
});
test('storage: schema-valid but engine-invalid data stays quarantined',()=>{
  const loaded=loadModel({getItem:()=>JSON.stringify({schemaVersion:1,model:makeCombinedModel()})},()=>({ok:false,issues:[{message:'Invalid counts'}]}),FIXED_CLOCK);
  assert.equal(loaded.persistence.status,'QUARANTINED');assert.match(loaded.persistence.message,/Invalid counts/);
});
test('storage: quota failure is disclosed while in-memory updates survive',()=>{
  const h=harness({failSave:true});h.app.callbacks.onSetPreferences({...h.app.getState().model.preferences,requestedDays:1});
  assert.equal(h.app.getState().model.preferences.requestedDays,1);assert.equal(h.app.getState().persistence.status,'FAILED');
  assert.equal(saveModel({setItem(){throw new Error('disabled');}},{}).status,'FAILED');
});
test('real facade: demo calculates and commits without overwriting personal storage',()=>{
  let writes=0;
  const app=createController({engine:realEngine,render(){},storage:{getItem:()=>null,setItem(){writes++;}},clock:()=>FIXED_CLOCK});
  app.callbacks.onEnterDemo();assert.equal(app.getResults().runtime,'READY');assert.equal(app.getResults().evaluation.status,'MEETS_PLANNING_RULES');
  app.callbacks.onSuggest();const batch=app.getState().batch;assert.equal(batch.dates.length,2);
  app.callbacks.onAccept({dates:[batch.dates[0]],modelRevision:batch.modelRevision});
  assert.equal(app.getState().model.commitments.length,1);assert.equal(app.getState().batch,null);assert.equal(writes,0);
  app.callbacks.onExitDemo();assert.equal(app.getState().model,null);assert.equal(app.getResults().runtime,'NO_SETUP');
});
