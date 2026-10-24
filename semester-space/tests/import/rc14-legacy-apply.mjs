// RC-001.4 owner integration probe; serialized memory storage, NOT a native browser reload.
// No production/controller/storage edits. Run only with --run in A's RC-001.4 tree.
import assert from 'node:assert/strict';
import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {parseCalendar} from '../../src/import/parse.js';
import {suggestRevisionEffects} from '../../src/import/revision-extract.js';
import * as revision from '../../src/import/revision.js';
import * as engine from '../../src/engine/index.js';
export async function checkLegacyApplication(){
 const {createController}=await import('../../src/controller.js'),{makeEmptyRelease}=await import('../../src/storage.js'),{STORAGE_KEY}=await import('../../src/shared/constants.js');
 assert.equal(typeof makeEmptyRelease,'function','Run this probe in A’s RC-001.4 tree.');
 const {d:initial,o}=fixture();completeSyntheticCoverage(initial,o);const compiled=compileConfirmedImport(initial,o);assert.ok(compiled.ok);
 const model=compiled.model,expanded=engine.expandSchedule({schedule:model.schedule,courses:model.courses,registers:model.registers,extraSessions:[],overrides:[]});assert.ok(expanded.ok);model.schedule.initialized=true;model.sessions=expanded.sessions;model.revision=3;
 const legacy={sha256:'b'.repeat(64),fileName:'Original Calendar (1).PDF'},release=makeEmptyRelease(model);release.calendar.sourceRevision=structuredClone(legacy);
 let writes=0;const mem=new Map([[STORAGE_KEY,JSON.stringify({schemaVersion:2,model,release})]]),storage={getItem:k=>mem.get(k)??null,setItem(k,v){writes++;mem.set(k,v);}};
 const create=()=>createController({engine,revision,storage,clock:()=>structuredClone(o.clockPlaceholder),render(){}}),app=create();assert.equal(app.getState().persistence.status,'SAVED');
 const source={id:'new-source',sha256:'c'.repeat(64),fileName:'review.pdf',coverage:'PARTIAL',role:'ACADEMIC_CALENDAR',section:'Q',pageRefs:['new-source#page=1']};
 const page={sourceId:source.id,page:1,method:'OCR',text:'Holiday 02.11.2026',width:1000,height:1000,items:[{text:'Holiday 02.11.2026',x:0,y:0,w:300,h:20}]},calendarEntries=parseCalendar(source,[page],source.id).calendarEntries;
 const draft={revisionDraftVersion:1,status:'PARTIAL',source,pages:[page],calendarEntries,issues:[],review:{proposalKey:'rc14-d-01-apply',scope:{start:'2026-10-24',end:'2026-11-09',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},scopeConfirmed:true,sourceCoverageConfirmed:true,coverageNote:'Explicit synthetic manual completion; no personal confirmations.',academicScope:o.academicScope,effects:suggestRevisionEffects(calendarEntries),exclusions:[],missing:[],legacySourceReviewed:true,legacySourceNote:'Synthetic explicit prior-source comparison.'}};
 for(const e of draft.review.effects)e.confirmed=e.applicabilityConfirmed=e.effectiveDateConfirmed=true;
 const before=app.getState(),{proposal}=revision.prepareCalendarRevision({currentModel:before.model,existingSourceRevision:before.release.calendar.sourceRevision,extractedDraft:draft});assert.deepEqual(proposal.unresolved,[]);
 assert.ok(app.callbacks.onProposeCalendarRevision({expectedModelRevision:3,proposal}).ok);assert.equal(writes,0);
 const applied=app.callbacks.onApplyCalendarRevision({expectedModelRevision:3,proposalId:proposal.proposalId,acceptedChangeIds:proposal.changes.map(c=>c.changeId),confirmedSourceCoverage:true,historicalResolutions:[],confirmation:true});assert.ok(applied.ok,JSON.stringify(applied));assert.equal(writes,1);
 const after=app.getState(),persisted=JSON.parse(mem.get(STORAGE_KEY));assert.equal(after.model.revision,4);assert.deepEqual(after.model.snapshots,before.model.snapshots);assert.deepEqual(after.model.commitments,before.model.commitments);
 assert.deepEqual(after.release.calendar.sourceRevision.sourceHistory,[legacy]);assert.equal(after.release.calendar.sourceRevision.links.length,proposal.changes.length);assert.ok(after.release.calendar.sourceRevision.links.every(l=>l.sourceSha256===source.sha256));assert.deepEqual(persisted.release.calendar.sourceRevision.sourceHistory,[legacy]);
 const reloaded=create().getState();assert.deepEqual(reloaded.model,after.model);assert.deepEqual(reloaded.release,after.release);assert.equal(writes,1);
 return {harness:'Actual RC-001.4 controller and serialized in-memory storage; not native browser',reviewedLegacyAccepted:true,priorIdentityInPersistedHistory:legacy,noInventedPriorLinks:true,writes,modelRevision:reloaded.model.revision,snapshotsAndCommitmentsPreserved:true,serializedReloadPassed:true};
}
if(process.argv.includes('--run'))console.log(JSON.stringify(await checkLegacyApplication(),null,2));
