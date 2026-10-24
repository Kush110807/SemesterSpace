import * as engine from '../../src/engine/index.js';
import {fixture,calendar} from './coverage-fixture.mjs';
import {compileConfirmedImport as currentCompile} from '../../src/import/compile.js';
export function reproduceCoverage(compileConfirmedImport=currentCompile){
const reports=[];
function run(name,edit){const {d,o}=fixture();d.pages[1].text='Mandatory exam 26.10.2026. Saturday 31.10.2026 follows Monday timetable.';d.pages[1].method='OCR';d.pages[1].width=1000;d.pages[1].height=1000;d.pages[1].items=[{text:d.pages[1].text,x:10,y:100,w:900,h:20}];edit(d,o);const r=compileConfirmedImport(d,o);let trialStatus=null,saturdaySessions=null;
if(r.model){const m=r.model,x=engine.expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});if(x.ok){saturdaySessions=x.sessions.filter(s=>s.date==='2026-10-31').length;trialStatus=engine.evaluatePlan({...m,schedule:{...m.schedule,initialized:true},sessions:x.sessions},{clock:o.clockPlaceholder,additionalDates:['2026-10-26']}).status;}}
reports.push({case:name,compiled:r.ok,events:r.model?.events.length??null,replacements:r.model?.schedule.replacements.length??null,examDayBreakTrialStatus:trialStatus,substitutionSaturdaySessions:saturdaySessions,issues:r.issues.map(i=>i.code)});}
run('1 omitted exam and substitution',()=>{});
run('2 readable OCR but calendar meaning unsupported',d=>{d.pages[1].text='M S T indicated by shaded boxes. Alternate teaching pattern in legend.';d.pages[1].items=[{text:d.pages[1].text,x:10,y:100,w:900,h:20}];d.issues=[{code:'GRID_LAYOUT_REVIEW',severity:'WARNING',message:'Calendar meaning unsupported'}];});
run('3a delete unresolved candidate',d=>{d.calendarEntries=[calendar({kind:'EXAM_WINDOW',review:'UNREVIEWED',treatment:'UNRESOLVED'})];d.calendarEntries.splice(0,1);});
run('3b reclassify exam as information-only',d=>{d.calendarEntries=[calendar({kind:'EXAM_WINDOW',treatment:'INFORMATION_ONLY',resolutionNote:'Administrative information'})];});
run('3c change category to avoid critical note requirement',d=>{d.calendarEntries=[calendar({kind:'HOLIDAY',treatment:'INFORMATION_ONLY'})];});
run('4 page reviewed with unresolved meaning',d=>{d.pages[1].reviewed=true;d.issues=[{code:'NO_CALENDAR_ROWS',severity:'ERROR',message:'No interpreted calendar rows'}];});
run('4b an existing unresolved row remains blocked',d=>{d.calendarEntries=[calendar({kind:'EXAM_WINDOW',review:'UNREVIEWED',treatment:'UNRESOLVED'})];});
return {investigationBase:'feb40999bdc59fc7ef41eb55e24665a690985fa6',phase:process.env.SS_REPRO_PHASE??'current',cases:reports};
}
if(process.argv.includes('--run'))console.log(JSON.stringify(reproduceCoverage(),null,2));
