import { CONTRACT_VERSION } from './constants.js';
// A owns these immutable-by-convention contract fixtures. Call factories for fresh copies.
export const FIXED_CLOCK = Object.freeze({date: '2026-11-02', time: '08:00', timeZone: 'Asia/Kolkata'});
export function makeSession(id, date, registerId = 'lecture', weight = 1, start = '09:00', end = '10:00') {
  return {id, registerId, date, start, end, weight, protected: false, cancelled: false, origin: 'extra', templateId: null};
}
export function makeCombinedModel() {
  return {
    schemaVersion: 1, revision: 0, id: 'synthetic-combined', timeZone: 'Asia/Kolkata',
    context: {college: 'Synthetic college — DEMO ONLY', academicYear: '2026–27', semester: '1', programme: 'Demo programme', section: 'Synthetic', sourceLabel: 'Synthetic; no MAIT policy or timetable claim', preparedOn: '2026-10-23', applicabilityConfirmed: true},
    schedule: {startDate: '2026-11-01', teachingEnd: '2026-11-04', confirmed: true, initialized: true, weeklyTemplates: [], holidays: [], replacements: [], holidayTeachingDates: []},
    courses: [{id: 'physics', name: 'Physics', mustAttend: false}],
    registers: [{id: 'lecture', courseId: 'physics', name: 'Physics lectures', requiredBps: 7500, personalMinBps: null, bufferBps: 300}],
    sessions: [makeSession('s1', '2026-11-02'), makeSession('s2', '2026-11-03')],
    events: [], snapshots: [{id: 'snapshot-1', date: '2026-11-01', counts: {lecture: {attended: 79, held: 100}}, confirmed: true, completeToday: true, confirmedAt: {date: '2026-11-01', time: '20:00', timeZone: 'Asia/Kolkata'}, sequence: 1}],
    commitments: [], attendanceConfirmation: {throughDate: '2026-11-02', noUnlistedClasses: true},
    preferences: {candidateStart: '2026-11-02', candidateEnd: '2026-11-04', preferredDates: [], requestedDays: 2, notes: ''},
  };
}
export function makeRecoveryModel() {
  const m = makeCombinedModel(); m.id = 'synthetic-recovery';
  m.snapshots[0].counts.lecture = {attended: 37, held: 48};
  m.registers.push({id: 'practical', courseId: 'physics', name: 'Physics practical', requiredBps: 7500, personalMinBps: null, bufferBps: 300});
  m.snapshots[0].counts.practical = {attended: 10, held: 10};
  m.sessions.push(makeSession('p1', '2026-11-02', 'practical', 1, '11:00', '12:00'));
  m.sessions.find(s => s.id === 's2').date = '2026-11-04';
  // This practical-only day is before lecture recovery and can still be missed.
  m.sessions.push(makeSession('p2', '2026-11-03', 'practical'));
  return m;
}
export function makeDemoModel() {
  const m = makeCombinedModel(); m.id = 'synthetic-demo';
  m.schedule.teachingEnd = '2026-11-20';
  m.preferences.candidateEnd = '2026-11-10';
  m.snapshots[0].counts.lecture = {attended: 90, held: 100};
  m.sessions = Array.from({length: 15}, (_, i) => makeSession(`demo-${i+1}`, `2026-11-${String(i+2).padStart(2,'0')}`));
  m.schedule.holidays = [{date: '2026-11-18', label: 'Synthetic holiday'}];
  m.events = [{id: 'exam-demo', title: 'Synthetic assessment', cancelled: false, sessionId: null, date: '2026-11-19', start: '10:00', end: '12:00'}];
  return m;
}
export const ARITHMETIC_CASES = Object.freeze([
  {id:'joint-miss-first', attended:79, held:100, floorBps:7800, steps:[0,1], pass:true, final:[80,102]},
  {id:'joint-miss-second', attended:79, held:100, floorBps:7800, steps:[1,0], pass:true, final:[80,102]},
  {id:'joint-miss-both', attended:79, held:100, floorBps:7800, steps:[0,0], pass:false, firstFailIndex:1, final:[79,102]},
  {id:'chronology', attended:40, held:50, floorBps:7800, steps:[0,0,1,1,1,1,1,1,1,1], pass:false, firstFailIndex:1, final:[48,60]},
  {id:'exact-boundary', attended:39, held:50, floorBps:7800, steps:[], pass:true, final:[39,50]},
  {id:'display-rounding', attended:77999, held:100000, floorBps:7800, steps:[], pass:false, final:[77999,100000]},
  {id:'first-missed', attended:0, held:0, floorBps:7800, steps:[0], pass:false, firstFailIndex:0, final:[0,1]},
  {id:'first-attended', attended:0, held:0, floorBps:7800, steps:[1], pass:true, final:[1,1]},
]);

