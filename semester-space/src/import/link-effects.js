// Calendar-link checks only: actual future restriction dates, not attendance arithmetic.
import {validDate} from './parse.js';
const reviewed=r=>['CONFIRMED','CORRECTED'].includes(r?.review);
const time=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t??'');
const active=r=>reviewed(r)&&r.applicability==='APPLIES';
export function fitsCalendarScope(row,o){
  const scope=o.academicScope, audience=row.audienceText??'';
  if(!['UNSPECIFIED','BOTH',scope?.term].includes(row.term))return false;
  if(/except\s+(?:first|1st)\s+sem/i.test(audience)&&scope?.semesterNumber===1||/\bPG[- ]I\b/.test(audience)&&!/\bUG\b/.test(audience)&&scope?.degreeGroup==='UG'||/first\s+(?:year|semester)/i.test(audience)&&!/except/i.test(audience)&&scope?.semesterNumber>2)return false;
  return !(/except\s+TAs?\b/i.test(audience)&&scope?.isTeachingAssistant!==false);
}
export function projectionDates(row,o){
  if(!validDate(row.startDate)||!validDate(row.endDate)||row.startDate>row.endDate||!validDate(o.startDate)||!validDate(o.teachingEnd)||!validDate(o.snapshot?.date))return [];
  const after=new Date(o.snapshot.date+'T12:00:00Z');after.setUTCDate(after.getUTCDate()+1);
  const start=[row.startDate,o.startDate,after.toISOString().slice(0,10)].sort().at(-1),end=[row.endDate,o.teachingEnd].sort()[0],dates=[];
  for(let date=new Date(start+'T12:00:00Z');date.toISOString().slice(0,10)<=end;date.setUTCDate(date.getUTCDate()+1)){dates.push(date.toISOString().slice(0,10));if(dates.length>740)return [];}
  return dates;
}
const contains=(row,date)=>validDate(row.startDate)&&validDate(row.endDate)&&row.startDate<=date&&date<=row.endDate;
function suppressed(date,d,o){return !o.holidayTeachingDates?.includes(date)&&d.calendarEntries.some(r=>active(r)&&['HOLIDAY','NON_TEACHING'].includes(r.treatment)&&contains(r,date));}
function patternHasObligations(day,d){return d.timetableEntries.some(r=>active(r)&&r.weekday===day&&(r.treatment==='COMPULSORY_ZERO_UNITS'||r.treatment==='ATTENDANCE'&&Number.isSafeInteger(r.weight)&&r.weight>0&&d.registers.some(reg=>reg.id===r.registerId)));}
export function targetRestriction(row,area,d,o){
  if(!active(row)||!fitsCalendarScope(row,o))return null;
  let dates=projectionDates(row,o);if(!dates.length)return null;
  const event=row.treatment==='COMPULSORY'&&(row.allDay===true||time(row.startTime)&&time(row.endTime)&&row.startTime<row.endTime);
  if(area==='OBLIGATIONS'&&event||area==='SUBSTITUTIONS'&&row.kind==='WORKING_DAY_NOTICE'&&event)return {row,dates,suppressionDates:[],pattern:null,start:row.allDay?'00:00':row.startTime,end:row.allDay?'23:59':row.endTime};
  if(area==='SUBSTITUTIONS'&&row.treatment==='REPLACEMENT'&&row.startDate===row.endDate&&Number.isInteger(row.replacementWeekday)&&row.replacementWeekday>=1&&row.replacementWeekday<=7&&patternHasObligations(row.replacementWeekday,d)){
    dates=dates.filter(date=>!suppressed(date,d,o));return dates.length?{row,dates,suppressionDates:[],pattern:row.replacementWeekday}:null;
  }
  if(area==='NON_TEACHING'&&['HOLIDAY','NON_TEACHING'].includes(row.treatment)){
    const suppressionDates=dates.filter(date=>!o.holidayTeachingDates?.includes(date));
    // A gazetted-holiday label may coexist with explicitly confirmed holiday teaching.
    // Explicit NON_TEACHING claims must suppress teaching, not just retain that marker.
    if(row.treatment==='NON_TEACHING')dates=suppressionDates;
    return dates.length?{row,dates,suppressionDates,pattern:null}:null;
  }
  return null;
}
export function datesForSource(effect,source,area){return area==='NON_TEACHING'&&['NON_TEACHING','VACATION'].includes(source.kind)?effect.suppressionDates:effect.dates;}
function intervalCovered(source,effects,date){
  const start=source.allDay?'00:00':source.startTime,end=source.allDay?'23:59':source.endTime;
  if(!time(start)||!time(end))return true;
  let covered=start;
  for(const e of effects.filter(e=>e.dates.includes(date)).sort((a,b)=>(a.start??'').localeCompare(b.start??''))){if(!time(e.start)||!time(e.end)||e.start>covered)continue;if(e.end>covered)covered=e.end;}
  return covered>=end;
}
export function naturallyCorresponds(source,effects,area,o){
  if(!fitsCalendarScope(source,o))return false;
  const expected=projectionDates(source,o);if(!expected.length)return false;
  if(area==='SUBSTITUTIONS'&&source.kind==='WORKING_DAY_NOTICE'&&!source.replacementWeekday&&effects.some(e=>e.row.treatment==='REPLACEMENT'))return false;
  return expected.every(date=>effects.some(e=>datesForSource(e,source,area).includes(date)&&(source.kind!=='REPLACEMENT'||e.row.treatment==='REPLACEMENT'&&e.pattern===source.replacementWeekday))&&(area!=='OBLIGATIONS'||intervalCovered(source,effects,date)));
}
function sourceBinding(source,d){return JSON.stringify([source.id,source.kind,source.startDate,source.endDate,source.replacementWeekday,source.term,source.audienceText,source.startTime,source.endTime,source.allDay,source.evidence,d.sources.filter(s=>s.role==='ACADEMIC_CALENDAR').map(s=>[s.id,s.sha256])]);}
function targetBinding(targets){return JSON.stringify(targets.map(r=>({id:r.id,kind:r.kind,review:r.review,applicability:r.applicability,treatment:r.treatment,startDate:r.startDate,endDate:r.endDate,replacementWeekday:r.replacementWeekday,startTime:r.startTime,endTime:r.endTime,allDay:r.allDay,term:r.term,audienceText:r.audienceText,evidence:r.evidence})).sort((a,b)=>a.id.localeCompare(b.id)));}
function scopeBinding(o){return JSON.stringify([o.academicScope,o.context?.section,o.startDate,o.teachingEnd,o.snapshot?.date,o.replacements,o.holidayTeachingDates]);}
export function makeSourceReconciliation(source,targets,d,o,note){return {sourceCandidateId:source.id,sourceBinding:sourceBinding(source,d),targetBinding:targetBinding(targets),scopeBinding:scopeBinding(o),note,confirmed:true};}
export function reconciled(source,targets,d,o,reconciliation){
  return reconciliation?.confirmed===true&&typeof reconciliation.note==='string'&&reconciliation.note.trim().length>0&&reconciliation.sourceCandidateId===source.id&&reconciliation.sourceBinding===sourceBinding(source,d)&&reconciliation.targetBinding===targetBinding(targets)&&reconciliation.scopeBinding===scopeBinding(o);
}
