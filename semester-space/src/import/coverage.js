// Import-layer review only. No coverage metadata is added to the shared Model schema.
// Neither readable OCR nor a parser candidate list establishes complete calendar coverage.
import {parseCalendar,validDate,issue} from './parse.js';
import {targetRestriction,datesForSource,naturallyCorresponds,reconciled,makeSourceReconciliation,fitsCalendarScope} from './link-effects.js';
export const COVERAGE_AREAS=[
  ['OBLIGATIONS','Exams and compulsory student obligations'],
  ['SUBSTITUTIONS','Timetable substitutions and exceptional working days'],
  ['NON_TEACHING','Holidays, recess and teaching suspensions'],
];
export const IMPORT_SOURCE_PREFIX='Document import (manual calendar coverage): ';
const reviewed=r=>['CONFIRMED','CORRECTED'].includes(r?.review);
const nonempty=s=>typeof s==='string'&&s.trim().length>0;
const cache=new WeakMap();
export function calendarPages(d){return d.pages.filter(p=>d.sources.some(s=>s.id===p.sourceId&&s.role==='ACADEMIC_CALENDAR'));}
function rawKey(d){return JSON.stringify([d.id,d.sources.filter(s=>s.role==='ACADEMIC_CALENDAR').map(s=>[s.id,s.sha256,s.pageCount]),calendarPages(d).map(p=>[p.sourceId,p.page,p.text,p.method,p.width,p.height,p.items])]);}
export function sourceCalendarCandidates(d){
  const key=rawKey(d),prior=cache.get(d);if(prior?.key===key)return structuredClone(prior.rows);
  const rows=d.sources.filter(s=>s.role==='ACADEMIC_CALENDAR').flatMap(s=>parseCalendar(s,calendarPages(d).filter(p=>p.sourceId===s.id),d.id).calendarEntries);
  cache.set(d,{key,rows:structuredClone(rows)});return rows;
}
export function coverageArea(row){
  if(['REPLACEMENT','WORKING_DAY_NOTICE'].includes(row.kind))return 'SUBSTITUTIONS';
  if(['HOLIDAY','NON_TEACHING','VACATION'].includes(row.kind))return 'NON_TEACHING';
  if(['EXAM_WINDOW','ACADEMIC_ACTIVITY','UNKNOWN'].includes(row.kind))return 'OBLIGATIONS';
  return null;
}
export function relevantCalendarRow(row,o,d){
  if(!validDate(row.startDate)||!validDate(row.endDate)||row.startDate>row.endDate)return true;
  const source=d.sources.find(s=>s.id===row.evidence?.[0]?.sourceId);
  if(source?.academicYear&&Math.abs(Number(row.startDate.slice(0,4))-source.academicYear)>1)return true;
  if(!validDate(o.snapshot?.date)||!validDate(o.startDate)||!validDate(o.teachingEnd))return true;
  return row.endDate>o.snapshot.date&&row.endDate>=o.startDate&&row.startDate<=o.teachingEnd;
}
export function representsArea(row,area){
  if(!reviewed(row)||row.applicability!=='APPLIES')return false;
  return area==='OBLIGATIONS'?row.treatment==='COMPULSORY':area==='SUBSTITUTIONS'?row.treatment==='REPLACEMENT'||row.kind==='WORKING_DAY_NOTICE'&&row.treatment==='COMPULSORY':['HOLIDAY','NON_TEACHING'].includes(row.treatment);
}
const onPage=(row,page)=>row.evidence?.some(e=>e.sourceId===page.sourceId&&e.page===page.page);
export function calendarCoverageFingerprint(d,o){
  // Exact comparison, not a security signature. Raw sources are read-only in the UI.
  return JSON.stringify([rawKey(d),o.academicScope,o.context?.section,o.startDate,o.teachingEnd,o.snapshot?.date,d.calendarEntries,o.replacements,o.holidayTeachingDates]);
}
export function blankPageCoverage(page){return {sourceId:page.sourceId,page:page.page,areas:Object.fromEntries(COVERAGE_AREAS.map(([key])=>[key,{decision:'UNRESOLVED',rowIds:[],note:''}])),confirmed:false,fingerprint:null,answersFingerprint:null};}
export function recordPageCoverage(d,o,record){record.confirmed=true;record.fingerprint=calendarCoverageFingerprint(d,o);record.answersFingerprint=JSON.stringify(record.areas);}
export function coverageSummary(d,o){
  const records=d.calendarCoverage?.pages??[],fingerprint=calendarCoverageFingerprint(d,o);
  return {pages:calendarPages(d).length,confirmed:records.filter(r=>r.confirmed===true&&r.fingerprint===fingerprint&&r.answersFingerprint===JSON.stringify(r.areas)&&COVERAGE_AREAS.every(([a])=>['ENTERED','NONE_APPLICABLE'].includes(r.areas?.[a]?.decision)&&nonempty(r.areas[a].note))).length};
}
export function recordSourceReconciliation(d,o,rowId,note){
  const row=d.calendarEntries.find(r=>r.id===rowId),source=sourceCalendarCandidates(d).find(r=>r.id===rowId)??row;
  const ids=row?.coverageResolution?.rowIds;
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Select at least one distinct planner row before reconciling this source.');
  const targets=ids.map(id=>d.calendarEntries.find(r=>r.id===id));
  if(targets.some(r=>!r))throw Error('Select existing planner rows before reconciling this source.');
  row.coverageResolution.reconciliation=makeSourceReconciliation(source,targets,d,o,note);
}
export function validateCalendarCoverage(d,o){
  const errors=[],bad=(code,message,row=null)=>errors.push(issue(code,'calendarCoverage',message,row?[row.id]:[],row?.evidence??[]));
  const pages=calendarPages(d);
  if(!pages.length||pages.some(p=>typeof p.text!=='string'||!Array.isArray(p.items))){bad('CALENDAR_SOURCE_REVIEW','Keep the original decoded calendar pages available for manual completion. Re-extract if they are missing.');return errors;}
  const originals=sourceCalendarCandidates(d),current=new Map(d.calendarEntries.map(r=>[r.id,r]));
  for(const original of originals){
    const row=current.get(original.id);
    if(!row){bad('CALENDAR_CANDIDATE_REMOVED','A source candidate was removed. Restore it and record an explicit exclusion or link it to its corrected replacement.',original);continue;}
    if(!original.evidence.every(e=>onPage(row,e)))bad('CALENDAR_CANDIDATE_PROVENANCE','A source candidate lost its page provenance. Restore the source link.',original);
  }
  // Original source categories survive user edits to candidate names, dates and classification.
  // New manually entered rows are reviewed too; deleting one after confirmation invalidates coverage.
  const inventory=[...originals,...d.calendarEntries.filter(r=>!originals.some(x=>x.id===r.id))];
  for(const original of inventory){
    const row=current.get(original.id),area=coverageArea(original);
    if(!row||!area||!relevantCalendarRow(original,o,d))continue;
    const decision=row.coverageResolution;
    if(!decision||decision.confirmed!==true||!nonempty(decision.note)){
      bad('CALENDAR_SOURCE_RESOLUTION','Resolve this source candidate explicitly: represent its obligation/exception or confirm why it has no applicable planner effect. Information-only and page viewing are insufficient.',original);continue;
    }
    if(decision.decision==='REPRESENTED'){
      const ids=decision.rowIds;
      if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>{
        const target=current.get(id);return !target||!representsArea(target,area)||original.kind==='REPLACEMENT'&&target.treatment!=='REPLACEMENT'||!original.evidence.some(e=>onPage(target,e))||!validDate(target.startDate)||!validDate(target.endDate);
      }))bad('CALENDAR_RESOLUTION_LINK','Link this source candidate to reviewed, applicable planner entries of the required type on its source page. Information-only rows do not represent an obligation or substitution.',original);
      else {
        const targets=ids.map(id=>current.get(id)),effects=targets.map(target=>targetRestriction(target,area,d,o));
        if(!fitsCalendarScope(original,o))bad('CALENDAR_RESOLUTION_SCOPE','An out-of-scope source is an exclusion, not a represented obligation. Use the justified NO_APPLICABLE_EFFECT decision.',original);
        else if(effects.some(e=>!e||!datesForSource(e,original,area).length))bad('CALENDAR_RESOLUTION_EFFECT','Every represented target must produce the claimed future planner effect after the snapshot and within the teaching horizon. Reconciliation cannot rescue an ineffective target.',original);
        else if(!naturallyCorresponds(original,effects,area,o)&&!reconciled(original,targets,d,o,decision.reconciliation))bad('CALENDAR_RESOLUTION_CORRESPONDENCE','Linked effects do not cover the source dates/times or substitution pattern. Confirm a source-specific reconciliation against the original evidence, or use a justified exclusion.',original);
      }
    }else if(decision.decision==='NO_APPLICABLE_EFFECT'){
      if(!reviewed(row)||!['INFORMATION_ONLY','DOES_NOT_APPLY'].includes(row.treatment)||row.treatment==='INFORMATION_ONLY'&&row.applicability!=='APPLIES'||row.treatment==='DOES_NOT_APPLY'&&row.applicability!=='DOES_NOT_APPLY')bad('CALENDAR_EXCLUSION_DECISION','An explicit no-effect decision needs a reviewed information-only or non-applicable row and its justification.',original);
    }else bad('CALENDAR_SOURCE_RESOLUTION','The source candidate resolution is still unknown.',original);
  }
  function reconcilesEntered(source,target,area){
    const ids=target.coverageResolution?.rowIds;
    if(!Array.isArray(ids)||!ids.length||!ids.includes(target.id)||new Set(ids).size!==ids.length)return false;
    const targets=ids.map(id=>current.get(id));
    if(targets.some(r=>!r||!source.evidence.some(e=>onPage(r,e))||source.kind==='REPLACEMENT'&&r.treatment!=='REPLACEMENT'))return false;
    if(targets.some(r=>{const e=targetRestriction(r,area,d,o);return !e||!datesForSource(e,source,area).length;}))return false;
    return reconciled(source,targets,d,o,target.coverageResolution?.reconciliation);
  }
  const records=d.calendarCoverage?.pages;
  if(!Array.isArray(records)){bad('CALENDAR_MANUAL_COMPLETION','Calendar extraction produced candidates, not confirmed coverage. Manually complete every calendar page and each coverage area before saving.');return errors;}
  const fingerprint=calendarCoverageFingerprint(d,o);
  if(records.length!==pages.length||new Set(records.map(r=>`${r.sourceId}:${r.page}`)).size!==pages.length)bad('CALENDAR_COVERAGE_PAGES','Supply exactly one manual completion record for each original calendar page.');
  for(const page of pages){
    const record=records.find(r=>r.sourceId===page.sourceId&&r.page===page.page);
    if(!record){bad('CALENDAR_MANUAL_COMPLETION',`Calendar page ${page.page}: manual completion is missing.`);continue;}
    for(const [area,label] of COVERAGE_AREAS){
      const answer=record.areas?.[area],required=d.calendarEntries.filter(r=>onPage(r,page)&&representsArea(r,area)&&relevantCalendarRow(r,o,d));
      if(!answer||!nonempty(answer.note)||!['ENTERED','NONE_APPLICABLE'].includes(answer.decision)){bad('CALENDAR_MANUAL_COMPLETION',`Calendar page ${page.page}: explicitly complete “${label}” with a source-based explanation. Readable text or a viewed-page checkbox cannot supply this answer.`);continue;}
      if(answer.decision==='ENTERED'){
        if(!Array.isArray(answer.rowIds)||!answer.rowIds.length||new Set(answer.rowIds).size!==answer.rowIds.length||answer.rowIds.some(id=>!current.has(id)||!onPage(current.get(id),page)||!representsArea(current.get(id),area))||required.some(r=>!answer.rowIds.includes(r.id)))bad('CALENDAR_COVERAGE_LINK',`Calendar page ${page.page}: link all applicable entered ${label.toLowerCase()} to actual planner entries; information-only rows do not count.`);
        else for(const id of answer.rowIds){
          const target=current.get(id),effect=targetRestriction(target,area,d,o),source=originals.find(r=>r.id===id)??target;
          if(!fitsCalendarScope(source,o))bad('CALENDAR_COVERAGE_SCOPE',`Calendar page ${page.page}: this source belongs to another term/cohort; an exclusion cannot be recorded as ENTERED.`,target);
          else if(!effect||!datesForSource(effect,source,area).length)bad('CALENDAR_COVERAGE_EFFECT',`Calendar page ${page.page}: an ENTERED link has no effective future ${label.toLowerCase()} within this scope/horizon.`,target);
          else if(!naturallyCorresponds(source,[effect],area,o)&&!reconcilesEntered(source,target,area))bad('CALENDAR_COVERAGE_CORRESPONDENCE',`Calendar page ${page.page}: this ENTERED row differs from its original source dates or pattern and needs an explicit source-specific reconciliation.`,target);
        }
      }else if(required.length||answer.rowIds?.length)bad('CALENDAR_COVERAGE_CONTRADICTION',`Calendar page ${page.page}: “none applicable” conflicts with entered ${label.toLowerCase()}.`);
    }
    if(record.confirmed!==true)bad('CALENDAR_MANUAL_COMPLETION',`Calendar page ${page.page}: explicitly confirm manual completion for the current cohort and teaching horizon.`);
    else if(record.fingerprint!==fingerprint||record.answersFingerprint!==JSON.stringify(record.areas))bad('CALENDAR_COVERAGE_STALE',`Calendar page ${page.page}: rows, decisions, source, cohort or horizon changed. Recheck and confirm manual completion again.`);
  }
  return errors;
}
