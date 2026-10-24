// Draft validation and schema-1 adapter; attendance decisions remain in the public engine.
import {expandSchedule,validateModel} from '../engine/index.js';
import {validDate,issue,DAYS} from './parse.js';
const reviewed=r=>r?.review==='CONFIRMED'||r?.review==='CORRECTED';
const int=n=>Number.isSafeInteger(n)&&n>=0;
const time=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s??'');
const text=s=>typeof s==='string'&&s.trim().length>0;
export function datesBetween(a,b){const out=[];if(!validDate(a)||!validDate(b)||a>b)return out;for(let d=new Date(a+'T12:00:00Z');d.toISOString().slice(0,10)<=b;d.setUTCDate(d.getUTCDate()+1)){out.push(d.toISOString().slice(0,10));if(out.length>740)throw Error('Teaching horizon exceeds 740 days.');}return out;}
const active=r=>r.applicability==='APPLIES'&&r.review!=='EXCLUDED';
function inspectDraft(d,o){
  const issues=[],bad=(code,path,message,row)=>issues.push(issue(code,path,message,row?[row.id]:[],row?.evidence??[]));
  if(!d||!o||d.importVersion!=='0.2.0'||d.status!=='REVIEW_REQUIRED'){bad('INVALID_IMPORT','draft','A readable review draft and confirmation options are required.');return {ok:false,issues};}
  for(const k of ['sources','subjects','registers','timetableEntries','calendarEntries','pages'])if(!Array.isArray(d[k]))bad('INVALID_STRUCTURE',k,`Missing ${k}.`);
  if(issues.length)return {ok:false,issues};
  if(!d.selectedSection||!d.sectionCandidates.includes(d.selectedSection)||!d.timetableEntries.length)bad('SECTION_COVERAGE','selectedSection','Selected section must have extracted, reviewed timetable coverage.');
  if(d.sources.length!==2||!['TIMETABLE','ACADEMIC_CALENDAR'].every(role=>d.sources.some(s=>s.role===role)))bad('SOURCE_ROLES','sources','One timetable and one academic calendar are required.');
  for(const k of ['sources','subjects','registers','timetableEntries','calendarEntries']){
    const seen=new Set();for(const r of d[k]){if(!text(r?.id)||seen.has(r.id))bad('DUPLICATE_ID',k,'Rows need unique stable IDs.',r);seen.add(r?.id);}
  }
  const sourceById=new Map(d.sources.map(s=>[s.id,s]));
  for(const s of d.sources){const a=o.sourceApplicability?.[s.id];if(!a||a.institutionConfirmed!==true||a.termConfirmed!==true||a.cohortConfirmed!==true)bad('SOURCE_APPLICABILITY','sourceApplicability','Confirm each source institution, term and cohort.');
    if(!/^[a-f0-9]{64}$/.test(s.sha256)||!int(s.pageCount)||s.pageCount<1)bad('SOURCE_PROVENANCE','sources','Source SHA and page count are missing.');
    const scopeInstitution=o.academicScope?.institution??'';
    if(/BHU/i.test(s.institutionLabel??'')&&!/BHU/i.test(scopeInstitution)||/MAHARAJA AGRASEN/i.test(s.institutionLabel??'')&&!/MAIT|MAHARAJA AGRASEN/i.test(scopeInstitution))bad('WRONG_INSTITUTION','academicScope','Source institution differs from confirmed academic scope.');
    const pages=d.pages.filter(p=>p.sourceId===s.id);if(pages.length!==s.pageCount||pages.some(p=>p.reviewed!==true))bad('PAGE_COVERAGE','pages','Review every source page, including missing rows, legends and notes; add corrections before confirming coverage.');
  }
  const provenance=(r,role)=>{
    if(!r.evidence?.length||r.evidence.some(e=>!sourceById.has(e.sourceId)||sourceById.get(e.sourceId).role!==role||!int(e.page)||e.page<1||e.page>sourceById.get(e.sourceId).pageCount||!text(e.rawText)))bad('ROW_PROVENANCE','evidence','Every row needs real source text and a valid source page.',r);
  };
  const scope=o.academicScope;
  if(!scope||!text(scope.institution)||!text(scope.academicYear)||!['ODD','EVEN'].includes(scope.term)||!['UG','PG','PHD','OTHER'].includes(scope.degreeGroup)||!int(scope.semesterNumber)||scope.semesterNumber<1||!text(scope.programme))bad('ACADEMIC_SCOPE','academicScope','Confirm institution, year, term, degree group, semester and programme.');
  if(!o.context||o.context.applicabilityConfirmed!==true||o.context.section!==d.selectedSection||['college','academicYear','semester','programme','sourceLabel'].some(k=>!text(o.context[k])))bad('CONTEXT_CONFIRMATION','context','Confirm complete academic identity and selected section.');
  if(scope&&o.context&&(o.context.academicYear!==scope.academicYear||Number(o.context.semester)!==scope.semesterNumber||o.context.programme!==scope.programme||o.context.college!==scope.institution))bad('CONTEXT_SCOPE_MISMATCH','academicScope','Academic scope and planner context must describe the same institution, year, semester and programme.');
  if(!validDate(o.startDate)||!validDate(o.teachingEnd)||o.startDate>o.teachingEnd||o.horizonConfirmed!==true)bad('HORIZON_CONFIRMATION','startDate','Confirm a valid teaching start and last teaching day; exam dates are not a substitute.');
  if(validDate(o.startDate)&&validDate(o.teachingEnd)&&(+new Date(o.teachingEnd)-+new Date(o.startDate))/86400000>739)bad('HORIZON_LIMIT','teachingEnd','Maximum supported teaching horizon is 740 days.');
  const subjects=new Map(d.subjects.map(s=>[s.id,s])),registers=new Map(d.registers.map(r=>[r.id,r])),used=new Set();
  for(const r of d.timetableEntries){
    provenance(r,'TIMETABLE');
    if(!reviewed(r)&&!(r.review==='EXCLUDED'&&r.applicability==='DOES_NOT_APPLY'))bad('TIMETABLE_REVIEW','timetableEntries','Review every occupied period and explicitly exclude non-applicable rows.',r);
    if(!['APPLIES','DOES_NOT_APPLY'].includes(r.applicability))bad('GROUP_APPLICABILITY','timetableEntries','Resolve the applicable group; an unknown mapping is not a free period.',r);
    if(r.applicability==='DOES_NOT_APPLY'){if(!text(r.resolutionNote))bad('EXCLUSION_REASON','timetableEntries','Explain why this occupied period does not apply.',r);continue;}
    const sourceGroups=[...new Set((r.evidence??[]).flatMap(e=>[...e.rawText.matchAll(new RegExp(`\\b${d.selectedSection.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[- ]?(\\d+)\\b`,'ig'))].map(m=>d.selectedSection+m[1])))];
    if((r.groupOptions?.length||sourceGroups.length)&&(!(sourceGroups.length?sourceGroups:r.groupOptions).includes(r.groupChoice)||!text(r.resolutionNote)))bad('GROUP_CHOICE','timetableEntries','Confirm the exact source group label and explain its mapping to the declared subgroup. Q3 physics is unresolved until explicitly confirmed.',r);
    if(!int(r.weekday)||r.weekday<1||r.weekday>7||!time(r.start)||!time(r.end)||r.start>=r.end)bad('TIMETABLE_TIME','timetableEntries','Confirm valid weekday and time interval.',r);
    if(!['ATTENDANCE','COMPULSORY_ZERO_UNITS','OPTIONAL','BREAK'].includes(r.treatment))bad('ROW_TREATMENT','timetableEntries','Classify this occurrence, including Library/NCC/Sports.',r);
    if(['LECTURE','LAB','UNKNOWN'].includes(r.kind)&&['OPTIONAL','BREAK'].includes(r.treatment)&&!text(r.resolutionNote))bad('CLASS_EXCLUSION','timetableEntries','Explain why an extracted class is treated as optional or a break.',r);
    if(r.treatment==='ATTENDANCE'){
      if(!int(r.weight)||r.weight<1)bad('EXPLICIT_WEIGHT','timetableEntries','Enter positive integer attendance units; duration does not determine weight.',r);
      const reg=registers.get(r.registerId),sub=subjects.get(r.subjectId);
      if(!reg||!sub||reg.subjectId!==sub.id)bad('REGISTER_MAPPING','timetableEntries','Subject and independent attendance register must match.',r);
      else{used.add(reg.id);if(!reviewed(reg)||!reviewed(sub)||!text(reg.name)||!text(sub.name))bad('ROSTER_REVIEW','registers','Review subject aliases and separate register names.',r);}
    }
  }
  if(!used.size)bad('NO_REGISTERS','registers','At least one reviewed attendance register is required.');
  for(const id of used){
    const rule=o.registerRules?.[id],c=o.snapshot?.counts?.[id];
    if(!rule||!int(rule.requiredBps)||rule.requiredBps<1||rule.requiredBps>10000||rule.personalMinBps!==null&&(!int(rule.personalMinBps)||rule.personalMinBps<1||rule.personalMinBps>10000)||!int(rule.bufferBps)||Math.max(rule.requiredBps,rule.personalMinBps??rule.requiredBps)+rule.bufferBps>10000)bad('REGISTER_RULES','registerRules','Enter valid confirmed R, optional T and B for every selected register.');
    if(!c||!int(c.attended)||!int(c.held)||c.attended>c.held)bad('ACTUAL_COUNTS','snapshot.counts','Explicit complete actual counts are required for every selected register.');
  }
  if(!o.snapshot||o.snapshot.confirmed!==true||typeof o.snapshot.completeToday!=='boolean'||!validDate(o.snapshot.date))bad('SNAPSHOT_CONFIRMATION','snapshot','Confirm complete counts through one completed day.');
  if(Object.keys(o.snapshot?.counts??{}).some(id=>!used.has(id)))bad('EXTRA_COUNTS','snapshot.counts','Remove unused candidate registers from counts mapping.');
  for(const id of o.protectedSubjectIds??[])if(!subjects.has(id)||![...used].some(r=>registers.get(r)?.subjectId===id))bad('PROTECTION_REFERENCE','protectedSubjectIds','Choose a subject with an active attendance register; removed or optional subjects cannot carry unenforced protection.');
  for(const r of d.calendarEntries){
    provenance(r,'ACADEMIC_CALENDAR');
    const inHorizon=!r.startDate||!r.endDate||(r.endDate>=(o.snapshot?.date??o.startDate)&&r.startDate<=o.teachingEnd);
    if(!reviewed(r)){if(inHorizon)bad('CALENDAR_REVIEW','calendarEntries','Review relevant dates, unknown windows, cohorts and obligations.',r);else issues.push(issue('REFERENCE_UNREVIEWED','calendarEntries','Out-of-horizon reference remains unreviewed.',[r.id],r.evidence,'WARNING'));continue;}
    if(!['APPLIES','DOES_NOT_APPLY'].includes(r.applicability))bad('CALENDAR_APPLICABILITY','calendarEntries','Confirm calendar row applicability.',r);
    if(r.applicability==='DOES_NOT_APPLY'||r.treatment==='DOES_NOT_APPLY'){if(!text(r.resolutionNote))bad('EXCLUSION_REASON','calendarEntries','Explain non-applicability (term/cohort/institution).',r);continue;}
    if(r.term!=='UNSPECIFIED'&&r.term!=='BOTH'&&r.term!==scope?.term)bad('WRONG_TERM','calendarEntries','Row term differs from selected term; explicitly exclude it.',r);
    if(r.treatment==='UNRESOLVED'||!['HOLIDAY','NON_TEACHING','REPLACEMENT','TEACHING_BOUNDARY','COMPULSORY','INFORMATION_ONLY'].includes(r.treatment))bad('CALENDAR_TREATMENT','calendarEntries','Resolve calendar treatment; exams do not automatically cancel teaching.',r);
    const audience=r.audienceText??'';
    if(/except\s+(?:first|1st)\s+sem/i.test(audience)&&scope?.semesterNumber===1||/\bPG[- ]I\b/.test(audience)&&!/\bUG\b/.test(audience)&&scope?.degreeGroup==='UG'||/first\s+(?:year|semester)/i.test(audience)&&!/except/i.test(audience)&&scope?.semesterNumber>2)bad('WRONG_COHORT','calendarEntries','Source cohort differs from the confirmed student. Exclude this alternative explicitly.',r);
    if(/except\s+TAs?\b/i.test(audience)&&scope?.isTeachingAssistant!==false)bad('TA_APPLICABILITY','academicScope','Confirm the teaching-assistant exception before applying this recess.',r);
    if(r.kind==='EXAM_WINDOW'&&['HOLIDAY','NON_TEACHING'].includes(r.treatment)&&!text(r.resolutionNote))bad('EXAM_CANCELLATION_CONFIRMATION','calendarEntries','Exams do not cancel classes automatically. Explain the explicitly confirmed teaching suspension.',r);
    if(r.treatment==='INFORMATION_ONLY'){
      if(inHorizon&&['EXAM_WINDOW','WORKING_DAY_NOTICE','UNKNOWN','ACADEMIC_ACTIVITY'].includes(r.kind)&&!text(r.resolutionNote))bad('WINDOW_RESOLUTION','calendarEntries','Explain why this relevant obligation/window needs no planner restriction or specify actual occurrences.',r);
    }else{
      if(!validDate(r.startDate)||!validDate(r.endDate)||r.startDate>r.endDate)bad('CALENDAR_DATES','calendarEntries','Correct missing, invalid or reversed Gregorian dates.',r);
      if(r.printedCalendarWeekday&&r.kind!=='REPLACEMENT'&&validDate(r.startDate)&&((new Date(r.startDate+'T12:00:00Z').getUTCDay()||7)!==r.printedCalendarWeekday)&&!(r.review==='CORRECTED'&&text(r.resolutionNote)))bad('SOURCE_WEEKDAY_CONFLICT','calendarEntries','Source weekday and date conflict. Inspect preview and record a correction or explicit source-conflict resolution.',r);
      const source=sourceById.get(r.evidence?.[0]?.sourceId),y=Number(r.startDate?.slice(0,4));
      if(source?.academicYear&&Math.abs(y-source.academicYear)>1&&!(r.review==='CORRECTED'&&text(r.resolutionNote)))bad('SOURCE_YEAR_CONFLICT','calendarEntries','Date year differs from academic calendar. Inspect source and record correction.',r);
      if(r.treatment==='REPLACEMENT'&&(!int(r.replacementWeekday)||r.replacementWeekday<1||r.replacementWeekday>7||r.startDate!==r.endDate))bad('REPLACEMENT_PATTERN','calendarEntries','A replacement needs one date and an explicit ISO weekday pattern.',r);
      if(r.treatment==='COMPULSORY'&&r.allDay!==true&&(!time(r.startTime)||!time(r.endTime)||r.startTime>=r.endTime))bad('EVENT_TIMES','calendarEntries','Supply actual event times or explicitly select whole-window all-day protection.',r);
      if(r.certainty!=='AS_LISTED'&&!text(r.resolutionNote))bad('TENTATIVE_RESOLUTION','calendarEntries','Resolve tentative/unspecified windows explicitly; preserve source wording.',r);
    }
  }
  return {ok:!issues.some(i=>i.severity==='ERROR'),issues};
}
export function validateImportDraft(d,o){try{return inspectDraft(d,o);}catch(e){return {ok:false,issues:[issue('INVALID_IMPORT_STRUCTURE','draft',`Malformed review draft: ${e.message}`)]};}}
export function compileConfirmedImport(d,o){
  const check=validateImportDraft(d,o);if(!check.ok)return {...check,model:null};
  try{
    const entries=d.timetableEntries.filter(active),used=new Set(entries.filter(r=>r.treatment==='ATTENDANCE').map(r=>r.registerId));
    const registers=d.registers.filter(r=>used.has(r.id)).map(r=>({id:r.id,courseId:r.subjectId,name:r.name,...o.registerRules[r.id]}));
    const subjectIds=new Set(registers.map(r=>r.courseId));
    const courses=d.subjects.filter(s=>subjectIds.has(s.id)).map(s=>({id:s.id,name:s.name,mustAttend:o.protectedSubjectIds.includes(s.id)}));
    const schedule={startDate:o.startDate,teachingEnd:o.teachingEnd,confirmed:true,initialized:false,weeklyTemplates:entries.filter(r=>r.treatment==='ATTENDANCE').map(r=>({id:r.id,registerId:r.registerId,weekday:r.weekday,start:r.start,end:r.end,weight:r.weight,protected:false})),holidays:[],replacements:[...o.replacements],holidayTeachingDates:[...o.holidayTeachingDates]};
    const labels=new Map(),events=[];
    for(const r of d.calendarEntries.filter(r=>active(r)&&reviewed(r))){
      if(['INFORMATION_ONLY','TEACHING_BOUNDARY'].includes(r.treatment))continue;
      for(const date of datesBetween(r.startDate,r.endDate).filter(date=>date>=o.startDate&&date<=o.teachingEnd)){
        if(['HOLIDAY','NON_TEACHING'].includes(r.treatment))labels.set(date,[...(labels.get(date)??[]),r.title]);
        if(r.treatment==='REPLACEMENT')schedule.replacements.push({date,weekday:r.replacementWeekday,confirmed:true});
        if(r.treatment==='COMPULSORY')events.push({id:`${r.id}:${date}`,title:r.title,cancelled:false,sessionId:null,date,start:r.allDay?'00:00':r.startTime,end:r.allDay?'23:59':r.endTime});
      }
    }
    schedule.holidays=[...labels].map(([date,titles])=>({date,label:titles.join('; ')}));
    // Independent zero-unit obligations follow the same confirmed effective weekday rules.
    for(const date of datesBetween(o.startDate,o.teachingEnd)){
      if(labels.has(date)&&!schedule.holidayTeachingDates.includes(date))continue;
      const weekday=schedule.replacements.find(r=>r.date===date)?.weekday??(new Date(date+'T12:00:00Z').getUTCDay()||7);
      for(const r of entries.filter(r=>r.treatment==='COMPULSORY_ZERO_UNITS'&&r.weekday===weekday))events.push({id:`${r.id}:${date}`,title:d.subjects.find(s=>s.id===r.subjectId)?.name??'Reviewed obligation',cancelled:false,sessionId:null,date,start:r.start,end:r.end});
    }
    const model={schemaVersion:1,revision:0,id:o.modelId,timeZone:'Asia/Kolkata',context:structuredClone(o.context),schedule,courses,registers,sessions:[],events,snapshots:[{id:`${d.id}-snapshot`,date:o.snapshot.date,counts:structuredClone(o.snapshot.counts),confirmed:true,completeToday:o.snapshot.completeToday,confirmedAt:structuredClone(o.clockPlaceholder),sequence:1}],commitments:[],attendanceConfirmation:{throughDate:o.snapshot.date,noUnlistedClasses:true},preferences:structuredClone(o.preferences)};
    const expanded=expandSchedule({schedule,courses,registers,extraSessions:[],overrides:[]});
    if(!expanded.ok)return {ok:false,model:null,issues:expanded.issues.map(i=>({...i,severity:'ERROR',rowIds:[],evidence:[]}))};
    const valid=validateModel({...model,schedule:{...schedule,initialized:true},sessions:expanded.sessions},o.clockPlaceholder);
    if(!valid.ok)return {ok:false,model:null,issues:valid.issues.map(i=>({...i,severity:'ERROR',rowIds:[],evidence:[]}))};
    return {ok:true,model,issues:check.issues};
  }catch(e){return {ok:false,model:null,issues:[issue('COMPILE_INPUT','options',e.message)]};}
}
