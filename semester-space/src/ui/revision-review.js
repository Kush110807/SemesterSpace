// C-only local calendar-revision review. Importer proposes; A accepts/stamps/writes.
// No unreviewed interpretation, device timestamp, or implicit cancellation is persisted.
import {extractCalendarRevision} from '../import/revision-extract.js';
import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';

const sessions=new Map();
const KINDS=['ADD_HOLIDAY','UPSERT_EVENT','REPLACE_PATTERN','TEACHING_END','ADD_SESSION','EDIT_SESSION','CANCEL_SESSION','REMOVE_HOLIDAY'];
const changeNames={ADD_HOLIDAY:'Add a non-teaching date',UPSERT_EVENT:'Add or revise a compulsory event',REPLACE_PATTERN:'Teaching-day substitution',TEACHING_END:'Change teaching end',ADD_SESSION:'Add session',EDIT_SESSION:'Change a session',CANCEL_SESSION:'Cancel an explicitly identified session',REMOVE_HOLIDAY:'Remove an explicitly identified holiday'};
const newId=()=>globalThis.crypto?.randomUUID?.()??`local-${Math.random().toString(36).slice(2)}`;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
const add=(host,...nodes)=>{host.append(...nodes);return host;};
const note=(host,text,type='muted')=>{const n=el('p',text,`release-note ${type}`);if(type==='error')n.setAttribute('role','alert');host.append(n);return n;};
const field=(host,name,value,change,{type='text',hint='',rows=0,key=''}={})=>{
 const label=el('label',null,'release-field');const input=el(rows?'textarea':'input');if(!rows)input.type=type;else input.rows=rows;
 if(type==='checkbox')input.checked=Boolean(value);else input.value=value??'';
 if(key)input.dataset.uiKey=key;
 input.addEventListener(type==='checkbox'?'change':'input',()=>change(type==='checkbox'?input.checked:input.value));
 if(type==='checkbox')add(label,input,el('span',name));else add(label,el('span',name),input);
 if(hint)label.append(el('small',hint,'field-help'));host.append(label);return input;
};
const choose=(host,title,values,value,onChange)=>{
 const wrap=el('label',null,'release-field'),select=el('select');
 for(const [key,name] of values){const option=el('option',name);option.value=String(key);select.append(option);}
 if(value!=null&&!values.some(([v])=>String(v)===String(value))){const missing=el('option','Unrecognized — review required');missing.value=String(value);select.append(missing);}
 select.value=value??'';select.setAttribute('aria-label',title);select.addEventListener('change',()=>onChange(select.value));add(wrap,el('span',title),select);host.append(wrap);return select;
};
const tick=(host,text,value,fn)=>field(host,text,value,fn,{type:'checkbox'});
const button=(host,label,fn,{secondary=false,disabled=false}={})=>{const b=el('button',label,`action ${secondary?'secondary':''}`);b.type='button';b.disabled=disabled;b.addEventListener('click',fn);host.append(b);return b;};
const details=(host,title,open=false)=>{const d=el('details',null,'release-technical');d.open=open;d.append(el('summary',title));host.append(d);return d;};
function messages(host,items){if(!items?.length)return;const ul=el('ul',null,'release-issues');for(const i of items)ul.append(el('li',`${i.code?`${i.code}: `:''}${i.message??String(i)}${i.sourceRef?` · source ${i.sourceRef}`:''}`));host.append(ul);}
function sessionFor(state){const key=`${state.mode}:${state.model.id}`;if(!sessions.has(key))sessions.set(key,{phase:'empty',file:null,draft:null,controller:null,revision:null,progress:'',error:'',reviewConsent:false,stageConsent:false,comparison:null,proposal:null,stageMessage:'',stagedId:null,extractionRevision:null,pagesReviewed:new Set(),effectInputs:new Map(),reviewedModelRevision:state.model.revision,stagedInvalidated:false,generation:0,authorizedStage:null,latestModelRevision:state.model.revision});
 const session=sessions.get(key);
 if(session.latestModelRevision!==state.model.revision){
   invalidateStage(session,'The saved schedule changed. Review and stage this calendar again.');
   session.latestModelRevision=state.model.revision;
 }
 return session;}
