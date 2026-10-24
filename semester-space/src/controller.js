import { PASS_STATUSES } from './shared/constants.js';
import { FIXED_CLOCK, makeDemoModel } from './shared/fixtures.js';
import { loadModel, saveModel } from './storage.js';

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

export function createController({engine, render, storage, clock = currentClock}) {
  const loaded = loadModel(storage, (m,c) => engine.validateModel(m,c), clock());
  let state = {mode:'personal', model:loaded.model, month:clock().date.slice(0,7), selectedDate:null, manualDates:[], batch:null, persistence:loaded.persistence, notice:''};
  let results = {runtime:'NO_SETUP',evaluation:null,search:null,error:null};
  let personal = null;
  const now = () => state.mode === 'demo' ? copy(FIXED_CLOCK) : clock();
  const emit = () => render(copy(state), copy(results), callbacks);
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
  function persist() {
    state.persistence = state.mode === 'demo' ? {status:'DEMO_MEMORY',message:'Synthetic demo; fixed clock; changes are in memory only.'} : saveModel(storage, state.model);
  }
  function transact(update, {requirePassing=false} = {}) {
    required(state.model, 'Create a setup first.');
    const model = copy(state.model);
    const transactionClock=now();
    update(model,transactionClock);
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
    state.model = model;
    state.batch = null; state.manualDates = [];
    state.notice = 'Updated; previous suggestions cleared. Commitments are retained for review.';
    results = {runtime:'READY',evaluation,search:null,error:null}; persist();
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
  const callbacks = {
    onEnterDemo: guarded(() => {
      if (state.mode === 'demo') return;
      personal = copy(state);
      state = {...state, mode:'demo',model:makeDemoModel(),month:FIXED_CLOCK.date.slice(0,7),selectedDate:null,manualDates:[],batch:null,notice:'DEMO ONLY — clock fixed at 2 November 2026, 08:00 IST.',persistence:{status:'DEMO_MEMORY',message:'Demo changes never overwrite personal storage.'}};
      evaluate();
    }),
    onExitDemo: guarded(() => {
      if (personal) {
        state = personal; personal = null;
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
      state.model = candidate; state.month = transactionClock.date.slice(0,7);results={runtime:'READY',evaluation,search:null,error:null};persist();
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
    onConfirmSnapshot: guarded(({date,counts,confirmed,completeToday}) => transact((m,transactionClock) => {
      required(confirmed === true,'Explicit completed-day confirmation is required.');
      const latest = m.snapshots.at(-1); required(!latest || date >= latest.date,'Baseline date cannot regress.');
      const sequence = (latest?.sequence ?? 0) + 1;
      m.snapshots.push({id:`${m.id}:snapshot:${sequence}`,sequence,date,counts:copy(counts),confirmed:true,completeToday,confirmedAt:copy(transactionClock)});
      m.attendanceConfirmation = {throughDate:date,noUnlistedClasses:true};
    })),
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
    onUpsertEvent: guarded(({event}) => transact(m => {
      const index = m.events.findIndex(x=>x.id===event.id);
      if (index < 0) m.events.push(copy(event)); else m.events[index]=copy(event);
    })),
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
      const evaluation = evaluate(state.manualDates);
      state.batch = passes(evaluation) && state.manualDates.length ? {modelRevision:state.model.revision,evaluatedAt:now(),dates:copy(state.manualDates),evaluation} : null;
      state.notice = state.batch ? 'Manual dates checked together. Explicit acceptance is still required.' : 'No passing manual selection to accept.';
    }),
    onSuggest: guarded(() => {
      required(state.model,'Create a setup first.');
      const search = engine.suggestPlan(state.model,{clock:now()});
      results={runtime:'READY',evaluation:search.evaluation,search,error:null};
      state.batch = search.batch && passes(search.batch.evaluation) ? copy(search.batch) : null;
      state.notice=search.search.requested===null ? 'Invalid request. Correct the setup issues before searching.' : `Found ${search.search.found} days using this search; requested ${search.search.requested}.`;
    }),
    onAccept: guarded(({dates,modelRevision}) => {
      required(state.batch && state.model,'No current checked batch to accept.');
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
    onRefresh: guarded(() => {
      const evaluation=evaluate(state.batch?.dates ?? []);
      if (!passes(evaluation) || state.batch?.modelRevision!==state.model?.revision) state.batch=null;
    }),
  };
  try {evaluate();} catch(error) {fail(error);}
  emit();
  return {callbacks,getState:()=>copy(state),getResults:()=>copy(results)};
}
