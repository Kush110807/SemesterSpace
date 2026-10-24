import {PASS_STATUSES} from '../shared/constants.js';
import {isObject,nonnegative,validClock,dateAdd,datesBetween,copy,issue} from './common.js';
import {evaluatePlan} from './plan.js';

const passes = evaluation => PASS_STATUSES.includes(evaluation.status);
/** Greedy, re-ranked on each acceptance; never promises a maximum feasible set. */
export function suggestPlan(model, request) {
  const clock=isObject(request)?request.clock:undefined;
  const initial=evaluatePlan(model,{additionalDates:[],clock});
  const K=isObject(model)&&isObject(model.preferences)&&nonnegative(model.preferences.requestedDays)?model.preferences.requestedDays:null;
  const search={requested:K,found:0,outcome:'BLOCKED',considered:0,rejections:[],preferenceWarnings:[]};
  const blocked={evaluation:initial,batch:null,search};
  if(!isObject(request)||!validClock(clock)){
    if(!isObject(request))initial.issues.push(issue('INVALID_REQUEST','request','Supply {clock} for suggestion search.'));
    // evaluatePlan's malformed clock status is already INVALID_SETUP.
    return blocked;
  }
  if(!passes(initial))return blocked;
  if(K===0){search.outcome='COMPLETE';return blocked;}
  const S=model.snapshots.at(-1).date, rangeStart=[dateAdd(S,1),clock.date,model.schedule.startDate].sort().at(-1),rangeEnd=model.schedule.teachingEnd;
  const committed=new Set(model.commitments.filter(c=>c.date>S).map(c=>c.date));
  const allActive=model.sessions.filter(s=>!s.cancelled&&s.date>S&&s.date<=rangeEnd);
  const sessionsByDate=new Map(),unitsByDate=new Map();
  for(const s of allActive){
    const row=sessionsByDate.get(s.date)??[];row.push(s);sessionsByDate.set(s.date,row);
    unitsByDate.set(s.date,(unitsByDate.get(s.date)??0n)+BigInt(s.weight));
  }
  const sessionById=new Map(model.sessions.map(s=>[s.id,s]));
  const eventsByDate=new Set();
  for(const e of model.events)if(!e.cancelled){
    const s=e.sessionId===null?null:sessionById.get(e.sessionId);
    if(s?.cancelled)continue;
    eventsByDate.add(s?s.date:e.date);
  }
  const protectedDate=new Set();
  const registerCourse=new Map(model.registers.map(r=>[r.id,r.courseId]));
  const protectedCourses=new Set(model.courses.filter(c=>c.mustAttend).map(c=>c.id));
  for(const s of allActive)if(s.protected||protectedCourses.has(registerCourse.get(s.registerId)))protectedDate.add(s.date);
  const free=date=>!sessionsByDate.has(date)&&!eventsByDate.has(date);
  const eligible=date=>date>=rangeStart&&date<=rangeEnd&&date>=model.preferences.candidateStart&&date<=model.preferences.candidateEnd&&sessionsByDate.has(date)&&!committed.has(date)&&!protectedDate.has(date)&&!eventsByDate.has(date);
  const inCalendar=date=>date>=rangeStart&&date<=rangeEnd;
  const preferred=new Set(model.preferences.preferredDates);
  for(const date of preferred){
    if(eligible(date))continue;
    let reason;
    if(!inCalendar(date)||date<model.preferences.candidateStart||date>model.preferences.candidateEnd)reason='Outside the selectable future teaching window.';
    else if(committed.has(date))reason='Already committed; K counts new dates only.';
    else if(eventsByDate.has(date))reason='A compulsory event blocks a full day off.';
    else if(protectedDate.has(date))reason='A must-attend session blocks a full day off.';
    else reason='No active teaching session is scheduled.';
    search.preferenceWarnings.push(issue('PREFERRED_DATE_UNAVAILABLE',`model.preferences.preferredDates`,`${date}: ${reason}`));
  }
  const candidates=new Set([...sessionsByDate.keys()].filter(eligible));
  if(!candidates.size){search.outcome='NO_CANDIDATES';return blocked;}
  const accepted=new Set();
  // Adjacent means immediately neighbouring known dates which are genuinely off
  // or provisionally absent, never merely a Saturday/Sunday weekday label.
  const off=date=>inCalendar(date)&&(free(date)||committed.has(date)||accepted.has(date));
  const rank=date=>{
    const neighbors=[dateAdd(date,-1),dateAdd(date,1)];
    const adjacency=neighbors.filter(off).length;
    let length=1;
    let d=dateAdd(date,-1);while(off(d)){length++;d=dateAdd(d,-1);}
    d=dateAdd(date,1);while(off(d)){length++;d=dateAdd(d,1);}
    return {date,preference:preferred.has(date)?1:0,adjacency,length,units:unitsByDate.get(date)};
  };
  while(candidates.size&&accepted.size<K){
    const ranked=[...candidates].map(rank).sort((a,b)=>
      b.preference-a.preference||b.adjacency-a.adjacency||b.length-a.length||(a.units<b.units?-1:a.units>b.units?1:0)||a.date.localeCompare(b.date));
    const date=ranked[0].date;candidates.delete(date);search.considered++;
    const trial=[...accepted,date].sort();
    const evaluation=evaluatePlan(model,{additionalDates:trial,clock});
    if(passes(evaluation))accepted.add(date);
    else search.rejections.push({date,evaluation});
  }
  const chosen=[...accepted].sort();
  search.found=chosen.length;
  search.outcome=chosen.length===K?'COMPLETE':'EXHAUSTED';
  const evaluation=chosen.length?evaluatePlan(model,{additionalDates:chosen,clock}):initial;
  return {evaluation,batch:chosen.length?{modelRevision:model.revision,evaluatedAt:copy(clock),dates:chosen,evaluation}:null,search};
}
