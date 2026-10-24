import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,calendar} from './coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
function sourceDraft(raw='Mandatory exam 26.10.2026. Saturday 31.10.2026 follows Monday timetable.'){
 const {d,o}=fixture();Object.assign(d.pages[1],{text:raw,method:'OCR',width:1000,height:1000,items:[{text:raw,x:10,y:100,w:900,h:20}]});return {d,o};
}
test('omitted exam/substitution cannot be made complete by generic page review',()=>{const {d,o}=sourceDraft();assert.equal(compileConfirmedImport(d,o).ok,false);});
test('readable OCR with unsupported calendar meaning still needs manual completion',()=>{const {d,o}=sourceDraft('M S T shown by colour codes; symbols require human interpretation.');d.issues=[{code:'GRID_LAYOUT_REVIEW',severity:'WARNING',message:'Meaning unsupported'}];assert.equal(compileConfirmedImport(d,o).ok,false);});
test('deleting an unresolved source candidate does not resolve it',()=>{const {d,o}=sourceDraft();d.calendarEntries=[calendar({kind:'EXAM_WINDOW',review:'UNREVIEWED',treatment:'UNRESOLVED'})];d.calendarEntries=[];assert.equal(compileConfirmedImport(d,o).ok,false);});
test('information-only is not a substitute for resolving a source exam',()=>{const {d,o}=sourceDraft();d.calendarEntries=[calendar({kind:'EXAM_WINDOW',treatment:'INFORMATION_ONLY',resolutionNote:'Administrative information'})];assert.equal(compileConfirmedImport(d,o).ok,false);});
test('changing source category does not clear a known coverage requirement',()=>{const {d,o}=sourceDraft();d.calendarEntries=[calendar({kind:'HOLIDAY',treatment:'INFORMATION_ONLY'})];assert.equal(compileConfirmedImport(d,o).ok,false);});
test('generic page review cannot clear NO_CALENDAR_ROWS errors',()=>{const {d,o}=sourceDraft();d.pages[1].reviewed=true;d.issues=[{code:'NO_CALENDAR_ROWS',severity:'ERROR'}];assert.equal(compileConfirmedImport(d,o).ok,false);});
import {parseCalendar} from '../../src/import/parse.js';
import {completeSyntheticCoverage} from './coverage-fixture.mjs';
import {validateCalendarCoverage,blankPageCoverage,recordPageCoverage,calendarCoverageFingerprint,IMPORT_SOURCE_PREFIX} from '../../src/import/coverage.js';
import * as engine from '../../src/engine/index.js';
function modelledDraft(){
 const {d,o}=sourceDraft();const page=d.pages[1];page.items=[{text:'Mandatory exam 26.10.2026',x:10,y:100,w:800,h:20},{text:'Time table adjustment 31.10.2026 Monday TT',x:10,y:200,w:800,h:20}];page.text=page.items.map(i=>i.text).join('\n');
 d.calendarEntries=parseCalendar(d.sources[1],[page],d.id).calendarEntries;
 for(const r of d.calendarEntries)Object.assign(r,{review:'CONFIRMED',applicability:'APPLIES',treatment:r.kind==='REPLACEMENT'?'REPLACEMENT':'COMPULSORY',allDay:true,resolutionNote:'Synthetic source review: actual all-day exam / Monday substitution.'});
 completeSyntheticCoverage(d,o);return {d,o};
}
const codes=(d,o)=>validateCalendarCoverage(d,o).map(i=>i.code);
test('explicit manual completion compiles real exam and substitution effects, without storing coverage schema fields',()=>{
 const {d,o}=modelledDraft(),before=structuredClone({d,o}),r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));assert.deepEqual({d,o},before);
 assert.equal(r.model.events.length,1);assert.deepEqual(r.model.schedule.replacements,[{date:'2026-10-31',weekday:1,confirmed:true}]);assert.ok(r.model.context.sourceLabel.startsWith(IMPORT_SOURCE_PREFIX));assert.equal('calendarCoverage' in r.model,false);
 const expanded=engine.expandSchedule({schedule:r.model.schedule,courses:r.model.courses,registers:r.model.registers,extraSessions:[],overrides:[]});assert.equal(expanded.ok,true);assert.ok(expanded.sessions.some(s=>s.date==='2026-10-31'));
 const model={...r.model,schedule:{...r.model.schedule,initialized:true},sessions:expanded.sessions};assert.equal(engine.evaluatePlan(model,{clock:o.clockPlaceholder,additionalDates:['2026-10-26']}).status,'PLAN_BLOCKED');
});
test('deletion remains blocked after a user records new page declarations',()=>{
 const {d,o}=modelledDraft();d.calendarEntries.splice(0,1);completeSyntheticCoverage(d,o);assert.ok(codes(d,o).includes('CALENDAR_CANDIDATE_REMOVED'));assert.equal(compileConfirmedImport(d,o).model,null);
});
test('original exam meaning survives editable category and information-only reclassification',()=>{
 const {d,o}=modelledDraft();const exam=d.calendarEntries.find(r=>r.kind==='EXAM_WINDOW');exam.kind='HOLIDAY';exam.treatment='INFORMATION_ONLY';exam.resolutionNote='Looks administrative';
 for(const page of d.calendarCoverage.pages)recordPageCoverage(d,o,page);
 assert.ok(codes(d,o).includes('CALENDAR_RESOLUTION_LINK'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('no-effect source disposition is an explicit separate human decision, not a generic note or viewed checkbox',()=>{
 const {d,o}=modelledDraft(),exam=d.calendarEntries.find(r=>r.kind==='EXAM_WINDOW');exam.treatment='INFORMATION_ONLY';exam.resolutionNote='Faculty certification exam, not an obligation for the synthetic student';
 exam.coverageResolution={decision:'NO_APPLICABLE_EFFECT',rowIds:[],note:exam.resolutionNote,confirmed:false};for(const p of d.calendarCoverage.pages)recordPageCoverage(d,o,p);assert.ok(codes(d,o).includes('CALENDAR_SOURCE_RESOLUTION'));
 exam.coverageResolution.confirmed=true;const p=d.calendarCoverage.pages[0];p.areas.OBLIGATIONS={decision:'NONE_APPLICABLE',rowIds:[],note:exam.resolutionNote};recordPageCoverage(d,o,p);assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('deleting extraction issue flags cannot resolve unconfirmed manual coverage',()=>{
 const {d,o}=modelledDraft();d.calendarCoverage.pages=[blankPageCoverage(d.pages[1])];d.issues=[];d.pages[1].reviewed=true;assert.ok(codes(d,o).includes('CALENDAR_MANUAL_COMPLETION'));assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('readable but semantically opaque OCR requires manual completion and permits actual manually transcribed entries',()=>{
 const {d,o}=sourceDraft('M S T shown by colour codes; symbols require human interpretation.');assert.equal(parseCalendar(d.sources[1],[d.pages[1]],d.id).calendarEntries.length,0);assert.equal(compileConfirmedImport(d,o).ok,false);
 d.calendarEntries=[calendar({id:'manual-exam',kind:'EXAM_WINDOW',treatment:'COMPULSORY',allDay:true,resolutionNote:'Synthetic manual transcription from the coloured source.'}),calendar({id:'manual-substitution',kind:'REPLACEMENT',treatment:'REPLACEMENT',startDate:'2026-10-31',endDate:'2026-10-31',replacementWeekday:1})];
 completeSyntheticCoverage(d,o);const r=compileConfirmedImport(d,o);assert.equal(r.ok,true,JSON.stringify(r.issues));assert.equal(r.model.events.length,1);assert.equal(r.model.schedule.replacements[0].weekday,1);
});
test('software cannot prove that an undetected event is absent: explicit manual none-applicable attestation remains a human assertion',()=>{
 const {d,o}=sourceDraft('Coloured cells and footnotes require human interpretation.');assert.equal(compileConfirmedImport(d,o).ok,false);completeSyntheticCoverage(d,o);assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('horizon, cohort and candidate changes invalidate previously recorded completion',()=>{
 for(const edit of [({o})=>o.teachingEnd='2026-11-16',({o})=>o.academicScope.degreeGroup='PG',({o})=>o.snapshot.date='2026-10-24',({d})=>d.calendarEntries[0].endDate='2026-10-27',({d})=>d.pages[1].text+=' Revised note.']){
  const f=modelledDraft();edit(f);assert.ok(codes(f.d,f.o).includes('CALENDAR_COVERAGE_STALE'));
 }
});
test('information-only rows cannot be linked as represented exams or timetable substitutions',()=>{
 for(const kind of ['EXAM_WINDOW','REPLACEMENT']){const {d,o}=modelledDraft(),r=d.calendarEntries.find(r=>r.kind===kind);r.treatment='INFORMATION_ONLY';r.resolutionNote='Generic note';for(const p of d.calendarCoverage.pages)recordPageCoverage(d,o,p);assert.ok(codes(d,o).includes('CALENDAR_RESOLUTION_LINK'));}
});
test('page confirmations must include every area, use real effect links and match original page membership',()=>{
 const {d,o}=modelledDraft(),p=d.calendarCoverage.pages[0];p.areas.SUBSTITUTIONS.rowIds=['missing'];recordPageCoverage(d,o,p);assert.ok(codes(d,o).includes('CALENDAR_COVERAGE_LINK'));
 p.areas.SUBSTITUTIONS={decision:'NONE_APPLICABLE',note:'No exceptions',rowIds:[]};recordPageCoverage(d,o,p);assert.ok(codes(d,o).includes('CALENDAR_COVERAGE_CONTRADICTION'));
 d.calendarCoverage.pages.push(structuredClone(p));assert.ok(codes(d,o).includes('CALENDAR_COVERAGE_PAGES'));
});
test('manual page completion is not a replacement for an existing unresolved candidate',()=>{
 const {d,o}=modelledDraft();d.calendarEntries[0].review='UNREVIEWED';for(const p of d.calendarCoverage.pages)recordPageCoverage(d,o,p);assert.equal(compileConfirmedImport(d,o).ok,false);assert.ok(codes(d,o).some(c=>c==='CALENDAR_RESOLUTION_LINK'||c==='CALENDAR_EXCLUSION_DECISION'));
});
test('coverage data cannot be replayed on another upload with the same filename',()=>{
 const {d,o}=modelledDraft(),before=calendarCoverageFingerprint(d,o);d.sources[1].sha256='c'.repeat(64);assert.notEqual(calendarCoverageFingerprint(d,o),before);assert.ok(codes(d,o).includes('CALENDAR_COVERAGE_STALE'));
});
test('editing completion answers directly invalidates the declaration even if its checkbox flag remains true',()=>{
 const {d,o}=modelledDraft();d.calendarCoverage.pages[0].areas.OBLIGATIONS.note='Changed after confirmation';assert.ok(codes(d,o).includes('CALENDAR_COVERAGE_STALE'));
});
