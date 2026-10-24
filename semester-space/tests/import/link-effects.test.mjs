import test from 'node:test';
import assert from 'node:assert/strict';
import {linkFixture,redirectLink,refreshDeclarations,publicOutcome} from './d-imp-01-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {validateCalendarCoverage,recordSourceReconciliation} from '../../src/import/coverage.js';
import {expandSchedule,evaluatePlan} from '../../src/engine/index.js';
const errors=(d,o)=>validateCalendarCoverage(d,o).map(i=>i.code);
function soleMapping(d){for(const r of d.calendarEntries)r.coverageResolution.rowIds=[r.id];}
for(const kind of ['EXAM_WINDOW','NON_TEACHING','REPLACEMENT']){
 test(`${kind}: D's out-of-horizon redirect is rejected at source and page level`,()=>{
  const {d,o}=linkFixture(kind),baseline=compileConfirmedImport(d,o);assert.equal(baseline.ok,true,JSON.stringify(baseline.issues));
  if(kind==='EXAM_WINDOW'){assert.equal(baseline.model.events.length,2);assert.equal(publicOutcome(baseline,o).oct26PlanStatus,'PLAN_BLOCKED');}
  if(kind==='NON_TEACHING'){assert.equal(baseline.model.schedule.holidays.length,2);const m=baseline.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});assert.ok(x.ok);assert.ok(!x.sessions.some(s=>s.date==='2026-10-26'));}
  if(kind==='REPLACEMENT'){assert.equal(baseline.model.schedule.replacements.length,2);assert.equal(publicOutcome(baseline,o).oct31Sessions,1);}
  redirectLink(d,o);const codes=errors(d,o);assert.ok(codes.includes('CALENDAR_RESOLUTION_EFFECT'));assert.ok(codes.includes('CALENDAR_COVERAGE_EFFECT'));assert.equal(compileConfirmedImport(d,o).model,null);
 });
 test(`${kind}: same-page but wrong in-horizon date cannot stand in for the source`,()=>{
  const {d,o}=linkFixture(kind);redirectLink(d,o,'2026-11-03');assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_CORRESPONDENCE'));assert.equal(compileConfirmedImport(d,o).ok,false);
 });
 test(`${kind}: before the projection start or on the completed snapshot has no target effect`,()=>{
  for(const date of ['2026-10-23','2026-10-20']){const {d,o}=linkFixture(kind);redirectLink(d,o,date);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.equal(compileConfirmedImport(d,o).model,null);}
 });
 test(`${kind}: reconciliation cannot rescue an out-of-scope/ineffective target`,()=>{
  const {d,o}=linkFixture(kind);redirectLink(d,o);for(const row of d.calendarEntries)recordSourceReconciliation(d,o,row.id,'Explicit but invalid out-of-horizon mapping');refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.equal(compileConfirmedImport(d,o).ok,false);
 });
 test(`${kind}: valid source-specific corrected dates produce actual public-engine schedule effects`,()=>{
  const {d,o}=linkFixture(kind);soleMapping(d);const row=d.calendarEntries[0],date=kind==='REPLACEMENT'?'2026-11-03':'2026-11-02';
  row.startDate=row.endDate=date;row.review='CORRECTED';row.resolutionNote='Synthetic source-specific visual correction of the printed date.';refreshDeclarations(d,o);
  assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_CORRESPONDENCE'));
  recordSourceReconciliation(d,o,row.id,row.resolutionNote);refreshDeclarations(d,o);const r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));
  const m=r.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});assert.ok(x.ok);
  if(kind==='EXAM_WINDOW'){assert.ok(m.events.some(e=>e.date===date));const p=evaluatePlan({...m,schedule:{...m.schedule,initialized:true},sessions:x.sessions},{clock:o.clockPlaceholder,additionalDates:[date]});assert.equal(p.status,'PLAN_BLOCKED');}
  if(kind==='NON_TEACHING'){assert.ok(m.schedule.holidays.some(h=>h.date===date));assert.ok(!x.sessions.some(s=>s.date===date));}
  if(kind==='REPLACEMENT'){assert.ok(m.schedule.replacements.some(r=>r.date===date&&r.weekday===1));assert.equal(x.sessions.filter(s=>s.date===date).length,1);}
 });
}
test('source-specific reconciliation cannot be copied to another source or replayed after target/scope edits',()=>{
 for(const edit of [({d})=>{d.calendarEntries[1].coverageResolution.reconciliation=d.calendarEntries[0].coverageResolution.reconciliation;d.calendarEntries[1].startDate=d.calendarEntries[1].endDate='2026-11-03';},({d})=>{d.calendarEntries[0].startDate=d.calendarEntries[0].endDate='2026-11-03';},({o})=>{o.teachingEnd='2026-11-16';}]){
  const f=linkFixture();soleMapping(f.d);const row=f.d.calendarEntries[0];row.startDate=row.endDate='2026-11-02';row.review='CORRECTED';row.resolutionNote='Synthetic correction';recordSourceReconciliation(f.d,f.o,row.id,'Confirmed visual source-specific correction');refreshDeclarations(f.d,f.o);assert.equal(compileConfirmedImport(f.d,f.o).ok,true);edit(f);refreshDeclarations(f.d,f.o);assert.ok(errors(f.d,f.o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));assert.equal(compileConfirmedImport(f.d,f.o).ok,false);
 }
});
test('an unrelated same-page row with valid type and dates requires explicit correspondence, not a generic note',()=>{
 const {d,o}=linkFixture();const [a,b]=d.calendarEntries;a.treatment='INFORMATION_ONLY';a.resolutionNote='Generic';a.coverageResolution={decision:'REPRESENTED',rowIds:[b.id],note:'Same page',confirmed:true};refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('page ENTERED links to a historical candidate moved into the horizon require reconciliation too',()=>{
 const {d,o}=linkFixture();soleMapping(d);o.startDate='2026-11-01';const row=d.calendarEntries[0];row.startDate=row.endDate='2026-11-02';row.review='CORRECTED';row.resolutionNote='Synthetic corrected commencement';
 const page=d.calendarCoverage.pages[0];page.areas.OBLIGATIONS.rowIds=[row.id];refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_CORRESPONDENCE'));recordSourceReconciliation(d,o,row.id,'Source-specific date correction into this projection');refreshDeclarations(d,o);assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('nonteaching representation must suppress teaching; a teaching-on-holiday override is not that restriction',()=>{
 const {d,o}=linkFixture('NON_TEACHING');o.holidayTeachingDates=['2026-10-26'];refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_EFFECT'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('substitutions need effective obligations in their weekday pattern and cannot disappear under a holiday',()=>{
 for(const edit of [({d})=>{for(const r of d.calendarEntries)r.replacementWeekday=7;},({d})=>{d.calendarEntries.push({...structuredClone(d.calendarEntries[0]),id:'holiday',kind:'HOLIDAY',treatment:'HOLIDAY',startDate:'2026-10-31',endDate:'2026-10-31',coverageResolution:{decision:'REPRESENTED',rowIds:['holiday'],note:'Holiday',confirmed:true}});}]){
  const f=linkFixture('REPLACEMENT');edit(f);refreshDeclarations(f.d,f.o);assert.ok(errors(f.d,f.o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.equal(compileConfirmedImport(f.d,f.o).ok,false);
 }
});
test('changed substitution weekday is not a source match without source-specific reconciliation',()=>{
 const {d,o}=linkFixture('REPLACEMENT');soleMapping(d);d.timetableEntries.push({...structuredClone(d.timetableEntries[0]),id:'tuesday',weekday:2});const row=d.calendarEntries[0];row.replacementWeekday=2;row.review='CORRECTED';row.resolutionNote='Explicit visual weekday correction';refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));recordSourceReconciliation(d,o,row.id,row.resolutionNote);refreshDeclarations(d,o);const r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));const m=r.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});assert.ok(x.ok);assert.equal(x.sessions.filter(s=>s.date==='2026-10-31'&&s.templateId==='tuesday').length,1);
});
test('shortening a source exam window requires explicit reconciliation to actual occurrences',()=>{
 const {d,o}=linkFixture();d.pages[1].items[0].text='Mandatory exam 26.10.2026 to 28.10.2026';d.pages[1].text=d.pages[1].items.map(i=>i.text).join('\n');soleMapping(d);refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));recordSourceReconciliation(d,o,d.calendarEntries[0].id,'The source window is resolved to this one confirmed synthetic exam occurrence.');refreshDeclarations(d,o);assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('genuine exclusions use the justified NO_APPLICABLE_EFFECT path',()=>{
 const {d,o}=linkFixture();for(const row of d.calendarEntries)Object.assign(row,{applicability:'DOES_NOT_APPLY',treatment:'DOES_NOT_APPLY',resolutionNote:'Synthetic faculty-only exam, not this student scope',coverageResolution:{decision:'NO_APPLICABLE_EFFECT',rowIds:[],note:'Explicitly confirmed faculty-only scope',confirmed:true}});
 Object.assign(d.calendarCoverage.pages[0].areas.OBLIGATIONS,{decision:'NONE_APPLICABLE',rowIds:[],note:'Source-specific exclusions confirmed for this synthetic student.'});refreshDeclarations(d,o);const r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));assert.deepEqual(r.model.events,[]);
});
test('wrong-term targets cannot be represented or entered even if declared applicable',()=>{
 const {d,o}=linkFixture();d.calendarEntries[1].term='EVEN';refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_EFFECT'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('page reconciliation cannot turn a historical wrong-term source into an entered current-term obligation',()=>{
 const {d,o}=linkFixture();for(const r of d.calendarEntries)r.startDate=r.endDate='2026-10-01';
 d.pages[1].items=d.pages[1].items.map((i,n)=>({...i,text:`EVEN semester exam 0${n+1}.10.2026`}));d.pages[1].text=d.pages[1].items.map(i=>i.text).join('\n');soleMapping(d);
 const row=d.calendarEntries[0];row.startDate=row.endDate='2026-11-02';row.review='CORRECTED';row.resolutionNote='Attempted date change';recordSourceReconciliation(d,o,row.id,'Explicit date change cannot change a source term exclusion');d.calendarCoverage.pages[0].areas.OBLIGATIONS.rowIds=[row.id];refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_SCOPE'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('a corrected OCR year maps to an effective future exam only with explicit source reconciliation',()=>{
 const {d,o}=linkFixture();d.pages[1].items[0].text='Mandatory exam 26.10.2028';d.pages[1].text=d.pages[1].items.map(i=>i.text).join('\n');soleMapping(d);const row=d.calendarEntries[0];row.review='CORRECTED';row.resolutionNote='Visual source review: OCR year 2028 is actually 2026';refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_CORRESPONDENCE'));recordSourceReconciliation(d,o,row.id,row.resolutionNote);refreshDeclarations(d,o);const r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));assert.ok(r.model.events.some(e=>e.date==='2026-10-26'));assert.equal(publicOutcome(r,o).oct26PlanStatus,'PLAN_BLOCKED');
});
test('changing explicit nonteaching into a holiday marker cannot hide an override that keeps teaching active',()=>{
 const {d,o}=linkFixture('NON_TEACHING');d.calendarEntries[0].kind='HOLIDAY';d.calendarEntries[0].treatment='HOLIDAY';o.holidayTeachingDates=['2026-10-26'];refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_RESOLUTION_EFFECT'));assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_EFFECT'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('page ENTERED cannot use an empty reconciliation binding for a historical source moved into scope',async()=>{
 const {makeSourceReconciliation}=await import('../../src/import/link-effects.js'),{sourceCalendarCandidates}=await import('../../src/import/coverage.js');const {d,o}=linkFixture();o.startDate='2026-11-01';soleMapping(d);const row=d.calendarEntries[0];row.startDate=row.endDate='2026-11-02';row.review='CORRECTED';row.resolutionNote='Attempt to use an empty target snapshot';row.coverageResolution.rowIds=[];
 assert.throws(()=>recordSourceReconciliation(d,o,row.id,row.resolutionNote),/Select at least/);row.coverageResolution.reconciliation=makeSourceReconciliation(sourceCalendarCandidates(d)[0],[],d,o,row.resolutionNote);d.calendarCoverage.pages[0].areas.OBLIGATIONS.rowIds=[row.id];refreshDeclarations(d,o);assert.ok(errors(d,o).includes('CALENDAR_COVERAGE_CORRESPONDENCE'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
