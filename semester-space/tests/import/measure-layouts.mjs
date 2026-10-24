// Developer corpus comparison only. Runtime parser never imports these expectations or stored OCR.
import {readFile} from 'node:fs/promises';
import {parseCalendar} from '../../src/import/parse.js';
const inputs=['Academic_Calendar_Odd_Semester_2026-2027.pdf','IIT_BHU_calendar_26-27_odd.pdf','calendar_grid_colour_150735.png','calendar_grid_cohort_150809.png','calendar_dual_term_150940.png'];
export async function measureLayouts(parse=parseCalendar){
 const corpus=JSON.parse(await readFile(new URL('../../docs/import/CALENDAR_FORMAT_REFERENCE.json',import.meta.url)));
 const reports=[];
 for(const [i,file] of inputs.entries()){
  const decoded=JSON.parse(await readFile(new URL('./evidence/d-imp-01/corpus-'+file+'.json',import.meta.url))),source=decoded.sources.find(s=>s.role==='ACADEMIC_CALENDAR'),pages=decoded.pages.filter(p=>p.sourceId===source.id);
  const actual=parse(source,pages,'measured');
  const expected=i?corpus.newExamples[i-1].expectedCases:JSON.parse(await readFile(new URL('../../docs/import/SECTION_Q_EXTRACTION_REFERENCE.json',import.meta.url))).calendarEntries;
  const matches=expected.filter(e=>e.startDate&&actual.calendarEntries.some(r=>r.kind===e.kind&&r.startDate===e.startDate&&r.endDate===e.endDate&&(e.replacementIsoWeekday===undefined||r.replacementWeekday===e.replacementIsoWeekday)));
  reports.push({file,input:'Actual prior device-local PDF/OCR decoding; parser-only comparison, not a new OCR run',candidateRows:actual.calendarEntries.length,datedCandidates:actual.calendarEntries.filter(r=>r.startDate).length,matches:matches.map(e=>e.id),unmatched:expected.filter(e=>!matches.includes(e)).map(e=>e.id),issues:actual.issues.map(i=>i.code)});
 }return reports;
}
if(process.argv.includes('--run'))console.log(JSON.stringify(await measureLayouts(),null,2));
