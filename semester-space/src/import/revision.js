// RC-001 pure proposal/candidate boundary. A owns clocks, revision increments and writes.
import {validDate,parseCalendar} from './parse.js';
import {fitsCalendarScope} from './link-effects.js';
import {expandSchedule,validateModel,evaluatePlan} from '../engine/index.js';
const clone=v=>structuredClone(v);
export function revisionKey(v){
  if(Array.isArray(v))return '['+v.map(revisionKey).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+revisionKey(v[k])).join(',')+'}';
  return JSON.stringify(v)??'null';
}
const same=(a,b)=>revisionKey(a)===revisionKey(b),text=v=>typeof v==='string'&&v.trim().length>0;
const affirmative=e=>['EXPLICIT_CANCELLATION','REVIEWED_OFFICIAL_CORRECTION'].includes(e?.basis);
const sessionKinds=['ADD_SESSION','EDIT_SESSION','CANCEL_SESSION'];
const kinds=[...sessionKinds,'ADD_HOLIDAY','REMOVE_HOLIDAY','REPLACE_PATTERN','UPSERT_EVENT','TEACHING_END'];
const effectiveKinds={HOLIDAY:['ADD_HOLIDAY','REMOVE_HOLIDAY'],NON_TEACHING:['ADD_HOLIDAY'],VACATION:['ADD_HOLIDAY'],EXAM_WINDOW:['UPSERT_EVENT'],REPLACEMENT:['REPLACE_PATTERN'],WORKING_DAY_NOTICE:['REPLACE_PATTERN','UPSERT_EVENT'],TEACHING_BOUNDARY:['TEACHING_END']};
function effectValue(model,kind,id,after){
  if(sessionKinds.includes(kind))return model.sessions.find(r=>r.id===id)??null;
  if(kind==='UPSERT_EVENT')return model.events.find(r=>r.id===id)??null;
  if(['ADD_HOLIDAY','REMOVE_HOLIDAY'].includes(kind))return model.schedule.holidays.find(r=>r.date===(id??after?.date))??null;
  if(kind==='REPLACE_PATTERN')return model.schedule.replacements.find(r=>r.date===(id??after?.date))??null;
  return kind==='TEACHING_END'?{date:model.schedule.teachingEnd}:null;
}
function historical(model,before,after,clock=null){
  const snapshot=model.snapshots.at(-1)?.date;
  return [before,after].filter(Boolean).some(r=>{
    const anchored=r.id?.match(/^weekly:.+:(\d{4}-\d{2}-\d{2})$/)?.[1];if(anchored&&anchored<=snapshot)return true;
    const date=r.date;if(!validDate(date))return false;
    return date<=snapshot||clock&&(date<clock.date||date===clock.date&&(!r.start||r.start<=clock.time));
  });
}
function sourceRows(d){return d?.source&&Array.isArray(d.pages)?parseCalendar(d.source,d.pages,d.source.id).calendarEntries:[];}
function evidenceFor(d,effect,rows=sourceRows(d)){
  const row=rows.find(r=>r.id===effect.sourceRef),ev=row?.evidence?.[0];
  return effect.evidence??(ev?{sourceId:ev.sourceId,page:ev.page,excerpt:ev.rawText,basis:'DIRECT_SOURCE'}:null);
}
function validEvidence(d,ev,rows=sourceRows(d)){
  if(!ev||ev.sourceId!==d.source?.id||!Number.isInteger(ev.page)||!text(ev.excerpt))return false;
  const page=d.pages.find(p=>p.page===ev.page&&p.sourceId===ev.sourceId);if(!page)return false;
  const norm=s=>(s??'').replace(/\s+/g,' ').trim(),excerpt=norm(ev.excerpt);
  return norm(page.text).includes(excerpt)||norm(page.items.map(i=>i.text).join(' ')).includes(excerpt)||rows.some(r=>r.evidence.some(e=>e.page===ev.page&&norm(e.rawText)===excerpt));
}
function dateOf(effect){return effect.after?.date??effect.before?.date;}
function sourceCorresponds(row,effect){
  if(!row||row.kind==='UNKNOWN')return false;
  if(effectiveKinds[row.kind]&&!effectiveKinds[row.kind].includes(effect.kind))return false;
  const date=dateOf(effect);
  if(!validDate(row.startDate)||!validDate(row.endDate)||!validDate(date)||date<row.startDate||date>row.endDate)return false;
  if(effect.kind==='REPLACE_PATTERN'&&row.replacementWeekday!==effect.after?.weekday)return false;
  if(effect.kind==='UPSERT_EVENT'&&row.allDay===true&&(effect.after?.start!=='00:00'||effect.after?.end!=='23:59'))return false;
  return true;
}
// Explicit reconciliation binds the original candidate and the reviewed effect, not a generic page tick.
export function reconcileRevisionEffect(draft,effectId,note){
  const effect=draft.review.effects.find(e=>e.id===effectId);if(!effect)throw Error('Unknown revision effect.');
  const source=sourceRows(draft).find(r=>r.id===effect.sourceRef);if(!source)throw Error('Source-specific correction requires an extracted source candidate.');
  effect.reconciliation={confirmed:true,note,binding:revisionKey([draft.source?.sha256,source,{...effect,reconciliation:undefined},draft.review.scope])};
}
function reconciles(d,effect){
  const r=effect.reconciliation,source=sourceRows(d).find(row=>row.id===effect.sourceRef);
  return r?.confirmed===true&&text(r.note)&&r.binding===revisionKey([d.source?.sha256,source,{...effect,reconciliation:undefined},d.review.scope]);
}
export function prepareCalendarRevision({currentModel:model,existingSourceRevision=null,extractedDraft:d}){
  const changes=[],unresolved=[],comparison=[];
  const bad=(code,sourceRef,message)=>unresolved.push({code,sourceRef:sourceRef??'',message});
  const originals=sourceRows(d);
  const review=d?.review??{},scope=review.scope??{start:model.schedule.startDate,end:model.schedule.teachingEnd,section:model.context.section,subgroup:null,programmingGroup:null};
  const source={sha256:d?.source?.sha256??'',fileName:d?.source?.fileName??'',role:'ACADEMIC_CALENDAR',coverage:d?.source?.coverage??'UNSUPPORTED',section:d?.source?.section??null,pageRefs:clone(d?.source?.pageRefs??[])};
  if(!['REVIEW_REQUIRED','PARTIAL'].includes(d?.status))bad(d?.status==='UNREADABLE'?'UNREADABLE':'UNSUPPORTED','', 'No applicable calendar was decoded; retain the existing setup.');
  if(!/^[a-f0-9]{64}$/.test(source.sha256)||!Array.isArray(d?.pages)||!d.pages.length)bad('SOURCE_PROVENANCE','', 'Keep the decoded source pages and SHA-256.');
  if(review.scopeConfirmed!==true||!validDate(scope.start)||!validDate(scope.end)||scope.start>scope.end||scope.section!==model.context.section||source.section!==scope.section)bad('SCOPE_REVIEW','', 'Confirm institution/cohort applicability and effective interval for this existing setup.');
  const academic=review.academicScope;
  if(!academic||academic.institution!==model.context.college||academic.academicYear!==model.context.academicYear||academic.semesterNumber!==Number(model.context.semester)||academic.programme!==model.context.programme||!['ODD','EVEN'].includes(academic.term)||!['UG','PG','PHD','OTHER'].includes(academic.degreeGroup))bad('ACADEMIC_SCOPE_REVIEW','','Confirm the source academic identity against the existing setup.');
  const institution=d?.source?.institutionLabel??'';
  if(/BHU/i.test(institution)&&!/BHU/i.test(model.context.college)||/MAHARAJA AGRASEN/i.test(institution)&&!/MAIT|MAHARAJA AGRASEN/i.test(model.context.college))bad('WRONG_INSTITUTION','','The source institution differs from the existing setup.');
  if(review.sourceCoverageConfirmed!==true||!text(review.coverageNote))bad('COVERAGE_REVIEW','', 'Extraction candidates are not complete coverage. Manually complete all pages, including missed exams, boundaries and substitutions.');
  if(!existingSourceRevision)bad('PRIOR_SOURCE_UNAVAILABLE','', 'Legacy setup has no persisted source crosswalk. Explicit matching and a justified legacy-source review are required.');
  if(!existingSourceRevision&&review.legacySourceReviewed===true&&text(review.legacySourceNote))unresolved.splice(unresolved.findIndex(i=>i.code==='PRIOR_SOURCE_UNAVAILABLE'),1);
  const effects=Array.isArray(review.effects)?review.effects:[],seen=new Set();
  for(const effect of effects){
    const ev=evidenceFor(d,effect,originals),row=originals.find(r=>r.id===effect.sourceRef),ref=effect.sourceRef;
    if(!text(effect.id)||seen.has(effect.id)){bad('DUPLICATE_EFFECT',ref,'Each draft effect needs a once-assigned unique ID.');continue;}seen.add(effect.id);
    if(!kinds.includes(effect.kind)){bad('UNSUPPORTED_EFFECT',ref,'Resolve this calendar meaning manually.');continue;}
    if(!validEvidence(d,ev,originals)){bad('SOURCE_EVIDENCE',ref,'Link the effect to an actual source page and excerpt.');continue;}
    if(effect.confirmed!==true||effect.applicabilityConfirmed!==true||effect.effectiveDateConfirmed!==true)bad('EFFECT_REVIEW',ref,'Explicitly confirm applicability, interpretation and effective date.');
    if(!sourceCorresponds(row,effect)&&!reconciles(d,effect)&&!(!row&&effect.manual===true&&effect.confirmed===true&&text(effect.reason)))bad('SOURCE_CORRESPONDENCE',ref,'Dates/pattern/meaning differ from the source candidate; record source-specific reconciliation.');
    if(row&&!fitsCalendarScope(row,{academicScope:academic}))bad('SOURCE_SCOPE',ref,'This source term/cohort does not match the confirmed scope; use a justified exclusion.');
    const date=dateOf(effect);if(!validDate(date)||date<scope.start||date>scope.end)bad('EFFECT_OUT_OF_SCOPE',ref,'The proposed effect is outside the reviewed effective interval.');
    if((['CANCEL_SESSION','REMOVE_HOLIDAY'].includes(effect.kind)||effect.after?.cancelled===true)&&!affirmative(ev))bad('REMOVAL_EVIDENCE',ref,'Missing extraction is not deletion: supply affirmative cancellation or reviewed official-correction evidence.');
    if(ev.basis==='REVIEWED_OFFICIAL_CORRECTION'&&!text(effect.reason))bad('CORRECTION_REASON',ref,'Explain the reviewed official correction.');
    if(ev.basis==='EXPLICIT_CANCELLATION'&&!/cancel|withdraw|revok|not\s+(?:be\s+)?held|no\s+class|remov/i.test(ev.excerpt))bad('CANCELLATION_EVIDENCE',ref,'The excerpt does not state cancellation; review the actual source or use a justified official correction.');
    let id=effect.occurrenceId??effect.targetId??null,match='ADDED';
    // Stored source links are hints. A changed source never grants permission to remap an occurrence.
    const links=(existingSourceRevision?.links??[]).filter(l=>l.sourceRef===effect.previousSourceRef);
    if(!id&&links.length===1)id=links[0].targetId;
    let before=effectValue(model,effect.kind,id,effect.after),after=clone(effect.after??null);
    const label=v=>(v??'').toLowerCase().replace(/\d+/g,' ').replace(/[^a-z]+/g,' ').trim();
    const possible=!id&&['ADD_SESSION','UPSERT_EVENT'].includes(effect.kind)?(effect.kind==='UPSERT_EVENT'?model.events:model.sessions).filter(r=>effect.kind==='UPSERT_EVENT'?(text(after?.title)&&label(r.title)===label(after.title)||r.date===after?.date&&r.start===after?.start):r.registerId===after?.registerId&&r.date===after?.date):[];
    if(possible.length&&!(effect.additionConfirmed===true&&text(effect.reason))){match='AMBIGUOUS';bad('AMBIGUOUS_MATCH',ref,'Possible existing target(s) require a reviewed crosswalk or explicit confirmation of a distinct addition.');}
    if(effect.kind==='ADD_HOLIDAY'&&['NON_TEACHING','VACATION'].includes(row?.kind)&&model.schedule.holidayTeachingDates.includes(after?.date))bad('TEACHING_OVERRIDE_CONFLICT',ref,'An explicit nonteaching source cannot be represented by a holiday label while teaching remains enabled.');
    if(effect.kind==='UPSERT_EVENT'&&after?.cancelled===true&&!affirmative(ev))bad('INEFFECTIVE_EVENT',ref,'A cancelled event requires affirmative cancellation/correction evidence.');
    if(effect.kind==='REPLACE_PATTERN'&&!model.schedule.weeklyTemplates.some(t=>t.weekday===after?.weekday))bad('INEFFECTIVE_PATTERN',ref,'This substitution has no known weekly obligations; resolve the pattern/zero-unit provenance manually.');
    if(!id&&['ADD_SESSION','UPSERT_EVENT'].includes(effect.kind)&&!before){id=`${effect.kind==='ADD_SESSION'?'extra':'event'}:revision:${effect.id}`;if(after)after.id=id;}
    if(before){
      if(effect.matchConfirmed===true&&text(effect.matchReason))match='REVIEWED_CROSSWALK';
      else if(same(before,after))match='EXACT_ID';
      else {match='AMBIGUOUS';bad('MATCH_REVIEW',ref,'Confirm the existing target and stable identity crosswalk before changing it.');}
    }else if(effect.kind==='EDIT_SESSION'||effect.kind==='CANCEL_SESSION'||effect.kind==='REMOVE_HOLIDAY'||effect.previousSourceRef){match='AMBIGUOUS';bad('MATCH_NOT_FOUND',ref,'The claimed prior target is absent or ambiguous. Do not silently add or remove it.');}
    if(links.length>1){match='AMBIGUOUS';bad('AMBIGUOUS_MATCH',ref,'More than one stored source target matches this reference.');}
    if(after&&sessionKinds.includes(effect.kind)&&id)after.id=id;
    if(after&&effect.kind==='UPSERT_EVENT'&&id)after.id=id;
    if(effect.kind==='CANCEL_SESSION'&&before)after={...clone(before),cancelled:true};
    if(effect.kind==='REMOVE_HOLIDAY')after=null;
    const change={changeId:`change:${effect.id}`,kind:effect.kind,occurrenceId:sessionKinds.includes(effect.kind)?id:null,before:clone(before),after,evidence:clone(ev),match,affectsConfirmedHistory:!same(before,after)&&historical(model,before,after)};
    if(effect.confirmed!==true||effect.applicabilityConfirmed!==true||effect.effectiveDateConfirmed!==true)change.match='AMBIGUOUS';
    changes.push(change);comparison.push({sourceRef:ref,changeId:change.changeId,status:same(before,after)?'UNCHANGED':match==='AMBIGUOUS'?'NEEDS_REVIEW':before?'CHANGED':'ADDED',targetId:id});
  }
  for(const row of originals){
    const linked=effects.filter(e=>e.sourceRef===row.id),ex=review.exclusions?.find(e=>e.sourceRef===row.id);
    if(ex?.confirmed===true&&text(ex.reason)&&!linked.length)continue;
    if(!linked.length)bad('UNRESOLVED_SOURCE',row.id,'Resolve this extracted candidate or explicitly justify no applicable effect.');
    // A source range cannot be satisfied by a single unrelated/effective date unless reconciled.
    if(linked.length&&validDate(row.startDate)&&validDate(row.endDate)&&['EXAM_WINDOW','HOLIDAY','NON_TEACHING','VACATION'].includes(row.kind)){
      const start=[row.startDate,scope.start,model.snapshots.at(-1)?.date??''].sort().at(-1),end=[row.endDate,scope.end].sort()[0];
      for(let dt=new Date(start+'T12:00:00Z'),n=0;Number.isFinite(+dt)&&dt.toISOString().slice(0,10)<=end&&n<740;dt.setUTCDate(dt.getUTCDate()+1),n++){
        const date=dt.toISOString().slice(0,10);if(date<=model.snapshots.at(-1)?.date)continue;
        if(!linked.some(e=>dateOf(e)===date)&&!linked.some(e=>reconciles(d,e))){bad('SOURCE_RANGE_INCOMPLETE',row.id,'Represent the relevant source range or explicitly reconcile it to confirmed actual occurrences.');break;}
      }
    }
  }
  const represented=new Set(effects.map(e=>e.previousSourceRef).filter(Boolean));
  for(const link of existingSourceRevision?.links??[]){
    if(represented.has(link.sourceRef)||link.value===null||link.value?.date<=model.snapshots.at(-1)?.date)continue;
    // Exact current effect is still represented even if its source row moved/reordered.
    if(changes.some(c=>c.kind===link.kind&&same(c.after,link.value)))continue;
    const keep=review.missing?.find(r=>r.sourceRef===link.sourceRef&&r.decision==='KEEP_EXISTING'&&r.confirmed===true&&text(r.reason));
    comparison.push({sourceRef:link.sourceRef,changeId:null,status:'POSSIBLE_REMOVAL',targetId:link.targetId});
    if(!keep)bad('POSSIBLE_REMOVAL',link.sourceRef,'Old source effect is absent from extraction. Keep it or reconcile with affirmative evidence; omission is not cancellation.');
  }
  // IDs are opaque draft tokens; equality digest is the entire canonical payload, which A must bind.
  const body={proposalVersion:1,proposalId:`revision:${source.sha256}:${model.revision}:${review.proposalKey??'draft'}`,baseModelRevision:model.revision,source,scope:clone(scope),changes,unresolved,createdAtUntrusted:null};
  return {proposal:body,comparison};
}
function applyChange(m,c){
  if(sessionKinds.includes(c.kind)){
    const at=m.sessions.findIndex(r=>r.id===c.occurrenceId);
    if(c.before&&sessionKinds.includes(c.kind)&&(c.before.origin!==c.after?.origin||c.before.templateId!==c.after?.templateId))bad('IDENTITY_CHANGE','Occurrence origin and original template identity cannot be remapped.',c.changeId);
      if(c.kind==='ADD_SESSION'){if(at>=0)throw Error('Session ID already exists.');m.sessions.push(clone(c.after));}
    else {if(at<0)throw Error('Unknown session.');m.sessions[at]=clone(c.after);}
  }else if(c.kind==='UPSERT_EVENT'){
    const at=m.events.findIndex(r=>r.id===c.after.id);if(at<0)m.events.push(clone(c.after));else m.events[at]=clone(c.after);
  }else if(['ADD_HOLIDAY','REMOVE_HOLIDAY'].includes(c.kind)){
    const date=c.before?.date??c.after?.date;m.schedule.holidays=m.schedule.holidays.filter(h=>h.date!==date);
    if(c.after)m.schedule.holidays.push(clone(c.after));
  }else if(c.kind==='REPLACE_PATTERN'){
    m.schedule.replacements=m.schedule.replacements.filter(r=>r.date!==(c.before?.date??c.after.date));m.schedule.replacements.push(clone(c.after));
  }else if(c.kind==='TEACHING_END')m.schedule.teachingEnd=c.after.date;
}
function canonical(model){return expandSchedule({schedule:{...clone(model.schedule),initialized:false},courses:clone(model.courses),registers:clone(model.registers),extraSessions:[],overrides:[]});}
function reproject(before,m,selected,clock,issues){
  if(!selected.some(c=>['ADD_HOLIDAY','REMOVE_HOLIDAY','REPLACE_PATTERN','TEACHING_END'].includes(c.kind)&&!same(c.before,c.after)))return;
  const old=canonical(before),next=canonical(m);
  if(!old.ok||!next.ok){issues.push({code:'SCHEDULE_EXPANSION',message:[...old.issues,...next.issues].map(i=>i.message).join(' ')});return;}
  const was=new Map(old.sessions.map(r=>[r.id,r])),now=new Map(next.sessions.map(r=>[r.id,r])),actual=new Map(m.sessions.map(r=>[r.id,r]));
  const explicit=new Set(selected.filter(c=>sessionKinds.includes(c.kind)).map(c=>c.occurrenceId));
  for(const id of new Set([...was.keys(),...now.keys()])){
    const a=was.get(id),b=now.get(id);if(same(a,b)||explicit.has(id))continue;
    const current=actual.get(id),after=b??(current?{...current,cancelled:true}:null);
    if(historical(before,a??current,b,clock)){issues.push({code:'HISTORICAL_SCHEDULE_CONFLICT',message:'Schedule projection would change completed/started attendance.',occurrenceId:id});continue;}
    if(current&&!same(current,a)||!current&&a){issues.push({code:'MANUAL_OVERRIDE_CONFLICT',message:'Calendar change touches an edited/cancelled occurrence; supply an explicit reviewed occurrence crosswalk.',occurrenceId:id});continue;}
    if(after){if(current)Object.assign(current,clone(after));else m.sessions.push(clone(after));}
  }
}
export function buildRevisionCandidate({model,proposal,acceptedChangeIds,clock}){
  const issues=[],bad=(code,message,changeId)=>issues.push({code,message,...(changeId?{changeId}:{})});
  const reject=()=>({ok:false,issues,proposedModel:null,sourceRevisionPatch:null,engineStatus:null});
  try{
    if(proposal?.proposalVersion!==1||proposal.baseModelRevision!==model.revision){bad('STALE_REVISION','Proposal must target the current model revision.');return reject();}
    if(!Array.isArray(proposal.unresolved)||proposal.unresolved.length)bad('UNRESOLVED_PROPOSAL','Resolve every applicability, coverage and matching blocker before acceptance.');
    if(!Array.isArray(acceptedChangeIds)||new Set(acceptedChangeIds).size!==acceptedChangeIds.length){bad('INVALID_SELECTION','Select distinct proposal change IDs.');return reject();}
    const all=proposal.changes;if(!Array.isArray(all)||new Set(all.map(c=>c.changeId)).size!==all.length){bad('INVALID_PROPOSAL','Change IDs must be unique.');return reject();}
    if(acceptedChangeIds.some(id=>!all.some(c=>c.changeId===id)))bad('UNKNOWN_CHANGE','Selection contains a change outside this staged proposal.');
    if(!clock||clock.timeZone!=='Asia/Kolkata'||!validDate(clock.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock.time??''))bad('INVALID_CLOCK','A must capture the acceptance transaction clock.');
    const selected=all.filter(c=>acceptedChangeIds.includes(c.changeId)),targets=new Set();
    for(const c of selected){
      if(!kinds.includes(c.kind)||!['EXACT_ID','REVIEWED_CROSSWALK','ADDED'].includes(c.match))bad('AMBIGUOUS_CHANGE','Unsupported or ambiguous change cannot apply.',c.changeId);
      const id=sessionKinds.includes(c.kind)?c.occurrenceId:c.kind==='UPSERT_EVENT'?(c.before?.id??c.after?.id):c.before?.date??c.after?.date;
      const key=(sessionKinds.includes(c.kind)?'SESSION':c.kind==='UPSERT_EVENT'?'EVENT':c.kind==='TEACHING_END'?'END':c.kind==='REPLACE_PATTERN'?'PATTERN':'HOLIDAY')+':'+id;
      if(targets.has(key))bad('COMPETING_CHANGES','Selected changes compete for one target.',c.changeId);targets.add(key);
      if(!same(effectValue(model,c.kind,id,c.after),c.before))bad('STALE_TARGET','The before value no longer matches the current target.',c.changeId);
      if(sessionKinds.includes(c.kind)&&c.after?.id!==c.occurrenceId||c.kind==='UPSERT_EVENT'&&c.before&&c.before.id!==c.after?.id)bad('IDENTITY_CHANGE','Existing canonical occurrence/event IDs must be retained.',c.changeId);
      if(c.before&&sessionKinds.includes(c.kind)&&(c.before.origin!==c.after?.origin||c.before.templateId!==c.after?.templateId))bad('IDENTITY_CHANGE','Occurrence origin and original template identity cannot be remapped.',c.changeId);
      if(c.kind==='ADD_SESSION'&&(c.before!==null||c.after?.origin!=='extra'||c.after?.templateId!==null))bad('INVALID_ADDITION','A new reviewed occurrence must use its once-assigned extra ID.',c.changeId);
      if((['CANCEL_SESSION','REMOVE_HOLIDAY'].includes(c.kind)||c.after?.cancelled===true)&&!affirmative(c.evidence))bad('REMOVAL_EVIDENCE','Absence from extraction is not affirmative deletion evidence.',c.changeId);
      if(c.kind==='CANCEL_SESSION'&&(!c.before||!same(c.after,{...c.before,cancelled:true})))bad('INVALID_CANCELLATION','Cancellation retains the original occurrence and identity.',c.changeId);
      if(!same(c.before,c.after)&&(c.affectsConfirmedHistory===true||historical(model,c.before,c.after,clock)))bad('HISTORICAL_CONFLICT','Keep confirmed/started attendance unchanged; A must require explicit separate reconciliation.',c.changeId);
      const date=c.after?.date??c.before?.date;
      if(!validDate(date)||date<proposal.scope.start||date>proposal.scope.end)bad('EFFECT_OUT_OF_SCOPE','Accepted effect lies outside the reviewed scope.',c.changeId);
    }
    if(issues.length)return reject();
    const candidate=clone(model);for(const c of selected)if(!same(c.before,c.after))applyChange(candidate,c);
    reproject(model,candidate,selected,clock,issues);if(issues.length)return reject();
    for(const c of selected){const date=c.after?.date??c.before?.date;if(c.kind!=='TEACHING_END'&&(date<candidate.schedule.startDate||date>candidate.schedule.teachingEnd))bad('INEFFECTIVE_TARGET','The selected effect has no restriction inside the resulting teaching horizon.',c.changeId);}
    if(issues.length)return reject();
    const valid=validateModel(candidate,clock);if(!valid.ok){for(const i of valid.issues)bad(i.code,i.message);return reject();}
    const evaluation=evaluatePlan(candidate,{additionalDates:[],clock});
    // PLAN_BLOCKED is valid: A retains and reports invalid commitments instead of dropping them.
    return {ok:true,issues:[],proposedModel:candidate,engineStatus:evaluation.status,preservedCommitmentIds:model.commitments.map(c=>c.id),sourceRevisionPatch:{version:1,source:clone(proposal.source),scope:clone(proposal.scope),links:selected.map(c=>({sourceRef:c.changeId,changeId:c.changeId,kind:c.kind,targetId:sessionKinds.includes(c.kind)?c.occurrenceId:c.after?.id??c.after?.date??c.before?.date,value:clone(c.after),evidence:clone(c.evidence)}))}};
  }catch(e){bad('INVALID_REVISION',e.message);return reject();}
}
