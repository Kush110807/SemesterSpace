import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_VERSION, STATUS } from '../../src/shared/constants.js';
import { makeInvalidInputCases, makeSnapshotTimingCases } from '../../src/shared/fixtures.js';

// These are contract-schema/fixture checks, NOT executions of B's pending engine.
for(const c of makeInvalidInputCases())test(`D B1 fixture schema only: ${c.id}`,()=>{
  const result=c.expectedPlan;
  assert.equal(result.contractVersion,CONTRACT_VERSION);assert.equal(result.status,STATUS.INVALID_SETUP);
  assert.deepEqual(Object.keys(result).sort(),['contractVersion','status','modelRevision','evaluatedAt','issues','firstFailure','registers','dates','combinedAbsenceDates','assumptions'].sort());
  assert.equal(result.firstFailure,null);assert.ok(result.issues.length>0);
  assert.equal(result.modelRevision,c.id==='missing-model'||c.id==='invalid-revision'?null:0);
  assert.equal(result.evaluatedAt===null,c.id==='missing-clock'||c.id==='malformed-clock');
  assert.equal(c.expectedSearch.search.requested,c.id==='missing-model'||c.id==='invalid-k'?null:2);
  assert.equal(c.expectedSearch.batch,null);assert.equal(c.expectedSearch.search.outcome,'BLOCKED');
  assert.doesNotThrow(()=>JSON.stringify(c));
});

for(const c of makeSnapshotTimingCases())test(`D B2 fixture timing only: ${c.id}`,()=>{
  const snapshot=c.model.snapshots[0],stamp=x=>`${x.date}T${x.time}`;
  // Independent direct timestamp inequalities, not a copy of a production validator.
  let complete=snapshot.confirmedAt.date>=snapshot.date && stamp(snapshot.confirmedAt)<=stamp(c.clock);
  if(snapshot.confirmedAt.date===snapshot.date){
    complete=complete && snapshot.completeToday===true && c.model.sessions.filter(s=>!s.cancelled&&s.date===snapshot.date).every(s=>s.end<=snapshot.confirmedAt.time);
  }
  assert.equal(complete,c.valid);
});
