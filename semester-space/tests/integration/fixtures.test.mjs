import test from 'node:test';
import assert from 'node:assert/strict';
import { ARITHMETIC_CASES, makeCombinedModel, makeRecoveryModel } from '../../src/shared/fixtures.js';
// Independent fraction arithmetic verifies stated expectations; no engine imported here.
for(const c of ARITHMETIC_CASES)test(`fixture arithmetic only: ${c.id}`,()=>{
  let a=BigInt(c.attended),h=BigInt(c.held),first=null;
  const above=()=>h===0n||a*10000n>=h*BigInt(c.floorBps);
  let pass=above();
  c.steps.forEach((attend,i)=>{a+=BigInt(attend);h++;if(!above()){pass=false;if(first===null)first=i;}});
  assert.equal(pass,c.pass);assert.deepEqual([Number(a),Number(h)],c.final);
  if('firstFailIndex'in c)assert.equal(first,c.firstFailIndex);
});
test('fixture arithmetic only: recovery first reaches F after two attended units',()=>{
  assert.ok(38n*10000n<49n*7800n);assert.equal(39n*10000n,50n*7800n);
  const m=makeRecoveryModel();assert.equal(m.sessions.find(s=>s.id==='s2').date,'2026-11-04');
});
test('fixture isolation: fresh factories do not share mutable counts',()=>{
  const a=makeCombinedModel();a.snapshots[0].counts.lecture.attended=0;
  assert.equal(makeCombinedModel().snapshots[0].counts.lecture.attended,79);
});
