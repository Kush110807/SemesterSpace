import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../../src/engine/index.js';
import {createController} from '../../src/controller.js';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';

// B-owned test driving A's UNMODIFIED controller with the REAL engine, not doubles.
test('real controller -> real engine: check, suggest, commit, persist, invalidate',()=>{
  const items=new Map();
  const storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>{items.set(k,v);},removeItem:k=>items.delete(k)};
  let renders=0;
  const app=createController({engine,render:()=>{renders++;},storage,clock:()=>({...FIXED_CLOCK})});
  assert.equal(app.getResults().runtime,'NO_SETUP');
  const original=makeCombinedModel();app.callbacks.onReplaceSetup({model:original});
  assert.equal(app.getResults().runtime,'READY');
  assert.equal(app.getResults().evaluation.status,'MEETS_PLANNING_RULES');
  assert.equal(app.getResults().evaluation.registers[0].final.attended,81);
  app.callbacks.onSetManualDates({dates:['2026-11-02','2026-11-03']});
  app.callbacks.onCheckManual();
  assert.equal(app.getResults().evaluation.status,'PLAN_BLOCKED');
  assert.equal(app.getState().batch,null);
  assert.equal(app.getState().model.commitments.length,0);
  app.callbacks.onSuggest();
  assert.equal(app.getResults().search.search.found,1);
  const batch=app.getState().batch;assert.equal(batch.dates.length,1);
  app.callbacks.onAccept({dates:batch.dates,modelRevision:batch.modelRevision});
  assert.equal(app.getState().model.commitments.length,1);
  assert.equal(app.getState().model.revision,1);
  assert.equal(app.getResults().evaluation.status,'MEETS_PLANNING_RULES');
  assert.equal(JSON.parse(items.get('semesterspace.v1')).model.commitments.length,1);
  app.callbacks.onSetThreshold({registerId:'lecture',requiredBps:8500,personalMinBps:null,bufferBps:300});
  assert.equal(app.getResults().evaluation.status,'EXISTING_UNRECOVERABLE_SHORTFALL');
  assert.equal(app.getState().model.commitments.length,1,'editing threshold preserves existing commitment');
  assert.equal(app.getState().batch,null);
  assert.ok(renders>=7);
  assert.deepEqual(original,makeCombinedModel(),'caller input was not mutated');
});
