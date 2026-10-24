import {TIME_ZONE,isObject,safeInt,nonnegative,issue,validTime,validDate,validClock,clockStamp,sessionOrder,floorOf} from './common.js';

function jsonSafe(x, depth=0, seen=new WeakSet()) {
  if (x===null || typeof x==='string' || typeof x==='boolean') return true;
  if (typeof x==='number') return Number.isFinite(x);
  if (depth>60 || !x || typeof x!=='object' || seen.has(x) || (Array.isArray(x) ? false : !isObject(x))) return false;
  seen.add(x);
  const good=(Array.isArray(x)?x:Object.values(x)).every(v=>jsonSafe(v,depth+1,seen));
  seen.delete(x); return good;
}
export function validateModel(model,clock) {
  const issues=[];const fail=(code,path,message)=>issues.push(issue(code,path,message));
  if(!validClock(clock)) fail('INVALID_CLOCK','clock','Supply a valid Asia/Kolkata evaluation clock.');
  if(!isObject(model)) {fail('INVALID_MODEL','model','Supply a complete model object.');return {ok:false,issues};}
  if (!jsonSafe(model)) fail('NON_SERIALIZABLE_MODEL','model','Model must contain only finite JSON data with no cycles.');
  if(model.schemaVersion!==1) fail('INVALID_SCHEMA_VERSION','model.schemaVersion','Expected schema version 1.');
  if(!nonnegative(model.revision)) fail('INVALID_MODEL_REVISION','model.revision','Revision must be a nonnegative safe integer.');
  if(typeof model.id!=='string'||!model.id.trim()) fail('INVALID_MODEL_ID','model.id','A model ID is required.');
  if(model.timeZone!==TIME_ZONE) fail('INVALID_TIME_ZONE','model.timeZone','Use Asia/Kolkata.');
  const context=model.context;
  if(!isObject(context)) fail('INVALID_CONTEXT','model.context','Confirmed academic context is required.');
  else {
    for(const key of ['college','academicYear','semester','programme','section','sourceLabel']) if(typeof context[key]!=='string'||!context[key].trim()) fail('INVALID_CONTEXT_FIELD',`model.context.${key}`,`${key} must be supplied.`);
    if(!validDate(context.preparedOn)) fail('INVALID_DATE','model.context.preparedOn','Invalid preparation date.');
    if(context.applicabilityConfirmed!==true) fail('UNCONFIRMED_CONTEXT','model.context.applicabilityConfirmed','Student must confirm applicability.');
  }
  const schedule=model.schedule;
  const lists=['courses','registers','sessions','events','snapshots','commitments'];
  for(const name of lists) if(!Array.isArray(model[name])) fail('INVALID_ARRAY',`model.${name}`,`${name} must be an array.`);
  const arr=name=>Array.isArray(model[name])?model[name]:[];
  const seenIds={};
  const checkId=(row,path,kind)=>{
    if(!isObject(row)){fail('INVALID_ROW',path,'Expected an object.');return false;}
    if(typeof row.id!=='string'||!row.id.trim()){fail('INVALID_ID',`${path}.id`,'Nonempty stable ID required.');return false;}
    const ids=seenIds[kind]??(seenIds[kind]=new Set());
    if(ids.has(row.id)) fail('DUPLICATE_ID',`${path}.id`,`${kind} ID is repeated.`);
    ids.add(row.id);return true;
  };
  const courses=new Map(), registers=new Map(), sessions=new Map();
  arr('courses').forEach((c,i)=>{
    const p=`model.courses[${i}]`;if(!checkId(c,p,'course'))return;
    courses.set(c.id,c);
    if(typeof c.name!=='string'||!c.name.trim())fail('INVALID_NAME',`${p}.name`,'Course name required.');
    if(typeof c.mustAttend!=='boolean')fail('INVALID_BOOLEAN',`${p}.mustAttend`,'Must-attend flag is required.');
  });
  arr('registers').forEach((r,i)=>{
    const p=`model.registers[${i}]`;if(!checkId(r,p,'register'))return;
    registers.set(r.id,r);
    if(!courses.has(r.courseId))fail('UNKNOWN_COURSE',`${p}.courseId`,'Register references an unknown course.');
    if(typeof r.name!=='string'||!r.name.trim())fail('INVALID_NAME',`${p}.name`,'Register name required.');
    if(!safeInt(r.requiredBps)||r.requiredBps<1||r.requiredBps>10000)fail('INVALID_REQUIRED_BPS',`${p}.requiredBps`,'R must be 1..10000 basis points.');
    if(r.personalMinBps!==null&&(!safeInt(r.personalMinBps)||r.personalMinBps<1||r.personalMinBps>10000))fail('INVALID_PERSONAL_BPS',`${p}.personalMinBps`,'T must be null or 1..10000.');
    if(!nonnegative(r.bufferBps))fail('INVALID_BUFFER_BPS',`${p}.bufferBps`,'B must be a nonnegative safe integer.');
    if(safeInt(r.requiredBps)&&(r.personalMinBps===null||safeInt(r.personalMinBps))&&nonnegative(r.bufferBps)&&floorOf(r)>10000)fail('FLOOR_OVER_100',p,'The combined planning floor must not exceed 100%.');
  });
  if(!registers.size)fail('NO_REGISTERS','model.registers','At least one attendance register is required.');
  const templateIds=new Set();
  if(!isObject(schedule))fail('INVALID_SCHEDULE','model.schedule','Schedule is missing.');
  else {
    if(!validDate(schedule.startDate))fail('INVALID_DATE','model.schedule.startDate','Invalid start date.');
    if(!validDate(schedule.teachingEnd))fail('INVALID_DATE','model.schedule.teachingEnd','Invalid teaching end date.');
    if(validDate(schedule.startDate)&&validDate(schedule.teachingEnd)&&schedule.startDate>schedule.teachingEnd)fail('INVALID_HORIZON','model.schedule','Teaching end is before start.');
    if(schedule.confirmed!==true)fail('UNCONFIRMED_SCHEDULE','model.schedule.confirmed','Confirm last teaching date.');
    if(schedule.initialized!==true)fail('UNINITIALIZED_SCHEDULE','model.schedule.initialized','Expand and initialize recurring schedule first.');
    for(const k of ['weeklyTemplates','holidays','replacements','holidayTeachingDates']) if(!Array.isArray(schedule[k]))fail('INVALID_ARRAY',`model.schedule.${k}`,`${k} must be an array.`);
    (Array.isArray(schedule.weeklyTemplates)?schedule.weeklyTemplates:[]).forEach((t,i)=>{
      const p=`model.schedule.weeklyTemplates[${i}]`;if(!isObject(t)){fail('INVALID_ROW',p,'Expected weekly template object.');return;}
      if(typeof t.id!=='string'||!t.id.trim()||templateIds.has(t.id))fail('INVALID_TEMPLATE_ID',`${p}.id`,'Unique template ID required.');else templateIds.add(t.id);
      if(!registers.has(t.registerId))fail('UNKNOWN_REGISTER',`${p}.registerId`,'Unknown register.');
      if(!safeInt(t.weekday)||t.weekday<1||t.weekday>7)fail('INVALID_WEEKDAY',`${p}.weekday`,'ISO weekday must be 1..7.');
      if(!validTime(t.start)||!validTime(t.end)||t.start>=t.end)fail('INVALID_TIME',p,'Template start must precede end.');
      if(!safeInt(t.weight)||t.weight<1)fail('INVALID_WEIGHT',`${p}.weight`,'Weight must be positive safe integer.');
      if(typeof t.protected!=='boolean')fail('INVALID_BOOLEAN',`${p}.protected`,'Protection flag required.');
    });
    const holidays=new Set(),replacementDates=new Set(),holidayTeaching=new Set();
    (Array.isArray(schedule.holidays)?schedule.holidays:[]).forEach((h,i)=>{
      const p=`model.schedule.holidays[${i}]`;if(!isObject(h)||!validDate(h.date)){fail('INVALID_HOLIDAY',p,'Valid holiday date and label required.');return;}
      if(typeof h.label!=='string')fail('INVALID_HOLIDAY',`${p}.label`,'Holiday label required.');
      if(holidays.has(h.date))fail('DUPLICATE_HOLIDAY',p,'Holiday date repeated.');holidays.add(h.date);
    });
    (Array.isArray(schedule.holidayTeachingDates)?schedule.holidayTeachingDates:[]).forEach((d,i)=>{
      if(!validDate(d))fail('INVALID_DATE',`model.schedule.holidayTeachingDates[${i}]`,'Invalid holiday teaching date.');
      else if(holidayTeaching.has(d))fail('DUPLICATE_HOLIDAY_TEACHING',`model.schedule.holidayTeachingDates[${i}]`,'Holiday confirmation repeated.');
      holidayTeaching.add(d);
    });
    (Array.isArray(schedule.replacements)?schedule.replacements:[]).forEach((r,i)=>{
      const p=`model.schedule.replacements[${i}]`;
      if(!isObject(r)||!validDate(r.date)){fail('INVALID_REPLACEMENT',p,'Replacement date required.');return;}
      if(replacementDates.has(r.date))fail('AMBIGUOUS_REPLACEMENT',p,'One replacement rule per date.');replacementDates.add(r.date);
      if(!safeInt(r.weekday)||r.weekday<1||r.weekday>7)fail('INVALID_WEEKDAY',`${p}.weekday`,'Replacement weekday must be 1..7.');
      if(r.confirmed!==true)fail('UNCONFIRMED_REPLACEMENT',`${p}.confirmed`,'Replacement must be confirmed.');
      if(holidays.has(r.date)&&!holidayTeaching.has(r.date))fail('HOLIDAY_TEACHING_UNCONFIRMED',p,'Confirm replacement teaching on this holiday.');
    });
    // Rows beyond a revised teaching end are retained but not projected.
  }
  arr('sessions').forEach((s,i)=>{
    const p=`model.sessions[${i}]`;if(!checkId(s,p,'session'))return;
    sessions.set(s.id,s);
    if(!registers.has(s.registerId))fail('UNKNOWN_REGISTER',`${p}.registerId`,'Session references unknown register.');
    if(!validDate(s.date))fail('INVALID_DATE',`${p}.date`,'Invalid session date.');
    if(!validTime(s.start)||!validTime(s.end)||s.start>=s.end)fail('INVALID_TIME',p,'Session start must precede end.');
    if(!safeInt(s.weight)||s.weight<1)fail('INVALID_WEIGHT',`${p}.weight`,'Session weight must be positive safe integer.');
    if(typeof s.protected!=='boolean'||typeof s.cancelled!=='boolean')fail('INVALID_BOOLEAN',p,'Session flags are required.');
    if(s.origin!=='extra'&&s.origin!=='weekly')fail('INVALID_SESSION_ORIGIN',`${p}.origin`,'Session origin must be extra or weekly.');
    if(s.origin==='extra'&&s.templateId!==null||s.origin==='weekly'&&(!templateIds.has(s.templateId)))fail('INVALID_TEMPLATE_REF',`${p}.templateId`,'Template ID must match the weekly origin.');
    if(isObject(schedule)&&Array.isArray(schedule.holidays)&&schedule.holidays.some(h=>h?.date===s.date)&&!s.cancelled&&!(Array.isArray(schedule.holidayTeachingDates)&&schedule.holidayTeachingDates.includes(s.date)))fail('HOLIDAY_TEACHING_UNCONFIRMED',p,'Active class on a holiday needs explicit teaching confirmation.');
  });
  const active=arr('sessions').filter(s=>isObject(s)&&s.cancelled===false&&typeof s.id==='string'&&validDate(s.date)&&validTime(s.start)&&validTime(s.end)&&s.start<s.end).sort(sessionOrder);
  for(let i=1;i<active.length;i++) {
    const a=active[i-1],b=active[i];
    if(a.date===b.date&&b.start<a.end)fail('OVERLAPPING_SESSIONS',`model.sessions`,`${a.id} overlaps ${b.id} on ${a.date}.`);
  }
  arr('events').forEach((e,i)=>{
    const p=`model.events[${i}]`;if(!checkId(e,p,'event'))return;
    if(typeof e.title!=='string'||!e.title.trim())fail('INVALID_EVENT_TITLE',`${p}.title`,'Event title required.');
    if(typeof e.cancelled!=='boolean')fail('INVALID_BOOLEAN',`${p}.cancelled`,'Cancellation flag required.');
    if(e.sessionId===null) {
      if(!validDate(e.date)||!validTime(e.start)||!validTime(e.end)||e.start>=e.end)fail('INVALID_INDEPENDENT_EVENT',p,'Independent event needs a valid date/time.');
    } else if(typeof e.sessionId!=='string'||!sessions.has(e.sessionId)||e.date!==null||e.start!==null||e.end!==null)fail('INVALID_LINKED_EVENT',p,'Linked event must reference one session and use null date/times.');
  });
  const shots=arr('snapshots');let priorSeq=0, priorDate='';let last=null;
  shots.forEach((s,i)=>{
    const p=`model.snapshots[${i}]`;if(!checkId(s,p,'snapshot'))return;
    if(!validDate(s.date))fail('INVALID_DATE',`${p}.date`,'Snapshot date invalid.');
    if(!safeInt(s.sequence)||s.sequence<=priorSeq)fail('INVALID_SNAPSHOT_SEQUENCE',`${p}.sequence`,'Confirmation sequence must increase.');else priorSeq=s.sequence;
    if(validDate(s.date)&&s.date<priorDate)fail('SNAPSHOT_DATE_REGRESSION',`${p}.date`,'Snapshot date cannot regress.');
    if(validDate(s.date))priorDate=s.date;
    if(s.confirmed!==true)fail('SNAPSHOT_UNCONFIRMED',`${p}.confirmed`,'Explicit confirmation required.');
    if(typeof s.completeToday!=='boolean')fail('INVALID_BOOLEAN',`${p}.completeToday`,'Completion flag required.');
    if(!isObject(s.counts))fail('INVALID_SNAPSHOT_COUNTS',`${p}.counts`,'Complete counts per register required.');
    else {
      for(const id of registers.keys()) {
        const c=s.counts[id];if(!isObject(c)||!nonnegative(c.attended)||!nonnegative(c.held)||c.attended>c.held)fail('INVALID_COUNTS',`${p}.counts.${id}`,'Counts must be safe nonnegative integers with attended <= held.');
      }
      for(const id of Object.keys(s.counts))if(!registers.has(id))fail('UNKNOWN_SNAPSHOT_REGISTER',`${p}.counts.${id}`,'Snapshot has an unknown register.');
    }
    if(!validClock(s.confirmedAt))fail('INVALID_CONFIRMATION_CLOCK',`${p}.confirmedAt`,'Confirmation requires a valid captured clock.');
    else if(validDate(s.date)){
      if(s.confirmedAt.date<s.date)fail('PREMATURE_SNAPSHOT_DATE',`${p}.confirmedAt`,'Snapshot cannot predate its confirmation.');
      if(validClock(clock)&&clockStamp(s.confirmedAt)>clockStamp(clock))fail('FUTURE_SNAPSHOT_CONFIRMATION',`${p}.confirmedAt`,'Snapshot confirmation occurs after evaluation clock.');
      if(s.confirmedAt.date===s.date) {
        if(s.completeToday!==true)fail('SNAPSHOT_DAY_NOT_COMPLETE',`${p}.completeToday`,'Same-day confirmation requires explicit completeToday.');
        const latestEnd=active.filter(x=>x.date===s.date).reduce((end,x)=>x.end>end?x.end:end,'00:00');
        if(s.confirmedAt.time<latestEnd)fail('PREMATURE_SNAPSHOT_TIME',`${p}.confirmedAt`,'Confirmation precedes an active attendance session end.');
      }
    }
    last=s;
  });
  if(!shots.length)fail('MISSING_SNAPSHOT','model.snapshots','A completed-day baseline snapshot is required.');
  if(last&&validDate(last.date)&&validClock(clock)&&last.date>clock.date)fail('FUTURE_SNAPSHOT','model.snapshots','Baseline date cannot be in the future.');
  const conf=model.attendanceConfirmation;
  if(conf!==null){
    if(!isObject(conf)||!validDate(conf.throughDate)||conf.noUnlistedClasses!==true)fail('INVALID_GAP_CONFIRMATION','model.attendanceConfirmation','Require confirmed no-unlisted-classes through a valid date.');
    else {
      if(validClock(clock)&&conf.throughDate>clock.date)fail('FUTURE_GAP_CONFIRMATION','model.attendanceConfirmation.throughDate','Gap confirmation cannot include future days.');
      if(last&&validDate(last.date)&&conf.throughDate<last.date)fail('STALE_GAP_CONFIRMATION','model.attendanceConfirmation.throughDate','Gap confirmation cannot predate the baseline.');
    }
  }
  const pref=model.preferences;
  if(!isObject(pref))fail('INVALID_PREFERENCES','model.preferences','Preferences required.');
  else {
    if(!validDate(pref.candidateStart))fail('INVALID_DATE','model.preferences.candidateStart','Invalid candidate start.');
    if(!validDate(pref.candidateEnd))fail('INVALID_DATE','model.preferences.candidateEnd','Invalid candidate end.');
    if(validDate(pref.candidateStart)&&validDate(pref.candidateEnd)&&pref.candidateStart>pref.candidateEnd)fail('INVALID_CANDIDATE_RANGE','model.preferences','Candidate date range is reversed.');
    if(!Array.isArray(pref.preferredDates))fail('INVALID_PREFERRED_DATES','model.preferences.preferredDates','Preferred dates must be an array.');
    else {const seen=new Set();pref.preferredDates.forEach((d,i)=>{if(!validDate(d))fail('INVALID_DATE',`model.preferences.preferredDates[${i}]`,'Invalid preferred date.');if(seen.has(d))fail('DUPLICATE_PREFERENCE',`model.preferences.preferredDates[${i}]`,'Duplicate preferred date.');seen.add(d);});}
    if(!nonnegative(pref.requestedDays))fail('INVALID_REQUESTED_DAYS','model.preferences.requestedDays','K must be nonnegative safe integer.');
    if(typeof pref.notes!=='string')fail('INVALID_NOTES','model.preferences.notes','Notes must be text (not enforced by engine).');
  }
  const committedDates=new Set();
  arr('commitments').forEach((c,i)=>{
    const p=`model.commitments[${i}]`;if(!checkId(c,p,'commitment'))return;
    if(!validDate(c.date))fail('INVALID_DATE',`${p}.date`,'Commitment date invalid.');
    else {if(committedDates.has(c.date))fail('DUPLICATE_COMMITMENT_DATE',`${p}.date`,'Duplicate commitment date.');committedDates.add(c.date);}
    if(!nonnegative(c.createdAtRevision)||nonnegative(model.revision)&&c.createdAtRevision>model.revision)fail('INVALID_COMMITMENT_REVISION',`${p}.createdAtRevision`,'Commitment revision invalid.');
  });
  // Even all-attend projections must not exceed the safely stored integer domain.
  if(last&&isObject(last.counts)&&isObject(schedule)&&validDate(schedule.teachingEnd)) {
    for(const [id] of registers) {
      const initial=last.counts[id];if(!isObject(initial)||!nonnegative(initial.attended)||!nonnegative(initial.held))continue;
      let total=0;for(const s of active)if(s.registerId===id&&s.date>last.date&&s.date<=schedule.teachingEnd&&safeInt(s.weight)&&s.weight>0){total+=s.weight;if(!Number.isSafeInteger(total))break;}
      if(!Number.isSafeInteger(total)||total>Number.MAX_SAFE_INTEGER-initial.held||total>Number.MAX_SAFE_INTEGER-initial.attended)fail('PROJECTED_COUNT_OVERFLOW',`model.registers.${id}`,'Projected counts exceed safe integer range.');
    }
  }
  return {ok:issues.length===0,issues};
}
