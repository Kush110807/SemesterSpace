import {validDate, validTime, validClock} from './engine/common.js';
import {IMPORT_SOURCE_PREFIX} from './import/coverage.js';
import { PASS_STATUSES } from './shared/constants.js';
import { FIXED_CLOCK, makeDemoModel } from './shared/fixtures.js';
import { loadModel, saveModel, makeEmptyRelease, validateRelease, equalJSON } from './storage.js';

export function currentClock() {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, timeZone: 'Asia/Kolkata'};
}
const copy = value => structuredClone(value);
const passes = result => PASS_STATUSES.includes(result?.status);
const required = (condition, message) => { if (!condition) throw new Error(message); };
const unique = list => Array.isArray(list) && list.length === new Set(list).size;
// Course/register rows contain only primitive JSON fields. Ignore row/property order,
// but require identical IDs and values so initialization cannot remap snapshot counts.
function sameRoster(current, incoming) {
  if (!Array.isArray(incoming) || incoming.length !== current.length || incoming.some(row=>!row || typeof row!=='object')) return false;
  const byId=new Map(incoming.map(row=>[row.id,row]));
  return byId.size===current.length && current.every(row=>{
    const candidate=byId.get(row.id),keys=Object.keys(row);
    return candidate && Object.keys(candidate).length===keys.length && keys.every(key=>Object.hasOwn(candidate,key) && Object.is(row[key],candidate[key]));
  });
}

