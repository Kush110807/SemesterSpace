// Calendar-only staging. Device-local reader; no Model, storage or controller access.
import {readSource,checkSource,aborted} from './read.js';
import {parseCalendar,validDate} from './parse.js';
export function suggestRevisionEffects(rows){
  const effects=[];
  for(const row of rows){
    const kind=['HOLIDAY','NON_TEACHING','VACATION'].includes(row.kind)?'ADD_HOLIDAY':['EXAM_WINDOW','ACADEMIC_ACTIVITY'].includes(row.kind)?'UPSERT_EVENT':['REPLACEMENT','WORKING_DAY_NOTICE'].includes(row.kind)?'REPLACE_PATTERN':row.kind==='TEACHING_BOUNDARY'&&/end|last/i.test(row.title)?'TEACHING_END':null;
    if(!kind||!validDate(row.startDate)||!validDate(row.endDate))continue;
    let n=0;for(let dt=new Date(row.startDate+'T12:00:00Z');dt.toISOString().slice(0,10)<=row.endDate&&n++<740;dt.setUTCDate(dt.getUTCDate()+1)){
      const date=dt.toISOString().slice(0,10);
      const after=kind==='ADD_HOLIDAY'?{date,label:row.title}:kind==='UPSERT_EVENT'?{id:null,title:row.title,cancelled:false,sessionId:null,date,start:null,end:null}:kind==='REPLACE_PATTERN'?{date,weekday:row.replacementWeekday,confirmed:true}:{date};
      effects.push({id:crypto.randomUUID(),sourceRef:row.id,kind,after,confirmed:false,applicabilityConfirmed:false,effectiveDateConfirmed:false});
    }
  }return effects;
}
export async function extractCalendarRevision({academicCalendar,section=null,signal,onProgress}){
  const draft={revisionDraftVersion:1,status:'REVIEW_REQUIRED',source:null,pages:[],calendarEntries:[],issues:[],review:{proposalKey:crypto.randomUUID(),scope:null,scopeConfirmed:false,sourceCoverageConfirmed:false,coverageNote:'',effects:[],exclusions:[],missing:[]}};
  try{
    aborted(signal);const mime=checkSource(academicCalendar);
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',academicCalendar.bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const source={id:`calendar:${sha256}`,sha256,fileName:academicCalendar.fileName,role:'ACADEMIC_CALENDAR',mimeType:mime,coverage:'PARTIAL',section};
    const {pages}=await readSource(academicCalendar,'ACADEMIC_CALENDAR',{signal,onProgress});aborted(signal);
    source.institutionLabel=pages.map(p=>p.text).join(' ').match(/MAHARAJA\s+AGRASEN\s+INSTITUTE\s+OF\s+TECHNOLOGY|INDIAN\s+INSTITUTE\s+OF\s+TECHNOLOGY\s*\(BHU\)/i)?.[0]??null;
    source.pageCount=pages.length;source.pageRefs=pages.map(p=>`${source.id}#page=${p.page}`);
    draft.source=source;draft.pages=pages.map(p=>({...p,sourceId:source.id}));
    const parsed=parseCalendar(source,pages,source.id);draft.calendarEntries=parsed.calendarEntries;draft.issues=parsed.issues;
    // Readable text or candidate count never establishes semantic completeness.
    draft.review.effects=suggestRevisionEffects(draft.calendarEntries);draft.status='PARTIAL';return draft;
  }catch(e){
    if(signal?.aborted||e.name==='AbortError')throw new DOMException('Import cancelled','AbortError');
    draft.status=/UNSUPPORTED_FORMAT|PAGE_LIMIT|FILE_LIMIT|IMAGE_LIMIT/.test(e.message)?'UNSUPPORTED':'UNREADABLE';
    draft.issues.push({code:'REVISION_EXTRACTION_FAILED',message:e.message});return draft;
  }
}
