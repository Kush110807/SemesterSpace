import {CONTRACT_VERSION,STATUS} from '../shared/constants.js';
import {ASSUMPTIONS,copy,issue,validClock,validDate,nonnegative,isObject,sessionOrder,ratio,meets,floorOf,dateAdd,datesBetween} from './common.js';
import {validateModel} from './validation.js';

function envelope(model,clock) {
  return {
    contractVersion:CONTRACT_VERSION,status:STATUS.INVALID_SETUP,
    modelRevision:isObject(model)&&nonnegative(model.revision)?model.revision:null,
    evaluatedAt:validClock(clock)?copy(clock):null,
    issues:[],firstFailure:null,registers:[],dates:[],combinedAbsenceDates:[],assumptions:[],
  };
}
function failure(kind, message, {date=null,sessionId=null,registerId=null,eventId=null,attended=null,held=null,percentage=null,requiredBps=null,floorBps=null,combinedAbsenceDates=[]}={}) {
  return {kind,date,sessionId,registerId,eventId,attended,held,percentage,requiredBps,floorBps,combinedAbsenceDates,message};
}
function actualEvents(model) {
  const sessions=new Map(model.sessions.map(s=>[s.id,s]));
  return model.events.filter(e=>!e.cancelled).map(e=>{
    if(e.sessionId===null)return {...e};
    const s=sessions.get(e.sessionId);
    return s.cancelled?null:{...e,date:s.date,start:s.start,end:s.end};
  }).filter(Boolean);
}
function firstObligationFailure(model, day, sessions, events) {
  const session=sessions.find(s=>s.date===day&&(s.protected||model.courses.some(c=>c.id===model.registers.find(r=>r.id===s.registerId)?.courseId&&c.mustAttend)));
  if(session)return failure('PROTECTION',`Required attendance session ${session.id} blocks a full-day break on ${day}.`,{date:day,sessionId:session.id,registerId:session.registerId});
  const event=events.find(e=>e.date===day);
  if(event)return failure('COMPULSORY',`Compulsory event ${event.title} (${event.id}) blocks a full-day break on ${day}.`,{date:day,eventId:event.id,sessionId:event.sessionId});
  return null;
}
function buildDateResults(model, sessions, events, snapshotDate, selected, futureCommitted) {
  const calendar=new Set();
  const start=model.schedule.startDate>snapshotDate?model.schedule.startDate:dateAdd(snapshotDate,1);
  for(const date of datesBetween(start,model.schedule.teachingEnd))calendar.add(date);
  for(const c of model.commitments)calendar.add(c.date);
  for(const d of selected)calendar.add(d);
  const holidays=new Set(model.schedule.holidays.map(h=>h.date));
  const activeByDate=new Map(),eventByDate=new Map();
  for(const s of sessions){const row=activeByDate.get(s.date)??[];row.push(s);activeByDate.set(s.date,row);}
  for(const e of events){const row=eventByDate.get(e.date)??[];row.push(e);eventByDate.set(e.date,row);}
  return [...calendar].sort().map(date=>{
    const active=activeByDate.get(date)??[], oblig=eventByDate.get(date)??[];
    const hasCommitment=model.commitments.some(c=>c.date===date);
    const selectedDate=selected.has(date), isHistorical=hasCommitment&&date<=snapshotDate;
    const markers=[];
    if(holidays.has(date))markers.push('HOLIDAY');
    if(active.length)markers.push('TEACHING');
    if(active.some(s=>s.protected||model.courses.some(c=>c.mustAttend&&c.id===model.registers.find(r=>r.id===s.registerId)?.courseId)))markers.push('PROTECTED');
    if(oblig.length)markers.push('COMPULSORY');
    if(selectedDate)markers.push('SELECTED');
    if(hasCommitment)markers.push('COMMITTED');
    if(isHistorical)markers.push('HISTORICAL');
    if(hasCommitment&&!isHistorical&&(date<model.schedule.startDate||date>model.schedule.teachingEnd))markers.push('OUTSIDE_HORIZON');
    if(hasCommitment&&!isHistorical&&!active.length&&!oblig.length&&date>=model.schedule.startDate&&date<=model.schedule.teachingEnd)markers.push('ALREADY_OFF');
    const absenceUnits=[];
    if(futureCommitted.has(date)||selectedDate){
      const total=new Map();for(const s of active)total.set(s.registerId,(total.get(s.registerId)??0)+s.weight);
      for(const [registerId,units] of [...total.entries()].sort(([a],[b])=>a.localeCompare(b)))absenceUnits.push({registerId,units});
    }
    return {date,markers,sessionIds:active.map(s=>s.id).sort(),eventIds:oblig.map(e=>e.id).sort(),absenceUnits,conflictScope:'NONE',messages:[]};
  });
}
function markConflict(result, failureInfo, relatedDates, scope) {
  if(!failureInfo)return;
  for(const row of result.dates)if(relatedDates.has(row.date)) {
    if(row.markers.includes('COMMITTED')&&!row.markers.includes('INVALID_COMMITMENT'))row.markers.push('INVALID_COMMITMENT');
    row.conflictScope=scope;
    if(!row.messages.includes(failureInfo.message))row.messages.push(failureInfo.message);
  }
}
function initialClassification(a,h,r,f) {
  if(!h||meets(a,h,f))return 'NONE';
  return meets(a,h,r)?'MARGIN':'REQUIREMENT';
}
function summaryDates(selected,committed) {return [...new Set([...selected,...committed])].sort();}

