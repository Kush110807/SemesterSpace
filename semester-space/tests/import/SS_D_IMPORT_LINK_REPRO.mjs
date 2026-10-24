// Independent test-only adversarial reproduction; production sources unchanged.
import {strict as assert} from 'node:assert';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const local = rel => import(pathToFileURL(resolve(process.cwd(),rel)).href);
const {fixture,completeSyntheticCoverage}=await local('tests/import/coverage-fixture.mjs');
const {parseCalendar}=await local('src/import/parse.js');
const {recordPageCoverage,validateCalendarCoverage}=await local('src/import/coverage.js');
const {compileConfirmedImport}=await local('src/import/compile.js');
const {expandSchedule,evaluatePlan}=await local('src/engine/index.js');
const {d,o}=fixture();
const page=d.pages[1];
page.text='Mandatory exam 26.10.2026\nMandatory exam 27.10.2026';
page.method='OCR';page.width=1000;page.height=1000;
page.items=[
 {text:'Mandatory exam 26.10.2026',x:10,y:100,w:500,h:20},
 {text:'Mandatory exam 27.10.2026',x:10,y:170,w:500,h:20}
];
d.calendarEntries=parseCalendar(d.sources[1],[page],d.id).calendarEntries;
for(const row of d.calendarEntries){Object.assign(row,{review:'CONFIRMED',applicability:'APPLIES',treatment:'COMPULSORY',allDay:true,resolutionNote:'Test-reviewed compulsory exam'});}
completeSyntheticCoverage(d,o);
const baseline=compileConfirmedImport(d,o);
assert.equal(baseline.ok,true,JSON.stringify(baseline.issues));
assert.equal(baseline.model.events.length,2);
const [exam26,exam27]=d.calendarEntries;
exam26.treatment='INFORMATION_ONLY';exam26.resolutionNote='Test: another entry was selected as representation';
exam26.coverageResolution={decision:'REPRESENTED',rowIds:[exam27.id],note:'Test reviewer selected alternate exam on page',confirmed:true};
exam27.startDate='2027-01-10';exam27.endDate='2027-01-10';
exam27.coverageResolution.rowIds=[exam27.id];
const completion=d.calendarCoverage.pages[0];
completion.areas.OBLIGATIONS.rowIds=[exam27.id];
recordPageCoverage(d,o,completion);
const validation=validateCalendarCoverage(d,o);
const compiled=compileConfirmedImport(d,o);
assert.deepEqual(validation,[]);
assert.equal(compiled.ok,true,JSON.stringify(compiled.issues));
assert.deepEqual(compiled.model.events,[]);
const expanded=expandSchedule({schedule:compiled.model.schedule,courses:compiled.model.courses,registers:compiled.model.registers,extraSessions:[],overrides:[]});
assert.equal(expanded.ok,true,JSON.stringify(expanded.issues));
const model={...compiled.model,schedule:{...compiled.model.schedule,initialized:true},sessions:expanded.sessions};
const plan=evaluatePlan(model,{clock:o.clockPlaceholder,additionalDates:['2026-10-26']});
console.log(JSON.stringify({sourceExams:['2026-10-26','2026-10-27'],teachingHorizon:[o.startDate,o.teachingEnd],baselineCompiledEvents:baseline.model.events.map(e=>e.date),coverageErrors:validation.map(x=>x.code),importAccepted:compiled.ok,compiledEvents:compiled.model.events.map(e=>e.date),oct26PlanStatus:plan.status,oct26Blockers:plan.blockers??null},null,2));
