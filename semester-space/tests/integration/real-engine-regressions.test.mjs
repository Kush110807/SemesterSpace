import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecoveryModel, FIXED_CLOCK } from '../../src/shared/fixtures.js';
import { evaluatePlan, validateModel } from '../../src/engine/index.js';
import * as engine from '../../src/engine/index.js';
import { createController } from '../../src/controller.js';
import { makeCombinedModel } from '../../src/shared/fixtures.js';

test('integration decision: recovery is per session when two meetings share a date',()=>{
  const model=makeRecoveryModel();
  model.sessions=model.sessions.filter(s=>s.registerId==='lecture');
  Object.assign(model.sessions[1],{date:'2026-11-02',start:'11:00',end:'12:00'});
  assert.equal(validateModel(model,FIXED_CLOCK).ok,true);
  const result=evaluatePlan(model,{additionalDates:[],clock:FIXED_CLOCK});
  assert.equal(result.status,'CONDITIONAL_RECOVERY');
  assert.equal(result.firstFailure,null);
  assert.deepEqual(result.registers[0].recovery,{status:'RECOVERABLE',sessionId:'s2',date:'2026-11-02'});
  assert.deepEqual([result.registers[0].final.attended,result.registers[0].final.held],[39,50]);
});

test('real integration: initial same-day snapshot fails before final end and passes at end',()=>{
  let clock={...FIXED_CLOCK,time:'09:59'},writes=[];
  const app=createController({engine,render(){},clock:()=>structuredClone(clock),storage:{getItem:()=>null,setItem:(key,value)=>writes.push(JSON.parse(value))}});
  const model=makeCombinedModel();
  Object.assign(model.snapshots[0],{date:'2026-11-02',completeToday:true,counts:{lecture:{attended:80,held:101}},confirmedAt:{...FIXED_CLOCK,date:'1999-01-01'}});
  model.attendanceConfirmation={throughDate:'2026-11-02',noUnlistedClasses:true};
  const original=structuredClone(model);
  app.callbacks.onReplaceSetup({model});
  assert.equal(app.getState().model,null);assert.equal(writes.length,0);
  assert.match(app.getResults().error,/Confirmation precedes/);
  clock={...clock,time:'10:00'};app.callbacks.onReplaceSetup({model});
  assert.equal(app.getResults().runtime,'READY');assert.equal(app.getResults().evaluation.status,'MEETS_PLANNING_RULES');
  assert.deepEqual(writes[0].model.snapshots[0].confirmedAt,clock);
  assert.deepEqual(writes[0].model.snapshots[0].counts,{lecture:{attended:80,held:101}});
  assert.deepEqual(model,original);
});
