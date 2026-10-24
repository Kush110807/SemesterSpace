import test from 'node:test';
import assert from 'node:assert/strict';
import {validateModel,evaluatePlan,expandSchedule,suggestPlan} from '../../src/engine/index.js';
import {FIXED_CLOCK,makeCombinedModel,makeRecoveryModel,makeSession} from '../../src/shared/fixtures.js';
const clone=structuredClone;
const run=(m,dates=[],clock=FIXED_CLOCK)=>evaluatePlan(m,{additionalDates:dates,clock});
const list=m=>m.sessions.map(s=>s.id);
const clock=(date,time='08:00')=>({date,time,timeZone:'Asia/Kolkata'});
const committed=(m,date,id=`c:${date}`)=>{m.revision++;m.commitments.push({id,date,createdAtRevision:m.revision});return m;};
const emptyDraft=()=>{
  const m=makeCombinedModel();m.schedule.initialized=false;
  m.schedule.weeklyTemplates=[{id:'mon',registerId:'lecture',weekday:1,start:'09:00',end:'10:00',weight:2,protected:false}];
  return {schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]};
};

test('R/T/B floor precedence, exact comparisons, and shortfall classification',()=>{
  let m=makeCombinedModel();m.registers[0].personalMinBps=8500;
  assert.equal(run(m).registers[0].floorBps,8800);
  assert.equal(run(m).status,'EXISTING_UNRECOVERABLE_SHORTFALL');
  m.registers[0].personalMinBps=7000;
  assert.equal(run(m).registers[0].floorBps,7800);
  m.snapshots[0].counts.lecture={attended:76,held:100};
  let r=run(m);assert.equal(r.status,'EXISTING_UNRECOVERABLE_SHORTFALL');
  assert.equal(r.registers[0].initialShortfall,'MARGIN');
  m.snapshots[0].counts.lecture={attended:74,held:100};
  assert.equal(run(m).registers[0].initialShortfall,'REQUIREMENT');
  m.registers[0].bufferBps=2501;
  assert.ok(validateModel(m,FIXED_CLOCK).issues.some(i=>i.code==='FLOOR_OVER_100'));
});

test('0/0, first attended, first missed, exact 100% and display-vs-decision',()=>{
  let m=makeCombinedModel();m.schedule.teachingEnd='2026-11-02';m.sessions=[m.sessions[0]];
  m.snapshots[0].counts.lecture={attended:0,held:0};
  assert.deepEqual([run(m).registers[0].initial.percentage,run(m).registers[0].final.percentage],[null,'100.00']);
  const missed=run(m,['2026-11-02']);assert.equal(missed.status,'PLAN_BLOCKED');
  assert.deepEqual([missed.firstFailure.attended,missed.firstFailure.held],[0,1]);
  m.registers[0].requiredBps=10000;m.registers[0].bufferBps=0;m.snapshots[0].counts.lecture={attended:9,held:10};
  assert.equal(run(m).status,'EXISTING_UNRECOVERABLE_SHORTFALL');
  m=makeCombinedModel();m.sessions=[];m.snapshots[0].counts.lecture={attended:77999,held:100000};
  const r=run(m);assert.equal(r.status,'EXISTING_UNRECOVERABLE_SHORTFALL');
  assert.equal(r.registers[0].initial.percentage,'78.00');
  assert.equal(r.registers[0].initialShortfall,'MARGIN');
});

test('chronological failure persists despite a passing final semester ratio',()=>{
  const m=makeCombinedModel();m.schedule.teachingEnd='2026-11-11';m.preferences.candidateEnd='2026-11-11';
  m.snapshots[0].counts.lecture={attended:40,held:50};
  m.sessions=Array.from({length:10},(_,i)=>makeSession(`s${i+1}`,`2026-11-${String(i+2).padStart(2,'0')}`));
  const r=run(m,['2026-11-02','2026-11-03']);
  assert.equal(r.status,'PLAN_BLOCKED');assert.equal(r.firstFailure.sessionId,'s2');
  assert.deepEqual([r.firstFailure.attended,r.firstFailure.held],[40,52]);
  assert.deepEqual([r.registers[0].final.attended,r.registers[0].final.held],[48,60]);
  assert.deepEqual(r.firstFailure.combinedAbsenceDates,['2026-11-02','2026-11-03']);
});

