import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {expandSchedule,evaluatePlan} from '../../src/engine/index.js';
import {parseCalendar} from '../../src/import/parse.js';
import {prepareCalendarRevision,buildRevisionCandidate,reconcileRevisionEffect} from '../../src/import/revision.js';
import {extractCalendarRevision,suggestRevisionEffects} from '../../src/import/revision-extract.js';
function setup(text='Holiday 02.11.2026'){
 const {d:initial,o}=fixture();completeSyntheticCoverage(initial,o);const compiled=compileConfirmedImport(initial,o);assert.ok(compiled.ok);
 const m=compiled.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});m.schedule.initialized=true;m.sessions=x.sessions;m.revision=7;
 const source={id:'new-source',sha256:'c'.repeat(64),fileName:'renamed.pdf',role:'ACADEMIC_CALENDAR',coverage:'PARTIAL',section:'Q',pageRefs:['new-source#page=1']};
 const page={sourceId:source.id,page:1,method:'OCR',text,width:1000,height:1000,items:text.split('\n').map((text,n)=>({text,x:10,y:40+n*30,w:800,h:20}))};
 const rows=parseCalendar(source,[page],source.id).calendarEntries;
 const d={revisionDraftVersion:1,status:'PARTIAL',source,pages:[page],calendarEntries:rows,issues:[],review:{scope:{start:'2026-10-24',end:'2026-11-09',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},scopeConfirmed:true,sourceCoverageConfirmed:true,coverageNote:'Synthetic human manual completion, not institutional confirmation.',academicScope:o.academicScope,effects:suggestRevisionEffects(rows),exclusions:[],missing:[]}};
 for(const e of d.review.effects){e.confirmed=e.applicabilityConfirmed=e.effectiveDateConfirmed=true;}
 const prior={version:1,source:{sha256:'b'.repeat(64)},links:[]};
 return {m,d,prior,clock:o.clockPlaceholder};
}
const prepare=f=>prepareCalendarRevision({currentModel:f.m,existingSourceRevision:f.prior,extractedDraft:f.d});
const build=(f,p,ids=p.changes.map(c=>c.changeId))=>buildRevisionCandidate({model:f.m,proposal:p,acceptedChangeIds:ids,clock:f.clock});
const codes=r=>r.issues.map(i=>i.code);
test('calendar-only extraction rejects unsupported and empty bytes without a Model or I/O',async()=>{
 for(const bytes of [new Uint8Array(),new TextEncoder().encode('not a document')]){
  const r=await extractCalendarRevision({academicCalendar:{bytes,fileName:'expected.pdf'},section:'Q'});assert.ok(['UNREADABLE','UNSUPPORTED'].includes(r.status));assert.equal(r.source,null);assert.deepEqual(r.review.effects,[]);
 }
 const ac=new AbortController();ac.abort();await assert.rejects(extractCalendarRevision({academicCalendar:{bytes:new Uint8Array([1])},signal:ac.signal}),{name:'AbortError'});
});
test('reviewed holiday comparison produces a pure future restriction with stable canonical IDs',()=>{
 const f=setup(),input=structuredClone(f),r=prepare(f);assert.deepEqual(r.proposal.unresolved,[]);assert.equal(r.comparison[0].status,'ADDED');
 assert.deepEqual(prepare(f),r);const c=build(f,r.proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.revision,7);assert.deepEqual(f,input);
 const old=f.m.sessions.find(s=>s.date==='2026-11-02'),row=c.proposedModel.sessions.find(s=>s.id===old.id);assert.equal(row.cancelled,true);assert.equal(row.id,'weekly:t:2026-11-02');assert.deepEqual(c.proposedModel.snapshots,f.m.snapshots);assert.ok(c.sourceRevisionPatch.links[0].evidence.excerpt.includes('Holiday'));
});
test('source omissions produce possible-removal review, never cancellations',()=>{
 const f=setup();f.m.events.push({id:'old-exam',date:'2026-11-03',start:'10:00',end:'11:00',title:'Old exam',sessionId:null,cancelled:false});f.prior.links=[{sourceRef:'old-row',kind:'UPSERT_EVENT',targetId:'old-exam',value:structuredClone(f.m.events[0])}];
 let r=prepare(f);assert.ok(r.proposal.unresolved.some(i=>i.code==='POSSIBLE_REMOVAL'));assert.ok(!r.proposal.changes.some(c=>c.kind==='CANCEL_SESSION'));assert.equal(build(f,r.proposal).ok,false);
 f.d.review.missing.push({sourceRef:'old-row',decision:'KEEP_EXISTING',reason:'Missing extraction is inconclusive; preserve prior exam.',confirmed:true});r=prepare(f);assert.deepEqual(r.proposal.unresolved,[]);assert.ok(build(f,r.proposal).proposedModel.events.some(e=>e.id==='old-exam'));
});
test('partial, opaque, and unknown candidates require manual interpretation and coverage',()=>{
 const f=setup('Student obligation date to be notified');let r=prepare(f);assert.ok(r.proposal.unresolved.some(i=>i.code==='UNRESOLVED_SOURCE'));
 f.d.review.sourceCoverageConfirmed=false;assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='COVERAGE_REVIEW'));
 f.d.status='UNSUPPORTED';assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='UNSUPPORTED'));
});
test('applicability, effective dates, cohort and source-specific corrections cannot be silently confirmed',()=>{
 const f=setup();f.d.review.effects[0].effectiveDateConfirmed=false;assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='EFFECT_REVIEW'));
 f.d.review.effects[0].effectiveDateConfirmed=true;f.d.review.effects[0].after.date='2026-11-03';assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='SOURCE_CORRESPONDENCE'));
 reconcileRevisionEffect(f.d,f.d.review.effects[0].id,'Explicit synthetic visual date correction');assert.deepEqual(prepare(f).proposal.unresolved,[]);assert.ok(build(f,prepare(f).proposal).ok);
 f.d.review.effects[0].after.date='2026-11-04';assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='SOURCE_CORRESPONDENCE'));
 const wrong=setup('EVEN semester Holiday 02.11.2026');assert.ok(prepare(wrong).proposal.unresolved.some(i=>i.code==='SOURCE_SCOPE'));
});
test('range extraction cannot be represented by one unreviewed day',()=>{
 const f=setup('Mandatory exam 02.11.2026 to 04.11.2026');f.d.review.effects=f.d.review.effects.slice(0,1);assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='SOURCE_RANGE_INCOMPLETE'));
});
test('ambiguous existing exam matches need explicit identity confirmation; corrected event keeps ID',()=>{
 const f=setup('Exam 02.11.2026');const e=f.d.review.effects[0];Object.assign(e.after,{start:'10:00',end:'11:00'});f.m.events=[{...e.after,id:'known-exam'}];
 let r=prepare(f);assert.ok(r.proposal.unresolved.some(i=>i.code==='AMBIGUOUS_MATCH'));assert.equal(r.proposal.changes[0].match,'AMBIGUOUS');assert.ok(r.proposal.changes.some(c=>c.before?.id==='known-exam'));assert.ok(r.proposal.changes.some(c=>c.before===null));
 Object.assign(e,{targetId:'known-exam',matchConfirmed:true,matchReason:'Explicitly recognized source occurrence'});e.after.date='2026-11-03';reconcileRevisionEffect(f.d,e.id,'The printed date was visually corrected for this exam');r=prepare(f);assert.deepEqual(r.proposal.unresolved,[]);const c=build(f,r.proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.events.length,1);assert.equal(c.proposedModel.events[0].id,'known-exam');assert.equal(c.proposedModel.events[0].date,'2026-11-03');
 assert.equal(evaluatePlan(c.proposedModel,{additionalDates:['2026-11-03'],clock:f.clock}).status,'PLAN_BLOCKED');
});
test('changed extracted order cannot remap explicit persisted occurrence crosswalks',()=>{
 const f=setup('Exam 02.11.2026\nExam 03.11.2026');f.m.events=f.d.review.effects.map((e,n)=>({...e.after,id:'event-'+n,start:'10:00',end:'11:00'}));
 f.prior.links=f.m.events.map((e,n)=>({sourceRef:'persisted-'+n,kind:'UPSERT_EVENT',targetId:e.id,value:e}));
 for(let n=0;n<2;n++){const e=f.d.review.effects[n];e.previousSourceRef='persisted-'+n;e.after.start='10:00';e.after.end='11:00';e.matchConfirmed=true;e.matchReason='Recognized persisted crosswalk';}
 const a=prepare(f);f.d.calendarEntries.reverse();f.d.review.effects.reverse();const b=prepare(f);assert.deepEqual(a.proposal.changes.map(c=>c.after.id).sort(),b.proposal.changes.map(c=>c.after.id).sort());assert.ok(build(f,b.proposal).ok);
});
test('stale revisions, forged before images, unknown selections and ambiguous proposals fail without mutation',()=>{
 for(const mutate of [p=>p.baseModelRevision--,p=>p.changes[0].before={date:'2026-11-02',label:'forged'},p=>p.changes[0].match='AMBIGUOUS']){
  const f=setup(),old=structuredClone(f.m),p=prepare(f).proposal;mutate(p);assert.equal(build(f,p).ok,false);assert.deepEqual(f.m,old);
 }
 const f=setup(),p=prepare(f).proposal;assert.ok(codes(build(f,p,['unknown'])).includes('UNKNOWN_CHANGE'));assert.ok(codes(build(f,p,[p.changes[0].changeId,p.changes[0].changeId])).includes('INVALID_SELECTION'));
});
test('cancellation needs affirmative evidence and retains the occurrence row and ID',()=>{
 const f=setup('Classes cancelled 02.11.2026'),s=f.m.sessions.find(s=>s.date==='2026-11-02');f.d.review.effects=[{id:'cancel-once',sourceRef:f.d.calendarEntries[0].id,kind:'CANCEL_SESSION',occurrenceId:s.id,after:structuredClone(s),confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true,matchConfirmed:true,matchReason:'Explicitly recognized Monday occurrence',manual:true,reason:'Reviewed cancellation of the specified occurrence'}];
 let r=prepare(f);assert.ok(r.proposal.unresolved.some(i=>i.code==='REMOVAL_EVIDENCE'));
 f.d.review.effects[0].evidence={sourceId:'new-source',page:1,excerpt:'Classes cancelled 02.11.2026',basis:'EXPLICIT_CANCELLATION'};
 reconcileRevisionEffect(f.d,'cancel-once','This source cancellation applies to this known occurrence.');r=prepare(f);assert.deepEqual(r.proposal.unresolved,[]);const c=build(f,r.proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.sessions.find(r=>r.id===s.id).cancelled,true);assert.equal(c.proposedModel.sessions.length,f.m.sessions.length);
});
test('history and currently started occurrences cannot be rewritten, even if proposal flag lies',()=>{
 const f=setup();const p=prepare(f).proposal;f.clock={date:'2026-11-02',time:'09:30',timeZone:'Asia/Kolkata'};const old=structuredClone(f.m);assert.equal(build(f,p).ok,false);assert.deepEqual(f.m,old);
 const past=setup('Holiday 23.10.2026');past.d.review.scope.start='2026-10-23';const proposal=prepare(past).proposal;proposal.changes[0].affectsConfirmedHistory=false;assert.ok(codes(build(past,proposal)).includes('HISTORICAL_CONFLICT'));
});
test('retained commitments may become blocked; candidate retains all and does not assign revision/clock',()=>{
 const f=setup('Exam 02.11.2026');Object.assign(f.d.review.effects[0].after,{start:'09:00',end:'10:00'});f.m.commitments=[{id:'saved',date:'2026-11-02',createdAtRevision:6}];const c=build(f,prepare(f).proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.engineStatus,'PLAN_BLOCKED');assert.deepEqual(c.preservedCommitmentIds,['saved']);assert.deepEqual(c.proposedModel.commitments,f.m.commitments);assert.equal(c.proposedModel.revision,7);assert.deepEqual(c.proposedModel.snapshots,f.m.snapshots);
});
test('substitution expands actual obligations and preserves original service-date IDs',()=>{
 const f=setup('Timetable of Monday 31.10.2026');const p=prepare(f).proposal;assert.deepEqual(p.unresolved,[]);const c=build(f,p);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.sessions.find(s=>s.date==='2026-10-31').id,'weekly:t:2026-10-31');
});
test('manual overrides touched by projection fail closed rather than being regenerated',()=>{
 const f=setup();f.m.sessions.find(s=>s.date==='2026-11-02').start='09:15';const c=build(f,prepare(f).proposal);assert.ok(codes(c).includes('MANUAL_OVERRIDE_CONFLICT'));assert.equal(c.proposedModel,null);
});
test('legacy source metadata requires explicit reconciliation; exclusions do not erase entries',()=>{
 const f=setup();f.prior=null;assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='PRIOR_SOURCE_UNAVAILABLE'));Object.assign(f.d.review,{legacySourceReviewed:true,legacySourceNote:'Synthetic manual comparison to saved setup'});assert.deepEqual(prepare(f).proposal.unresolved,[]);
 f.d.review.exclusions=[{sourceRef:f.d.calendarEntries[0].id,confirmed:true,reason:'This is a faculty-only holiday for a different cohort.'}];f.d.review.effects=[];assert.deepEqual(prepare(f).proposal.changes,[]);assert.ok(build(f,prepare(f).proposal).ok);
});
test('deleting editable candidates cannot erase unresolved original source meanings',()=>{
 const f=setup('Exam 02.11.2026');f.d.calendarEntries=[];f.d.review.effects=[];assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='UNRESOLVED_SOURCE'));
});
test('manufactured page evidence is rejected rather than treated as source provenance',()=>{
 const f=setup();f.d.review.effects[0].evidence={sourceId:'new-source',page:1,excerpt:'A different invented source statement'};assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='SOURCE_EVIDENCE'));
});
test('an explicit rescheduling retains the canonical occurrence ID and snapshots',()=>{
 const f=setup('Monday class rescheduled to 03.11.2026');const original=f.m.sessions.find(s=>s.date==='2026-11-02');
 f.d.review.effects=[{id:'reschedule-token',sourceRef:f.d.calendarEntries[0].id,kind:'EDIT_SESSION',occurrenceId:original.id,after:{...original,date:'2026-11-03'},confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true,matchConfirmed:true,matchReason:'Confirmed same canonical occurrence'}];
 reconcileRevisionEffect(f.d,'reschedule-token','Explicitly reviewed the rescheduling meaning and same occurrence.');
 const c=build(f,prepare(f).proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.sessions.find(s=>s.date==='2026-11-03').id,'weekly:t:2026-11-02');assert.deepEqual(c.proposedModel.snapshots,f.m.snapshots);
});
test('cancellation cannot be disguised as EDIT_SESSION without affirmative source evidence',()=>{
 const f=setup('Monday class 02.11.2026');const row=f.m.sessions.find(s=>s.date==='2026-11-02');f.d.review.effects=[{id:'edit',sourceRef:f.d.calendarEntries[0].id,kind:'EDIT_SESSION',occurrenceId:row.id,after:{...row,cancelled:true},confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true,matchConfirmed:true,matchReason:'Same occurrence'}];
 assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='REMOVAL_EVIDENCE'));const p=prepare(f).proposal;p.unresolved=[];assert.ok(codes(build(f,p)).includes('REMOVAL_EVIDENCE'));
});
test('template/origin remapping cannot change a canonical occurrence identity',()=>{
 const f=setup('Monday class 02.11.2026'),row=f.m.sessions.find(s=>s.date==='2026-11-02');f.d.review.effects=[{id:'edit',sourceRef:f.d.calendarEntries[0].id,kind:'EDIT_SESSION',occurrenceId:row.id,after:{...row,templateId:'other'},confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true,matchConfirmed:true,matchReason:'Same occurrence'}];assert.ok(codes(build(f,prepare(f).proposal)).includes('IDENTITY_CHANGE'));
});
test('competing modifications fail as one candidate, without partially applying a valid addition',()=>{
 const f=setup('Holiday 02.11.2026'),copy=structuredClone(f.d.review.effects[0]);copy.id='distinct';f.d.review.effects.push(copy);const p=prepare(f).proposal,old=structuredClone(f.m);assert.ok(codes(build(f,p)).includes('COMPETING_CHANGES'));assert.deepEqual(f.m,old);
});
test('a teaching-on-holiday override cannot stand in for explicit nonteaching suppression',()=>{
 const f=setup('Non-teaching 02.11.2026');f.m.schedule.holidayTeachingDates=['2026-11-02'];assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='TEACHING_OVERRIDE_CONFLICT'));
});
test('a weekday pattern with no known attendance obligations stays unresolved',()=>{
 const f=setup('Timetable of Sunday 31.10.2026');assert.ok(prepare(f).proposal.unresolved.some(i=>i.code==='INEFFECTIVE_PATTERN'));
});
test('source links remain absent as a deletion until an explicit holiday removal is reviewed',()=>{
 const f=setup('Holiday cancelled 02.11.2026');f.m.schedule.holidays=[{date:'2026-11-02',label:'Previous holiday'}];f.m.sessions=f.m.sessions.filter(s=>s.date!=='2026-11-02');
 const e=f.d.review.effects[0];Object.assign(e,{kind:'REMOVE_HOLIDAY',targetId:'2026-11-02',matchConfirmed:true,matchReason:'Reviewed old holiday date',reason:'Explicit source cancellation',evidence:{sourceId:'new-source',page:1,excerpt:'Holiday cancelled 02.11.2026',basis:'EXPLICIT_CANCELLATION'}});
 const c=build(f,prepare(f).proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.ok(!c.proposedModel.schedule.holidays.length);assert.equal(c.proposedModel.sessions.find(s=>s.date==='2026-11-02').id,'weekly:t:2026-11-02');
});
test('linked compulsory events cannot conceal already-started attendance when moved to a future date',()=>{
 const f=setup('Exam 03.11.2026'),s=f.m.sessions.find(s=>s.date==='2026-11-02');f.m.events=[{id:'linked-event',title:'Recorded linked obligation',cancelled:false,sessionId:s.id,date:null,start:null,end:null}];
 const e=f.d.review.effects[0];Object.assign(e,{targetId:'linked-event',matchConfirmed:true,matchReason:'Recognized existing linked obligation'});Object.assign(e.after,{start:'10:00',end:'11:00'});
 f.clock={date:'2026-11-02',time:'10:30',timeZone:'Asia/Kolkata'};assert.ok(codes(build(f,prepare(f).proposal)).includes('HISTORICAL_CONFLICT'));
});
test('true added sessions use a once-assigned draft token independent of editable date/time',()=>{
 const f=setup('Additional lab 27.10.2026');f.d.review.effects=[{id:'once-extra-token',sourceRef:f.d.calendarEntries[0].id,kind:'ADD_SESSION',after:{id:null,registerId:'r',date:'2026-10-27',start:'11:00',end:'12:00',weight:1,protected:false,cancelled:false,origin:'extra',templateId:null},confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true}];
 reconcileRevisionEffect(f.d,'once-extra-token','Explicit reviewed additional attendance occurrence; weight confirmed synthetically.');let p=prepare(f).proposal,c=build(f,p);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.sessions.at(-1).id,'extra:revision:once-extra-token');
 Object.assign(f.d.review.effects[0].after,{date:'2026-10-28',start:'12:00',end:'13:00'});reconcileRevisionEffect(f.d,'once-extra-token','Corrected this draft addition before staging.');c=build(f,prepare(f).proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.sessions.at(-1).id,'extra:revision:once-extra-token');
});
test('confirmed teaching-boundary changes project related future occurrences without changing history/commitments',()=>{
 for(const date of ['2026-11-16','2026-11-01']){
  const f=setup('Teaching period ends '+date.slice(8)+'.11.2026');f.d.review.scope.end='2026-11-16';const e=f.d.review.effects[0];e.matchConfirmed=true;e.matchReason='Explicitly confirmed last teaching day boundary';
  const c=build(f,prepare(f).proposal);assert.ok(c.ok,JSON.stringify(c.issues));assert.equal(c.proposedModel.schedule.teachingEnd,date);assert.deepEqual(c.proposedModel.snapshots,f.m.snapshots);assert.deepEqual(c.proposedModel.commitments,f.m.commitments);
  if(date==='2026-11-16')assert.ok(c.proposedModel.sessions.some(s=>s.id==='weekly:t:2026-11-16'));
  else assert.ok(c.proposedModel.sessions.filter(s=>s.date>date).every(s=>s.cancelled));
 }
});
