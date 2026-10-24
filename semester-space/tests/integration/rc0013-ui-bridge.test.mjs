import test from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../../src/controller.js';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';
import {STORAGE_KEY} from '../../src/shared/constants.js';
import * as engine from '../../src/engine/index.js';
import * as attendance from '../../src/attendance/ledger.js';

const clone=x=>structuredClone(x);
const proposal={proposalVersion:1,proposalId:'bridge:1',baseModelRevision:0,
 source:{sha256:'deadbeef',fileName:'synthetic-revision.pdf',role:'ACADEMIC_CALENDAR',coverage:'COMPLETE',section:'Q',pageRefs:['p1']},
 scope:{start:'2026-11-01',end:'2026-11-04',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},
 changes:[{changeId:'holiday',kind:'ADD_HOLIDAY',occurrenceId:null,before:null,after:{date:'2026-11-04',label:'synthetic only'},evidence:{sourceId:'p1',page:1,excerpt:'synthetic fixture',basis:'DIRECT_SOURCE'},match:'ADDED',affectsConfirmedHistory:false}],unresolved:[],createdAtUntrusted:null};
function harness({fail=false}={}) {
 const data=new Map([[STORAGE_KEY,JSON.stringify({schemaVersion:1,model:makeCombinedModel()})]]);
 const rendered=[];let writes=0;
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw new Error('SIMULATED_WRITE_FAIL');data.set(k,v);writes++;}};
 const make=()=>createController({engine,attendance,storage,clock:()=>clone(FIXED_CLOCK),render(s){rendered.push(s)}});
 return {app:make(),make,rendered,data,get writes(){return writes}};
}
test('staging projects an immutable presentation copy with no storage mutation',()=>{
 const h=harness();
 assert.equal(h.app.getState().stagedCalendarRevision,null);
 const p=clone(proposal);
 const result=h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal:p});
 assert.equal(result.ok,true);
 assert.deepEqual(h.app.getState().stagedCalendarRevision,proposal);
 assert.deepEqual(h.rendered.at(-1).stagedCalendarRevision,proposal);
 assert.equal(h.writes,0);
 p.source.fileName='tampered';
 const leaked=h.app.getState();leaked.stagedCalendarRevision.source.fileName='tampered';
 h.rendered.at(-1).stagedCalendarRevision.source.fileName='tampered';
 assert.equal(h.app.getState().stagedCalendarRevision.source.fileName,proposal.source.fileName);
 assert.equal(h.app.getState().model.revision,0);
});
test('staged proposals clear on accepted edits, not on failed saves',()=>{
 const a=harness({fail:false}),b=harness({fail:true});
 for (const h of [a,b]) {
   assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
   h.app.callbacks.onSetCourseProtection({courseId:'physics',mustAttend:true});
 }
 assert.equal(a.app.getState().stagedCalendarRevision,null);
 assert.equal(a.writes,1);
 assert.deepEqual(b.app.getState().stagedCalendarRevision,proposal);
 assert.equal(b.writes,0);
 assert.equal(b.app.getState().model.revision,0);
});
test('staged proposal is not part of persisted v2 envelope or restored after reload',()=>{
 const h=harness();
 assert.equal(h.app.callbacks.onProposeCalendarRevision({expectedModelRevision:0,proposal}).ok,true);
 assert.equal(h.make().getState().stagedCalendarRevision,null);
 h.app.callbacks.onRefresh();
 assert.deepEqual(h.app.getState().stagedCalendarRevision,proposal);
});