test('separate registers stay separate and a weighted atomic unit cannot be split',()=>{
  const m=makeRecoveryModel();
  m.sessions.find(s=>s.id==='p1').weight=3;
  m.snapshots[0].counts.practical={attended:39,held:50};
  const r=run(m,['2026-11-02']);
  assert.equal(r.status,'PLAN_BLOCKED');
  // chronological lecture recovery failure occurs at 09:00 before 11:00 practical.
  assert.equal(r.firstFailure.registerId,'lecture');
  const n=makeCombinedModel();n.sessions[0].weight=2;
  const v=run(n,['2026-11-02']);assert.equal(v.status,'PLAN_BLOCKED');
  assert.equal(v.firstFailure.sessionId,'s1');
  assert.deepEqual([v.firstFailure.attended,v.firstFailure.held],[79,102]);
});

test('freshness at session-start equality, elapsed meetings and confirmed nonteaching gaps',()=>{
  const m=makeCombinedModel();
  assert.equal(run(m,[],clock('2026-11-02','08:59')).status,'MEETS_PLANNING_RULES');
  assert.equal(run(m,[],clock('2026-11-02','09:00')).status,'ATTENDANCE_UPDATE_NEEDED');
  assert.equal(run(m,[],clock('2026-11-02','10:00')).status,'ATTENDANCE_UPDATE_NEEDED');
  m.sessions=[makeSession('s4','2026-11-04')];
  m.schedule.teachingEnd='2026-11-04';
  m.attendanceConfirmation={throughDate:'2026-11-02',noUnlistedClasses:true};
  assert.equal(run(m,[],clock('2026-11-04')).status,'ATTENDANCE_UPDATE_NEEDED');
  m.attendanceConfirmation={throughDate:'2026-11-03',noUnlistedClasses:true};
  assert.equal(run(m,[],clock('2026-11-04')).status,'MEETS_PLANNING_RULES');
  assert.equal(run(m,[],clock('2026-11-04','09:00')).status,'ATTENDANCE_UPDATE_NEEDED');
});

test('latest snapshot supersedes counts; same-date correction, historical commitment',()=>{
  const m=committed(makeCombinedModel(),'2026-11-02');
  m.snapshots.push({id:'snew',date:'2026-11-02',counts:{lecture:{attended:50,held:60}},confirmed:true,completeToday:true,sequence:2,confirmedAt:clock('2026-11-02','10:00')});
  m.attendanceConfirmation={throughDate:'2026-11-02',noUnlistedClasses:true};
  const r=run(m,[],clock('2026-11-03','08:00'));
  assert.equal(r.status,'MEETS_PLANNING_RULES');
  assert.deepEqual([r.registers[0].initial.attended,r.registers[0].initial.held],[50,60]);
  assert.equal(r.dates.find(d=>d.date==='2026-11-02').markers.includes('HISTORICAL'),true);
  m.snapshots.push({...clone(m.snapshots.at(-1)),id:'correction',sequence:3,counts:{lecture:{attended:49,held:60}},confirmedAt:clock('2026-11-02','10:01')});
  assert.deepEqual([run(m,[],clock('2026-11-03')).registers[0].initial.attended,run(m,[],clock('2026-11-03')).registers[0].initial.held],[49,60]);
  m.snapshots.at(-1).date='2026-11-01';
  assert.equal(validateModel(m,clock('2026-11-03')).ok,false);
});

test('independent and linked compulsory restrictions count no additional units',()=>{
  const m=makeCombinedModel();
  m.events.push({id:'exam',title:'Assessment',cancelled:false,sessionId:null,date:'2026-11-02',start:'12:00',end:'13:00'});
  assert.equal(run(m,['2026-11-02']).firstFailure.kind,'COMPULSORY');
  assert.equal(run(m,[]).registers[0].final.held,102);
  m.events=[];
  m.events.push({id:'linked',title:'Compulsory practical',cancelled:false,sessionId:'s1',date:null,start:null,end:null});
  assert.equal(run(m,['2026-11-02']).firstFailure.eventId,'linked');
  assert.equal(run(m,[]).registers[0].final.held,102);
  // linked restriction moves with its one session, independent event stays fixed.
  m.sessions[0].date='2026-11-04';m.sessions[0].start='11:00';m.sessions[0].end='12:00';
  assert.equal(run(m,['2026-11-02']).firstFailure.kind,'SELECTION'); // no active class on Nov 2
  const moved=run(m,[]).dates.find(d=>d.date==='2026-11-04');
  assert.ok(moved.eventIds.includes('linked'));
  m.sessions[0].cancelled=true;
  assert.ok(!run(m,[]).dates.find(d=>d.date==='2026-11-04').eventIds.includes('linked'));
});

