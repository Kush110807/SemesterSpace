import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCombinedModel,FIXED_CLOCK} from '../../src/shared/fixtures.js';
import {makeEmptyRelease,validateRelease,loadModel} from '../../src/storage.js';
import * as engine from '../../src/engine/index.js';
import {STORAGE_KEY} from '../../src/shared/constants.js';

const copy=x=>structuredClone(x);
const CURRENT='a'.repeat(64), PREVIOUS='b'.repeat(64), UNKNOWN='c'.repeat(64);
function original(){
  const model=makeCombinedModel(),release=makeEmptyRelease(model);
  release.calendar.sourceRevision={version:1,sha256:CURRENT,fileName:'calendar-2.pdf',
    source:{sha256:CURRENT,fileName:'calendar-2.pdf',role:'ACADEMIC_CALENDAR',coverage:'PARTIAL',section:'Q',pageRefs:[]},
    scope:{start:'2026-11-01',end:'2026-12-01',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},
    // Historical targets are not required to remain in the active Model.
    links:[{sourceRef:'change:historical',changeId:'change:historical',kind:'UPSERT_EVENT',
      targetId:'historical:removed-event',sourceSha256:PREVIOUS,
      value:{id:'historical:removed-event',title:'Previous event'},
      evidence:{sourceId:'legacy-calendar:page1',page:1,excerpt:'Prior reviewed evidence'}}],
    sourceHistory:[{sha256:PREVIOUS,fileName:'calendar-1.pdf'}]};
  return {model,release};
}
function read(envelope){
  let writes=0;const raw=JSON.stringify(envelope);
  const storage={getItem:k=>k===STORAGE_KEY?raw:null,setItem(){writes++}};
  const result=loadModel(storage,engine.validateModel,FIXED_CLOCK);
  return {result,writes,raw,storage};
}
function corrupted(mutate){
  const {model,release}=original();mutate(release);
  const entry={schemaVersion:2,model,release},loaded=read(entry);
  assert.equal(loaded.result.persistence.status,'QUARANTINED');
  assert.equal(loaded.result.model,null);
  assert.equal(loaded.writes,0,'quarantine cannot overwrite persisted bytes');
  assert.equal(loaded.storage.getItem(STORAGE_KEY),loaded.raw);
  assert.throws(()=>validateRelease(release,model));
}
test('valid historic crosswalk with inactive target remains readable without writes',()=>{
  const {model,release}=original();assert.equal(validateRelease(release,model),release);
  const {result,writes}=read({schemaVersion:2,model,release});
  assert.equal(result.persistence.status,'SAVED');assert.equal(writes,0);
  assert.equal(result.release.calendar.sourceRevision.links[0].targetId,'historical:removed-event');
});
test('legacy two-field calendar source remains loadable without mutation',()=>{
  const {model,release}=original();release.calendar.sourceRevision={sha256:PREVIOUS,fileName:'old.pdf'};
  const {result,writes}=read({schemaVersion:2,model,release});
  assert.equal(result.persistence.status,'SAVED');assert.equal(writes,0);
  assert.deepEqual(result.release.calendar.sourceRevision,{sha256:PREVIOUS,fileName:'old.pdf'});
});
test('bad SHA-256 at source root quarantines even when duplicated in source object',()=>{
  corrupted(r=>{r.calendar.sourceRevision.sha256='x';r.calendar.sourceRevision.source.sha256='x'});
});
test('bad SHA-256 at nested source quarantines',()=>{
  corrupted(r=>{r.calendar.sourceRevision.source.sha256='not-hex'});
});
test('bad SHA-256 in historical link quarantines',()=>{
  corrupted(r=>{r.calendar.sourceRevision.links[0].sourceSha256='not-a-hash'});
});
test('good-looking link SHA that is not in source lineage quarantines',()=>{
  corrupted(r=>{r.calendar.sourceRevision.links[0].sourceSha256=UNKNOWN});
});
test('invalid sourceHistory SHA quarantines without losing historic links',()=>{
  corrupted(r=>{r.calendar.sourceRevision.sourceHistory[0].sha256='bad'});
});
test('invalid hash in applied-revision provenance quarantines',()=>{
  corrupted(r=>{r.calendar.appliedRevisions.push({proposalId:'p',sourceSha256:'bad',
    appliedAt:copy(FIXED_CLOCK),modelRevision:1,changeIds:[]})});
});
test('legacy source with invalid digest or crosswalk fields masquerading as legacy quarantines',()=>{
  corrupted(r=>{r.calendar.sourceRevision={sha256:'x',fileName:'bad.pdf'}});
  corrupted(r=>{r.calendar.sourceRevision={sha256:PREVIOUS,fileName:'old.pdf',links:[]}});
});