// This is the only full-semester attendance decision path: manual and greedy requests share it.
export function evaluatePlan(model, request) {
  const clock=isObject(request)?request.clock:undefined;
  const result=envelope(model,clock);
  const validation=validateModel(model,clock);
  result.issues=[...validation.issues];
  if(!isObject(request))result.issues.push(issue('INVALID_REQUEST','request','Supply {additionalDates,clock}.'));
  else if(!Array.isArray(request.additionalDates))result.issues.push(issue('INVALID_ADDITIONAL_DATES','additionalDates','Supply an array of selected date keys.'));
  else {
    const seen=new Set();
    request.additionalDates.forEach((d,i)=>{
      if(!validDate(d))result.issues.push(issue('INVALID_SELECTION_DATE',`additionalDates[${i}]`,'Selection must be a Gregorian date.'));
      else if(seen.has(d))result.issues.push(issue('DUPLICATE_SELECTION',`additionalDates[${i}]`,'Dates cannot be selected twice.'));
      seen.add(d);
    });
  }
  if(result.issues.length)return result;
  const latest=model.snapshots.at(-1),S=latest.date;
  const all=model.sessions.filter(s=>!s.cancelled).sort(sessionOrder),
    projected=all.filter(s=>s.date>S&&s.date<=model.schedule.teachingEnd),
    events=actualEvents(model);
  const selected=new Set(request.additionalDates);
  const futureCommitted=new Set(model.commitments.filter(c=>c.date>S).map(c=>c.date));
  result.assumptions=[...ASSUMPTIONS];
  result.combinedAbsenceDates=summaryDates(selected,futureCommitted);
  result.dates=buildDateResults(model,all,events,S,selected,futureCommitted);
  const rowByDate=new Map(result.dates.map(r=>[r.date,r]));
  const initial=new Map(),projectedFinal=new Map();
  let unrecoverable=false;
  for(const r of model.registers){
    const counts=latest.counts[r.id],floor=floorOf(r),start=ratio(counts.attended,counts.held);
    const classification=initialClassification(counts.attended,counts.held,r.requiredBps,floor);
    const regProjected=projected.filter(s=>s.registerId===r.id);
    let rec={status:'NOT_NEEDED',sessionId:null,date:null};
    if(counts.held===0&&!regProjected.length)rec.status='NOT_STARTED';
    if(classification!=='NONE') {
      rec={status:'UNRECOVERABLE',sessionId:null,date:null};
      // Attend-all baseline is independent of commitments/selected absences.
      let a=counts.attended,h=counts.held;
      for(const s of regProjected){a+=s.weight;h+=s.weight;if(meets(a,h,floor)){rec={status:'RECOVERABLE',sessionId:s.id,date:s.date};break;}}
      if(rec.status==='UNRECOVERABLE')unrecoverable=true;
    }
    initial.set(r.id,{a:counts.attended,h:counts.held,classification,floor,r,rec});
    projectedFinal.set(r.id,{a:counts.attended,h:counts.held});
    result.registers.push({registerId:r.id,requiredBps:r.requiredBps,floorBps:floor,initial:start,final:start,initialShortfall:classification,recovery:rec});
  }
  // ATTENDANCE_UPDATE_NEEDED takes precedence over existing recovery problems.
  const elapsed=projected.find(s=>s.date<clock.date||s.date===clock.date&&s.start<=clock.time);
  const lastElapsedDay=clock.date>S?dateAdd(clock.date,-1):S;
  const missingGap=lastElapsedDay>S&&(!model.attendanceConfirmation||model.attendanceConfirmation.throughDate<lastElapsedDay);
  if(elapsed||missingGap){
    result.status=STATUS.ATTENDANCE_UPDATE_NEEDED;
    result.issues.push(issue(elapsed?'STARTED_SESSION':'UNCONFIRMED_NONTEACHING_GAP',elapsed?'model.snapshots':'model.attendanceConfirmation',
      elapsed?`Session ${elapsed.id} has started after the latest completed-day snapshot. Confirm new actual attendance before planning.`:`Confirm no unlisted sessions through ${lastElapsedDay} before planning.`));
    return result;
  }
  if(unrecoverable){
    result.status=STATUS.EXISTING_UNRECOVERABLE_SHORTFALL;
    // Even a blocked unrecoverable baseline can show its best-case attend-all final ratio.
    for(const reg of result.registers){
      const v=projected.filter(s=>s.registerId===reg.registerId).reduce((v,s)=>({a:v.a+s.weight,h:v.h+s.weight}),{a:reg.initial.attended,h:reg.initial.held});
      reg.final=ratio(v.a,v.h);
    }
    const first=result.registers.find(r=>r.recovery.status==='UNRECOVERABLE');
    const inf=initial.get(first.registerId);
    result.firstFailure=failure('RECOVERY',`Existing ${inf.classification==='MARGIN'?'planning-margin':'required-attendance'} shortfall in ${first.registerId} cannot recover by the confirmed teaching end.`,{registerId:first.registerId,attended:inf.a,held:inf.h,percentage:ratio(inf.a,inf.h).percentage,requiredBps:inf.r.requiredBps,floorBps:inf.floor});
    return result;
  }
  // A selection must be a *new teaching date* inside its hard range; commitments are
  // not forced back into a revised candidate range.
  const lower=S<clock.date?clock.date:dateAdd(S,1);
  let block=null;let blockDates=new Set();
  for(const date of result.combinedAbsenceDates) {
    const isNew=selected.has(date);
    const row=rowByDate.get(date);
    const dateSessions=projected.filter(s=>s.date===date);
    if(!isNew&&date<=S)continue;
    if(date<model.schedule.startDate||date>model.schedule.teachingEnd) {
      block??=failure('OUTSIDE_HORIZON',`Break on ${date} falls outside the confirmed teaching horizon and requires review.`,{date});
      if(block.date===date)blockDates.add(date);
      continue;
    }
    if(isNew&&(date<lower||date<model.preferences.candidateStart||date>model.preferences.candidateEnd)){
      block??=failure('SELECTION',`New break date ${date} is outside the future search window.`,{date});
      if(block.date===date)blockDates.add(date);
      continue;
    }
    if(isNew&&futureCommitted.has(date)){
      block??=failure('SELECTION',`Date ${date} is already committed; requested days must be new.`,{date});
      if(block.date===date)blockDates.add(date);
      continue;
    }
    if(isNew&&!dateSessions.length){
      block??=failure('SELECTION',`Date ${date} has no active attendance session and cannot count as a new teaching day off.`,{date});
      if(block.date===date)blockDates.add(date);
      continue;
    }
    const protection=firstObligationFailure(model,date,dateSessions,events);
    if(protection){block??=protection;if(block.date===date)blockDates.add(date);}
    if(row&&row.markers.includes('ALREADY_OFF'))row.messages.push('Already off — no teaching day used.');
  }
  const combinedAbsenceByRegister=new Map();
  // Recovery is an atomic session boundary, including multiple sessions on one day.
  const projectedIndex=new Map(projected.map((s,index)=>[s.id,index]));
  let attendanceFailure=null;
  for(const [sessionIndex,s] of projected.entries()){
    const base=initial.get(s.registerId),v=projectedFinal.get(s.registerId),miss=selected.has(s.date)||futureCommitted.has(s.date);
    if(miss){
      const old=combinedAbsenceByRegister.get(s.registerId)??new Set();old.add(s.date);combinedAbsenceByRegister.set(s.registerId,old);
    }else v.a+=s.weight;
    v.h+=s.weight;
    if(!attendanceFailure){
      const recoveryIndex=projectedIndex.get(base.rec.sessionId);
      const missingRecovery=base.classification!=='NONE'&&sessionIndex<=recoveryIndex&&miss;
      const lowAfterRecovery=(base.classification==='NONE'||sessionIndex>=recoveryIndex)&&!meets(v.a,v.h,base.floor);
      if(missingRecovery||lowAfterRecovery) {
        const dates=[...(combinedAbsenceByRegister.get(s.registerId)??[])].sort();
        const kind=missingRecovery?'RECOVERY':'ATTENDANCE';
        const rr=ratio(v.a,v.h);
        attendanceFailure=failure(kind,`${kind==='RECOVERY'?'Recovery needs attendance at':'Planning floor fails after'} session ${s.id} on ${s.date}: ${v.a}/${v.h} (${rr.percentage}%), R ${base.r.requiredBps/100}%, F ${base.floor/100}%. Combined absences included in this calculation: ${dates.join(', ')||'none'}.`,
          {date:s.date,sessionId:s.id,registerId:s.registerId,attended:v.a,held:v.h,percentage:rr.percentage,requiredBps:base.r.requiredBps,floorBps:base.floor,combinedAbsenceDates:dates});
      }
    }
  }
  for(const reg of result.registers){const v=projectedFinal.get(reg.registerId);reg.final=ratio(v.a,v.h);}
  if(block){
    result.firstFailure=block;result.status=STATUS.PLAN_BLOCKED;
    markConflict(result,block,blockDates,'DATE');
    return result;
  }
  if(attendanceFailure){
    result.status=STATUS.PLAN_BLOCKED;result.firstFailure=attendanceFailure;
    // A combined plan conflict does not assert that any one individual date is impossible.
    markConflict(result,attendanceFailure,new Set(attendanceFailure.combinedAbsenceDates),'PLAN');
    return result;
  }
  result.status=result.registers.some(r=>r.initialShortfall!=='NONE')?STATUS.CONDITIONAL_RECOVERY:STATUS.MEETS_PLANNING_RULES;
  return result;
}