test('course or session protection follows active rows; cancellation removes it',()=>{
  const m=makeCombinedModel();m.courses[0].mustAttend=true;
  assert.equal(run(m,['2026-11-02']).firstFailure.kind,'PROTECTION');
  m.courses[0].mustAttend=false;m.sessions[0].protected=true;
  assert.equal(run(m,['2026-11-02']).firstFailure.sessionId,'s1');
  m.sessions[0].cancelled=true;
  assert.equal(run(m,['2026-11-02']).firstFailure.kind,'SELECTION');
  assert.equal(run(m,[]).status,'MEETS_PLANNING_RULES');
});

test('future commitments outside horizon, already off, and combined PLAN conflicts are preserved',()=>{
  const m=makeCombinedModel();committed(m,'2026-11-02');committed(m,'2026-11-03');
  const r=run(m);assert.equal(r.status,'PLAN_BLOCKED');assert.equal(r.firstFailure.kind,'ATTENDANCE');
  for(const date of ['2026-11-02','2026-11-03']){
    const day=r.dates.find(x=>x.date===date);assert.ok(day.markers.includes('INVALID_COMMITMENT'));assert.equal(day.conflictScope,'PLAN');
  }
  m.sessions=[];
  const off=run(m);assert.equal(off.status,'MEETS_PLANNING_RULES');
  assert.equal(off.dates.find(x=>x.date==='2026-11-02').markers.includes('ALREADY_OFF'),true);
  m.schedule.teachingEnd='2026-11-02';
  assert.equal(run(m).firstFailure.kind,'OUTSIDE_HORIZON');
  assert.ok(run(m).dates.find(d=>d.date==='2026-11-03').markers.includes('OUTSIDE_HORIZON'));
});

test('duplicate, out-of-range, committed and nonteaching trial dates do not silently disappear',()=>{
  const m=makeCombinedModel();
  assert.equal(run(m,['2026-11-02','2026-11-02']).status,'INVALID_SETUP');
  assert.equal(run(m,['2026-11-04']).firstFailure.kind,'SELECTION');
  m.preferences.candidateEnd='2026-11-02';
  assert.equal(run(m,['2026-11-03']).firstFailure.kind,'SELECTION');
  m.preferences.candidateEnd='2026-11-04';committed(m,'2026-11-02');
  assert.equal(run(m,['2026-11-02']).firstFailure.kind,'SELECTION');
});

test('overlaps are invalid, adjacent session times allowed, invalid/overflow counts rejected',()=>{
  const m=makeCombinedModel();m.sessions.push(makeSession('s3','2026-11-02','lecture',1,'09:30','10:30'));
  assert.ok(validateModel(m,FIXED_CLOCK).issues.some(i=>i.code==='OVERLAPPING_SESSIONS'));
  m.sessions.at(-1).start='10:00';
  assert.equal(validateModel(m,FIXED_CLOCK).ok,true);
  m.sessions.at(-1).weight=Number.MAX_SAFE_INTEGER;
  assert.ok(validateModel(m,FIXED_CLOCK).issues.some(i=>i.code==='PROJECTED_COUNT_OVERFLOW'));
  m.sessions.at(-1).weight=1;
  m.snapshots[0].counts.lecture.attended=1.5;
  assert.ok(validateModel(m,FIXED_CLOCK).issues.some(i=>i.code==='INVALID_COUNTS'));
  m.snapshots[0].counts.lecture.attended=79;
  m.sessions.at(-1).registerId='unknown';
  assert.ok(validateModel(m,FIXED_CLOCK).issues.some(i=>i.code==='UNKNOWN_REGISTER'));
});

test('expanded weekly session IDs, holiday suppression and substitute weekday pattern',()=>{
  const d=emptyDraft();d.schedule.teachingEnd='2026-11-04';
  d.schedule.holidays=[{date:'2026-11-02',label:'Holiday'}];
  d.schedule.replacements=[{date:'2026-11-03',weekday:1,confirmed:true}];
  let r=expandSchedule(d);assert.equal(r.ok,true);assert.deepEqual(list({sessions:r.sessions}),['weekly:mon:2026-11-03']);
  assert.equal(r.sessions[0].weight,2);
  const untouched=clone(d);
  d.overrides=[{sessionId:'weekly:mon:2026-11-03',changes:{date:'2026-11-04',start:'11:00',end:'12:00'}}];
  r=expandSchedule(d);assert.equal(r.ok,true);assert.deepEqual([r.sessions[0].id,r.sessions[0].date],['weekly:mon:2026-11-03','2026-11-04']);
  assert.deepEqual(untouched.overrides,[],'input copied, not mutated');
  d.overrides.push({sessionId:'weekly:mon:2026-11-03',changes:{weight:3}});
  assert.equal(expandSchedule(d).ok,false);
});

