import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';
import {FIXED_CLOCK} from '../shared/fixtures.js';
// RC-001 UI only. No attendance maths, journal writes, or source-to-model reconciliation.
// A supplies state.release (versioned envelope) and the two result-returning callbacks.
const dayDrafts=new Map();
const dayFeedback=new Map();
const revisionDrafts=new Map();
const revisionFeedback=new Map();
const activeRequests=new Set();
const dispositionLabels={UNKNOWN:'Unresolved — cannot close day',ATTENDED:'Attended',MISSED:'Missed',NOT_HELD:'Not held (confirm explicitly)'};
const changeLabels={ADD_SESSION:'Added meeting',EDIT_SESSION:'Moved/edited meeting',CANCEL_SESSION:'Explicitly cancelled meeting',ADD_HOLIDAY:'Added holiday',REMOVE_HOLIDAY:'Removed holiday',REPLACE_PATTERN:'Changed teaching pattern',UPSERT_EVENT:'Updated compulsory event',TEACHING_END:'Changed teaching horizon'};
const element=(tag,text,klass)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=String(text);if(klass)node.className=klass;return node;};
const append=(host,...nodes)=>{host.append(...nodes);return host;};
function flag(host,message,tone='muted',alert=false){const p=element('p',message,`release-note ${tone}`);if(alert)p.setAttribute('role','alert');host.append(p);return p;}
function action(host,text,fn,{disabled=false,secondary=false,key=''}={}){const b=element('button',text,`action ${secondary?'secondary':''}`);b.type='button';b.disabled=disabled;if(key)b.dataset.uiKey=key;b.addEventListener('click',fn);host.append(b);return b;}
function tick(host,text,checked,onChange,{disabled=false}={}){const label=element('label',null,'release-checkbox');const i=element('input');i.type='checkbox';i.checked=checked;i.disabled=disabled;i.addEventListener('change',()=>onChange(i.checked));append(label,i,element('span',text));host.append(label);return i;}
function selector(host,title,options,value,fn,key){const label=element('label',null,'release-field');const field=element('select');field.setAttribute('aria-label',title);if(key)field.dataset.uiKey=key;for(const [code,name] of options){const item=element('option',name);item.value=code;field.append(item);}field.value=value;field.addEventListener('change',()=>fn(field.value));append(label,element('span',title),field);host.append(label);return field;}
function issueList(host,issues){if(!Array.isArray(issues)||!issues.length)return;const ul=element('ul',null,'release-issues');for(const i of issues)ul.append(element('li',i?.message??String(i)));host.append(ul);}
function dateToday(){const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(d.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function timeNow(){const d=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const p=Object.fromEntries(d.map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`;}
function newKey(date){return `day:${date}:${globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;}
const daySessionRows=(model,date)=>(model?.sessions??[]).filter(s=>s.date===date&&!s.cancelled).slice().sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
const registerName=(m,id)=>{const r=m.registers.find(x=>x.id===id);const c=m.courses.find(x=>x.id===r?.courseId);return r?`${c?.name??'Unnamed course'} · ${r.name}`:'Unrecognized register';};
function latestClose(journal,date){return [...(journal?.closedDays??[])].reverse().find(c=>c.date===date)??null;}
function closedMark(journal,close,session){if(!close)return null;const recordIds=new Set(close.recordIds);return (journal?.records??[]).find(r=>recordIds.has(r.recordId)&&r.occurrenceId===session.id&&r.registerId===session.registerId)??null;}
export function buildConfirmDayRequest({model,date,dayKey,marks,correctionOfDayKey}){
  // Shape only; calculations and validity are exclusively B/A responsibilities.
  return {expectedModelRevision:model.revision,date,marks:marks.map(m=>({occurrenceId:m.occurrenceId,registerId:m.registerId,disposition:m.disposition,note:m.note})),confirmCompleteDay:true,confirmNoUnlistedMeetings:true,dayKey,...(correctionOfDayKey?{correctionOfDayKey}:{})};
}
export function buildApplyRevisionRequest({model,proposal,acceptedChangeIds,historicalResolutions}){
  return {expectedModelRevision:model.revision,proposalId:proposal.proposalId,acceptedChangeIds:[...acceptedChangeIds],confirmedSourceCoverage:true,historicalResolutions:historicalResolutions.map(x=>({...x})),confirmation:true};
}
function validResult(result,revision=false){return !!result&&typeof result==='object'&&typeof result.ok==='boolean'&&typeof result.code==='string'&&Number.isSafeInteger(result.modelRevision)&&Array.isArray(result.issues)&&(revision?Array.isArray(result.appliedChangeIds)&&Array.isArray(result.preservedCommitmentIds):Object.hasOwn(result,'registerTotals')&&Object.hasOwn(result,'dayKey'));}
function resultFeedback(host,entry,kind){
  if(!entry)return;
  const p=element('div',null,`release-feedback ${entry.ok?'success':'error'}`);
  p.setAttribute('role',entry.ok?'status':'alert');
  append(p,element('strong',entry.title),element('p',entry.message));issueList(p,entry.issues);
  if(entry.code){const evidence=element('details',null,'release-technical');append(evidence,element('summary','Technical response'),element('p',`Response code: ${entry.code}`));p.append(evidence);}
  host.append(p);
}
async function submitAction(key,run,onResult,kind){if(activeRequests.has(key))return;activeRequests.add(key);try{
    const result=await run();if(!validResult(result,kind==='revision'))throw Error(`${kind} integration did not return the RC-001 result shape. No accepted change is assumed.`);
    onResult(result,null);
  }catch(error){onResult(null,error);}finally{activeRequests.delete(key);}}
export function renderReleaseFreshness(host,state){
  if(!state.model)return;
  const m=state.model,release=state.release,att=release?.attendance,cal=release?.calendar,last=m.snapshots?.at(-1);
  const wrap=element('div',null,'release-freshness');wrap.setAttribute('aria-label','Attendance and calendar freshness');
  const a=element('div',null,'freshness-item');
  append(a,element('p','ATTENDANCE','freshness-label'));
  if(!att||att.version!==1){
    append(a,element('h3','Daily tracking not connected'));
    flag(a,`Last recorded attendance baseline: ${last?.date??'not available'}. Daily marks cannot be saved yet.`,'warning');
  }else{
    const lastClosedDate=(att.closedDays??[]).map(c=>c.date).sort().at(-1),lastSnapshotId=last?.id;
    const official=att.officialSnapshotIds?.includes(lastSnapshotId);
    append(a,element('h3',lastClosedDate?`Confirmed through ${lastClosedDate}`:'No days confirmed yet'));
    flag(a,`Recorded baseline: ${last?.date??'none'} · ${official?'official/legacy':'journal-derived or legacy'}.`);
    if(att.reconciliationIssues?.length)flag(a,`${att.reconciliationIssues.length} attendance difference(s) need review.`,'warning');
  }
  const b=element('div',null,'freshness-item');append(b,element('p','SCHEDULE','freshness-label'));
  if(!cal||cal.version!==1){
    append(b,element('h3','Revision tracking not connected'));
    flag(b,'Your original schedule is available. New calendar notices cannot be compared here yet.','warning');
  }else{
    const source=cal.sourceRevision;
    append(b,element('h3',source?'Updated calendar on file':'Original calendar on file'));
    flag(b,source?`Applied revision${typeof source.fileName==='string'?`: ${source.fileName}`:''}.`:'No newer academic calendar has been applied.');
    flag(b,`${cal.appliedRevisions?.length??0} update(s) recorded. Check for later institutional notices.`);
  }
  append(wrap,a,b);host.append(wrap);
}
export function renderAttendanceReview(host,state,callbacks,redraw){
  if(!state.model)return;
  const m=state.model,journal=state.release?.attendance;
  const section=element('section',null,'release-panel');section.dataset.releaseAttendance='true';
  append(section,element('p','01 / ATTENDANCE','section-kicker'),element('h2','Today’s attendance'),element('p','Choose what actually happened in every session. You can confirm the day only after all meetings have ended. Planned breaks are never marked missed automatically.','section-intro'));
  const connected=typeof callbacks.onConfirmAttendanceDay==='function'&&journal?.version===1&&Array.isArray(journal.records)&&Array.isArray(journal.closedDays);
  if(!connected){flag(section,'Daily saving is not yet connected. You may review the form, but confirmation is unavailable.','warning',true);const detail=element('details',null,'release-technical');append(detail,element('summary','Integration detail'),element('p','A must expose state.release.attendance and onConfirmAttendanceDay returning AttendanceResult.'));section.append(detail);}
  const scope=`${state.mode}:${m.id}`;
  const remembered=dayDrafts.get(`${scope}:selectedDate`);
  const dateInput=element('input');dateInput.type='date';dateInput.value=remembered??state.selectedDate??(state.mode==='demo'?FIXED_CLOCK.date:dateToday());dateInput.dataset.uiKey='attendance:date';dateInput.setAttribute('aria-label','Attendance day to review');
  const chooser=element('label',null,'release-field');append(chooser,element('span','Day to review'),dateInput);section.append(chooser);
  dateInput.addEventListener('change',()=>{dayDrafts.set(`${scope}:selectedDate`,dateInput.value);redraw();});
  const date=dateInput.value,rows=daySessionRows(m,date),prior=latestClose(journal,date);
  const dayId=`${scope}:${date}:${prior?.dayKey??'new'}`;
  let draft=dayDrafts.get(dayId);
  if(!draft){draft={revision:m.revision,dayKey:newKey(date),correction:false,complete:false,noUnlisted:false,correctionConfirmed:false,marks:new Map(rows.map(s=>{const old=closedMark(journal,prior,s);return [s.id,{disposition:old?.disposition??'UNKNOWN',note:old?.note??''}];}))};dayDrafts.set(dayId,draft);}
  if(draft.revision!==m.revision){
    // Preserve typed draft, but never preserve acceptance declarations across model changes.
    draft.revision=m.revision;draft.dayKey=newKey(date);draft.complete=false;draft.noUnlisted=false;draft.correctionConfirmed=false;
    for(const session of rows)if(!draft.marks.has(session.id))draft.marks.set(session.id,{disposition:'UNKNOWN',note:''});
    flag(section,'The timetable or attendance record changed. Your selections are kept, but review them and reconfirm this day.','warning');
  }
  if(prior){flag(section,'This day was confirmed earlier. A correction will create a new record and keep the previous one.');tick(section,'I want to correct this previously closed day',draft.correction,v=>{draft.correction=v;redraw();});}
  const resolved=rows.filter(r=>(draft.marks.get(r.id)?.disposition??'UNKNOWN')!=='UNKNOWN').length;
  const progress=element('div',null,'day-progress');progress.setAttribute('role','status');append(progress,element('strong',`${resolved} of ${rows.length} sessions resolved`),element('span',resolved===rows.length?'Ready for complete-day review':'Choose a result for every listed meeting.'));section.append(progress);
  if(!rows.length)flag(section,'No active sessions are listed for this date. You still need to confirm that no other attendance meetings took place.');
  for(const s of rows){
    const record=element('div',null,'release-session');
    append(record,element('strong',`${s.start}–${s.end} · ${registerName(m,s.registerId)}`),element('p',`${s.protected?'Must-attend session':'Scheduled session'} · ${s.weight} attendance ${s.weight===1?'unit':'units'}`,'muted'));
    const mark=draft.marks.get(s.id)??{disposition:'UNKNOWN',note:''};
    draft.marks.set(s.id,mark);
    selector(record,'What happened?', [...Object.entries(dispositionLabels)],mark.disposition,v=>{mark.disposition=v;redraw();},`attendance:${date}:${s.id}:mark`);
    const note=element('label',null,'release-field');const entry=element('textarea');entry.rows=2;entry.value=mark.note;entry.maxLength=1000;entry.dataset.uiKey=`attendance:${date}:${s.id}:note`;entry.setAttribute('aria-label',`Optional note for ${registerName(m,s.registerId)} at ${s.start}`);entry.addEventListener('input',()=>{mark.note=entry.value;});append(note,element('span','Optional explanation'),entry);
    if(mark.disposition==='NOT_HELD'||mark.disposition==='MISSED'||mark.note.trim())record.append(note);
    else {const disclosure=element('details',null,'release-technical');append(disclosure,element('summary','Add an optional note'),note);record.append(disclosure);}
    section.append(record);
  }
  const confirmGroup=element('div',null,'day-confirmation');append(confirmGroup,element('h3','Confirm the complete day'));
  tick(confirmGroup,'Every listed session has ended, and these marks reflect what happened',draft.complete,v=>{draft.complete=v;});
  tick(confirmGroup,'No additional attendance meetings took place on this date',draft.noUnlisted,v=>{draft.noUnlisted=v;});
  if(prior&&draft.correction)tick(confirmGroup,'Keep the original record and save this as a correction',draft.correctionConfirmed,v=>{draft.correctionConfirmed=v;});
  section.append(confirmGroup);
  // Device time is never the transaction clock. In particular the demo controller
  // uses FIXED_CLOCK while the host device has a different calendar day.
  // B/A will reject future or unfinished sessions against its captured clock.
  const deviceFuture=state.mode!=='demo'&&(date>dateToday()||date===dateToday()&&rows.some(s=>s.end>timeNow()));
  if(deviceFuture)flag(section,'Your device time suggests that some meetings may still be underway. The controller checks its own authoritative time before acceptance.','warning');
  const isClosed=Boolean(prior),eligible=connected&&(!isClosed||draft.correction);
  const button=action(section,isClosed?'Submit attendance correction':'Confirm completed attendance day',()=>{
    const marks=rows.map(s=>({occurrenceId:s.id,registerId:s.registerId,disposition:draft.marks.get(s.id)?.disposition??'UNKNOWN',note:draft.marks.get(s.id)?.note??''}));
    const unresolved=marks.filter(x=>x.disposition==='UNKNOWN');
    if(unresolved.length||!draft.complete||!draft.noUnlisted||(prior&&(!draft.correction||!draft.correctionConfirmed))){
      dayFeedback.set(scope,{ok:false,title:'Finish reviewing this day',message:unresolved.length?`${unresolved.length} scheduled meeting(s) unresolved. Choose an actual outcome for every one.`:'Confirm the completed day, no unlisted meetings and (if correcting) preservation of history.',issues:[]});redraw();return;
    }
    const request=buildConfirmDayRequest({model:m,date,dayKey:draft.dayKey,marks,correctionOfDayKey:prior?.dayKey});
    button.disabled=true;
    submitAction(`${scope}:attendance`,()=>callbacks.onConfirmAttendanceDay(request),(result,error)=>{
      if(error)dayFeedback.set(scope,{ok:false,title:'Attendance not saved',message:error.message,issues:[]});
      else{
        dayFeedback.set(scope,{ok:result.ok,title:result.ok?'Day confirmed':'Attendance was not saved',code:result.code,message:result.ok?`Attendance recorded for ${date}. The confirmed totals will appear in your attendance status.`:'No attendance records were accepted. Your selections remain available to correct and retry.',issues:result.issues});
        if(result.ok){dayDrafts.delete(dayId);dayDrafts.delete(`${scope}:selectedDate`);}
      }
      redraw();
    },'attendance');
  },{disabled:!eligible,key:'attendance:submit'});
  if(isClosed&&!draft.correction)flag(section,'Already confirmed. Enable correction above if an earlier outcome needs changing.');
  if(!connected)button.setAttribute('title','Controller integration unavailable');
  resultFeedback(section,dayFeedback.get(scope),'attendance');
  if(journal?.closedDays?.length){
    const history=element('details',null,'release-history');append(history,element('summary',`Closed-day history (${journal.closedDays.length})`));
    for(const c of [...journal.closedDays].reverse().slice(0,30))append(history,element('p',`${c.date} · ${c.recordIds.length} recorded meeting(s) · ${c.supersedesDayKey?'Correction (earlier closure retained)':'Original closure'}`));
    section.append(history);
  }
  host.append(section);
}

// The imported source is reviewed locally in revision-review.js. A owns staging and atomic acceptance.
export function renderCalendarRevision(host,state,callbacks,redraw){
  if(!state.model)return;
  const m=state.model,scope=`${state.mode}:${m.id}`;
  const section=element('section',null,'release-panel');section.dataset.releaseRevision='true';
  append(section,element('p','02 / SCHEDULE','section-kicker'),element('h2','Review a revised calendar'),element('p','Compare the new notice with your current schedule. Nothing changes until you review and confirm it.','section-intro'));
  renderRevisionIntake(section,state,callbacks,redraw);
  // Controller must supply this transient projection when it has a staged proposal.
  // This is a required A presentation adapter, not a new mutating callback.
  const proposal=state.stagedCalendarRevision??null; // A adapter: not defined by RC-001; see docs/UI_DELIVERY.md
  const connected=typeof callbacks.onProposeCalendarRevision==='function'&&typeof callbacks.onApplyCalendarRevision==='function';
  const locallyOutdated=isRevisionStageLocallyOutdated(state);
  if(proposal&&locallyOutdated)flag(section,'You edited or replaced the document after staging this comparison. The older staged proposal cannot be applied from this screen. Complete review and stage your current draft again, or explicitly discard that draft.','warning',true);
  if(!connected)flag(section,'Calendar updates are not yet connected. You can view any provided comparison, but cannot apply changes.','warning',true);
  if(!proposal){flag(section,'No comparison is ready. Your existing calendar and saved breaks have not changed.');resultFeedback(section,revisionFeedback.get(scope),'revision');host.append(section);return;}
  if(proposal.proposalVersion!==1||!Array.isArray(proposal.changes)||!Array.isArray(proposal.unresolved)||!proposal.source||!proposal.scope){flag(section,'Invalid staged proposal shape. No change can be applied.','error',true);host.append(section);return;}
  let draft=revisionDrafts.get(`${scope}:${proposal.proposalId}`);
  if(!draft){draft={accepted:new Set(),coverage:false,confirmation:false,historical:new Map(),rejected:false};revisionDrafts.set(`${scope}:${proposal.proposalId}`,draft);}
  append(section,element('h3',proposal.source.fileName),element('p',`Source review: ${proposal.source.coverage==='COMPLETE'?'complete':proposal.source.coverage==='PARTIAL'?'some pages or dates still need review':'not supported'} · Section ${proposal.scope.section} · ${proposal.scope.start} to ${proposal.scope.end}.`));
  if(proposal.baseModelRevision!==m.revision)flag(section,`Proposal refers to model revision ${proposal.baseModelRevision}; current revision ${m.revision}. Restage against the current model before proceeding.`, 'error',true);
  if(proposal.source.coverage!=='COMPLETE')flag(section,'Some document content is still uncertain. Missing extracted sessions are not cancellations — review the original source before applying changes.','warning',true);
  if(proposal.unresolved.length){append(section,element('h3',`${proposal.unresolved.length} item(s) need review`));issueList(section,proposal.unresolved);}
  if(!proposal.changes.length)flag(section,'No recognized proposed changes. This does not prove the revised calendar is identical or complete.');
  if(proposal.changes.length){append(section,element('h3',`${proposal.changes.length} proposed change(s)`));flag(section,'Rows not mentioned in this proposal are not proven unchanged. Source coverage still needs review.');}
  for(const change of proposal.changes){
    const row=element('div',null,'revision-change'),needsProof=['CANCEL_SESSION','REMOVE_HOLIDAY'].includes(change.kind),validProof=!needsProof||['EXPLICIT_CANCELLATION','REVIEWED_OFFICIAL_CORRECTION'].includes(change.evidence?.basis);
    const locked=change.match==='AMBIGUOUS'||!validProof;
    append(row,element('h4',changeLabels[change.kind]??'Proposed change'),element('p',`${change.match==='AMBIGUOUS'?'The matching session needs review':change.match==='ADDED'?'New calendar item':'Matched to a current calendar item'}${change.affectsConfirmedHistory?' · Would affect a day with recorded attendance':''}.`,'muted'));
    const beforeDate=change.before?.date??change.before?.startDate??null,afterDate=change.after?.date??change.after?.startDate??null;
    if(beforeDate||afterDate)row.append(element('p',beforeDate&&afterDate&&beforeDate!==afterDate?`${beforeDate} → ${afterDate}`:`Date: ${afterDate??beforeDate}`,'revision-date'));
    const before=element('details',null,'release-technical');append(before,element('summary','Source evidence and before / after'),element('pre',`Before: ${JSON.stringify(change.before,null,2)}\nAfter: ${JSON.stringify(change.after,null,2)}`));
    if(change.evidence)before.append(element('p',`Page ${change.evidence.page??'not located'} · ${change.evidence.excerpt??'No excerpt'} · ${change.evidence.basis??'Basis not established'}`,'release-evidence'));row.append(before);
    if(locked)flag(row,'Not selectable: identity is ambiguous or explicit cancellation/removal evidence is missing.','warning');
    tick(row,'Include this change in the application',draft.accepted.has(change.changeId),v=>{if(v)draft.accepted.add(change.changeId);else draft.accepted.delete(change.changeId);},{disabled:locked});
    // Make blocking unambiguous even when the change is unselected; A decides atomic validity.
    if(change.affectsConfirmedHistory){
      flag(row,'Historical attendance is protected. Applying this change requires a reviewed resolution from A.','warning');
      selector(row,'Historical resolution',[['','Not resolved'],['KEEP_HISTORY','Keep existing attendance history'],['EXPLICIT_CORRECTION_REQUIRED','Explicit correction required']],draft.historical.get(change.changeId)?.action??'',v=>{draft.historical.set(change.changeId,{changeId:change.changeId,action:v,reason:draft.historical.get(change.changeId)?.reason??''});},`revision:${change.changeId}:resolution`);
      const reason=element('textarea');reason.rows=2;reason.placeholder='Reason and supporting reference';reason.value=draft.historical.get(change.changeId)?.reason??'';reason.setAttribute('aria-label',`Historical resolution reason for ${changeLabels[change.kind]??change.kind}`);reason.addEventListener('input',()=>{const x=draft.historical.get(change.changeId)??{changeId:change.changeId,action:''};draft.historical.set(change.changeId,{...x,reason:reason.value});});row.append(reason);
    }
    section.append(row);
  }
  tick(section,'I have reviewed source coverage, my cohort and every relevant calendar page, including omissions',draft.coverage,v=>{draft.coverage=v;});
  tick(section,'Apply the checked changes only; retain past attendance and existing commitments for re-evaluation',draft.confirmation,v=>{draft.confirmation=v;});
  const stale=proposal.baseModelRevision!==m.revision,blockers=proposal.unresolved.length>0||proposal.changes.some(c=>c.match==='AMBIGUOUS');
  const apply=action(section,'Apply selected calendar changes',()=>{
    if(isRevisionStageLocallyOutdated(state)||state.stagedCalendarRevision?.proposalId!==proposal.proposalId){
      revisionFeedback.set(scope,{ok:false,title:'Review changed',message:'This staged proposal is no longer authorized by the current document review. Stage the current review again.',issues:[]});redraw();return;
    }
    const accepted=proposal.changes.filter(c=>draft.accepted.has(c.changeId));
    const bad=accepted.some(c=>['CANCEL_SESSION','REMOVE_HOLIDAY'].includes(c.kind)&&!['EXPLICIT_CANCELLATION','REVIEWED_OFFICIAL_CORRECTION'].includes(c.evidence?.basis));
    const historical=accepted.filter(c=>c.affectsConfirmedHistory).map(c=>draft.historical.get(c.changeId));
    if(!draft.coverage||!draft.confirmation||!accepted.length||bad||historical.some(x=>!x?.action||!x.reason?.trim())){
      revisionFeedback.set(scope,{ok:false,title:'Changes not submitted',message:'Choose at least one supported change, confirm coverage and application, and resolve selected historical conflicts with reasons.',issues:[]});redraw();return;
    }
    const request=buildApplyRevisionRequest({model:m,proposal,acceptedChangeIds:accepted.map(c=>c.changeId),historicalResolutions:historical});
    apply.disabled=true;
    submitAction(`${scope}:revision`,()=>callbacks.onApplyCalendarRevision(request),(result,error)=>{
      if(error)revisionFeedback.set(scope,{ok:false,title:'Calendar not updated',message:error.message,issues:[]});
      else revisionFeedback.set(scope,{ok:result.ok,title:result.ok?'Calendar changes applied':'Calendar was not updated',code:result.code,message:result.ok?`${result.appliedChangeIds.length} change(s) applied. ${result.preservedCommitmentIds.length} saved break(s) retained for rechecking. Review the calendar for conflicts.`:'Your schedule was not changed. Review the listed issues; if the timetable changed meanwhile, request a fresh comparison.',issues:result.issues});
      if(result?.ok)revisionDrafts.delete(`${scope}:${proposal.proposalId}`);
      redraw();
    },'revision');
  },{disabled:!connected||locallyOutdated||stale||blockers||proposal.source.coverage==='UNSUPPORTED',key:'revision:apply'});
  if(blockers)flag(section,'This comparison has unresolved items. You cannot apply it until the original source and matching are checked.','warning',true);
  resultFeedback(section,revisionFeedback.get(scope),'revision');
  host.append(section);
}
export function renderRevisionConsequences(host,state,results){
  if(!state.model?.commitments?.length)return;
  const invalid=results?.evaluation?.dates?.filter(d=>d.markers?.includes('INVALID_COMMITMENT'))??[];
  if(!invalid.length)return;
  const box=element('div',null,'release-impact');box.setAttribute('role','status');append(box,element('h3','Saved breaks need another look'),element('p','These dates are still saved, but the current plan cannot support them. This may reflect the combined timetable, attendance and other breaks; it does not prove one imported change caused the problem.'));
  for(const d of invalid){const p=element('p',`${d.date}: ${(d.messages??[]).join(' ')||'Conflicts with current recorded schedule, attendance or commitments. Open the calendar date for details.'}`);box.append(p);}
  host.append(box);
}
