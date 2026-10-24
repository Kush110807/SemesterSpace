import {readSource,aborted,checkSource} from './read.js';
import {parseTimetable,parseCalendar,issue} from './parse.js';
export {validateImportDraft,compileConfirmedImport} from './compile.js';
export async function extractDocuments(request){
  const {signal,onProgress}=request;const id=crypto.randomUUID();
  const draft={importVersion:'0.2.0',id,revision:0,status:'REVIEW_REQUIRED',sources:[],sectionCandidates:[],selectedSection:request.section?.trim().toUpperCase()??null,declaredSubgroup:request.subgroup??null,declaredProgrammingGroup:request.programmingGroup??null,subjects:[],registers:[],timetableEntries:[],calendarEntries:[],issues:[],pages:[],calendarCoverage:{pages:[]}};
  try{
    for(const [key,role] of [['timetable','TIMETABLE'],['academicCalendar','ACADEMIC_CALENDAR']]){
      aborted(signal);const input=request[key];checkSource(input);
      const source={id:`${id}-${key}`,role,fileName:input.fileName,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input.bytes))).map(x=>x.toString(16).padStart(2,'0')).join(''),mimeType:checkSource(input),pageCount:0,institutionLabel:null,extractionMode:'PDF_TEXT'};
      const {pages}=await readSource(input,role,{signal,onProgress});aborted(signal);
      source.pageCount=pages.length;const modes=new Set(pages.map(p=>p.method));source.extractionMode=modes.size>1?'MIXED':pages[0].method;
      const raw=pages.map(p=>p.text).join(' ');source.institutionLabel=raw.match(/MAHARAJA\s+AGRASEN\s+INSTITUTE\s+OF\s+TECHNOLOGY|INDIAN\s+INSTITUTE\s+OF\s+TECHNOLOGY\s*\(BHU\)/i)?.[0]??null;
      onProgress?.({stage:'ASSEMBLING',sourceRole:role,page:null,pages:pages.length});
      const parsed=key==='timetable'?parseTimetable(source,pages,draft.selectedSection??'',id):parseCalendar(source,pages,id);
      const {issues,year,...fields}=parsed;Object.assign(draft,fields);source.academicYear=year??null;draft.issues.push(...issues);draft.sources.push(source);
      draft.pages.push(...pages.map(p=>({...p,sourceId:source.id,reviewed:false})));
    }
    for(const row of draft.timetableEntries){const declared=/programming/i.test(draft.subjects.find(s=>s.id===row.subjectId)?.name??'')?request.programmingGroup:request.subgroup;
      if(declared&&row.groupOptions.includes(declared)){row.groupChoice=declared;row.applicability='APPLIES';}
    }
    return draft;
  }catch(error){
    if(signal?.aborted||error.name==='AbortError')throw new DOMException('Import cancelled','AbortError');
    draft.status=/UNSUPPORTED_FORMAT|PAGE_LIMIT|FILE_LIMIT|IMAGE_LIMIT/.test(error.message)?'UNSUPPORTED':'UNREADABLE';
    draft.issues.push(issue('EXTRACTION_FAILED','sources',`Local extraction failed: ${error.message}. Check supported files and run npm ci if local assets are missing.`));return draft;
  }
}
// A replacement or cancel invalidates every old completion, even if decoding ignores abort.
export function createImportJob(extract=extractDocuments){
  let serial=0,controller;
  return {cancel(){serial++;controller?.abort();},async run(request){controller?.abort();const token=++serial;controller=new AbortController();const draft=await extract({...request,signal:controller.signal});if(token!==serial)throw new DOMException('Superseded import','AbortError');return draft;}};
}