const existingSource=state=>state.release?.calendar?.sourceRevision??null;
const isLegacy=state=>{const r=existingSource(state);return !r||r.version!==1||!Array.isArray(r.links);};
function invalidateStage(s,message='This review changed. A previously staged comparison cannot be applied.') {
 // Revoke obsolete staging ownership now. Its eventual result is still checked
 // against generation/source/revision and must not clear a newer request.
 if(s.controller?.kind==='stage')s.controller=null;
 s.generation+=1;
 s.authorizedStage=null;
 s.stagedInvalidated=true;
 s.stageMessage=message;
 // Edits do not always trigger a re-render. Lock the visible apply action now.
 document.querySelectorAll('[data-ui-key="revision:apply"]').forEach(button=>{button.disabled=true;});
}
function dirty(s){
 invalidateStage(s);
 s.comparison=null;s.proposal=null;s.stageConsent=false;s.reviewConsent=false;s.error='';
 // A changed field revokes the approval immediately, even before the next redraw.
 // Leaving a visually checked box backed by false state misleads the reviewer.
 document.querySelectorAll('[data-ui-key="revision:review-consent"], [data-ui-key="revision:stage-consent"]').forEach(box=>{box.checked=false;});
 if(s.draft)s.draft.review.proposalKey=newId();
}
const statusText=(p)=>{
 if(typeof p==='string')return p;
 if(!p||typeof p!=='object')return 'Reading document locally…';
 return [p.stage??p.phase??p.step??'Processing document',p.page?`page ${p.page}`:'',p.message??''].filter(Boolean).join(' · ');
};
function sourceRows(d){return d.calendarEntries??[];}
const rowDescription=r=>`${r.title??r.kind??'Unrecognized entry'} · ${r.startDate??'no start'}${r.endDate&&r.endDate!==r.startDate?` – ${r.endDate}`:''}`;
function sourceInfo(d,sourceRef){const row=sourceRows(d).find(r=>r.id===sourceRef);return row?rowDescription(row):'Manually linked page evidence (source row not automatically recognized)';}
function detectedSource(host,s){const d=s.draft;if(!d)return;
 const source=d.source;
 const header=el('div',null,'revision-source-summary');add(header,el('strong',source?`${source.fileName} · ${source.pageCount??d.pages.length} page(s)`:'No readable source'),el('p',`Reader result: ${d.status}. ${source?.institutionLabel?'Detected label: '+source.institutionLabel:'Institution could not be established from extraction.'}`));host.append(header);
 if(d.status==='UNSUPPORTED'||d.status==='UNREADABLE'){note(host,'This file was not decoded into a reviewable calendar. No proposal can be prepared. Choose another supported document or retry.','error');messages(host,d.issues);return;}
 note(host,'Automatic extraction is partial evidence, not proof that all dates, cohorts, footnotes or cancellations were found. Inspect every original page and retain missing existing entries.','warning');
 const pages=details(host,`Source pages (${d.pages.length}) and reading errors`);
 for(const page of d.pages){const box=details(pages,`Page ${page.page} · ${page.method??'extraction method unknown'}`);
 if(typeof page.preview==='string'&&page.preview.startsWith('data:image/')){const img=el('img');img.src=page.preview;img.alt=`Document page ${page.page}. Check the original visually; text extraction may omit legends or markings.`;img.className='revision-page-preview';box.append(img);}
 const pre=el('pre',page.text?.trim()||'No text recovered. Inspect this page against the actual file.','revision-source-text');box.append(pre);
 tick(box,`I compared original page ${page.page} with extracted entries, captions and footnotes`,s.pagesReviewed.has(page.page),v=>{if(v)s.pagesReviewed.add(page.page);else s.pagesReviewed.delete(page.page);dirty(s);});}
 if(d.issues.length){const issues=details(pages,`Extractor issues (${d.issues.length})`,true);messages(issues,d.issues);}
}
function scopeReview(host,s,state,redraw){const d=s.draft,r=d.review,m=state.model;
 if(!r.scope)r.scope={start:m.schedule.startDate,end:m.schedule.teachingEnd,section:m.context.section,subgroup:null,programmingGroup:null};
 if(!r.academicScope)r.academicScope={institution:m.context.college??'',academicYear:m.context.academicYear??'',semesterNumber:Number(m.context.semester)||0,programme:m.context.programme??'',term:'',degreeGroup:''};
 const pane=details(host,'1. Scope and applicability — confirm against your actual programme',true);
 let scopeConsentInput=null;const changedScope=()=>{r.scopeConfirmed=false;if(scopeConsentInput)scopeConsentInput.checked=false;dirty(s);};
 note(pane,'Values from your existing setup are suggestions only. Verify source institution, year, semester, section, subgroup and teaching interval against the official notice.','warning');
 for(const [name,key] of [['Institution','institution'],['Academic year','academicYear'],['Programme','programme']])field(pane,name,r.academicScope[key],v=>{r.academicScope[key]=v;changedScope();});
 field(pane,'Semester number',r.academicScope.semesterNumber,v=>{r.academicScope.semesterNumber=Number(v);changedScope();},{type:'number'});
 choose(pane,'Academic term',[['','Choose after checking'],['ODD','Odd'],['EVEN','Even']],r.academicScope.term,v=>{r.academicScope.term=v;changedScope();});
 choose(pane,'Degree group',[['','Choose after checking'],['UG','Undergraduate'],['PG','Postgraduate'],['PHD','Doctorate'],['OTHER','Other']],r.academicScope.degreeGroup,v=>{r.academicScope.degreeGroup=v;changedScope();});
 for(const [label,key] of [['Section','section'],['Practical subgroup','subgroup'],['Programming group','programmingGroup']])field(pane,label,r.scope[key]??'',v=>{r.scope[key]=v||null;changedScope();});
 for(const [label,key] of [['Effective from','start'],['Effective through','end']])field(pane,label,r.scope[key],v=>{r.scope[key]=v;changedScope();},{type:'date'});
 scopeConsentInput=tick(pane,'I checked this notice against my actual course, cohort, and confirmed teaching dates',r.scopeConfirmed,v=>{r.scopeConfirmed=v;dirty(s);});
 if(isLegacy(state)){
   const legacy=details(pane,'Previous-source crosswalk is missing or legacy — explicit review required',true);
   note(legacy,'No verified previous source links are available. Comparison cannot establish that older rows disappeared. Review the earlier calendar and preserve uncertain entries.','warning');
   tick(legacy,'I manually checked the original calendar and acknowledge that old source links cannot be reconstructed',r.legacySourceReviewed??false,v=>{r.legacySourceReviewed=v;dirty(s);});
   field(legacy,'Which prior documents and rows did you review?',r.legacySourceNote??'',v=>{r.legacySourceNote=v;dirty(s);},{rows:3});
 }
}
function effectReview(host,s,state,redraw){const d=s.draft,review=d.review;
 const pane=details(host,`2. Interpret extracted effects (${review.effects.length})`);
 note(pane,'Every candidate starts unconfirmed. A missing row is not an explicit cancellation. Reconcile revised dates to a specific source excerpt; never silently alter a recorded occurrence.','warning');
 const known=[['','No existing target — distinct addition'],...(state.model.sessions??[]).map(x=>[x.id,`${x.date} · ${x.start} · ${x.id}`]),...(state.model.events??[]).map(x=>[x.id,`${x.date} · ${x.title??x.id}`]),...(state.model.schedule.holidays??[]).map(x=>[x.date,`Holiday · ${x.date} · ${x.label??''}`])];
 for(const e of review.effects){
   const card=el('div',null,'revision-change');card.dataset.revisionEffect=e.id;
   add(card,el('h4',changeNames[e.kind]??e.kind),el('p',sourceInfo(d,e.sourceRef),'muted'));
   choose(card,'Reviewed meaning',KINDS.map(x=>[x,changeNames[x]]),e.kind,v=>{e.kind=v;delete e.reconciliation;dirty(s);redraw();});
   choose(card,'Original source candidate',[['','Manual entry — no extracted row'],...sourceRows(d).map(x=>[x.id,rowDescription(x)])],e.sourceRef,v=>{e.sourceRef=v;delete e.evidence;delete e.reconciliation;dirty(s);redraw();});
   choose(card,'Existing target (only if verified)',known,e.occurrenceId??e.targetId??'',v=>{e.targetId=v||undefined;e.occurrenceId=undefined;delete e.reconciliation;dirty(s);});
   const afterField=field(card,'Proposed calendar entry (editable JSON)',s.effectInputs.get(e.id)??JSON.stringify(e.after??{},null,2),v=>{
    s.effectInputs.set(e.id,v);e.confirmed=false;e.effectiveDateConfirmed=false;e.matchConfirmed=false;for(const box of card.querySelectorAll('input[type=checkbox]'))box.checked=false;
    try{const parsed=JSON.parse(v);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Object required');e.after=parsed;e.inputError='';delete e.reconciliation;dirty(s);}catch(err){e.inputError=err.message;dirty(s);}
   },{rows:5,hint:'Edit date, title, pattern or existing occurrence fields. Invalid JSON stays visible for correction.'});
   if(e.inputError)note(card,`Draft entry is invalid: ${e.inputError}`,'error');
   tick(card,'I verified this entry is applicable to my section/cohort',e.applicabilityConfirmed,v=>{e.applicabilityConfirmed=v;dirty(s);});
   tick(card,'I checked the meaning and effective date against the source',e.effectiveDateConfirmed,v=>{e.effectiveDateConfirmed=v;dirty(s);});
   tick(card,'Include this interpreted effect in the comparison',e.confirmed,v=>{e.confirmed=v;dirty(s);});
   tick(card,'I verified this is a separately added item, not an existing occurrence',e.additionConfirmed??false,v=>{e.additionConfirmed=v;dirty(s);});
   tick(card,'I matched this exact existing occurrence/source link',e.matchConfirmed??false,v=>{e.matchConfirmed=v;dirty(s);});
   field(card,'Reason for addition or matched identity',e.matchReason??'',v=>{e.matchReason=v;dirty(s);});
   const original=sourceRows(d).find(x=>x.id===e.sourceRef)?.evidence?.[0];
   const ev=e.evidence??(original?{sourceId:original.sourceId,page:original.page,excerpt:original.rawText,basis:'DIRECT_SOURCE'}:null);
   const evidence=details(card,'Source evidence, cancellation basis and previous source link');
   if(ev)evidence.append(el('p',`Page ${ev.page??'?'} · ${ev.excerpt??'No excerpt'}`));
   const newEvidence=()=>{if(!e.evidence)e.evidence={sourceId:d.source.id,page:ev?.page??d.pages[0]?.page??1,excerpt:ev?.excerpt??'',basis:ev?.basis??'DIRECT_SOURCE'};return e.evidence;};
   choose(evidence,'Basis in the actual document',[['DIRECT_SOURCE','Direct extracted statement'],['EXPLICIT_CANCELLATION','Explicit written cancellation'],['REVIEWED_OFFICIAL_CORRECTION','Manually reviewed official correction']],ev?.basis??'DIRECT_SOURCE',v=>{newEvidence().basis=v;delete e.reconciliation;dirty(s);});
   field(evidence,'Exact statement on source page',ev?.excerpt??'',v=>{newEvidence().excerpt=v;delete e.reconciliation;dirty(s);},{rows:3});
   field(evidence,'Source page number',ev?.page??1,v=>{newEvidence().page=Number(v);delete e.reconciliation;dirty(s);},{type:'number'});
   note(evidence,'Evidence must match an actual decoded page. Selecting a cancellation basis alone never establishes an authorized cancellation.','warning');
   const old=existingSource(state)?.links?.filter(x=>x.sourceRef===e.previousSourceRef)??[];
   if(old.length)evidence.append(el('pre',JSON.stringify(old,null,2)));
   else note(evidence,'No verified previous source link selected.');
   field(card,'Earlier source reference (only if verified)',e.previousSourceRef??'',v=>{e.previousSourceRef=v||undefined;delete e.reconciliation;dirty(s);});
   const correction=details(card,'Source-specific reconciliation — required when your interpretation differs from the excerpt');
   field(correction,'Reason linked to this exact source row and effect',e.reason??'',v=>{e.reason=v;delete e.reconciliation;dirty(s);},{rows:2});
   field(correction,'Reconciliation note',e.reconciliationNote??'',v=>{e.reconciliationNote=v;delete e.reconciliation;dirty(s);},{rows:2});
   button(correction,e.reconciliation?.confirmed?'Refresh source-specific reconciliation':'Confirm source-specific reconciliation',()=>{
     try{if(!e.reconciliationNote?.trim())throw Error('Explain the discrepancy before reconciling.');reconcileRevisionEffect(d,e.id,e.reconciliationNote);dirty(s);redraw();}
     catch(error){s.error=error.message;redraw();}
   },{secondary:true});
   if(e.reconciliation?.confirmed)note(correction,'Source-specific reconciliation recorded for the current interpretation. Editing it requires a new confirmation.');
   button(card,'Remove this draft effect (does not cancel the old session)',()=>{review.effects=review.effects.filter(x=>x.id!==e.id);dirty(s);redraw();},{secondary:true});
   pane.append(card);
 }
 const addPanel=details(pane,'Add a missing interpreted effect from a verified page');
 let sourceRef=sourceRows(d)[0]?.id??'',kind='ADD_HOLIDAY',date='',reason='',excerpt='',page=String(d.pages[0]?.page??1);
 choose(addPanel,'Source candidate',[['','Manually interpreted page text'],...sourceRows(d).map(x=>[x.id,rowDescription(x)])],sourceRef,v=>{sourceRef=v;});
 choose(addPanel,'Effect kind',KINDS.map(k=>[k,changeNames[k]]),kind,v=>{kind=v;});
 field(addPanel,'Effective date',date,v=>{date=v;},{type:'date'});
 field(addPanel,'Source page',page,v=>{page=v;},{type:'number'});
 field(addPanel,'Exact supporting source excerpt',excerpt,v=>{excerpt=v;},{rows:2});
 field(addPanel,'Why this row was missed / interpreted differently',reason,v=>{reason=v;},{rows:2});
 button(addPanel,'Add unconfirmed draft effect',()=>{
   if(!/^\d{4}-\d\d-\d\d$/.test(date)||!reason.trim()||!excerpt.trim()||!d.pages.some(p=>p.page===Number(page))){s.error='Specify a valid date, a page, an exact source excerpt and your review reason.';redraw();return;}
   const pageText=d.pages.find(p=>p.page===Number(page));if(!pageText.text?.replace(/\s+/g,' ').includes(excerpt.replace(/\s+/g,' '))){s.error='The evidence excerpt must actually appear on the selected source page.';redraw();return;}
   const row=sourceRows(d).find(x=>x.id===sourceRef);
   const after=kind==='ADD_HOLIDAY'?{date,label:'Review label'}:kind==='UPSERT_EVENT'?{id:null,date,start:'00:00',end:'23:59',title:'Review event',sessionId:null,cancelled:false}:kind==='REPLACE_PATTERN'?{date,weekday:0,confirmed:true}:kind==='TEACHING_END'?{date}:{};
   review.effects.push({id:newId(),sourceRef:row?.id??`manual:${newId()}`,kind,after,confirmed:false,applicabilityConfirmed:false,effectiveDateConfirmed:false,manual:!row,reason,evidence:{sourceId:d.source.id,page:Number(page),excerpt,basis:'DIRECT_SOURCE'}});
   dirty(s);redraw();
 },{secondary:true});
}
function exclusionsAndMissing(host,s,state,redraw){const d=s.draft,r=d.review;
 const pane=details(host,'3. Exclusions, omissions, and original-source links');
 note(pane,'If an extracted candidate does not apply, document why. If an older source row is missing, the existing calendar item remains unchanged. Neither exclusion nor omission is a cancellation.','warning');
 const liveRefs=new Set(r.effects.map(x=>x.sourceRef));
 for(const row of sourceRows(d)){
   const group=el('div',null,'revision-review-row');add(group,el('strong',rowDescription(row)),el('small',`Source reference: ${row.id}`));
   if(liveRefs.has(row.id)){note(group,'Linked to one or more editable effects above.');pane.append(group);continue;}
   let ex=r.exclusions.find(x=>x.sourceRef===row.id);if(!ex){ex={sourceRef:row.id,confirmed:false,reason:''};r.exclusions.push(ex);}
   tick(group,'Exclude this source candidate after reviewing applicability',ex.confirmed,v=>{ex.confirmed=v;dirty(s);});
   field(group,'Evidence-based exclusion reason',ex.reason,v=>{ex.reason=v;dirty(s);},{rows:2});pane.append(group);
 }
 const prior=existingSource(state);if(prior?.version===1&&Array.isArray(prior.links)){
   for(const link of prior.links){let old=r.missing.find(x=>x.sourceRef===link.sourceRef);if(!old){old={sourceRef:link.sourceRef,decision:'KEEP_EXISTING',confirmed:false,reason:''};r.missing.push(old);}
     const group=el('div',null,'revision-review-row');add(group,el('strong',`Previous source: ${link.kind} · ${link.value?.date??link.targetId??'existing item'}`),el('p','Do not treat absence from the new extraction as removal. Preserve current schedule unless separately evidenced.'));
     const disclosure=details(group,'Original source link and provenance');disclosure.append(el('pre',JSON.stringify(link,null,2)));
     tick(group,'Keep the previously recorded calendar effect if absent from this extraction',old.confirmed,v=>{old.confirmed=v;dirty(s);});
     field(group,'Why the existing effect should be retained',old.reason,v=>{old.reason=v;dirty(s);},{rows:2});pane.append(group);
   }
 }else note(pane,'There is no verified previous source crosswalk. A separate legacy-source review is required above.','warning');
}
function finalReview(host,s,state,redraw){const d=s.draft,r=d.review;
 const pane=details(host,'4. Manual page-coverage confirmation');
 note(pane,`Parsed ${sourceRows(d).length} calendar candidates and ${r.effects.length} possible effects across ${d.pages.length} page(s). ${s.pagesReviewed.size}/${d.pages.length} source pages explicitly reviewed. These counts cannot establish completeness.`,'warning');
 field(pane,'What did you manually verify on EVERY page (including legend, cohort, exams, notes, cancellations, rescheduling, end dates)?',r.coverageNote,v=>{r.coverageNote=v;dirty(s);},{rows:4});
 tick(pane,'I checked the source and manually resolved any relevant omissions (PARTIAL still means extraction was partial)',r.sourceCoverageConfirmed,v=>{r.sourceCoverageConfirmed=v;dirty(s);});
 field(pane,'I explicitly reviewed all interpretations, source evidence and exclusions before comparing',s.reviewConsent,v=>{s.reviewConsent=v;},{type:'checkbox',key:'revision:review-consent'});
 const unavailable=d.status==='UNSUPPORTED'||d.status==='UNREADABLE';
 button(pane,'Prepare comparison (no schedule change)',()=>{
   if(!s.reviewConsent||!d.pages.every(p=>s.pagesReviewed.has(p.page))||!r.scopeConfirmed||!r.sourceCoverageConfirmed||!r.coverageNote?.trim()||(isLegacy(state)&&(!r.legacySourceReviewed||!r.legacySourceNote?.trim()))||r.effects.some(e=>e.inputError)){
     s.error='Complete the explicit source, applicability, page-coverage and draft-entry reviews. Nothing was staged.';redraw();return;
   }
   try{
     // The importer now accepts reviewed legacy {sha256,fileName} metadata.
     // Preserve the exact source object: replacing it with null loses provenance.
     // The review gate above is mandatory whenever a verified v1 crosswalk is absent.
     const previous=existingSource(state);
     const comparison=prepareCalendarRevision({currentModel:state.model,existingSourceRevision:previous,extractedDraft:structuredClone(d)});
     s.comparison=comparison.comparison;s.proposal=comparison.proposal;s.extractionRevision=state.model.revision;s.stageConsent=false;s.error='';s.phase='compared';redraw();
   }catch(error){s.error=`Comparison failed: ${error.message}`;redraw();}
 },{disabled:unavailable});
}
function comparison(host,s,state,callbacks,redraw){if(!s.proposal)return;
 const p=s.proposal;const pane=el('section',null,'revision-compare');add(pane,el('h3','Comparison — not yet staged'),el('p',`Source: ${p.source.fileName}. ${p.changes.length} candidate change(s); ${p.unresolved.length} unresolved item(s). Your saved schedule has not changed.`));
 if(p.baseModelRevision!==state.model.revision)note(pane,'The model changed after the source was reviewed. Prepare a new comparison against the current schedule.','error');
 if(p.unresolved.length){note(pane,'Unresolved evidence or identity blocks application. Return to the review above; do not bypass these items.','warning');messages(pane,p.unresolved);}
 const status={UNCHANGED:'Already matches',ADDED:'Proposed addition',CHANGED:'Proposed edit',NEEDS_REVIEW:'Ambiguous — must resolve',POSSIBLE_REMOVAL:'Missing from extraction — retain existing'};
 for(const row of s.comparison??[]){const c=p.changes.find(x=>x.changeId===row.changeId);const card=el('div',null,'revision-review-row');add(card,el('strong',status[row.status]??row.status),el('p',sourceInfo(s.draft,row.sourceRef)));if(c)card.append(el('p',`${changeNames[c.kind]??c.kind} · ${c.after?.date??c.before?.date??'undated'}${c.affectsConfirmedHistory?' · historical attendance conflict':''}`));pane.append(card);}
 if(!s.comparison?.length)note(pane,'No changes recognized. This does not prove the revised source is complete.');
 field(pane,'I have read this comparison and understand that staged items are not yet applied',s.stageConsent,v=>{s.stageConsent=v;},{type:'checkbox',key:'revision:stage-consent'});
 const connected=typeof callbacks.onProposeCalendarRevision==='function';
 button(pane,'Stage reviewed proposal for selective application',async()=>{
   if(s.controller||!s.stageConsent||!connected||p.baseModelRevision!==state.model.revision){s.error='Confirm the comparison and use a current controller revision before staging.';redraw();return;}
   const generation=s.generation,modelRevision=state.model.revision,sourceFile=s.file;
   const stageRequest={kind:'stage',generation};
   s.controller=stageRequest;s.error='';
   try{
     const result=await callbacks.onProposeCalendarRevision({expectedModelRevision:modelRevision,proposal:structuredClone(p)});
     // A can finish storing a proposal after the user has moved on. Its transient
     // state is NOT authority for the UI to apply a superseded review.
     if(generation!==s.generation||s.latestModelRevision!==modelRevision||s.file!==sourceFile||s.proposal!==p)return;
     if(!result||typeof result.ok!=='boolean'||result.proposalId!==p.proposalId||!Array.isArray(result.issues))throw Error('A did not return the RC-001.4 staging result. No acceptance assumed.');
     s.stageMessage=result.ok?`Proposal staged for explicit selection (${result.changeCount} change(s)). No schedule change has been saved.`:`Staging rejected: ${result.code}. ${result.issues.map(i=>i.message).join('; ')}`;
     if(result.ok){s.stagedId=p.proposalId;s.authorizedStage={proposalId:p.proposalId,generation,modelRevision,sourceFile};s.stagedInvalidated=false;}
   }catch(error){if(generation===s.generation)s.error=`Staging not confirmed: ${error.message}`;}
   finally{if(s.controller===stageRequest){s.controller=null;redraw();}}
 },{disabled:!connected||p.baseModelRevision!==state.model.revision||Boolean(s.controller)});
 host.append(pane);
}
export function renderRevisionIntake(host,state,callbacks,redraw){
 const s=sessionFor(state),panel=el('section',null,'revision-intake');panel.dataset.revisionIntake='true';
 add(panel,el('h3','Upload a revised academic calendar'),el('p','The document stays on this device while it is read. File selection alone never stages or applies changes.','section-intro'));
 const upload=el('input');upload.type='file';upload.accept='.pdf,.png,.jpg,.jpeg';upload.setAttribute('aria-label','Choose revised academic calendar PDF or image');upload.dataset.uiKey='revision:file';
 upload.addEventListener('change',()=>{const file=upload.files?.[0];if(!file)return;s.controller?.abort?.();invalidateStage(s,'You selected a different document. Any earlier staged changes are blocked.');s.controller=null;s.file=file;s.draft=null;s.proposal=null;s.comparison=null;s.reviewConsent=false;s.stageConsent=false;s.pagesReviewed=new Set();s.effectInputs=new Map();s.phase='selected';s.error='';s.progress='';redraw();});
 const label=el('label',null,'release-field');add(label,el('span','Official revised-calendar document (PDF or image)'),upload);panel.append(label);
 if(s.file)note(panel,`Selected: ${s.file.name} (${Math.ceil(s.file.size/1024)} KB) · ${s.phase==='selected'?'Not read yet':s.phase==='processing'?'Reading locally':s.draft?'Extraction available for review':'Not processed'}.`);
 else note(panel,'No revised calendar selected. Your current schedule and recorded attendance are unchanged.');
 if(s.phase==='processing'){
   const progress=el('p',s.progress||'Reading document locally…','release-upload-status');progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');panel.append(progress);
   button(panel,'Cancel extraction',()=>{s.controller?.abort();invalidateStage(s,'Extraction cancelled; older staged changes are blocked.');s.controller=null;s.phase='cancelled';s.progress='Extraction cancelled. Current model unchanged.';redraw();},{secondary:true});
 }else{
   button(panel,s.phase==='error'||s.phase==='cancelled'?'Retry reading selected file':'Read selected calendar',async()=>{
     if(!s.file)return;
     const controller=new AbortController(),generation=s.generation,sourceFile=s.file;s.controller=controller;s.phase='processing';s.progress='Reading local file…';s.error='';redraw();
     try{
       const bytes=new Uint8Array(await sourceFile.arrayBuffer());if(controller.signal.aborted||generation!==s.generation)return;
       const d=await extractCalendarRevision({academicCalendar:{fileName:sourceFile.name,bytes},section:state.model.context.section,signal:controller.signal,onProgress:p=>{if(generation!==s.generation)return;s.progress=statusText(p);const node=document.querySelector('[data-revision-intake] .release-upload-status');if(node)node.textContent=s.progress;}});
       if(controller.signal.aborted||generation!==s.generation)return;
       s.draft=d;s.extractionRevision=state.model.revision;s.reviewedModelRevision=state.model.revision;s.pagesReviewed=new Set();s.effectInputs=new Map();s.phase='review';s.reviewConsent=false;s.stageConsent=false;
       if(d.status==='UNREADABLE'||d.status==='UNSUPPORTED')s.error='This source could not be decoded into supported calendar entries. Keep your existing schedule, and retry or use a better source.';
     }catch(error){if(generation!==s.generation)return;if(controller.signal.aborted){s.phase='cancelled';s.progress='Extraction cancelled.';}else{s.phase='error';s.error=`Unable to read file: ${error.message}`;}}
     finally{if(generation===s.generation){if(s.controller===controller)s.controller=null;redraw();}}
   },{disabled:!s.file});
   if(s.file)button(panel,'Discard selected review',()=>{invalidateStage(s,'Review discarded. The controller may retain an older proposal, but it is no longer authorized here.');s.file=null;s.draft=null;s.proposal=null;s.comparison=null;s.phase='empty';s.error='';s.pagesReviewed=new Set();s.effectInputs=new Map();s.reviewConsent=false;redraw();},{secondary:true});
 }
 if(s.phase==='cancelled')note(panel,s.progress||'Extraction cancelled. The existing schedule remains unchanged.','warning');
 if(s.error)note(panel,s.error,'error');
 if(s.stageMessage)note(panel,s.stageMessage);
 if(s.draft){
   if(s.reviewedModelRevision!==state.model.revision){
     // UI review approvals are tied to the roster that was reviewed; the source
     // stays available for correction but previous confirmations are no longer valid.
     s.draft.review.scopeConfirmed=false;s.draft.review.sourceCoverageConfirmed=false;
     s.draft.review.effects.forEach(e=>{e.confirmed=false;e.matchConfirmed=false;});
     (s.draft.review.exclusions??[]).forEach(e=>e.confirmed=false);(s.draft.review.missing??[]).forEach(e=>e.confirmed=false);
     s.pagesReviewed=new Set();s.reviewConsent=false;s.comparison=null;s.proposal=null;
     s.reviewedModelRevision=state.model.revision;
   }
   if(s.extractionRevision!==null&&state.model.revision!==s.extractionRevision)note(panel,'The model revision changed after extraction. Your editable draft is retained, but review the current setup and prepare a fresh comparison before staging.','warning');
   detectedSource(panel,s);if(['PARTIAL','REVIEW_REQUIRED'].includes(s.draft.status)){
     scopeReview(panel,s,state,redraw);effectReview(panel,s,state,redraw);exclusionsAndMissing(panel,s,state,redraw);finalReview(panel,s,state,redraw);
   }
 }
 comparison(panel,s,state,callbacks,redraw);host.append(panel);
}

export function isRevisionStageLocallyOutdated(state){
 const s=sessionFor(state),p=state.stagedCalendarRevision,a=s.authorizedStage;
 if(!p)return s.stagedInvalidated;
 // A owns staged storage; C independently authorizes only a successful response
 // matching the current document, review generation and model revision.
 return !a||a.proposalId!==p.proposalId||a.generation!==s.generation||a.modelRevision!==state.model.revision||a.sourceFile!==s.file||s.stagedInvalidated;
}
