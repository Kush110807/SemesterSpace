import {isObject,validDate,validTime,safeInt,issue,weekday,datesBetween,sessionOrder} from './common.js';

/** Expand one confirmed weekly schedule into immutable-by-convention canonical sessions.
 * Does not inspect or mutate a persisted Model; A installs the returned rows atomically. */
export function expandSchedule(draft) {
  const issues=[],bad=(code,path,message)=>issues.push(issue(code,path,message));
  const empty=()=>({ok:false,issues,sessions:[]});
  if(!isObject(draft)) {bad('INVALID_DRAFT','draft','Supply a schedule draft object.');return empty();}
  const schedule=draft.schedule;
  if(!isObject(schedule)) {bad('INVALID_SCHEDULE','draft.schedule','A confirmed schedule is required.');return empty();}
  const arrays=['courses','registers','extraSessions','overrides'];
  for(const k of arrays)if(!Array.isArray(draft[k]))bad('INVALID_ARRAY',`draft.${k}`,`${k} must be an array.`);
  for(const k of ['weeklyTemplates','holidays','replacements','holidayTeachingDates'])if(!Array.isArray(schedule[k]))bad('INVALID_ARRAY',`draft.schedule.${k}`,`${k} must be an array.`);
  if(!validDate(schedule.startDate))bad('INVALID_DATE','draft.schedule.startDate','Invalid schedule start.');
  if(!validDate(schedule.teachingEnd))bad('INVALID_DATE','draft.schedule.teachingEnd','Invalid teaching end.');
  if(validDate(schedule.startDate)&&validDate(schedule.teachingEnd)&&schedule.startDate>schedule.teachingEnd)bad('INVALID_HORIZON','draft.schedule','End must not precede start.');
  if(schedule.confirmed!==true)bad('UNCONFIRMED_SCHEDULE','draft.schedule.confirmed','Teaching horizon requires confirmation.');
  if(schedule.initialized!==false)bad('ALREADY_INITIALIZED','draft.schedule.initialized','Expansion is only permitted for an uninitialized draft.');
  const rows=k=>Array.isArray(draft[k])?draft[k]:[];
  const templateRows=Array.isArray(schedule.weeklyTemplates)?schedule.weeklyTemplates:[];
  const holidayRows=Array.isArray(schedule.holidays)?schedule.holidays:[];
  const replacementRows=Array.isArray(schedule.replacements)?schedule.replacements:[];
  const teachingRows=Array.isArray(schedule.holidayTeachingDates)?schedule.holidayTeachingDates:[];
  const idKinds={};
  function ident(row,p,kind){
    if(!isObject(row)){bad('INVALID_ROW',p,'Expected an object.');return false;}
    if(typeof row.id!=='string'||!row.id.trim()){bad('INVALID_ID',`${p}.id`,'Nonempty ID required.');return false;}
    const seen=idKinds[kind]??(idKinds[kind]=new Set());
    if(seen.has(row.id))bad('DUPLICATE_ID',`${p}.id`,`${kind} ID repeated.`);seen.add(row.id);return true;
  }
  const courses=new Set(),registers=new Set(),templates=new Set();
  rows('courses').forEach((c,i)=>{
    const p=`draft.courses[${i}]`;if(!ident(c,p,'course'))return;courses.add(c.id);
    if(typeof c.name!=='string'||!c.name.trim()||typeof c.mustAttend!=='boolean')bad('INVALID_COURSE',p,'Course needs name and protection flag.');
  });
  rows('registers').forEach((r,i)=>{
    const p=`draft.registers[${i}]`;if(!ident(r,p,'register'))return;registers.add(r.id);
    if(!courses.has(r.courseId))bad('UNKNOWN_COURSE',`${p}.courseId`,'Unknown course.');
    if(typeof r.name!=='string'||!r.name.trim())bad('INVALID_REGISTER',p,'Register name required.');
    if(!safeInt(r.requiredBps)||r.requiredBps<1||r.requiredBps>10000||r.personalMinBps!==null&&(!safeInt(r.personalMinBps)||r.personalMinBps<1||r.personalMinBps>10000)||!safeInt(r.bufferBps)||r.bufferBps<0||Math.max(r.requiredBps,r.personalMinBps??r.requiredBps)+r.bufferBps>10000)bad('INVALID_FLOOR',p,'Invalid R/T/B planning floor.');
  });
  if(!registers.size)bad('NO_REGISTERS','draft.registers','At least one register required.');
  templateRows.forEach((t,i)=>{
    const p=`draft.schedule.weeklyTemplates[${i}]`;if(!ident(t,p,'template'))return;templates.add(t.id);
    if(!registers.has(t.registerId))bad('UNKNOWN_REGISTER',`${p}.registerId`,'Unknown register.');
    if(!safeInt(t.weekday)||t.weekday<1||t.weekday>7)bad('INVALID_WEEKDAY',`${p}.weekday`,'ISO weekday must be 1..7.');
    if(!validTime(t.start)||!validTime(t.end)||t.start>=t.end)bad('INVALID_TIME',p,'Invalid template time interval.');
    if(!safeInt(t.weight)||t.weight<1)bad('INVALID_WEIGHT',`${p}.weight`,'Weight must be positive integer.');
    if(typeof t.protected!=='boolean')bad('INVALID_BOOLEAN',`${p}.protected`,'Protection flag required.');
  });
  const holidays=new Set(),confirmedHolidayTeaching=new Set(),replacements=new Map();
  holidayRows.forEach((h,i)=>{
    const p=`draft.schedule.holidays[${i}]`;
    if(!isObject(h)||!validDate(h.date)||typeof h.label!=='string'){bad('INVALID_HOLIDAY',p,'Valid date and label required.');return;}
    if(holidays.has(h.date))bad('DUPLICATE_HOLIDAY',p,'Holiday date repeated.');holidays.add(h.date);
  });
  teachingRows.forEach((d,i)=>{
    const p=`draft.schedule.holidayTeachingDates[${i}]`;
    if(!validDate(d))bad('INVALID_DATE',p,'Invalid date.');
    if(confirmedHolidayTeaching.has(d))bad('DUPLICATE_HOLIDAY_TEACHING',p,'Teaching date repeated.');
    confirmedHolidayTeaching.add(d);
  });
  replacementRows.forEach((r,i)=>{
    const p=`draft.schedule.replacements[${i}]`;
    if(!isObject(r)||!validDate(r.date)){bad('INVALID_REPLACEMENT',p,'Replacement needs a valid date.');return;}
    if(replacements.has(r.date))bad('AMBIGUOUS_REPLACEMENT',p,'A date cannot have two replacement patterns.');
    replacements.set(r.date,r.weekday);
    if(!safeInt(r.weekday)||r.weekday<1||r.weekday>7)bad('INVALID_WEEKDAY',`${p}.weekday`,'Replacement ISO weekday must be 1..7.');
    if(r.confirmed!==true)bad('UNCONFIRMED_REPLACEMENT',`${p}.confirmed`,'Replacement must be confirmed.');
    if(holidays.has(r.date)&&!confirmedHolidayTeaching.has(r.date))bad('HOLIDAY_TEACHING_UNCONFIRMED',p,'Confirm teaching on replacement holiday.');
  });
  if(issues.length)return empty();
  const sessions=[];const byId=new Map();
  // A replacement substitutes, not adds to, the actual weekday pattern.
  for(const date of datesBetween(schedule.startDate,schedule.teachingEnd)){
    if(holidays.has(date)&&!confirmedHolidayTeaching.has(date))continue;
    const d=replacements.get(date)??weekday(date);
    for(const t of templateRows)if(t.weekday===d){
      const s={id:`weekly:${t.id}:${date}`,registerId:t.registerId,date,start:t.start,end:t.end,weight:t.weight,protected:t.protected,cancelled:false,origin:'weekly',templateId:t.id};
      if(byId.has(s.id))bad('DUPLICATE_SESSION_ID','draft.schedule.weeklyTemplates',`Repeated generated session ${s.id}.`);
      sessions.push(s);byId.set(s.id,s);
    }
  }
  rows('extraSessions').forEach((s,i)=>{
    const p=`draft.extraSessions[${i}]`;if(!ident(s,p,'extraSession'))return;
    if(byId.has(s.id))bad('DUPLICATE_SESSION_ID',`${p}.id`,'Extra ID collides with generated row.');
    if(s.origin!=='extra'||s.templateId!==null)bad('INVALID_SESSION_ORIGIN',p,'Extra session must use extra origin and null templateId.');
    sessions.push({...s});byId.set(s.id,sessions.at(-1));
  });
  const overridden=new Set();
  rows('overrides').forEach((o,i)=>{
    const p=`draft.overrides[${i}]`;
    if(!isObject(o)||typeof o.sessionId!=='string'||!isObject(o.changes)){bad('INVALID_OVERRIDE',p,'Override needs stable sessionId and changes.');return;}
    if(!byId.has(o.sessionId))bad('UNKNOWN_OVERRIDE_TARGET',`${p}.sessionId`,'Override target does not exist.');
    if(overridden.has(o.sessionId))bad('DUPLICATE_OVERRIDE',`${p}.sessionId`,'A session can be overridden only once.');overridden.add(o.sessionId);
    const allowed=['date','start','end','registerId','weight','protected','cancelled'];
    if(Object.keys(o.changes).some(k=>!allowed.includes(k)))bad('FORBIDDEN_OVERRIDE_FIELD',`${p}.changes`,'Cannot edit session ID, origin or template mapping.');
    if(byId.has(o.sessionId)&&Object.keys(o.changes).every(k=>allowed.includes(k)))Object.assign(byId.get(o.sessionId),o.changes);
  });
  const valid=[];
  sessions.forEach((s,i)=>{
    const p=`sessions[${i}]`;
    if(typeof s.id!=='string'||!s.id.trim()||!registers.has(s.registerId)||!validDate(s.date)||!validTime(s.start)||!validTime(s.end)||s.start>=s.end||!safeInt(s.weight)||s.weight<1||typeof s.protected!=='boolean'||typeof s.cancelled!=='boolean')bad('INVALID_EXPANDED_SESSION',p,`Invalid expanded session ${s.id}.`);
    if(!s.cancelled&&holidays.has(s.date)&&!confirmedHolidayTeaching.has(s.date))bad('HOLIDAY_TEACHING_UNCONFIRMED',p,`Active session ${s.id} on holiday ${s.date} is not confirmed.`);
    if(!s.cancelled&&validDate(s.date)&&validTime(s.start)&&validTime(s.end))valid.push(s);
  });
  valid.sort(sessionOrder);
  for(let i=1;i<valid.length;i++)if(valid[i-1].date===valid[i].date&&valid[i].start<valid[i-1].end)bad('OVERLAPPING_SESSIONS','sessions',`${valid[i-1].id} overlaps ${valid[i].id}.`);
  if(issues.length)return empty();
  return {ok:true,issues:[],sessions:sessions.sort(sessionOrder)};
}
