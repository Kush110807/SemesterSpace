import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePlan,validateModel} from '../../src/engine/index.js';
import {FIXED_CLOCK,makeCombinedModel,makeRecoveryModel,makeInvalidInputCases,makeSnapshotTimingCases} from '../../src/shared/fixtures.js';

test('real public engine: jointly missed dates fail at s2 with exact evidence',()=>{
  const m=makeCombinedModel(),snapshot=structuredClone(m);
  for(const [dates,status,a] of [[[], 'MEETS_PLANNING_RULES',81],[['2026-11-02'],'MEETS_PLANNING_RULES',80],[['2026-11-03'],'MEETS_PLANNING_RULES',80],[['2026-11-02','2026-11-03'],'PLAN_BLOCKED',79]]) {
    const r=evaluatePlan(m,{additionalDates:dates,clock:FIXED_CLOCK});
    assert.equal(r.status,status);assert.deepEqual([r.registers[0].final.attended,r.registers[0].final.held],[a,102]);
    if(dates.length===2){assert.equal(r.firstFailure.sessionId,'s2');assert.deepEqual(r.firstFailure.combinedAbsenceDates,dates);}
  }
  assert.deepEqual(m,snapshot,'engine never mutates model');
});
test('real public engine: existing recovery plus unrelated practical day',()=>{
  const m=makeRecoveryModel();
  assert.equal(evaluatePlan(m,{additionalDates:[],clock:FIXED_CLOCK}).status,'CONDITIONAL_RECOVERY');
  assert.equal(evaluatePlan(m,{additionalDates:['2026-11-02'],clock:FIXED_CLOCK}).firstFailure.kind,'RECOVERY');
  const r=evaluatePlan(m,{additionalDates:['2026-11-03'],clock:FIXED_CLOCK});
  assert.equal(r.status,'CONDITIONAL_RECOVERY');assert.deepEqual([r.registers[0].final.attended,r.registers[0].final.held],[39,50]);
});
test('real public engine: SS-PREP-002 malformed input metadata',()=>{
  for(const c of makeInvalidInputCases()) {
    const r=evaluatePlan(c.model,c.request);
    assert.equal(r.status,'INVALID_SETUP',c.id);
    assert.equal(r.modelRevision,c.expectedPlan.modelRevision,c.id);
    assert.deepEqual(r.evaluatedAt,c.expectedPlan.evaluatedAt,c.id);
    assert.ok(r.issues.some(i=>i.code===c.expectedPlan.issues[0].code&&i.path===c.expectedPlan.issues[0].path),c.id);
    for(const field of Object.keys(c.expectedPlan))assert.ok(Object.hasOwn(r,field),`missing ${field}`);
  }
});
test('real public engine: 7 snapshot confirmation timing boundaries',()=>{
  for(const c of makeSnapshotTimingCases())assert.equal(validateModel(c.model,c.clock).ok,c.valid,c.id);
});