// Schema examples for malformed calls; NEVER live engine-response fallbacks.
export function makeInvalidInputCases() {
  const missingClockModel=makeCombinedModel(),badClockModel=makeCombinedModel(),badKModel=makeCombinedModel(),badRevisionModel=makeCombinedModel();
  badKModel.preferences.requestedDays=-1;badRevisionModel.revision=null;
  const definitions=[
    {id:'missing-model',model:null,request:{additionalDates:[],clock:{...FIXED_CLOCK}},revision:null,clock:{...FIXED_CLOCK},requested:null,code:'INVALID_MODEL',path:'model'},
    {id:'missing-clock',model:missingClockModel,request:{additionalDates:[]},revision:0,clock:null,requested:2,code:'INVALID_CLOCK',path:'clock'},
    {id:'malformed-clock',model:badClockModel,request:{additionalDates:[],clock:{...FIXED_CLOCK,date:'2026-02-30'}},revision:0,clock:null,requested:2,code:'INVALID_CLOCK',path:'clock'},
    {id:'invalid-k',model:badKModel,request:{additionalDates:[],clock:{...FIXED_CLOCK}},revision:0,clock:{...FIXED_CLOCK},requested:null,code:'INVALID_REQUESTED_DAYS',path:'model.preferences.requestedDays'},
    {id:'invalid-revision',model:badRevisionModel,request:{additionalDates:[],clock:{...FIXED_CLOCK}},revision:null,clock:{...FIXED_CLOCK},requested:2,code:'INVALID_MODEL_REVISION',path:'model.revision'},
  ];
  return definitions.map(c=>{
    const expectedPlan={contractVersion:CONTRACT_VERSION,status:'INVALID_SETUP',modelRevision:c.revision,evaluatedAt:c.clock,issues:[{code:c.code,path:c.path,message:'Invalid input; correct the indicated field.'}],firstFailure:null,registers:[],dates:[],combinedAbsenceDates:[],assumptions:[]};
    return {id:c.id,model:c.model,request:c.request,expectedPlan,expectedSearch:{evaluation:structuredClone(expectedPlan),batch:null,search:{requested:c.requested,found:0,outcome:'BLOCKED',considered:0,rejections:[],preferenceWarnings:[]}}};
  });
}

// Confirmation-time cases evaluated a day later: stale evaluation dates must not
// make a prematurely confirmed snapshot become valid. B must execute these too.
export function makeSnapshotTimingCases() {
  const evaluationClock={date:'2026-11-03',time:'08:00',timeZone:'Asia/Kolkata'};
  const cases=[
    {id:'premature-prior-day',confirmedAt:{date:'2026-11-02',time:'08:00'},completeToday:true,valid:false},
    {id:'snapshot-date-after-confirmation',confirmedAt:{date:'2026-11-01',time:'20:00'},completeToday:true,valid:false},
    {id:'confirmation-after-evaluation',confirmedAt:{date:'2026-11-03',time:'08:01'},completeToday:false,valid:false},
    {id:'same-day-completion-unconfirmed',confirmedAt:{date:'2026-11-02',time:'10:00'},completeToday:false,valid:false},
    {id:'one-minute-before-session-end',confirmedAt:{date:'2026-11-02',time:'09:59'},completeToday:true,valid:false},
    {id:'exact-session-end',confirmedAt:{date:'2026-11-02',time:'10:00'},completeToday:true,valid:true},
    {id:'later-day-confirmation',confirmedAt:{date:'2026-11-03',time:'08:00'},completeToday:false,valid:true},
  ];
  return cases.map(c=>{
    const model=makeCombinedModel();
    Object.assign(model.snapshots[0],{date:'2026-11-02',counts:{lecture:{attended:80,held:101}},confirmedAt:{...c.confirmedAt,timeZone:'Asia/Kolkata'},completeToday:c.completeToday});
    model.attendanceConfirmation={throughDate:'2026-11-02',noUnlistedClasses:true};
    return {id:c.id,model,clock:{...evaluationClock},valid:c.valid};
  });
}
