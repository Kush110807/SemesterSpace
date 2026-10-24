// Browser decoding/OCR of developer-visible originals. Candidate coverage is not an accuracy score.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
export async function runCorpus(){
 const {chromium}=await import('playwright');const origin=process.env.SS_ORIGIN??'http://127.0.0.1:5173';
 const browser=await chromium.launch({executablePath:process.env.SS_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage(),external=[];page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 const read=n=>readFile(new URL('../../../reference-inputs/'+n,import.meta.url));
 const timetable=(await read('1stSemPoolB.pdf')).toString('base64');
 const cases=JSON.parse(await readFile(new URL('../../docs/import/CALENDAR_FORMAT_REFERENCE.json',import.meta.url)));
 const files=['Academic_Calendar_Odd_Semester_2026-2027.pdf','IIT_BHU_calendar_26-27_odd.pdf','calendar_grid_colour_150735.png','calendar_grid_cohort_150809.png','calendar_dual_term_150940.png'],reports=[];
 const dir=process.env.SS_EVIDENCE_DIR??'/tmp/ss-browser-evidence';await mkdir(dir,{recursive:true});
 try{
  await page.goto(origin);
  for(let i=0;i<files.length;i++){
   const name=files[i],calendar=(await read(name)).toString('base64'),start=Date.now();
   const result=await page.evaluate(async({name,timetable,calendar})=>{
    const {extractDocuments}=await import('/src/import/index.js');const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    const d=await extractDocuments({timetable:{fileName:'renamed-timetable.pdf',bytes:decode(timetable)},academicCalendar:{fileName:name,bytes:decode(calendar)},section:'Q',subgroup:'Q3',programmingGroup:'Q23'});
    return {status:d.status,sources:d.sources,pages:d.pages.map(p=>({sourceId:p.sourceId,page:p.page,method:p.method,text:p.text,width:p.width,height:p.height,items:p.items,words:p.items.length})),subjects:d.subjects,registers:d.registers,timetableEntries:d.timetableEntries,calendarEntries:d.calendarEntries,issues:d.issues};
   },{name,timetable,calendar});
   const expected=i?cases.newExamples[i-1].expectedCases:JSON.parse(await readFile(new URL('../../docs/import/SECTION_Q_EXTRACTION_REFERENCE.json',import.meta.url))).calendarEntries;
   const matches=(expected??[]).filter(e=>e.startDate&&result.calendarEntries.some(r=>r.kind===e.kind&&r.startDate===e.startDate&&r.endDate===e.endDate&&(e.replacementIsoWeekday===undefined||r.replacementWeekday===e.replacementIsoWeekday)));
   const report={file:name,ms:Date.now()-start,status:result.status,pages:result.pages.filter(p=>p.sourceId.endsWith('academicCalendar')).map(p=>({page:p.page,method:p.method,textLength:p.text.length,words:p.words})),candidateRows:result.calendarEntries.length,datedCandidates:result.calendarEntries.filter(r=>r.startDate).length,candidateDateKindMatches:matches.map(e=>e.id),unmatchedReferenceCases:(expected??[]).filter(e=>!matches.includes(e)).map(e=>e.id),limitations:result.issues.map(i=>i.message)};
   reports.push(report);await writeFile(dir+'/corpus-'+name+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(report,null,2));
  }
  if(external.length)throw Error('Unexpected external requests: '+external.join(', '));await writeFile(dir+'/corpus-report.json',JSON.stringify(reports,null,2));
 }finally{await browser.close();}
}
if(process.argv.includes('--run'))await runCorpus();
