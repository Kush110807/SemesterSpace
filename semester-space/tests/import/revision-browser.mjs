// Served module/file-input integration harness, not C's revision UI or A's apply transaction.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {expandSchedule} from '../../src/engine/index.js';
export async function revisionBrowser(){
 const {chromium}=await import('playwright'),origin=process.env.SS_ORIGIN??'http://127.0.0.1:5190',dir=process.env.SS_EVIDENCE_DIR??'/tmp/ss-rc001-revision-browser';
 await mkdir(dir,{recursive:true});const browser=await chromium.launch({executablePath:process.env.SS_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
 try{
  await page.goto(origin);await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='revision-harness-file';document.body.append(input);});
  await page.locator('#revision-harness-file').setInputFiles(fileURLToPath(new URL('../../../reference-inputs/Academic_Calendar_Odd_Semester_2026-2027.pdf',import.meta.url)));
  const {o}=fixture(); // use a compiled synthetic setup, never personal confirmations
  const f=fixture();completeSyntheticCoverage(f.d,f.o);const r=compileConfirmedImport(f.d,f.o);assert.ok(r.ok);const m=r.model,x=expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});m.sessions=x.sessions;m.schedule.initialized=true;m.revision=7;
  m.context.college='MAIT — synthetic revision QA only';o.academicScope.institution=m.context.college;
  m.events.push({id:'retain-old-exam',date:'2026-11-03',start:'10:00',end:'11:00',title:'Prior synthetic exam',sessionId:null,cancelled:false});
  const report=await page.evaluate(async({m,academic,clock})=>{
   const {extractCalendarRevision}=await import('/src/import/revision-extract.js'),{prepareCalendarRevision,buildRevisionCandidate}=await import('/src/import/revision.js');
   const file=document.querySelector('#revision-harness-file').files[0],start=performance.now();
   const d=await extractCalendarRevision({academicCalendar:{fileName:'renamed-calendar.pdf',bytes:new Uint8Array(await file.arrayBuffer())},section:'Q'});
   const elapsedMs=Math.round(performance.now()-start),before=JSON.stringify(m),prior={version:1,links:[{sourceRef:'prior-exam',kind:'UPSERT_EVENT',targetId:'retain-old-exam',value:m.events[0]}]};
   const first=prepareCalendarRevision({currentModel:m,existingSourceRevision:prior,extractedDraft:d});
   const scope={start:m.schedule.startDate,end:m.schedule.teachingEnd,section:'Q',subgroup:'Q3',programmingGroup:'Q23'};
   const chosen=d.review.effects.find(e=>e.kind==='ADD_HOLIDAY'&&e.after.date>=scope.start&&e.after.date<=scope.end&&e.after.date>m.snapshots.at(-1).date);
   if(!chosen)throw Error('Actual extraction yielded no relevant holiday; do not substitute reference output.');
   d.review={...d.review,scope,scopeConfirmed:true,academicScope:academic,sourceCoverageConfirmed:true,coverageNote:'Synthetic developer manual completion for one bounded restriction; not personal or institutional approval.',effects:[{...chosen,confirmed:true,applicabilityConfirmed:true,effectiveDateConfirmed:true}],exclusions:d.calendarEntries.filter(row=>row.id!==chosen.sourceRef).map(row=>({sourceRef:row.id,confirmed:true,reason:'Synthetic bounded API exercise only; other real meanings require actual review.'})),missing:[{sourceRef:'prior-exam',decision:'KEEP_EXISTING',confirmed:true,reason:'A missing extracted row cannot delete the prior exam.'}]};
   const reviewed=prepareCalendarRevision({currentModel:m,existingSourceRevision:prior,extractedDraft:d}),candidate=buildRevisionCandidate({model:m,proposal:reviewed.proposal,acceptedChangeIds:reviewed.proposal.changes.map(c=>c.changeId),clock});
   return {harness:'Actual file input + served calendar-only module API; no C revision UI or A persistence',elapsedMs,status:d.status,pages:d.pages.length,candidates:d.calendarEntries.length,initialUnresolved:first.proposal.unresolved.map(i=>i.code),initialPossibleRemoval:first.comparison.some(c=>c.status==='POSSIBLE_REMOVAL'),reviewedUnresolved:reviewed.proposal.unresolved,candidateOk:candidate.ok,candidateIssues:candidate.issues,holiday:chosen.after.date,holidayPresent:candidate.proposedModel?.schedule.holidays.some(h=>h.date===chosen.after.date),oldExamRetained:candidate.proposedModel?.events.some(e=>e.id==='retain-old-exam'),sourceEvidencePreserved:!!candidate.sourceRevisionPatch?.links[0].evidence.excerpt,inputUnchanged:JSON.stringify(m)===before,revisionUnchanged:candidate.proposedModel?.revision===m.revision,storageKeys:localStorage.length};
  },{m,academic:o.academicScope,clock:o.clockPlaceholder});
  assert.equal(report.status,'PARTIAL');assert.equal(report.pages,8);assert.ok(report.initialPossibleRemoval);assert.ok(report.initialUnresolved.includes('COVERAGE_REVIEW'));assert.deepEqual(report.reviewedUnresolved,[]);assert.ok(report.candidateOk,JSON.stringify(report.candidateIssues));for(const k of ['holidayPresent','oldExamRetained','sourceEvidencePreserved','inputUnchanged','revisionUnchanged'])assert.ok(report[k],k);assert.equal(report.storageKeys,0);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  report.pageErrors=errors;report.externalRequests=external;await writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
if(process.argv.includes('--run'))await revisionBrowser();
