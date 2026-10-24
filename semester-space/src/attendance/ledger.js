// RC-001 / B-owned: deterministic, no-I/O attendance journal primitives.
// The controller alone captures clocks, increments durable revisions and writes storage.
import {dateAdd,validDate,validClock,clockStamp,nonnegative,safeInt,isObject,copy} from '../engine/common.js';
import {validateModel} from '../engine/validation.js';

const DISPOSITIONS = new Set(['ATTENDED','MISSED','NOT_HELD']);
const REQUEST_FIELDS = new Set(['expectedModelRevision','date','marks','confirmCompleteDay','confirmNoUnlistedMeetings','dayKey','correctionOfDayKey']);
const MARK_FIELDS = new Set(['occurrenceId','registerId','disposition','note']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const err = (code,message,occurrenceId) => occurrenceId ? {code,message,occurrenceId} : {code,message};
const rejected = (code,issues) => ({ok:false,code,issues,proposedJournal:null,proposedModel:null,registerTotals:null,snapshotId:null,idempotent:false});
const ids = rows => new Set(rows.map(r=>r.id));
const isCount = c => isObject(c)&&nonnegative(c.attended)&&nonnegative(c.held)&&c.attended<=c.held;
const activeDay = (model,date) => model.sessions.filter(s=>!s.cancelled&&s.date===date&&date>=model.schedule.startDate&&date<=model.schedule.teachingEnd).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
const activeCloses = journal => {
  const replaced = new Set(journal.closedDays.map(d=>d.supersedesDayKey).filter(x=>x!==null));
  return new Map(journal.closedDays.filter(d=>!replaced.has(d.dayKey)).map(d=>[d.date,d]));
};
const recordMap = journal => new Map(journal.records.map(r=>[r.recordId,r]));
const canonical = marks => marks.map(m=>({occurrenceId:m.occurrenceId,registerId:m.registerId,disposition:m.disposition,note:m.note})).sort((a,b)=>a.occurrenceId.localeCompare(b.occurrenceId));
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const safeAdd = (a,b) => {
  const n=a+b;
  return Number.isSafeInteger(n)?n:null;
};
const sessionKey = s => `${s.id.length}:${s.id}:${s.registerId.length}:${s.registerId}`;

/** A calls this during legacy migration or initial setup; no invented attendance records. */
export function createAttendanceJournal(model) {
  return {version:1,records:[],closedDays:[],officialSnapshotIds:model.snapshots.map(s=>s.id),reconciliationIssues:[]};
}

/** Refuse malformed history rather than trusting it in a new acceptance. A must also validate on load. */
export function validateAttendanceJournal(model,journal) {
  const issues=[];const bad=(code,message,id)=>issues.push(err(code,message,id));
  if(!isObject(journal)||journal.version!==1||!Array.isArray(journal.records)||!Array.isArray(journal.closedDays)||!Array.isArray(journal.officialSnapshotIds)||!Array.isArray(journal.reconciliationIssues)) {
    return {ok:false,issues:[err('INVALID_JOURNAL','AttendanceJournal v1 with four arrays is required.')]};
  }
  const shots=new Set(model.snapshots.map(s=>s.id));
  const official=new Set();
  for(const id of journal.officialSnapshotIds){
    if(!nonempty(id)||!shots.has(id)||official.has(id))bad('INVALID_OFFICIAL_SNAPSHOT','Official snapshot IDs must be unique and already exist in model.');
    official.add(id);
  }
  if(!official.size)bad('MISSING_OFFICIAL_BASELINE','A must register an official/legacy snapshot before deriving daily totals.');
  if(journal.reconciliationIssues.some(s=>typeof s!=='string'))bad('INVALID_RECONCILIATION_ISSUES','Reconciliation issues must be strings.');
  const dayByKey=new Map(),recById=new Map(),byDay=new Map(),byOccurrence=new Map();
  const scheduled=new Map(model.sessions.map(s=>[s.id,s]));
  let previousInitialDate='';
  for(const day of journal.closedDays){
    if(!isObject(day)||!nonempty(day.dayKey)||!validDate(day.date)||!Array.isArray(day.recordIds)||!validClock(day.confirmedAt)||day.confirmedAt.date<day.date||!nonnegative(day.sourceModelRevision)||day.sourceModelRevision>model.revision||day.noUnlistedMeetings!==true||!(day.supersedesDayKey===null||nonempty(day.supersedesDayKey))){bad('INVALID_DAY_CLOSE','Malformed confirmed day-close row.');continue;}
    if(dayByKey.has(day.dayKey))bad('DUPLICATE_DAY_KEY','Repeated day key.');
    dayByKey.set(day.dayKey,day);
    if(day.supersedesDayKey===null){
      if(day.date<=previousInitialDate)bad('INVALID_DAY_ORDER','New day closes must be appended in chronological order.');
      previousInitialDate=day.date;
    }
    const latestEnd=activeDay(model,day.date).reduce((t,s)=>s.end>t?s.end:t,'00:00');
    if(day.confirmedAt.date===day.date&&day.confirmedAt.time<latestEnd)bad('PREMATURE_DAY_CLOSE','A same-day close cannot precede the last active meeting end.');
    if(day.recordIds.some(id=>!nonempty(id))||new Set(day.recordIds).size!==day.recordIds.length)bad('INVALID_DAY_RECORD_IDS','A close must link unique nonempty record IDs.');
  }
  for(const r of journal.records){
    if(!isObject(r)||!nonempty(r.recordId)||!nonempty(r.dayKey)||!nonempty(r.occurrenceId)||!nonempty(r.registerId)||!validDate(r.date)||!safeInt(r.weight)||r.weight<1||!DISPOSITIONS.has(r.disposition)||!validClock(r.confirmedAt)||r.confirmedAt.date<r.date||!safeInt(r.recordRevision)||r.recordRevision<1||!(r.supersedesRecordId===null||nonempty(r.supersedesRecordId))||!nonnegative(r.sourceModelRevision)||r.sourceModelRevision>model.revision||typeof r.note!=='string'){bad('INVALID_DAILY_RECORD','Malformed confirmed daily record.');continue;}
    const scheduledRow=scheduled.get(r.occurrenceId);
    if(!scheduledRow||scheduledRow.cancelled||scheduledRow.date!==r.date||scheduledRow.registerId!==r.registerId||scheduledRow.weight!==r.weight)bad('HISTORICAL_OCCURRENCE_CONFLICT','Recorded occurrence changed date, register, weight or cancellation state; requires review.',r.occurrenceId);
    if(recById.has(r.recordId))bad('DUPLICATE_RECORD_ID','Repeated record ID.',r.occurrenceId);
    recById.set(r.recordId,r);
    if(!dayByKey.has(r.dayKey))bad('ORPHAN_RECORD','Record has no day-close.',r.occurrenceId);
    const group=byDay.get(r.dayKey)??[];group.push(r);byDay.set(r.dayKey,group);
    const earlier=byOccurrence.get(r.occurrenceId)??[];earlier.push(r);byOccurrence.set(r.occurrenceId,earlier);
  }
  const referenced=new Set();
  for(const day of journal.closedDays){
    if(!isObject(day)||!Array.isArray(day.recordIds)||!nonempty(day.dayKey))continue;
    const inDay=byDay.get(day.dayKey)??[];
    if(inDay.length!==day.recordIds.length)bad('INCOMPLETE_DAY_LINKS','Day close must link all its records exactly once.');
    const marked=new Set();
    for(const id of day.recordIds){
      const r=recById.get(id);
      if(!r||r.dayKey!==day.dayKey||r.date!==day.date||r.sourceModelRevision!==day.sourceModelRevision||!same(r.confirmedAt,day.confirmedAt))bad('BAD_RECORD_LINK','Record linkage, revision, date or authoritative clock differs.');
      if(referenced.has(id))bad('REUSED_RECORD_LINK','One record belongs to only one close.');
      referenced.add(id);
      if(r){if(marked.has(sessionKey({id:r.occurrenceId,registerId:r.registerId})))bad('DUPLICATE_DAY_OCCURRENCE','A day repeats an occurrence.',r.occurrenceId);marked.add(sessionKey({id:r.occurrenceId,registerId:r.registerId}));}
    }
    const expectedActive=new Set(activeDay(model,day.date).map(s=>s.id));
    const actualActive=new Set(inDay.map(r=>r.occurrenceId));
    if(expectedActive.size!==actualActive.size||[...expectedActive].some(id=>!actualActive.has(id)))bad('INCOMPLETE_CONFIRMED_DAY','A closed day must cover exactly all active scheduled occurrences.');
    if(day.supersedesDayKey!==null){
      const previous=dayByKey.get(day.supersedesDayKey);
      if(!previous||previous===day||previous.date!==day.date||journal.closedDays.indexOf(previous)>=journal.closedDays.indexOf(day))bad('INVALID_DAY_CORRECTION_CHAIN','A correction must supersede an earlier close of the same day.');
    }
  }
  const children=new Map();
  for(const d of journal.closedDays)if(d?.supersedesDayKey!==null&&d?.supersedesDayKey!==undefined){
    children.set(d.supersedesDayKey,(children.get(d.supersedesDayKey)??0)+1);
  }
  if([...children.values()].some(n=>n!==1))bad('FORKED_DAY_CORRECTION','Day corrections must form one linear chain.');
  const tips=activeCloses(journal);
  if(tips.size!==journal.closedDays.filter(d=>!children.has(d.dayKey)).length)bad('DUPLICATE_ACTIVE_CLOSE','A date has multiple active closes.');
  for(const [occ,rows] of byOccurrence){
    const canonicalRow=rows[0];
    const distinctDays=new Set(rows.map(r=>r.date));
    if(distinctDays.size>1||rows.some(r=>r.registerId!==canonicalRow.registerId||r.weight!==canonicalRow.weight))bad('HISTORICAL_OCCURRENCE_CONFLICT','Occurrence identity/register/weight changed across records.',occ);
    for(let i=0;i<rows.length;i++){
      const r=rows[i],prev=i?rows[i-1]:null;
      if(r.supersedesRecordId!==(prev?.recordId??null)||r.recordRevision!==(prev?prev.recordRevision+1:1))bad('INVALID_RECORD_REVISION','Record corrections must follow an unbroken occurrence chain.',occ);
    }
  }
  return {ok:issues.length===0,issues};
}

function officialBaseline(model,journal) {
  const marked=new Set(journal.officialSnapshotIds);
  return model.snapshots.filter(s=>marked.has(s.id)).at(-1)??null;
}

/** Compute exact all-register totals from one official baseline and active day closes. */
export function deriveAttendanceTotals({model,journal,throughDate}) {
  const valid=validateAttendanceJournal(model,journal);
  if(!valid.ok)return {ok:false,issues:valid.issues,registerTotals:null,baseline:null};
  const baseline=officialBaseline(model,journal);
  if(!validDate(throughDate)||throughDate<baseline.date)return {ok:false,issues:[err('INVALID_THROUGH_DATE','Derived throughDate must be on/after the official baseline.')],registerTotals:null,baseline};
  const totals=copy(baseline.counts),closes=activeCloses(journal),records=recordMap(journal);
  const sessionById=new Map(model.sessions.map(s=>[s.id,s]));
  let date=baseline.date;
  for(const d of [...closes.keys()].filter(d=>d>baseline.date&&d<=throughDate).sort()){
    const expected=dateAdd(date,1);
    if(d!==expected)return {ok:false,issues:[err('UNRESOLVED_PAST_DAY',`Day ${expected} has no confirmed complete close.`)],registerTotals:null,baseline};
    const close=closes.get(d);
    const active=activeDay(model,d),activeIds=new Set(active.map(s=>s.id));
    const seen=new Set();
    for(const id of close.recordIds){
      const r=records.get(id),s=sessionById.get(r?.occurrenceId);
      if(!r||!s||s.cancelled||s.date!==r.date||s.registerId!==r.registerId||s.weight!==r.weight||!activeIds.has(r.occurrenceId))return {ok:false,issues:[err('HISTORICAL_OCCURRENCE_CONFLICT','A confirmed occurrence was moved, cancelled or changed; manual reconciliation is required.',r?.occurrenceId)],registerTotals:null,baseline};
      if(seen.has(r.occurrenceId))return {ok:false,issues:[err('DUPLICATE_OCCURRENCE','One occurrence cannot be counted twice.',r.occurrenceId)],registerTotals:null,baseline};
      seen.add(r.occurrenceId);
      const c=totals[r.registerId];
      if(!isCount(c))return {ok:false,issues:[err('MISSING_REGISTER_COUNTS','The official baseline has invalid or missing register totals.')],registerTotals:null,baseline};
      const attended=safeAdd(c.attended,r.disposition==='ATTENDED'?r.weight:0);
      const held=safeAdd(c.held,r.disposition==='NOT_HELD'?0:r.weight);
      if(attended===null||held===null)return {ok:false,issues:[err('COUNT_OVERFLOW','Attendance totals exceed safe integers.')],registerTotals:null,baseline};
      totals[r.registerId]={attended,held};
    }
    if(active.length!==seen.size)return {ok:false,issues:[err('INCOMPLETE_CONFIRMED_DAY',`Day ${d} does not resolve every active session.`)],registerTotals:null,baseline};
    date=d;
  }
  if(date!==throughDate)return {ok:false,issues:[err('UNRESOLVED_PAST_DAY',`Day ${dateAdd(date,1)} has no confirmed complete close.`)],registerTotals:null,baseline};
  return {ok:true,issues:[],registerTotals:totals,baseline};
}

function replayMatch(journal,close,request){
  if(close.date!==request.date||close.supersedesDayKey!==(request.correctionOfDayKey??null)||request.confirmCompleteDay!==true||request.confirmNoUnlistedMeetings!==true)return false;
  const rm=recordMap(journal);
  return same(canonical(close.recordIds.map(id=>{const r=rm.get(id);return {occurrenceId:r.occurrenceId,registerId:r.registerId,disposition:r.disposition,note:r.note};})),canonical(request.marks));
}

/** B's RC-001 exact pure no-write interface. A validates + persists returned pair atomically. */
export function evaluateDayClose({model,journal,request,clock}) {
  if(!isObject(model)||!validClock(clock))return rejected('INVALID_INPUT',[err('INVALID_INPUT','A valid model and authoritative Asia/Kolkata clock are required.')]);
  const mv=validateModel(model,clock);
  if(!mv.ok)return rejected('INVALID_MODEL',mv.issues.map(i=>err(i.code,i.message)));
  const jv=validateAttendanceJournal(model,journal);
  if(!jv.ok)return rejected('INVALID_JOURNAL',jv.issues);
  if(journal.closedDays.some(d=>clockStamp(d.confirmedAt)>clockStamp(clock)))return rejected('FUTURE_JOURNAL_CLOCK',[err('FUTURE_JOURNAL_CLOCK','Existing attendance records cannot have been confirmed after the captured transaction clock.')]);
  if(!isObject(request)||!Object.keys(request).every(k=>REQUEST_FIELDS.has(k))||!validDate(request.date)||!nonempty(request.dayKey)||!Array.isArray(request.marks)||request.confirmCompleteDay!==true||request.confirmNoUnlistedMeetings!==true||!(request.correctionOfDayKey===undefined||nonempty(request.correctionOfDayKey)))return rejected('INVALID_REQUEST',[err('INVALID_REQUEST','Only RC-001 request fields are allowed; date, key and explicit complete-day/no-unlisted confirmations are required.')]);
  if(!request.marks.every(m=>isObject(m)&&Object.keys(m).length===MARK_FIELDS.size&&Object.keys(m).every(k=>MARK_FIELDS.has(k))&&nonempty(m.occurrenceId)&&nonempty(m.registerId)&&typeof m.note==='string'&&(['UNKNOWN',...DISPOSITIONS].includes(m.disposition))))return rejected('INVALID_MARK',[err('INVALID_MARK','A mark has only occurrenceId, registerId, disposition and note; weight and clock cannot be supplied by attendance.')]);
  if(!nonnegative(request.expectedModelRevision))return rejected('INVALID_REVISION',[err('INVALID_REVISION','Expected model revision must be a safe integer.')]);
  const priorByKey=journal.closedDays.find(d=>d.dayKey===request.dayKey);
  if(priorByKey){
    if(replayMatch(journal,priorByKey,request))return {ok:true,code:'DAY_ALREADY_CONFIRMED',issues:[],proposedJournal:journal,proposedModel:model,registerTotals:copy(model.snapshots.at(-1).counts),snapshotId:model.snapshots.at(-1).id,idempotent:true};
    return rejected('IDEMPOTENCY_CONFLICT',[err('IDEMPOTENCY_CONFLICT','This dayKey is already bound to different attendance evidence.')]);
  }
  if(request.expectedModelRevision!==model.revision)return rejected('STALE_REVISION',[err('STALE_REVISION','Reload and re-evaluate against the latest model revision.')]);
  if(request.date<model.schedule.startDate||request.date>model.schedule.teachingEnd)return rejected('OUTSIDE_TEACHING_HORIZON',[err('OUTSIDE_TEACHING_HORIZON','Day is outside the confirmed teaching horizon.')]);
  if(request.date>clock.date)return rejected('FUTURE_DAY',[err('FUTURE_DAY','Future attendance cannot be confirmed.')]);
  const baseline=officialBaseline(model,journal),tips=activeCloses(journal),existing=tips.get(request.date);
  const isCorrection=request.correctionOfDayKey!==undefined;
  if(request.date<=baseline.date)return rejected('REQUIRES_OFFICIAL_RECONCILIATION',[err('REQUIRES_OFFICIAL_RECONCILIATION','A day on or before the latest official baseline cannot adjust its counts.')]);
  const sessions=activeDay(model,request.date);
  if(request.date===clock.date&&sessions.some(s=>s.end>clock.time))return rejected('SESSION_NOT_FINISHED',[err('SESSION_NOT_FINISHED','All scheduled sessions must have finished before day closure.')]);
  const duplicated=new Set(),seen=new Set(),problems=[];
  const bySession=new Map(sessions.map(s=>[s.id,s]));
  for(const mark of request.marks){
    if(seen.has(mark.occurrenceId)){duplicated.add(mark.occurrenceId);continue;}
    seen.add(mark.occurrenceId);
    const s=bySession.get(mark.occurrenceId);
    if(!s)problems.push(err('UNSCHEDULED_MARK','Only active scheduled occurrences on this date may be closed.',mark.occurrenceId));
    else if(mark.registerId!==s.registerId)problems.push(err('REGISTER_MISMATCH','The mark must match the scheduled register.',mark.occurrenceId));
    if(mark.disposition==='UNKNOWN')problems.push(err('UNKNOWN_MARK','Unresolved occurrences cannot be confirmed.',mark.occurrenceId));
  }
  for(const id of duplicated)problems.push(err('DUPLICATE_MARK','An occurrence is marked more than once.',id));
  for(const s of sessions)if(!seen.has(s.id))problems.push(err('MISSING_MARK','Every active scheduled occurrence needs an explicit mark.',s.id));
  if(problems.length)return rejected('UNRESOLVED_OCCURRENCES',problems);
  if(isCorrection){
    if(!existing||existing.dayKey!==request.correctionOfDayKey)return rejected('INVALID_CORRECTION_TARGET',[err('INVALID_CORRECTION_TARGET','Corrections must name the latest close for exactly this day.')]);
  }else{
    if(existing)return rejected('DAY_ALREADY_CLOSED',[err('DAY_ALREADY_CLOSED','Supply correctionOfDayKey and a fresh dayKey for an already confirmed date.')]);
    // Closing a missing calendar day (including a day without meetings) is mandatory.
    const latest=[baseline.date,...tips.keys()].filter(d=>d>=baseline.date).sort().at(-1);
    if(request.date!==dateAdd(latest,1))return rejected('UNRESOLVED_PAST_DAY',[err('UNRESOLVED_PAST_DAY',`Close ${dateAdd(latest,1)} before confirming a later day.`)]);
  }
  const historicalById=new Map();
  for(const r of journal.records)historicalById.set(r.occurrenceId,r);
  for(const s of sessions){
    const prior=historicalById.get(s.id);
    if(prior&&(prior.date!==s.date||prior.registerId!==s.registerId||prior.weight!==s.weight||(!isCorrection)))return rejected('HISTORICAL_OCCURRENCE_CONFLICT',[err('HISTORICAL_OCCURRENCE_CONFLICT','Occurrence already has attendance on another day or no authorized correction chain.',s.id)]);
  }
  const proposedJournal=copy(journal),dayRecordIds=[];
  for(const mark of canonical(request.marks)){
    const s=bySession.get(mark.occurrenceId),prior=historicalById.get(s.id);
    const recordId=`attendance:${request.dayKey.length}:${request.dayKey}:${s.id.length}:${s.id}`;
    if(proposedJournal.records.some(r=>r.recordId===recordId))return rejected('RECORD_ID_CONFLICT',[err('RECORD_ID_CONFLICT','Generated record ID is already used.')]);
    proposedJournal.records.push({recordId,dayKey:request.dayKey,occurrenceId:s.id,registerId:s.registerId,date:s.date,weight:s.weight,disposition:mark.disposition,confirmedAt:copy(clock),recordRevision:(prior?.recordRevision??0)+1,supersedesRecordId:prior?.recordId??null,sourceModelRevision:model.revision,note:mark.note});
    dayRecordIds.push(recordId);
  }
  proposedJournal.closedDays.push({dayKey:request.dayKey,date:request.date,recordIds:dayRecordIds,confirmedAt:copy(clock),sourceModelRevision:model.revision,noUnlistedMeetings:true,supersedesDayKey:isCorrection?request.correctionOfDayKey:null});
  const lastClosed=[...activeCloses(proposedJournal).keys()].filter(d=>d>baseline.date).sort().at(-1)??baseline.date;
  const calc=deriveAttendanceTotals({model,journal:proposedJournal,throughDate:lastClosed});
  if(!calc.ok)return rejected(calc.issues[0].code,calc.issues);
  const last=model.snapshots.at(-1);
  if(lastClosed<last.date)return rejected('SNAPSHOT_DATE_REGRESSION',[err('SNAPSHOT_DATE_REGRESSION','The current projection ends before the latest model snapshot; A must reconcile the timeline.')]);
  if(model.revision===Number.MAX_SAFE_INTEGER||last.sequence===Number.MAX_SAFE_INTEGER)return rejected('REVISION_OVERFLOW',[err('REVISION_OVERFLOW','Version counter exhausted.')]);
  const sequence=last.sequence+1,snapshotId=`${model.id}:snapshot:${sequence}`;
  if(ids(model.snapshots).has(snapshotId))return rejected('SNAPSHOT_ID_CONFLICT',[err('SNAPSHOT_ID_CONFLICT','Generated snapshot ID collides with an existing snapshot.')]);
  const proposedModel=copy(model);
  proposedModel.revision++;
  proposedModel.snapshots.push({id:snapshotId,date:lastClosed,counts:copy(calc.registerTotals),confirmed:true,completeToday:lastClosed===clock.date,confirmedAt:copy(clock),sequence});
  proposedModel.attendanceConfirmation={throughDate:lastClosed,noUnlistedClasses:true};
  const check=validateModel(proposedModel,clock);
  if(!check.ok)return rejected('INVALID_DERIVED_MODEL',check.issues.map(i=>err(i.code,i.message)));
  return {ok:true,code:isCorrection?'DAY_CORRECTED':'DAY_CONFIRMED',issues:[],proposedJournal,proposedModel,registerTotals:copy(calc.registerTotals),snapshotId,idempotent:false};
}

/** Pure official-cutover helper. A stamps and appends officialSnapshot before calling this. */
export function reconcileOfficialSnapshot({previousModel,journal,officialSnapshot,clock}) {
  if(!validClock(clock)||!isObject(officialSnapshot)||!nonempty(officialSnapshot.id)||!validDate(officialSnapshot.date)||!isObject(officialSnapshot.counts)||!Array.isArray(previousModel?.snapshots))return rejected('INVALID_OFFICIAL_SNAPSHOT',[err('INVALID_OFFICIAL_SNAPSHOT','A controller-stamped complete official snapshot is required.')]);
  const mv=validateModel(previousModel,clock),jv=validateAttendanceJournal(previousModel,journal);
  if(!mv.ok||!jv.ok)return rejected('INVALID_BASELINE', [...mv.issues.map(i=>err(i.code,i.message)),...jv.issues]);
  if(journal.closedDays.some(d=>clockStamp(d.confirmedAt)>clockStamp(clock)))return rejected('FUTURE_JOURNAL_CLOCK',[err('FUTURE_JOURNAL_CLOCK','Journal includes a confirmation after this transaction clock.')]);
  const last=previousModel.snapshots.at(-1);
  if(officialSnapshot.date<last.date||officialSnapshot.sequence!==last.sequence+1||!validClock(officialSnapshot.confirmedAt)||!same(officialSnapshot.confirmedAt,clock)||officialSnapshot.confirmed!==true||typeof officialSnapshot.completeToday!=='boolean'||ids(previousModel.snapshots).has(officialSnapshot.id))return rejected('INVALID_OFFICIAL_SNAPSHOT',[err('INVALID_OFFICIAL_SNAPSHOT','Official snapshot must be fresh, chronological and controller-stamped.')]);
  if(officialSnapshot.date===clock.date&&officialSnapshot.completeToday!==true)return rejected('INVALID_OFFICIAL_SNAPSHOT',[err('INVALID_OFFICIAL_SNAPSHOT','Same-day official snapshot must confirm completeToday.')]);
  for(const r of previousModel.registers)if(!isCount(officialSnapshot.counts[r.id]))return rejected('INVALID_OFFICIAL_COUNTS',[err('INVALID_OFFICIAL_COUNTS','Official snapshot must contain valid complete register counts.')]);
  if(Object.keys(officialSnapshot.counts).length!==previousModel.registers.length)return rejected('INVALID_OFFICIAL_COUNTS',[err('INVALID_OFFICIAL_COUNTS','Official snapshot has extra or missing register counts.')]);
  const expected=deriveAttendanceTotals({model:previousModel,journal,throughDate:officialSnapshot.date});
  const proposedModel=copy(previousModel); proposedModel.revision++;
  proposedModel.snapshots.push(copy(officialSnapshot));
  proposedModel.attendanceConfirmation={throughDate:officialSnapshot.date,noUnlistedClasses:true};
  const valid=validateModel(proposedModel,clock);
  if(!valid.ok)return rejected('INVALID_OFFICIAL_SNAPSHOT',valid.issues.map(i=>err(i.code,i.message)));
  const proposedJournal=copy(journal);
  proposedJournal.officialSnapshotIds.push(officialSnapshot.id);
  if(expected.ok){
    for(const reg of previousModel.registers){
      const x=expected.registerTotals[reg.id],y=officialSnapshot.counts[reg.id];
      if(x.attended!==y.attended||x.held!==y.held)proposedJournal.reconciliationIssues.push(`OFFICIAL_COUNT_DISCREPANCY:${officialSnapshot.id}:${reg.id}:derived=${x.attended}/${x.held}:official=${y.attended}/${y.held}`);
    }
  }else{
    proposedJournal.reconciliationIssues.push(`OFFICIAL_RECONCILIATION_INCOMPLETE:${officialSnapshot.id}:${expected.issues[0].code}`);
  }
  return {ok:true,code:'OFFICIAL_BASELINE_RECORDED',issues:[],proposedJournal,proposedModel,registerTotals:copy(officialSnapshot.counts),snapshotId:officialSnapshot.id,idempotent:false};
}

/** Draft projection only; UNKNOWN is never persisted as DailyRecord. */
export function viewAttendanceDay({model,journal,date}) {
  if(!validDate(date))return {ok:false,issues:[err('INVALID_DATE','Date key is invalid.')],marks:[],confirmed:false,dayKey:null};
  const tip=activeCloses(journal).get(date),byId=recordMap(journal);
  const marked=new Map((tip?.recordIds??[]).map(id=>{const r=byId.get(id);return [r.occurrenceId,r];}));
  const marks=activeDay(model,date).map(s=>({occurrenceId:s.id,registerId:s.registerId,disposition:marked.get(s.id)?.disposition??'UNKNOWN',note:marked.get(s.id)?.note??''}));
  return {ok:true,issues:[],marks,confirmed:!!tip,dayKey:tip?.dayKey??null};
}