test('extra class on a holiday needs explicit confirmation, even with replacement; conflicting IDs fail',()=>{
  const d=emptyDraft();d.schedule.holidays=[{date:'2026-11-02',label:'Holiday'}];
  d.extraSessions=[makeSession('extra-1','2026-11-02')];
  assert.ok(expandSchedule(d).issues.some(x=>x.code==='HOLIDAY_TEACHING_UNCONFIRMED'));
  d.schedule.holidayTeachingDates=['2026-11-02'];
  // Must change extra start time: otherwise Monday weekly and extra class overlap.
  d.extraSessions[0].start='11:00';d.extraSessions[0].end='12:00';
  assert.equal(expandSchedule(d).ok,true);
  d.extraSessions.push({...makeSession('extra-1','2026-11-03')});
  assert.equal(expandSchedule(d).ok,false);
  d.extraSessions.pop();d.schedule.replacements=[{date:'2026-11-02',weekday:1,confirmed:false}];
  assert.equal(expandSchedule(d).ok,false);
});

test('suggestions are real joint trials: skip failure, terminate at K/exhaustion and create no empty batch',()=>{
  let m=makeCombinedModel();let r=suggestPlan(m,{clock:FIXED_CLOCK});
  assert.equal(r.search.requested,2);assert.equal(r.search.found,1);assert.equal(r.search.considered,2);
  assert.equal(r.search.outcome,'EXHAUSTED');assert.equal(r.search.rejections.length,1);
  assert.equal(r.batch.dates.length,1);assert.equal(r.batch.evaluation.status,'MEETS_PLANNING_RULES');
  m.preferences.requestedDays=0;r=suggestPlan(m,{clock:FIXED_CLOCK});
  assert.equal(r.search.outcome,'COMPLETE');assert.equal(r.batch,null);
  m.preferences.requestedDays=2;m.preferences.candidateStart='2026-11-04';
  r=suggestPlan(m,{clock:FIXED_CLOCK});assert.equal(r.search.outcome,'NO_CANDIDATES');assert.equal(r.search.found,0);
  m=makeCombinedModel();m.snapshots[0].counts.lecture={attended:9,held:10};m.registers[0].requiredBps=10000;m.registers[0].bufferBps=0;
  r=suggestPlan(m,{clock:FIXED_CLOCK});assert.equal(r.search.outcome,'BLOCKED');assert.equal(r.search.considered,0);
});

test('search honours preference, K as new days, and warns unavailable preferred dates',()=>{
  const m=makeCombinedModel();m.preferences.requestedDays=1;
  m.preferences.preferredDates=['2026-11-02','2026-11-04'];
  let r=suggestPlan(m,{clock:FIXED_CLOCK});
  assert.deepEqual(r.batch.dates,['2026-11-02']);
  assert.equal(r.search.preferenceWarnings.length,1);
  committed(m,'2026-11-03');
  r=suggestPlan(m,{clock:FIXED_CLOCK});assert.equal(r.search.found,0);
  assert.equal(r.search.rejections.length,1);
  assert.equal(r.search.requested,1);
});

test('search invalid request/k return blocked complete envelopes with nullable requested',()=>{
  const m=makeCombinedModel();m.preferences.requestedDays=-1;
  const r=suggestPlan(m,{clock:FIXED_CLOCK});
  assert.equal(r.evaluation.status,'INVALID_SETUP');assert.equal(r.batch,null);assert.equal(r.search.requested,null);
  assert.equal(suggestPlan(null,{clock:FIXED_CLOCK}).evaluation.status,'INVALID_SETUP');
  assert.equal(suggestPlan(makeCombinedModel(),null).evaluation.status,'INVALID_SETUP');
  assert.equal(run(null).status,'INVALID_SETUP');
  assert.equal(run(makeCombinedModel(),[],{...FIXED_CLOCK,timeZone:'UTC'}).evaluatedAt,null);
});

