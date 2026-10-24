import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {parseCalendar} from '../../src/import/parse.js';
import {recordPageCoverage} from '../../src/import/coverage.js';
import {expandSchedule,evaluatePlan} from '../../src/engine/index.js';
export function linkFixture(kind='EXAM_WINDOW'){
 const {d,o}=fixture(),page=d.pages[1];
 const texts=kind==='REPLACEMENT'?['Time table adjustment 31.10.2026 Monday TT','Time table adjustment 07.11.2026 Monday TT']:kind==='NON_TEACHING'?['Non-teaching 26.10.2026','Non-teaching 27.10.2026']:['Mandatory exam 26.10.2026','Mandatory exam 27.10.2026'];
 Object.assign(page,{text:texts.join('\n'),method:'OCR',width:1000,height:1000,items:texts.map((text,i)=>({text,x:10,y:100+i*70,w:500,h:20}))});
 d.calendarEntries=parseCalendar(d.sources[1],[page],d.id).calendarEntries;
 for(const r of d.calendarEntries)Object.assign(r,{review:'CONFIRMED',applicability:'APPLIES',treatment:kind==='EXAM_WINDOW'?'COMPULSORY':kind,allDay:true,resolutionNote:'Test-reviewed source restriction'});
 completeSyntheticCoverage(d,o);return {d,o};
}
export function refreshDeclarations(d,o){for(const p of d.calendarCoverage.pages)recordPageCoverage(d,o,p);}
export function redirectLink(d,o,date='2027-01-10'){
 const [source,target]=d.calendarEntries;source.treatment='INFORMATION_ONLY';source.resolutionNote='Test: another entry selected as representation';source.coverageResolution={decision:'REPRESENTED',rowIds:[target.id],note:'Test reviewer selected alternate entry on the page',confirmed:true};
 target.startDate=target.endDate=date;target.coverageResolution.rowIds=[target.id];
 const area=source.kind==='REPLACEMENT'?'SUBSTITUTIONS':source.kind==='NON_TEACHING'?'NON_TEACHING':'OBLIGATIONS';d.calendarCoverage.pages[0].areas[area].rowIds=[target.id];refreshDeclarations(d,o);return {source,target,area};
}
export function publicOutcome(compiled,o){
 if(!compiled.ok)return {importAccepted:false,compiledEvents:null,holidays:null,replacements:null,oct26PlanStatus:null,oct31Sessions:null,coverageOrCompileErrors:compiled.issues.map(i=>i.code)};
 const m=compiled.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});
 if(!x.ok)throw Error(JSON.stringify(x.issues));
 const model={...m,schedule:{...m.schedule,initialized:true},sessions:x.sessions};
 const p=evaluatePlan(model,{clock:o.clockPlaceholder,additionalDates:['2026-10-26']});
 return {importAccepted:true,compiledEvents:m.events.map(e=>e.date),holidays:m.schedule.holidays.map(h=>h.date),replacements:m.schedule.replacements,oct26PlanStatus:p.status,oct31Sessions:x.sessions.filter(s=>s.date==='2026-10-31').length,coverageOrCompileErrors:compiled.issues.map(i=>i.code)};
}
