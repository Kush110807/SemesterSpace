import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {parseCalendar,parseDates} from '../../src/import/parse.js';
const dates=s=>parseDates(s,2026).map(d=>d.date);
const evRoot=new URL('./evidence/d-imp-01/',import.meta.url);
async function decoded(file){const d=JSON.parse(await readFile(new URL('corpus-'+file+'.json',evRoot)));return {source:d.sources.find(s=>s.role==='ACADEMIC_CALENDAR'),pages:d.pages.filter(p=>p.sourceId===d.sources.find(s=>s.role==='ACADEMIC_CALENDAR').id)};}
function parsed(s){return parseCalendar(s.source,s.pages,'actual-content');}
function row(r,kind,start,end=start){return r.calendarEntries.find(r=>r.kind===kind&&r.startDate===start&&r.endDate===end);}
test('named dates preserve both endpoints, local years, cross-month ranges and academic-year headings',()=>{
 assert.deepEqual(dates('Mid Sem Exams (20Sept - 28 Sept)'),['2026-09-20','2026-09-28']);
 assert.deepEqual(dates('End-Sem Examinations {29th Nov - 8th Dec)'),['2026-11-29','2026-12-08']);
 assert.deepEqual(dates('Examination October 05 10. 2027'),['2027-10-05','2027-10-10']);
 assert.deepEqual(dates('Classes start for Even Semester 2026-27 Jan 05, 2027'),['2027-01-05']);
 assert.deepEqual(dates('Exams 21–26 September 2026'),['2026-09-21','2026-09-26']);
 assert.deepEqual(dates('Exams Dec 29, 2026 - Jan 08, 2027'),['2026-12-29','2027-01-08']);
 assert.deepEqual(dates('Calendar 2026-27, no announced dates'),[]);
 assert.deepEqual(dates('February 30-31, 2026'),[null,null]);
});
test('actual colour-grid OCR recovers explicit printed exam windows without inventing grid dates',async()=>{
 const d=await decoded('calendar_grid_colour_150735.png'),r=parsed(d);
 for(const [start,end] of [['2026-09-20','2026-09-28'],['2026-11-29','2026-12-08']]){
  const e=row(r,'EXAM_WINDOW',start,end);assert.ok(e);assert.equal(e.review,'UNREVIEWED');assert.equal(e.treatment,'UNRESOLVED');assert.ok(e.evidence[0].rawText.includes('Exam'));assert.equal(e.evidence[0].page,1);assert.equal(e.evidence[0].sourceId,d.source.id);
 }
 assert.ok(r.issues.some(i=>i.code==='GRID_LAYOUT_REVIEW'));assert.ok(r.issues.some(i=>i.code==='OCR_REVIEW'));
 // Perturb actual document text: extraction follows the changed printed date, never a fixture result.
 const altered=structuredClone(d);for(const p of altered.pages){p.text=p.text.replace('20Sept','21Sept');for(const i of p.items)i.text=i.text.replace('20Sept','21Sept');}
 assert.ok(row(parsed(altered),'EXAM_WINDOW','2026-09-21','2026-09-28'));assert.ok(!row(parsed(altered),'EXAM_WINDOW','2026-09-20','2026-09-28'));
});
test('native original event/date PDF keeps separate cohort boundaries and exam ranges',async()=>{
 const bytes=new Uint8Array(await readFile(new URL('../../../reference-inputs/IIT_BHU_calendar_26-27_odd.pdf',import.meta.url))),pdf=await getDocument({data:bytes,useSystemFonts:true}).promise;
 const pages=[];try{for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1}),c=await p.getTextContent(),items=c.items.filter(i=>i.str?.trim()).map(i=>({text:i.str,x:i.transform[4],y:v.height-i.transform[5]-i.height,w:i.width,h:i.height}));pages.push({page:n,width:v.width,height:v.height,items,text:items.map(i=>i.text).join(' '),method:'PDF_TEXT'});}}finally{await pdf.destroy();}
 const r=parseCalendar({id:'renamed-actual-input'},pages,'actual');
 assert.match(row(r,'TEACHING_BOUNDARY','2026-07-23').audienceText,/except First Semester/i);
 assert.match(row(r,'TEACHING_BOUNDARY','2026-11-10').audienceText,/except UG\/PG/i);
 assert.match(row(r,'TEACHING_BOUNDARY','2026-11-17').audienceText,/First Semester/i);
 assert.match(row(r,'EXAM_WINDOW','2026-11-12','2026-11-25').audienceText,/except First Sem/i);
 assert.match(row(r,'EXAM_WINDOW','2026-11-19','2026-11-30').audienceText,/First Sem/i);
 assert.ok(r.issues.some(i=>i.code==='MERGED_COHORT_REVIEW'));assert.ok(r.issues.some(i=>i.code==='TEXT_ENCODING_OR_LAYOUT'));
});
test('actual dual-term OCR preserves explicit exam ranges/years and distinct unspecified working Saturdays',async()=>{
 const d=await decoded('calendar_dual_term_150940.png'),r=parsed(d);
 assert.equal(row(r,'EXAM_WINDOW','2026-10-05','2026-10-10').term,'ODD');
 assert.equal(row(r,'EXAM_WINDOW','2026-12-04','2026-12-15').term,'ODD');
 const a=row(r,'WORKING_DAY_NOTICE','2026-12-05'),b=row(r,'WORKING_DAY_NOTICE','2026-12-12');assert.ok(a&&b);assert.equal(a.replacementWeekday,null);assert.equal(b.replacementWeekday,null);assert.ok(!row(r,'WORKING_DAY_NOTICE','2026-12-05','2026-12-12'));
 const unresolved=row(r,'REPLACEMENT','2026-08-22');assert.ok(unresolved);assert.equal(unresolved.replacementWeekday,null);assert.match(unresolved.evidence[0].rawText,/Tuesaday/);assert.ok(r.issues.some(i=>i.code==='UNKNOWN_REPLACEMENT_PATTERN'));
 assert.ok(r.calendarEntries.some(e=>e.term==='EVEN'&&e.startDate?.startsWith('2027-')));
});
test('generic exam ranges and explicit replacement dates vary with input, not filename/institution',()=>{
 const source={id:'unknown'},text='Revised exam October 06 11. 2027\nDecember 06 & 13 will be Working Saturdays in view of End Term Exams';
 const page={page:1,width:1000,height:1000,text,items:text.split('\n').map((text,n)=>({text,x:10,y:30+n*40,w:850,h:20})),method:'OCR'};
 const r=parseCalendar(source,[page],'different');assert.ok(row(r,'EXAM_WINDOW','2027-10-06','2027-10-11'));assert.ok(row(r,'WORKING_DAY_NOTICE','2027-12-06'));assert.ok(row(r,'WORKING_DAY_NOTICE','2027-12-13'));
 assert.ok(!r.calendarEntries.some(e=>e.review!=='UNREVIEWED'||e.applicability!=='UNRESOLVED'));
});
test('numeric OCR punctuation is recognized while merged/malformed years stay unresolved',async()=>{
 assert.deepEqual(dates('04:01:2027t0 17.01.2027'),['2027-01-04','2027-01-17']);
 assert.deepEqual(dates('21.09. 202610 to 26.09.2026'),[null,'2026-09-26']);
 const r=parsed(await decoded('Academic_Calendar_Odd_Semester_2026-2027.pdf'));
 assert.ok(row(r,'VACATION','2027-01-04','2027-01-17'));
 const unresolved=r.calendarEntries.find(e=>/Sessional Examination-I\b/.test(e.title)&&e.evidence[0].page===3);assert.ok(unresolved);assert.equal(unresolved.startDate,null);assert.ok(r.issues.some(i=>i.code==='DATE_TOKEN_REVIEW'));
});