test('cancelling a previously assumed attended meeting can invalidate a later commitment',()=>{
  const m=makeCombinedModel();
  m.schedule.teachingEnd='2026-11-05';
  m.sessions=[makeSession('att1','2026-11-02','lecture',1,'09:00','10:00'),makeSession('att2','2026-11-02','lecture',1,'10:00','11:00'),makeSession('att3','2026-11-02','lecture',1,'11:00','12:00'),makeSession('miss1','2026-11-04'),makeSession('miss2','2026-11-05')];
  committed(m,'2026-11-04');committed(m,'2026-11-05');
  assert.equal(run(m).status,'MEETS_PLANNING_RULES');
  m.sessions.find(s=>s.id==='att1').cancelled=true;
  const invalid=run(m);assert.equal(invalid.status,'PLAN_BLOCKED');
  assert.equal(invalid.firstFailure.sessionId,'miss2');
});

test('hard search range never truncates later attendance validation',()=>{
  const m=makeCombinedModel();m.preferences.candidateEnd='2026-11-02';
  const r=run(m,['2026-11-02']);
  assert.equal(r.status,'MEETS_PLANNING_RULES');
  assert.deepEqual([r.registers[0].final.attended,r.registers[0].final.held],[80,102]);
  assert.equal(suggestPlan(m,{clock:FIXED_CLOCK}).search.found,1);
});

test('greedy ranking: adjacency and fewer missed units; an event interrupts an off-day chain',()=>{
  let m=makeCombinedModel();m.snapshots[0].counts.lecture={attended:95,held:100};
  m.schedule.teachingEnd='2026-11-03';m.preferences.candidateEnd='2026-11-03';
  m.sessions[0].weight=2;m.preferences.requestedDays=1;
  assert.deepEqual(suggestPlan(m,{clock:FIXED_CLOCK}).batch.dates,['2026-11-03'],'fewer units wins after equal preferred/adjacency/length');
  m=makeCombinedModel();m.snapshots[0].counts.lecture={attended:95,held:100};
  m.schedule.teachingEnd='2026-11-05';m.preferences.candidateEnd='2026-11-05';m.preferences.requestedDays=1;
  m.sessions[1].date='2026-11-04';
  assert.deepEqual(suggestPlan(m,{clock:FIXED_CLOCK}).batch.dates,['2026-11-04'],'two genuinely free neighbors');
  m.events.push({id:'fixed-exam',title:'Exam',cancelled:false,sessionId:null,date:'2026-11-05',start:'11:00',end:'12:00'});
  assert.deepEqual(suggestPlan(m,{clock:FIXED_CLOCK}).batch.dates,['2026-11-02'],'exam interrupts the free neighbor on Nov 5');
});

test('all four public exports handle expected malformed plain-data shapes without throwing',()=>{
  const broken=[null,undefined,0,'',[],{}];
  for(const value of broken){
    assert.doesNotThrow(()=>validateModel(value,FIXED_CLOCK));
    assert.doesNotThrow(()=>evaluatePlan(value,{additionalDates:[],clock:FIXED_CLOCK}));
    assert.doesNotThrow(()=>suggestPlan(value,{clock:FIXED_CLOCK}));
    assert.doesNotThrow(()=>expandSchedule(value));
    assert.equal(evaluatePlan(value,{additionalDates:[],clock:FIXED_CLOCK}).status,'INVALID_SETUP');
    assert.equal(suggestPlan(value,{clock:FIXED_CLOCK}).search.outcome,'BLOCKED');
    assert.equal(expandSchedule(value).ok,false);
  }
  const m=makeCombinedModel();m.schedule.holidays=[{date:'2026-11-02',label:'Holiday'}];m.schedule.holidayTeachingDates={};
  assert.equal(run(m).status,'INVALID_SETUP');
  const n=makeCombinedModel();n.sessions.push({...makeSession('bad','2026-11-02'),id:17});
  assert.equal(validateModel(n,FIXED_CLOCK).ok,false);
});

test('all result envelopes are JSON-serializable and do not mutate input',()=>{
  const m=makeCombinedModel(),original=clone(m);
  const a=run(m,['2026-11-02']);const b=suggestPlan(m,{clock:FIXED_CLOCK});
  assert.doesNotThrow(()=>JSON.stringify(a));assert.doesNotThrow(()=>JSON.stringify(b));
  assert.deepEqual(m,original);
});