export function createController({engine, render, storage, clock = currentClock, attendance = null, revision = null}) {
  const loaded = loadModel(storage, (m,c) => engine.validateModel(m,c), clock());
  let state = {mode:'personal', model:loaded.model, release:loaded.release, month:clock().date.slice(0,7), selectedDate:null, manualDates:[], batch:null, persistence:loaded.persistence, notice:''};
  let results = {runtime:'NO_SETUP',evaluation:null,search:null,error:null};
  const witnesses=new Map();
  let personal = null;
  let stagedRevision = null; // ephemeral, not persisted or trusted after model changes
  const now = () => state.mode === 'demo' ? copy(FIXED_CLOCK) : clock();
  // RC-001.3: a read-only, transient presentation projection. Proposals remain
  // outside persisted release data and are cleared on every accepted mutation.
  // This does NOT constitute a file-to-proposal adapter or permission to apply.
  const projectedState = () => ({...copy(state), stagedCalendarRevision: stagedRevision === null ? null : copy(stagedRevision)});
  const emit = () => render(projectedState(), copy(results), callbacks);
  function fail(error) {
    results = {runtime:error.name === 'EngineUnavailable' ? 'ENGINE_UNAVAILABLE' : 'ERROR', evaluation:null,search:null,error:error.message};
    state.notice = error.message;
    state.batch = null;
  }
  function evaluate(additionalDates = []) {
    if (!state.model) { results = {runtime:'NO_SETUP',evaluation:null,search:null,error:null}; return null; }
    const evaluation = engine.evaluatePlan(state.model, {additionalDates, clock:now()});
    results = {runtime:'READY', evaluation, search:null,error:null};
    return evaluation;
  }
  function transact(update, {requirePassing=false} = {}) {
    required(state.model, 'Create a setup first.');
    const model = copy(state.model);
    const release=copy(state.release ?? makeEmptyRelease(model));
    const transactionClock=now();
    update(model,transactionClock,release);
    model.revision = state.model.revision + 1;
    const validation = engine.validateModel(model, transactionClock);
    required(validation.ok, validation.issues.map(x => x.message).join(' '));
    // Compute before swapping state: unexpected engine errors must not partially commit.
    const evaluation = engine.evaluatePlan(model, {additionalDates:[],clock:transactionClock});
    if (requirePassing && !passes(evaluation)) {
      state.batch=null;
      results={runtime:'READY',evaluation,search:null,error:null};
      state.notice='Acceptance blocked by the final evaluation. No dates were committed or saved.';
      return false;
    }
    // All persisted mutations (not just release callbacks) use the same
    // save-before-state-swap guard. Failed writes cannot create a phantom
    // snapshot, edit, or deleted commitment in the running UI.
    const saved=state.mode==='demo'
      ? {status:'DEMO_MEMORY',message:'Synthetic demo; fixed clock; changes are in memory only.'}
      : saveModel(storage,model,release,{expectedRevision:state.model.revision,expectedModelId:state.model.id});
    state.persistence=saved;
    if(saved.status==='FAILED') {
      state.notice='Acceptance failed because the complete change could not be saved. Nothing was committed.';
      return false;
    }
    witnesses.clear();
    state.model = model; state.release = release; stagedRevision=null;
    state.batch = null; state.manualDates = [];
    state.notice = 'Updated; previous suggestions cleared. Commitments are retained for review.';
    results = {runtime:'READY',evaluation,search:null,error:null};
    return true;
  }
  function guarded(action) {
    return payload => { try { action(payload); } catch(error) { fail(error); } emit(); };
  }
  function future(session) {
    const c = now();
    required(session.date > c.date || (session.date === c.date && session.start > c.time), 'Only not-yet-started future meetings can be edited. Update completed-day attendance first.');
  }
  function holiday(m, date, confirmed) {
    if (m.schedule.holidays.some(h => h.date === date)) {
      required(confirmed || m.schedule.holidayTeachingDates.includes(date), 'Confirm that teaching occurs on this holiday.');
      if (!m.schedule.holidayTeachingDates.includes(date)) m.schedule.holidayTeachingDates.push(date);
    }
  }
  // Strict atomic path for the new release features. No durable or in-memory
  // acceptance until a complete validated single-envelope write succeeds.
  function commitRelease(candidateModel, candidateRelease, transactionClock) {
    const previous=state.model;
    required(previous,'Create a setup first.');
    const model=copy(candidateModel),release=copy(candidateRelease);
    model.revision=previous.revision+1;
    const validation=engine.validateModel(model,transactionClock);
    required(validation.ok,validation.issues.map(x=>x.message).join(' '));
    validateRelease(release,model);
    const evaluation=engine.evaluatePlan(model,{additionalDates:[],clock:transactionClock});
    const saved=state.mode==='demo'
      ? {status:'DEMO_MEMORY',message:'Demo changes never overwrite personal storage.'}
      : saveModel(storage,model,release,{expectedRevision:previous.revision,expectedModelId:previous.id});
    if(saved.status==='FAILED') {
      state.persistence=saved;
      return {ok:false,code:'PERSISTENCE_FAILED',modelRevision:previous.revision,
        engineStatus:null,issues:[{code:'PERSISTENCE_FAILED',message:saved.message}]};
    }
    witnesses.clear();
    state.model=model;state.release=release;state.persistence=saved;
    state.batch=null;state.manualDates=[];stagedRevision=null;
    results={runtime:'READY',evaluation,search:null,error:null};
    return {ok:true,code:'COMMITTED',modelRevision:model.revision,
      engineStatus:evaluation.status,issues:[]};
  }
  function releaseOperation(fn) {
    return request => {
      let response;
      try { response=fn(request); }
      catch(error) {
        // Do not use fail(): that would hide last valid evaluation as if it were corrupt.
        state.notice=error.message;
        const code=/^([A-Z][A-Z0-9_]+):/.exec(error.message)?.[1]??'REJECTED';
        response={ok:false,code,modelRevision:state.model?.revision??null,
          engineStatus:results.evaluation?.status??null,issues:[{code,message:error.message}]};
      }
      emit();
      return copy(response);
    };
  }
  const sameJSON=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
  // B produces new journal entries; only A may accept and persist them.
  // Refuse worker responses that rewrite history, forget an occurrence, or
  // supply records that differ from what the student explicitly confirmed.
  function verifyDayJournal(previous, candidate, request, model, transactionClock) {
    const old=previous.attendance, next=candidate.attendance;
    for(const key of ['records','closedDays','reconciliationIssues'])
      required(Array.isArray(next[key]) && next[key].length>=old[key].length &&
        old[key].every((row,i)=>sameJSON(row,next[key][i])),
        `Daily worker cannot rewrite existing ${key}.`);
    required(sameJSON(old.officialSnapshotIds,next.officialSnapshotIds),
      'Daily worker cannot alter official snapshot history.');
    const newRecords=next.records.slice(old.records.length);
    const newDays=next.closedDays.slice(old.closedDays.length);
    required(newDays.length===1 && newRecords.length===request.marks.length,
      'Daily worker must append exactly one complete day and one record per mark.');
    const day=newDays[0];
    required(day.dayKey===request.dayKey && day.date===request.date &&
      day.noUnlistedMeetings===true && day.sourceModelRevision===model.revision &&
      day.supersedesDayKey===(request.correctionOfDayKey??null) &&
      sameJSON(day.confirmedAt,transactionClock),
      'Daily worker returned an inconsistent completed-day attestation.');
    required(unique(day.recordIds) && day.recordIds.length===newRecords.length &&
      newRecords.every(r=>day.recordIds.includes(r.recordId)),
      'Daily closure and appended record IDs do not match.');
    const priorDay=request.correctionOfDayKey
      ? old.closedDays.find(d=>d.dayKey===request.correctionOfDayKey) : null;
    const priorByOccurrence=new Map((priorDay?.recordIds??[]).map(id=>{
      const record=old.records.find(r=>r.recordId===id);return [record.occurrenceId,record];
    }));
    const marks=new Map(request.marks.map(mark=>[mark.occurrenceId,mark]));
    required(marks.size===request.marks.length,'Duplicate attendance mark.');
    for(const row of newRecords){
      const mark=marks.get(row.occurrenceId);
      const meeting=model.sessions.find(s=>s.id===row.occurrenceId);
      const prior=priorByOccurrence.get(row.occurrenceId);
      required(mark && meeting && row.dayKey===request.dayKey &&
        row.date===request.date && row.registerId===mark.registerId &&
        row.weight===meeting.weight && row.disposition===mark.disposition &&
        row.note===mark.note && row.sourceModelRevision===model.revision &&
        sameJSON(row.confirmedAt,transactionClock) &&
        row.supersedesRecordId===(prior?.recordId??null) &&
        row.recordRevision===(prior?prior.recordRevision+1:1),
        `Daily worker record does not match the confirmed occurrence ${row.occurrenceId}.`);
    }
  }
  function stableHistory(oldModel,newModel,allowAttendanceDerived=false,transactionClock=null) {
    for(const key of ['id','schemaVersion','timeZone','context','courses','registers','commitments','preferences'])
      required(sameJSON(oldModel[key],newModel[key]),`Release update cannot modify ${key}.`);
    required(Array.isArray(newModel.snapshots) && newModel.snapshots.length>=oldModel.snapshots.length &&
      oldModel.snapshots.every((v,i)=>sameJSON(v,newModel.snapshots[i])), 'Cannot rewrite any saved snapshot.');
    if(!allowAttendanceDerived) {
      required(sameJSON(oldModel.snapshots,newModel.snapshots), 'Calendar revision cannot change snapshots.');
      required(sameJSON(oldModel.attendanceConfirmation,newModel.attendanceConfirmation), 'Calendar revision cannot advance attendance.');
      const c=transactionClock;
      required(c,'Transaction clock required for historical comparison.');
      const recorded=new Set((state.release?.attendance?.records??[]).map(r=>r.occurrenceId));
      const fixedThrough=oldModel.snapshots.at(-1).date;
      for(const field of ['holidays','replacements']) {
        const oldPast=oldModel.schedule[field].filter(r=>r.date<=fixedThrough);
        const newPast=newModel.schedule[field].filter(r=>r.date<=fixedThrough);
        required(sameJSON(oldPast,newPast),`Cannot alter confirmed historical ${field}.`);
      }
      required(sameJSON(oldModel.schedule.holidayTeachingDates.filter(d=>d<=fixedThrough),
        newModel.schedule.holidayTeachingDates.filter(d=>d<=fixedThrough)),
        'Cannot alter historical teaching-on-holiday confirmations.');
      for(const old of oldModel.events) {
        const linked=old.sessionId?oldModel.sessions.find(s=>s.id===old.sessionId):null;
        const eventDate=old.date??linked?.date;
        if(eventDate && (eventDate<=fixedThrough || eventDate<c.date))
          required(sameJSON(old,newModel.events.find(e=>e.id===old.id)),
            `Cannot silently modify historical compulsory event ${old.id}.`);
      }
      for(const old of oldModel.sessions)if(old.date<=oldModel.snapshots.at(-1).date ||
          old.date<c.date || old.date===c.date&&old.start<=c.time || recorded.has(old.id)) {
        const next=newModel.sessions.find(s=>s.id===old.id);
        required(next&&sameJSON(old,next),`Historical attendance occurrence ${old.id} cannot be rewritten by a calendar revision.`);
      }
    } else {
      for(const key of ['schedule','sessions','events'])
        required(sameJSON(oldModel[key],newModel[key]),`Day confirmation cannot rewrite ${key}.`);
    }
  }
  const sameSource = (a,b) => revision?.revisionKey ? revision.revisionKey(a)===revision.revisionKey(b) : sameJSON(a,b);
  // RC-001.4 source crosswalk merge: never discard prior/unselected effects.
  // Importer is pure and cannot stamp, persist or silently rewrite history.
  function mergeSourceRevision(previous, proposal, patch, ids) {
    required(patch?.version === 1 && sameSource(patch.source,proposal.source) &&
      sameSource(patch.scope,proposal.scope) && Array.isArray(patch.links),
      'REVISION_METADATA_INVALID: candidate source/coverage metadata does not match the staged proposal.');
    const expected = new Set(ids), collected = new Set(), incoming = [];
    for (const link of patch.links) {
      required(link && expected.has(link.changeId) && !collected.has(link.changeId),
        'REVISION_METADATA_INVALID: missing, duplicated or unselected source crosswalk.');
      const change = proposal.changes.find(c=>c.changeId===link.changeId);
      const target = ['ADD_SESSION','EDIT_SESSION','CANCEL_SESSION'].includes(change.kind)
        ? change.occurrenceId : change.after?.id ?? change.after?.date ?? change.before?.date;
      required(link.sourceRef===change.changeId && link.kind===change.kind &&
        link.targetId===target && sameSource(link.value,change.after) &&
        sameSource(link.evidence,change.evidence),
        'REVISION_METADATA_INVALID: source crosswalk is inconsistent with reviewed change.');
      incoming.push({...copy(link),sourceSha256:proposal.source.sha256});
      collected.add(link.changeId);
    }
    required(collected.size===expected.size,
      'REVISION_METADATA_INVALID: candidate omitted an accepted source crosswalk.');
    const priorLinks = Array.isArray(previous?.links) ? previous.links : [];
    const changedTargets=new Set(incoming.map(l=>`${l.kind}:${l.targetId}`));
    const retained=priorLinks.filter(l=>!changedTargets.has(`${l.kind}:${l.targetId}`)).map(copy);
    // A historical source link may predate per-link SHA tracking. Explicitly
    // bind it to the prior source; never infer that it came from this new file.
    for (const l of retained) l.sourceSha256 ??= previous.sha256;
    const oldSource=previous?.source ?? (previous ? {sha256:previous.sha256,fileName:previous.fileName} : null);
    const history=Array.isArray(previous?.sourceHistory) ? copy(previous.sourceHistory) : [];
    if (oldSource && !history.some(s=>s.sha256===oldSource.sha256 && s.fileName===oldSource.fileName))
      history.push(copy(oldSource));
    return {version:1,sha256:proposal.source.sha256,fileName:proposal.source.fileName,
      source:copy(proposal.source),scope:copy(proposal.scope),links:[...retained,...incoming],sourceHistory:history};
  }
  // Manual event command: branch-owned outcomes, never classified from errors.
  const eventKeys=['id','title','cancelled','sessionId','date','start','end'];
  const exactData=(value,keys)=>{
    if(!value || typeof value!=='object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
    const d=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(d);
    return own.length===keys.length && keys.every(k=>d[k]?.enumerable && Object.hasOwn(d[k],'value'));
  };
  function clockIssues(c) {
    if(!validClock(c))return {code:'VALIDATION_REJECTED',reason:'INVALID_CLOCK'};
    try {
      const v=engine.validateModel(state.model,{date:'9999-12-31',time:'23:59',timeZone:'Asia/Kolkata'});
      if(!v.ok)return {code:'VALIDATION_REJECTED',reason:'INVALID_RETAINED_MODEL',issues:v.issues};
      validateRelease(state.release,state.model);
    }catch{return {code:'VALIDATION_REJECTED',reason:'INVALID_RETAINED_RECORD'};}
    const rows=[];
    const add=(clock,path,kind)=>rows.push({clock,path,kind});
    state.model.snapshots.forEach((r,i)=>add(r.confirmedAt,`model.snapshots[${i}].confirmedAt`,'SNAPSHOT'));
    state.release.attendance.records.forEach((r,i)=>add(r.confirmedAt,`release.attendance.records[${i}].confirmedAt`,'ATTENDANCE'));
    state.release.attendance.closedDays.forEach((r,i)=>add(r.confirmedAt,`release.attendance.closedDays[${i}].confirmedAt`,'DAY_CLOSE'));
    state.release.calendar.appliedRevisions.forEach((r,i)=>add(r.appliedAt,`release.calendar.appliedRevisions[${i}].appliedAt`,'CALENDAR_REVISION'));
    for(const [path,value] of [['results.evaluation',results.evaluation],['results.search.evaluation',results.search?.evaluation],['state.batch',state.batch],['state.batch.evaluation',state.batch?.evaluation]])if(value?.evaluatedAt)add(value.evaluatedAt,path+'.evaluatedAt','DECISION_OBSERVATION');
    if(rows.some(r=>!validClock(r.clock)))return {code:'VALIDATION_REJECTED',reason:'INVALID_RETAINED_CLOCK'};
    const later=rows.filter(r=>r.clock.date>c.date || r.clock.date===c.date && r.clock.time>c.time);
    if(state.model.snapshots.some(r=>r.date>c.date) || later.length)return {code:'CLOCK_CONFLICT',reason:'RETAINED_CLOCK',offending:later,capturedClock:copy(c)};
    try {const current=engine.validateModel(state.model,c);if(!current.ok)return {code:'VALIDATION_REJECTED',reason:'CURRENT_MODEL_INVALID',issues:current.issues};}
    catch{return {code:'VALIDATION_REJECTED',reason:'CURRENT_MODEL_VALIDATION'};}
    return null;
  }
  function eventTarget(e) {
    if(!exactData(e,eventKeys) || typeof e.id!=='string'||!e.id.trim() || typeof e.title!=='string'||!e.title.trim()||typeof e.cancelled!=='boolean')return null;
    if(e.sessionId===null)return validDate(e.date)&&validTime(e.start)&&validTime(e.end)&&e.start<e.end?{date:e.date,start:e.start,occurrenceId:null}:null;
    if(typeof e.sessionId!=='string'||e.date!==null||e.start!==null||e.end!==null)return null;
    const row=state.model.sessions.find(r=>r.id===e.sessionId);
    return row?{date:row.date,start:row.start,occurrenceId:row.id}:null;
  }
  function historyTarget(target,side,eventId,c) {
    const baseline=state.model.snapshots.reduce((d,r)=>r.date>d?r.date:d,'');
    let reason=null;
    if(target.date<=baseline)reason='SNAPSHOT_COVERED';
    else if(target.date<c.date)reason='PAST_DATE';
    else if(target.date===c.date && target.start<=c.time)reason='STARTED';
    else if(target.occurrenceId && (state.release.attendance.records.some(r=>r.occurrenceId===target.occurrenceId)||state.release.attendance.closedDays.some(d=>d.recordIds.some(id=>state.release.attendance.records.some(r=>r.recordId===id&&r.occurrenceId===target.occurrenceId)))))reason='CONFIRMED_OCCURRENCE';
    return reason?{side,eventId,...target,reason,baseline}:null;
  }
  function ownership(eventId) {
    const cal=state.release.calendar,source=cal.sourceRevision;
    let ambiguous=false,bound=false;
    if(!source)ambiguous=cal.appliedRevisions.length>0 || state.model.context.sourceLabel.startsWith(IMPORT_SOURCE_PREFIX);
    else if(source.version!==1)ambiguous=true;
    else {
      if(state.model.context.sourceLabel.startsWith(IMPORT_SOURCE_PREFIX))ambiguous=true; // original import has no durable event crosswalk
      for(const link of source.links) {
        if(link.kind==='UPSERT_EVENT' && link.targetId===eventId)bound=true;
        let resolved;
        if(['ADD_SESSION','EDIT_SESSION','CANCEL_SESSION'].includes(link.kind))resolved=state.model.sessions.some(r=>r.id===link.targetId);
        else if(link.kind==='UPSERT_EVENT')resolved=state.model.events.some(r=>r.id===link.targetId);
        else if(link.kind==='ADD_HOLIDAY')resolved=state.model.schedule.holidays.some(r=>r.date===link.targetId);
        else if(link.kind==='REMOVE_HOLIDAY')resolved=link.value===null&&!state.model.schedule.holidays.some(r=>r.date===link.targetId);
        else if(link.kind==='REPLACE_PATTERN')resolved=state.model.schedule.replacements.some(r=>r.date===link.targetId);
        else if(link.kind==='TEACHING_END')resolved=state.model.schedule.teachingEnd===link.targetId;
        else resolved=false;
        if(!resolved)ambiguous=true;
      }
    }
    return {bound,ambiguous};
  }
  function manualEvent(request) {
    const done=(code,details={})=>{
      const ok=['COMMITTED','DEMO_APPLIED','NO_CHANGE'].includes(code);
      const messages={NO_CHANGE:'No change. No save was attempted.',SOURCE_CHANGE_BLOCKED:'This event has retained source evidence. Source changes require review.',SOURCE_REVIEW_REQUIRED:details.reason==='DATASET_SOURCE_RESTRICTION'?'Source history is incomplete; changes to existing events are temporarily blocked.':"This event’s local entry cannot be established in this session.",HISTORY_PROTECTED:'Historical correction is unsupported; the old or proposed event is protected.',CLOCK_CONFLICT:'The clock precedes retained facts or decisions. Review the clock and explicitly revalidate.',STALE_REVISION:'This draft has an older model or revision. Refresh and review before submitting again.',PERSISTENCE_FAILED:'The complete change could not be saved. Accepted data and draft are retained.',VALIDATION_REJECTED:'The event command or retained data is invalid.',COMMITTED:'Event saved in this browser. Local edit permission expires on reload, mode switch or another kind of change.',DEMO_APPLIED:'Demo event applied in memory only.'};
      if(code==='CLOCK_CONFLICT')state.clockConflict=copy(details);
      if(['COMMITTED','DEMO_APPLIED','NO_CHANGE'].includes(code))state.clockConflict=null;
      state.notice=messages[code]??'Event command rejected.';
      const result={ok,code,effect:code==='COMMITTED'||code==='DEMO_APPLIED'?'MUTATED':'NONE',commitState:code==='COMMITTED'?'DURABLE':code==='DEMO_APPLIED'?'MEMORY_ONLY':'NONE',modelRevision:state.model?.revision??null,...details};
      state.eventCommandResult=copy(result);emit();return copy(result);
    };
    try {
      const keys=['requestVersion','mode','expectedModelId','expectedModelRevision','operation','targetEventId','event'];
      if(!exactData(request,keys)||request.requestVersion!==1||!['personal','demo'].includes(request.mode)||typeof request.expectedModelId!=='string'||!request.expectedModelId.trim()||!Number.isSafeInteger(request.expectedModelRevision)||request.expectedModelRevision<0||!['CREATE','UPDATE'].includes(request.operation)||!exactData(request.event,eventKeys))return done('VALIDATION_REJECTED',{reason:'REQUEST_PROFILE'});
      if(request.operation==='CREATE'?request.targetEventId!==null:typeof request.targetEventId!=='string'||!request.targetEventId.trim())return done('VALIDATION_REJECTED',{reason:'TARGET_PROFILE'});
      const e=request.event;
      if(typeof e.id!=='string'||!e.id.trim()||typeof e.title!=='string'||!e.title.trim()||typeof e.cancelled!=='boolean'||(e.sessionId!==null&&typeof e.sessionId!=='string')||request.operation==='UPDATE'&&e.id!==request.targetEventId)return done('VALIDATION_REJECTED',{reason:'EVENT_PROFILE'});
      if(e.sessionId===null ? !validDate(e.date)||!validTime(e.start)||!validTime(e.end)||e.start>=e.end : !e.sessionId.trim()||e.date!==null||e.start!==null||e.end!==null)return done('VALIDATION_REJECTED',{reason:'EVENT_UNION'});
      if(!state.model)return done('VALIDATION_REJECTED',{reason:'NO_SETUP'});
      if(request.mode!==state.mode||request.expectedModelId!==state.model.id||request.expectedModelRevision!==state.model.revision)return done('STALE_REVISION');
      const c=copy(now()),conflict=clockIssues(c);if(conflict)return done(conflict.code,conflict);
      const old=state.model.events.find(r=>r.id===e.id),target=eventTarget(e);
      if(!target || (request.operation==='CREATE'?!!old:!old))return done('VALIDATION_REJECTED',{reason:'EVENT_REFERENCE'});
      const before=old?eventTarget(old):null;if(old&&!before)return done('VALIDATION_REJECTED',{reason:'OLD_REFERENCE'});
      if(old && equalJSON(old,e))return done('NO_CHANGE');
      const protectedTarget=(before&&historyTarget(before,'OLD',e.id,c))||historyTarget(target,'NEW',e.id,c);
      if(protectedTarget)return done('HISTORY_PROTECTED',{history:protectedTarget});
      if(old) {
        const source=ownership(e.id);
        if(source.bound)return done('SOURCE_CHANGE_BLOCKED');
        if(source.ambiguous)return done('SOURCE_REVIEW_REQUIRED',{reason:'DATASET_SOURCE_RESTRICTION'});
        const witness=witnesses.get(e.id);
        if(!witness || witness.mode!==state.mode||witness.modelId!==state.model.id||witness.revision!==state.model.revision||!equalJSON(witness.value,old))return done('SOURCE_REVIEW_REQUIRED',{reason:'LOCAL_ORIGIN_UNPROVEN'});
      }
      const model=copy(state.model),release=copy(state.release);
      if(old)model.events[model.events.findIndex(r=>r.id===e.id)]=copy(e);else model.events.push(copy(e));
      model.revision++;
      if(!Number.isSafeInteger(model.revision))return done('VALIDATION_REJECTED',{reason:'REVISION_OVERFLOW'});
      let evaluation;
      try{const v=engine.validateModel(model,c);if(!v.ok)return done('VALIDATION_REJECTED',{issues:v.issues});validateRelease(release,model);evaluation=engine.evaluatePlan(model,{additionalDates:[],clock:c});}
      catch{return done('VALIDATION_REJECTED',{reason:'CANDIDATE_EVALUATION'});}
      let saved;
      if(state.mode==='personal') {
        try{saved=saveModel(storage,model,release,{expectedRevision:state.model.revision,expectedModelId:state.model.id});}catch{return done('PERSISTENCE_FAILED',{reason:'UNCLASSIFIED'});}
        if(saved?.code!=='SAVE_OK'||saved.status!=='SAVED') {
          const code=saved?.code==='PERSISTED_CONFLICT'?'STALE_REVISION':saved?.code==='CANDIDATE_INVALID'?'VALIDATION_REJECTED':'PERSISTENCE_FAILED';
          return done(code,{persistence:saved??null});
        }
      } else saved={status:'DEMO_MEMORY',message:'Demo changes are in memory only.'};
      for(const [id,w] of witnesses) {
        if(w.mode!==state.mode||w.modelId!==model.id||!equalJSON(w.value,state.model.events.find(r=>r.id===id)))witnesses.delete(id);
        else w.revision=model.revision;
      }
      witnesses.set(e.id,{mode:state.mode,modelId:model.id,revision:model.revision,value:copy(e)});
      state.model=model;state.release=release;state.persistence=saved;state.batch=null;state.manualDates=[];stagedRevision=null;
      results={runtime:'READY',evaluation,search:null,error:null};
      return done(state.mode==='demo'?'DEMO_APPLIED':'COMMITTED',{engineStatus:evaluation.status});
    } catch{return done('VALIDATION_REJECTED',{reason:'COMMAND_INSPECTION'});}
  }
  const callbacks = {
    onEnterDemo: guarded(() => {
      if (state.mode === 'demo') return;
      witnesses.clear();personal = copy(state);stagedRevision=null;
      state = {...state, clockConflict:null,mode:'demo',model:makeDemoModel(),release:makeEmptyRelease(makeDemoModel()),month:FIXED_CLOCK.date.slice(0,7),selectedDate:null,manualDates:[],batch:null,notice:'DEMO ONLY — clock fixed at 2 November 2026, 08:00 IST.',persistence:{status:'DEMO_MEMORY',message:'Demo changes never overwrite personal storage.'}};
      evaluate();
    }),
    onExitDemo: guarded(() => {
      if (personal) {
        witnesses.clear();state = personal; personal = null;
        const evaluation=evaluate(state.batch?.dates ?? []);
        if (!passes(evaluation)) state.batch=null;
      }
    }),
    onReplaceSetup: guarded(({model}) => {
      required(!state.model, 'Setup replacement is allowed only before initialization. Use update actions to preserve history and commitments.');
      const transactionClock=copy(now());
      const candidate = copy(model);
      required(candidate.snapshots.length === 1 && candidate.commitments.length === 0, 'A new setup starts with one confirmed snapshot and no commitments.');
      candidate.revision = 0;
      // This is a newly confirmed setup, not an import of historical attestations.
      candidate.snapshots[0].confirmedAt=copy(transactionClock);
      if (!candidate.schedule.initialized) {
        const expanded = engine.expandSchedule({schedule:candidate.schedule,courses:candidate.courses,registers:candidate.registers,extraSessions:candidate.sessions,overrides:[]});
        required(expanded.ok,expanded.issues.map(x=>x.message).join(' '));
        candidate.sessions = expanded.sessions; candidate.schedule.initialized = true;
      }
      const check = engine.validateModel(candidate,transactionClock);
      required(check.ok,check.issues.map(x=>x.message).join(' '));
      const evaluation=engine.evaluatePlan(candidate,{additionalDates:[],clock:transactionClock});
      const release=makeEmptyRelease(candidate);
      const saved=state.mode==='demo'?{status:'DEMO_MEMORY',message:'Demo changes never overwrite personal storage.'}
        :saveModel(storage,candidate,release,{expectedRevision:null});
      if(saved.status==='FAILED') {state.persistence=saved;state.notice='Initial setup could not be persisted; no setup was accepted.';return;}
      witnesses.clear();state.model = candidate;state.release=release;stagedRevision=null; state.month = transactionClock.date.slice(0,7);
      results={runtime:'READY',evaluation,search:null,error:null};state.persistence=saved;
    }),
    onInitializeSchedule: guarded(({draft}) => transact(m => {
      required(!m.schedule.initialized, 'Recurring schedule already initialized; edit individual future meetings.');
      required(sameRoster(m.courses,draft.courses) && sameRoster(m.registers,draft.registers), 'Schedule draft courses and registers must exactly match the existing roster. Initialize the full roster through initial setup instead.');
      const expanded = engine.expandSchedule(draft);
      required(expanded.ok,expanded.issues.map(x=>x.message).join(' '));
      m.schedule = {...copy(draft.schedule),initialized:true}; m.sessions = expanded.sessions;
    })),
    onSetPreferences: guarded(preferences => transact(m => { m.preferences = copy(preferences); })),
    onSetThreshold: guarded(({registerId,requiredBps,personalMinBps,bufferBps}) => transact(m => {
      const r = m.registers.find(x => x.id === registerId); required(r, 'Unknown register.');
      Object.assign(r,{requiredBps,personalMinBps,bufferBps});
    })),
    onSetCourseProtection: guarded(({courseId,mustAttend}) => transact(m => {
      const course = m.courses.find(c=>c.id===courseId); required(course,'Unknown course.'); course.mustAttend = mustAttend;
    })),
    onConfirmSnapshot: guarded(({date,counts,confirmed,completeToday}) => {
      required(state.model && confirmed === true, 'Explicit official snapshot confirmation is required.');
      const transactionClock=now();
      const latest=state.model.snapshots.at(-1);
      required(date>=latest.date, 'REQUIRES_CHRONOLOGICAL_OFFICIAL_SNAPSHOT: official date cannot predate the last derived or official snapshot.');
      const sequence=latest.sequence+1;
      const officialSnapshot={id:`${state.model.id}:snapshot:${sequence}`,sequence,date,
        counts:copy(counts),confirmed:true,completeToday,confirmedAt:copy(transactionClock)};
      // Existing controller-only harnesses remain supported for legacy empty
      // journals. Real browser app injects B and always uses its cutover logic.
      if (!attendance?.reconcileOfficialSnapshot) {
        required(state.release.attendance.records.length===0 && state.release.attendance.closedDays.length===0,
          'ATTENDANCE_ADAPTER_MISSING: cannot reconcile existing daily history without B.');
        transact((m,c,release) => {
          m.snapshots.push({...officialSnapshot,confirmedAt:copy(c)});
          release.attendance.officialSnapshotIds.push(officialSnapshot.id);
          m.attendanceConfirmation={throughDate:date,noUnlistedClasses:true};
        });
        return;
      }
      const proposed=attendance.reconcileOfficialSnapshot({previousModel:copy(state.model),
        journal:copy(state.release.attendance),officialSnapshot,clock:transactionClock});
      required(proposed?.ok,
        `${proposed?.code??'OFFICIAL_RECONCILIATION_FAILED'}: ${(proposed?.issues??[]).map(x=>x.message).join(' ')}`);
      stableHistory(state.model,proposed.proposedModel,true,transactionClock);
      const newSnapshots=proposed.proposedModel.snapshots;
      required(newSnapshots.length===state.model.snapshots.length+1 &&
        sameJSON(newSnapshots.at(-1),officialSnapshot),
        'Official reconciliation cannot rewrite snapshots or alter the authoritative attestation.');
      const release=copy(state.release),old=release.attendance;
      const next=proposed.proposedJournal;
      required(sameJSON(old.records,next.records) && sameJSON(old.closedDays,next.closedDays) &&
        next.officialSnapshotIds.length===old.officialSnapshotIds.length+1 &&
        old.officialSnapshotIds.every((id,i)=>next.officialSnapshotIds[i]===id) &&
        next.officialSnapshotIds.at(-1)===officialSnapshot.id &&
        next.reconciliationIssues.length>=old.reconciliationIssues.length &&
        old.reconciliationIssues.every((msg,i)=>next.reconciliationIssues[i]===msg),
        'Official reconciliation must preserve the complete confirmed attendance journal.');
      release.attendance=copy(next);
      const committed=commitRelease(proposed.proposedModel,release,transactionClock);
      if(!committed.ok) {
        state.notice='Official snapshot was not accepted; persistence failed without changing history.';
        return;
      }
      state.notice=next.reconciliationIssues.length>old.reconciliationIssues.length
        ? 'Official baseline superseded derived totals; attendance discrepancy or incomplete interval retained for review.'
        : 'Official attendance baseline saved; earlier daily records retained for audit.';
    }),
    onConfirmGap: guarded(confirmation => transact(m => {m.attendanceConfirmation=copy(confirmation);})),
    onSetTeachingEnd: guarded(({date,confirmed}) => transact(m => {m.schedule.teachingEnd=date;m.schedule.confirmed=confirmed;})),
    onAddSession: guarded(({session,teachingOnHolidayConfirmed}) => transact(m => {
      future(session); required(!m.sessions.some(x=>x.id===session.id),'Session ID already exists.');
      holiday(m,session.date,teachingOnHolidayConfirmed);m.sessions.push(copy(session));
    })),
    onEditSession: guarded(({sessionId,changes,teachingOnHolidayConfirmed}) => transact(m => {
      const s = m.sessions.find(x=>x.id===sessionId);required(s,'Unknown session.'); future(s);
      const allowed = ['date','start','end','registerId','weight','protected','cancelled'];
      required(Object.keys(changes).every(k=>allowed.includes(k)), 'Session ID and origin cannot be changed.');
      Object.assign(s,copy(changes));future(s); if (!s.cancelled) holiday(m,s.date,teachingOnHolidayConfirmed);
    })),
    onUpsertEvent: manualEvent,
    onUncommit: guarded(({commitmentId}) => transact(m => {
      required(m.commitments.some(x=>x.id===commitmentId),'Unknown commitment.');
      m.commitments=m.commitments.filter(x=>x.id!==commitmentId);
    })),
    onSelectDate: guarded(({date}) => {state.selectedDate=date;}),
    onSetMonth: guarded(({month}) => {required(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Invalid month.');state.month=month;}),
    onSetManualDates: guarded(({dates}) => {
      // A rejected new selection must not leave an older selection available to check.
      state.manualDates=[];state.batch=null;
      required(unique(dates),'Select unique dates.');state.manualDates=copy(dates);evaluate();
    }),
    onCheckManual: guarded(() => {
      const conflict=state.model&&clockIssues(now());if(conflict){state.clockConflict=copy(conflict);state.notice=conflict.code+': Explicit revalidation required.';return;}
      state.clockConflict=null;
      const evaluation = evaluate(state.manualDates);
      state.batch = passes(evaluation) && state.manualDates.length ? {modelRevision:state.model.revision,evaluatedAt:now(),dates:copy(state.manualDates),evaluation} : null;
      state.notice = state.batch ? 'Manual dates checked together. Explicit acceptance is still required.' : 'No passing manual selection to accept.';
    }),
    onSuggest: guarded(() => {
      const conflict=state.model&&clockIssues(now());if(conflict){state.clockConflict=copy(conflict);state.notice=conflict.code+': Explicit revalidation required.';return;}
      state.clockConflict=null;
      required(state.model,'Create a setup first.');
      const search = engine.suggestPlan(state.model,{clock:now()});
      results={runtime:'READY',evaluation:search.evaluation,search,error:null};
      state.batch = search.batch && passes(search.batch.evaluation) ? copy(search.batch) : null;
      state.notice=search.search.requested===null ? 'Invalid request. Correct the setup issues before searching.' : `Found ${search.search.found} days using this search; requested ${search.search.requested}.`;
    }),
    onAccept: guarded(({dates,modelRevision}) => {
      required(state.batch && state.model,'No current checked batch to accept.');
      if(state.clockConflict){state.notice='CLOCK_CONFLICT: Explicit revalidation required before accepting.';return;}
      const conflict=clockIssues(now());if(conflict){state.clockConflict=copy(conflict);state.notice=conflict.code+': Explicit revalidation required.';return;}
      required(modelRevision===state.model.revision && modelRevision===state.batch.modelRevision,'Stale suggestion revision. Generate a new batch.');
      required(unique(dates) && dates.length>0 && dates.every(d=>state.batch.dates.includes(d)), 'Accept a unique nonempty subset of the displayed batch.');
      const evaluation=engine.evaluatePlan(state.model,{additionalDates:dates,clock:now()});
      if (!passes(evaluation)) {
        state.batch=null; results={runtime:'READY',evaluation,search:null,error:null};state.notice='Acceptance blocked after current-time revalidation. No dates were committed.';return;
      }
      const committed=transact(m => {
        for(const date of dates) m.commitments.push({id:`${m.id}:commit:${m.revision+1}:${date}`,date,createdAtRevision:m.revision+1});
      },{requirePassing:true});
      if (committed) state.notice='Selected dates committed together. Other future sessions are assumed attended.';
    }),
    onConfirmAttendanceDay: releaseOperation(request => {
      required(state.model,'Create a setup first.');
      required(typeof request?.dayKey==='string' && request.dayKey &&
        /^\d{4}-\d{2}-\d{2}$/.test(request.date) && Array.isArray(request.marks),
        'Day confirmation requires a valid date, durable day key and marks.');
      required(request.confirmCompleteDay===true && request.confirmNoUnlistedMeetings===true,
        'Explicit complete-day and no-unlisted-meetings confirmations are required.');
      const previousDay=state.release.attendance.closedDays.find(d=>d.dayKey===request.dayKey);
      if(previousDay) {
        const actual=previousDay.recordIds.map(id=>state.release.attendance.records.find(r=>r.recordId===id));
        const original=actual.map(r=>[r.occurrenceId,r.registerId,r.disposition,r.note]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
        const incoming=request.marks.map(r=>[r.occurrenceId,r.registerId,r.disposition,r.note]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
        required(previousDay.date===request.date &&
          previousDay.supersedesDayKey===(request.correctionOfDayKey??null) &&
          request.confirmCompleteDay===true && request.confirmNoUnlistedMeetings===true &&
          sameJSON(original,incoming),'IDEMPOTENCY_CONFLICT: dayKey was already used with different attendance evidence.');
        return {ok:true,code:'ALREADY_CONFIRMED',modelRevision:state.model.revision,
          dayKey:request.dayKey,snapshotId:null,registerTotals:null,
          engineStatus:results.evaluation?.status??null,issues:[]};
      }
      required(request.expectedModelRevision===state.model.revision,
        'STALE_MODEL_REVISION: attendance draft must be refreshed.');
      const closedSameDate=state.release.attendance.closedDays.filter(d=>d.date===request.date);
      if(!closedSameDate.length) {
        const snapshotDate=state.model.snapshots.at(-1).date;
        const nextDate=new Date(Date.parse(`${snapshotDate}T00:00:00Z`)+86400000).toISOString().slice(0,10);
        required(request.date===nextDate,
          `UNRESOLVED_GAP: first confirm the entire day ${nextDate} before advancing attendance.`);
      }
      if(closedSameDate.length) {
        const superseded=new Set(closedSameDate.map(d=>d.supersedesDayKey).filter(Boolean));
        required(typeof request.correctionOfDayKey==='string' &&
          closedSameDate.some(d=>d.dayKey===request.correctionOfDayKey && !superseded.has(d.dayKey)),
          'A previously confirmed day needs an explicit correction reference and a new dayKey.');
        const officialDates=state.model.snapshots.filter(s=>state.release.attendance.officialSnapshotIds.includes(s.id)).map(s=>s.date);
        required(request.date>officialDates.at(-1), 'REQUIRES_OFFICIAL_RECONCILIATION: correction is at or before the latest official baseline.');
      }
      const meetingRows=state.model.sessions.filter(s=>!s.cancelled && s.date===request.date);
      const expected=new Map(meetingRows.map(s=>[s.id,s]));
      const listed=new Set();
      for(const mark of request.marks){
        required(mark && typeof mark.occurrenceId==='string' && !listed.has(mark.occurrenceId),
          'Duplicate/invalid attendance mark.');
        listed.add(mark.occurrenceId);
        const meeting=expected.get(mark.occurrenceId);
        required(meeting && meeting.registerId===mark.registerId,'Unknown session or register in attendance mark.');
        required(['ATTENDED','MISSED','NOT_HELD'].includes(mark.disposition) && typeof mark.note==='string',
          'Every occurrence must have an explicit completed disposition.');
      }
      required(listed.size===expected.size,'UNRESOLVED_OCCURRENCES: every scheduled noncancelled occurrence needs a mark.');
      const transactionClock=now();
      required(request.date<=transactionClock.date && meetingRows.every(s=>s.date<transactionClock.date || s.end<=transactionClock.time),
        'Cannot confirm the date before every scheduled occurrence has ended.');
      required(attendance && typeof attendance.evaluateDayClose==='function',
        'Daily attendance logic has not been integrated from B.');
      const proposed=attendance.evaluateDayClose({model:copy(state.model),
        journal:copy(state.release.attendance),request:copy(request),clock:transactionClock});
      if(!proposed?.ok) return {ok:false,code:proposed?.code??'DAY_REJECTED',
        modelRevision:state.model.revision,dayKey:null,snapshotId:null,
        registerTotals:null,engineStatus:results.evaluation?.status??null,issues:proposed?.issues??[]};
      required(proposed.idempotent!==true,'Worker cannot claim an unknown day key was already confirmed.');
      required(proposed.proposedModel&&proposed.proposedJournal,'B must return a full proposed model and journal.');
      stableHistory(state.model,proposed.proposedModel,true,transactionClock);
      required(proposed.proposedModel.snapshots.length===state.model.snapshots.length+1 &&
        sameJSON(proposed.proposedModel.snapshots.at(-1).confirmedAt,transactionClock),
        'Daily derived snapshot must be appended exactly once with the authoritative controller clock.');
      const release=copy(state.release);release.attendance=copy(proposed.proposedJournal);
      const oldRecordIds=new Set(state.release.attendance.records.map(r=>r.recordId));
      const oldDayKeys=new Set(state.release.attendance.closedDays.map(d=>d.dayKey));
      required(release.attendance.records.filter(r=>!oldRecordIds.has(r.recordId))
        .every(r=>sameJSON(r.confirmedAt,transactionClock)) &&
        release.attendance.closedDays.filter(d=>!oldDayKeys.has(d.dayKey))
        .every(d=>sameJSON(d.confirmedAt,transactionClock)),
        'New attendance attestations must use the controller transaction clock.');
      const newlyClosed=release.attendance.closedDays.find(d=>d.dayKey===request.dayKey);
      required(newlyClosed && newlyClosed.date===request.date &&
        newlyClosed.supersedesDayKey===(request.correctionOfDayKey??null),
        'Daily worker did not return the confirmed day or correction reference.');
      verifyDayJournal(state.release,release,request,state.model,transactionClock);
      const appended=proposed.proposedModel.snapshots.at(-1);
      const previous=state.model.snapshots.at(-1);
      required(appended.sequence===previous.sequence+1 && appended.confirmed===true &&
        appended.date===(request.correctionOfDayKey ? previous.date : request.date) &&
        sameJSON(proposed.proposedModel.attendanceConfirmation,
          {throughDate:appended.date,noUnlistedClasses:true}),
        'Daily worker snapshot does not advance confirmed attendance consistently.');
      const committed=commitRelease(proposed.proposedModel,release,transactionClock);
      if(!committed.ok) return {...committed,dayKey:null,snapshotId:null,registerTotals:null};
      state.notice='Confirmed daily attendance saved; plan and retained commitments recalculated.';
      return {...committed,code:'DAY_CONFIRMED',dayKey:request.dayKey,
        snapshotId:state.model.snapshots.at(-1).id,registerTotals:proposed.registerTotals??null};
    }),
    onProposeCalendarRevision: releaseOperation(({expectedModelRevision,proposal}) => {
      required(state.model,'Create a setup first.');
      required(expectedModelRevision===state.model.revision,'Stale calendar proposal.');
      required(proposal?.proposalVersion===1 && typeof proposal.proposalId==='string'&&proposal.proposalId &&
        proposal.baseModelRevision===state.model.revision && Array.isArray(proposal.changes) &&
        Array.isArray(proposal.unresolved) && typeof proposal.source?.sha256==='string',
        'Malformed calendar proposal.');
      required(!state.release.calendar.appliedRevisions.some(r=>r.proposalId===proposal.proposalId),
        'This calendar proposal was already applied.');
      const ids=proposal.changes.map(c=>c.changeId);
      required(unique(ids) && ids.every(x=>typeof x==='string'&&x),'Duplicate/invalid proposal change IDs.');
      if(stagedRevision?.proposalId===proposal.proposalId)
        required(sameJSON(stagedRevision,proposal),
          'IDEMPOTENCY_CONFLICT: same proposal ID was reused for different contents.');
      stagedRevision=copy(proposal); // only staging, not a write
      state.notice='Revision staged for explicit review. No teaching or attendance history changed.';
      return {ok:true,code:'REVIEW_REQUIRED',modelRevision:state.model.revision,
        proposalId:proposal.proposalId,changeCount:ids.length,issues:copy(proposal.unresolved)};
    }),
    onApplyCalendarRevision: releaseOperation(request => {
      required(state.model && stagedRevision,'Stage a calendar revision first.');
      if(state.clockConflict)return {ok:false,code:'CLOCK_CONFLICT',modelRevision:state.model.revision,issues:[]};
      const conflict=clockIssues(now());if(conflict)return {ok:false,...conflict,modelRevision:state.model.revision};
      required(request?.confirmation===true && request.confirmedSourceCoverage===true,
        'Explicit revision/source confirmation is required.');
      required(request.expectedModelRevision===state.model.revision &&
        stagedRevision.baseModelRevision===state.model.revision,'Stale calendar proposal.');
      required(request.proposalId===stagedRevision.proposalId,'Wrong staged calendar revision.');
      required(unique(request.acceptedChangeIds) && request.acceptedChangeIds.length>0,
        'Accept a nonempty unique set of reviewed changes.');
      required(request.acceptedChangeIds.every(id=>stagedRevision.changes.some(c=>c.changeId===id)),
        'Unknown proposed calendar change.');
      required(stagedRevision.unresolved.length===0,'Unresolved calendar evidence must be reviewed before applying.');
      required(request.acceptedChangeIds.every(id=>{
        const c=stagedRevision.changes.find(row=>row.changeId===id);
        if(c.match==='AMBIGUOUS' || !c.evidence?.sourceId)return false;
        if(['CANCEL_SESSION','REMOVE_HOLIDAY'].includes(c.kind))
          return c.evidence.basis==='EXPLICIT_CANCELLATION' || c.evidence.basis==='REVIEWED_OFFICIAL_CORRECTION';
        return true;
      }), 'Unreviewed or ambiguous change cannot apply.');
      required(revision && typeof revision.buildRevisionCandidate==='function',
        'Calendar revision adapter has not been integrated from Codex.');
      const transactionClock=now();
      const proposed=revision.buildRevisionCandidate({model:copy(state.model),
        proposal:copy(stagedRevision),acceptedChangeIds:copy(request.acceptedChangeIds),
        historicalResolutions:copy(request.historicalResolutions??[]),clock:transactionClock});
      if(!proposed?.ok) return {ok:false,code:proposed?.code??'REVISION_REJECTED',
        modelRevision:state.model.revision,appliedChangeIds:[],preservedCommitmentIds:[],
        engineStatus:results.evaluation?.status??null,issues:proposed?.issues??[]};
      required(proposed.proposedModel,'Revision adapter must return proposedModel.');
      stableHistory(state.model,proposed.proposedModel,false,transactionClock);
      const nextRelease=copy(state.release);
      nextRelease.calendar.appliedRevisions.push({proposalId:stagedRevision.proposalId,
        sourceSha256:stagedRevision.source.sha256,appliedAt:copy(transactionClock),
        modelRevision:state.model.revision+1,changeIds:copy(request.acceptedChangeIds)});
      nextRelease.calendar.sourceRevision=mergeSourceRevision(state.release.calendar.sourceRevision,
        stagedRevision,proposed.sourceRevisionPatch,request.acceptedChangeIds);
      const committed=commitRelease(proposed.proposedModel,nextRelease,transactionClock);
      if(!committed.ok) return {...committed,appliedChangeIds:[],preservedCommitmentIds:[]};
      state.notice='Calendar revision accepted atomically; retained commitments re-evaluated.';
      return {...committed,code:'REVISION_APPLIED',appliedChangeIds:copy(request.acceptedChangeIds),
        preservedCommitmentIds:state.model.commitments.map(c=>c.id)};
    }),
    onRefresh: guarded((request={}) => {
      if(state.clockConflict && request.explicit!==true){state.notice='CLOCK_CONFLICT: Use Recheck current plan for explicit revalidation.';return;}
      const conflict=state.model&&clockIssues(now());if(conflict){state.clockConflict=copy(conflict);state.notice=conflict.code+': Explicit revalidation required.';return;}
      state.clockConflict=null;
      const evaluation=evaluate(state.batch?.dates ?? []);
      if (!passes(evaluation) || state.batch?.modelRevision!==state.model?.revision) state.batch=null;
    }),
  };
  try {evaluate();} catch(error) {fail(error);}
  emit();
  return {callbacks,getState:projectedState,getResults:()=>copy(results)};
}
