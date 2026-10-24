import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {expandSchedule} from '../../src/engine/index.js';
import {parseCalendar} from '../../src/import/parse.js';
import {suggestRevisionEffects} from '../../src/import/revision-extract.js';
import {prepareCalendarRevision,buildRevisionCandidate} from '../../src/import/revision.js';
const legacy=()=>({sha256:'B'.repeat(64),fileName:'Original prior Calendar (1).PDF'});
function setup(){
 const {d,o}=fixture();completeSyntheticCoverage(d,o);const compiled=compileConfirmedImport(d,o);assert.ok(compiled.ok);const model=compiled.model;
 const expanded=expandSchedule({schedule:model.schedule,courses:model.courses,registers:model.registers,extraSessions:[],overrides:[]});assert.ok(expanded.ok);model.schedule.initialized=true;model.sessions=expanded.sessions;model.revision=3;
 const source={id:'new-source',sha256:'c'.repeat(64),fileName:'review.pdf',coverage:'PARTIAL',role:'ACADEMIC_CALENDAR',section:'Q',pageRefs:['new-source#page=1']};
 const page={sourceId:source.id,page:1,method:'OCR',text:'Holiday 02.11.2026',width:1000,height:1000,items:[{text:'Holiday 02.11.2026',x:0,y:0,w:300,h:20}]};
 const calendarEntries=parseCalendar(source,[page],source.id).calendarEntries;
 const draft={revisionDraftVersion:1,status:'PARTIAL',source,pages:[page],calendarEntries,issues:[],review:{proposalKey:'rc14-d-01-test',scope:{start:'2026-10-24',end:'2026-11-09',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},scopeConfirmed:true,sourceCoverageConfirmed:true,coverageNote:'Explicit synthetic manual completion; not personal confirmation.',academicScope:o.academicScope,effects:suggestRevisionEffects(calendarEntries),exclusions:[],missing:[],legacySourceReviewed:true,legacySourceNote:'Synthetic explicit comparison with prior source and saved setup.'}};
 for(const e of draft.review.effects)e.confirmed=e.applicabilityConfirmed=e.effectiveDateConfirmed=true;
 return {model,draft,clock:o.clockPlaceholder};
}
const propose=(f,prior)=>prepareCalendarRevision({currentModel:f.model,existingSourceRevision:prior,extractedDraft:f.draft});
const candidate=(f,proposal)=>buildRevisionCandidate({model:f.model,proposal,acceptedChangeIds:proposal.changes.map(c=>c.changeId),clock:f.clock});
const missingReview=[{}, {legacySourceReviewed:false,legacySourceNote:'reason'}, {legacySourceReviewed:true,legacySourceNote:''}, {legacySourceReviewed:true,legacySourceNote:' \n\t'}, {legacySourceReviewed:'true',legacySourceNote:'reason'}, {legacySourceReviewed:true,legacySourceNote:null}];
for(const [label,make] of [['missing',()=>null],['legacy',legacy]]){
 test(`${label} source: explicit review allows the same pure reviewed candidate without inventing old links`,()=>{
  const f=setup(),prior=make(),original=structuredClone({f,prior});if(prior)Object.freeze(prior);
  const r=propose(f,prior);assert.deepEqual(r.proposal.unresolved,[]);assert.deepEqual(r,propose(f,null));assert.equal(r.comparison.length,1);assert.equal(r.comparison[0].status,'ADDED');assert.equal(r.proposal.changes[0].before,null);
  const result=candidate(f,r.proposal);assert.ok(result.ok,JSON.stringify(result.issues));assert.equal(result.proposedModel.revision,3);assert.deepEqual(result.proposedModel.snapshots,f.model.snapshots);assert.deepEqual(result.proposedModel.commitments,f.model.commitments);
  assert.equal(result.sourceRevisionPatch.links.length,1);assert.equal(result.sourceRevisionPatch.source.sha256,'c'.repeat(64));assert.equal(result.sourceRevisionPatch.source.fileName,'review.pdf');assert.ok(result.sourceRevisionPatch.links.every(l=>l.evidence.sourceId==='new-source'));assert.deepEqual({f,prior},original);
  if(prior){assert.equal(prior.sha256,'B'.repeat(64));assert.equal(prior.fileName,'Original prior Calendar (1).PDF');assert.equal(Object.hasOwn(prior,'links'),false);assert.equal(Object.hasOwn(prior,'version'),false);}
 });
 test(`${label} source: missing/incomplete legacy confirmation always blocks`,()=>{
  for(const review of missingReview){const f=setup();delete f.draft.review.legacySourceReviewed;delete f.draft.review.legacySourceNote;Object.assign(f.draft.review,review);const p=propose(f,make()).proposal;assert.ok(p.unresolved.some(i=>i.code==='PRIOR_SOURCE_UNAVAILABLE'));assert.equal(candidate(f,p).proposedModel,null);}
 });
 test(`${label} source: confirmation cannot clear unknown matches, applicability or coverage`,()=>{
  for(const edit of [f=>{f.draft.review.effects[0].previousSourceRef='unestablished-old-row';},f=>{f.draft.review.sourceCoverageConfirmed=false;},f=>{f.draft.review.effects[0].applicabilityConfirmed=false;},f=>{f.draft.review.effects[0].effectiveDateConfirmed=false;},f=>{f.draft.status='UNSUPPORTED';}]){
   const f=setup();edit(f);const p=propose(f,make()).proposal;assert.ok(p.unresolved.length);assert.equal(candidate(f,p).proposedModel,null);
  }
 });
 test(`${label} source: legacy confirmation cannot choose between competing event identities`,()=>{
  const f=setup(),page=f.draft.pages[0];page.text=page.items[0].text='Exam 02.11.2026';f.draft.calendarEntries=parseCalendar(f.draft.source,[page],f.draft.source.id).calendarEntries;f.draft.review.effects=suggestRevisionEffects(f.draft.calendarEntries);
  for(const e of f.draft.review.effects){e.confirmed=e.applicabilityConfirmed=e.effectiveDateConfirmed=true;Object.assign(e.after,{start:'10:00',end:'11:00'});}
  f.model.events=['existing-one','existing-two'].map(id=>({...f.draft.review.effects[0].after,id}));const p=propose(f,make()).proposal;
  assert.ok(p.unresolved.some(i=>i.code==='AMBIGUOUS_MATCH'));assert.ok(p.changes.some(c=>c.before?.id==='existing-one'));assert.ok(p.changes.some(c=>c.before?.id==='existing-two'));assert.equal(candidate(f,p).proposedModel,null);
 });
 test(`${label} source: explicit legacy review does not authorize historical changes or cancellation without evidence`,()=>{
  const f=setup();f.clock={date:'2026-11-02',time:'09:30',timeZone:'Asia/Kolkata'};const p=propose(f,make()).proposal;const result=candidate(f,p);assert.equal(result.proposedModel,null);assert.ok(result.issues.some(i=>i.code==='HISTORICAL_CONFLICT'));
  const g=setup();g.draft.review.effects[0].kind='REMOVE_HOLIDAY';g.draft.review.effects[0].targetId='2026-11-02';g.model.schedule.holidays=[{date:'2026-11-02',label:'Prior holiday'}];const bad=propose(g,make()).proposal;assert.ok(bad.unresolved.some(i=>i.code==='REMOVAL_EVIDENCE'));assert.equal(candidate(g,bad).proposedModel,null);
 });
}
test('v1 source: established crosswalk needs no legacy confirmation; absent extracted rows still require resolution',()=>{
 const f=setup();delete f.draft.review.legacySourceReviewed;delete f.draft.review.legacySourceNote;
 const prior={version:1,source:legacy(),links:[]},old=structuredClone(prior);assert.deepEqual(propose(f,prior).proposal.unresolved,[]);assert.ok(candidate(f,propose(f,prior).proposal).ok);assert.deepEqual(prior,old);
 const exam={id:'old-exam',title:'Prior exam',date:'2026-11-03',start:'10:00',end:'11:00',sessionId:null,cancelled:false};f.model.events.push(exam);prior.links.push({sourceRef:'old-row',kind:'UPSERT_EVENT',targetId:exam.id,value:structuredClone(exam)});
 Object.assign(f.draft.review,{legacySourceReviewed:true,legacySourceNote:'Cannot erase a known source mapping.'});let p=propose(f,prior).proposal;assert.ok(p.unresolved.some(i=>i.code==='POSSIBLE_REMOVAL'));assert.equal(candidate(f,p).proposedModel,null);
 f.draft.review.missing.push({sourceRef:'old-row',decision:'KEEP_EXISTING',reason:'Absence from extraction is not deletion.',confirmed:true});p=propose(f,prior).proposal;assert.deepEqual(p.unresolved,[]);assert.ok(candidate(f,p).proposedModel.events.some(e=>e.id==='old-exam'));assert.equal(prior.source.sha256,'B'.repeat(64));assert.equal(prior.source.fileName,'Original prior Calendar (1).PDF');
});
test('malformed or versioned metadata cannot masquerade as reviewed legacy filename/hash metadata',()=>{
 for(const prior of [{},{sha256:['b'.repeat(64)],fileName:'old.pdf'},{sha256:'x',fileName:'old.pdf'},{sha256:'b'.repeat(64)},{sha256:'b'.repeat(64),fileName:' '},{...legacy(),version:2,links:[]},{...legacy(),version:1},{...legacy(),links:[]},{version:1,source:legacy(),links:'not-an-array'}]){
  const f=setup(),p=propose(f,prior).proposal;assert.ok(p.unresolved.some(i=>i.code==='SOURCE_METADATA_REVIEW'),JSON.stringify(prior));assert.equal(candidate(f,p).proposedModel,null);
 }
});
