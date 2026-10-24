import {extractDocuments,createImportJob,compileConfirmedImport} from '../import/index.js';
import {DAYS,evidence,issue} from '../import/parse.js';
let root=null,draft=null,live=null,busy=false,submitted=false;
const jobs=createImportJob(extractDocuments);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function field(parent,label,type,value,onchange,choices){
  const wrap=el('label'),name=el('span',label),input=el(type==='select'?'select':type==='textarea'?'textarea':'input');
  if(!['select','textarea'].includes(type))input.type=type;
  input.setAttribute('aria-label',label);
  if(choices)for(const [v,t] of choices){const opt=el('option',t);opt.value=v;input.append(opt);}
  if(type==='checkbox')input.checked=value===true;else input.value=value??'';
  input.addEventListener(type==='checkbox'||type==='select'?'change':'input',()=>onchange(type==='checkbox'?input.checked:input.value));
  wrap.append(name,input);parent.append(wrap);return input;
}
const action=(parent,label,fn)=>{const b=el('button',label);b.type='button';b.addEventListener('click',fn);parent.append(b);return b;};
const detail=(parent,label,open=false)=>{const box=el('details');box.open=open;box.append(el('summary',label));parent.append(box);return box;};
const choices=list=>list.map(x=>[x,x.replaceAll('_',' ')]);
const reviewed=r=>['CONFIRMED','CORRECTED'].includes(r.review);
function message(parent,text){const p=el('p',text);p.setAttribute('role','status');parent.append(p);return p;}
function sourceEvidence(parent,row){
  const box=detail(parent,'Source text and location');
  for(const e of row.evidence??[]){box.append(el('p',`${draft.sources.find(s=>s.id===e.sourceId)?.fileName??'Source'} · page ${e.page} · ${e.method}${e.confidence===null?'':` · OCR confidence ${Math.round(e.confidence)} (not correctness)`}${e.bbox?` · region ${e.bbox.map(n=>n.toFixed(3)).join(', ')}`:''}`));box.append(el('blockquote',e.rawText));
    action(box,'Show source page',()=>{const option=root.querySelector('[data-page-picker]');option.value=`${e.sourceId}:${e.page}`;option.dispatchEvent(new Event('change'));root.querySelector('[data-source-view]').scrollIntoView({block:'start'});});
  }
}
const number=v=>v.trim()===''?null:Number(v);
const rowNote=(box,r)=>field(box,'Resolution / correction reason','textarea',r.resolutionNote,v=>{r.resolutionNote=v;invalidate();});
function invalidate(){submitted=false;}
export function syncDocumentImport(state){
  live={...live,state};
  if(state.mode!=='personal'||state.model){jobs.cancel();busy=false;}
  if(state.mode==='personal'&&state.model){draft=null;root=null;submitted=false;}
}
export function documentImport(state,callbacks,clock){
  live={state,callbacks,clock};
  if(root)return root;
  root=el('section');root.className='document-import';root.dataset.documentImport='true';
  root.append(el('h3','Start with your documents'),el('p','Choose a timetable and academic calendar. PDF, PNG or JPEG, up to 15 MB each and 20 PDF pages. Everything is processed on this device with free local tools. Review and correct the draft before saving. Unfinished imports are lost on reload.'));
  const files=el('div');files.className='import-fields';root.append(files);let generation=0,timetable,calendar,section='Q',subgroup='Q3',programming='Q23';
  const tt=field(files,'Timetable file','file','',()=>{});tt.accept='.pdf,.png,.jpg,.jpeg';tt.addEventListener('change',()=>{timetable=tt.files[0];reset();});
  const cal=field(files,'Academic calendar file','file','',()=>{});cal.accept=tt.accept;cal.addEventListener('change',()=>{calendar=cal.files[0];reset();});
  field(files,'Section','text',section,v=>{section=v;reset();});field(files,'Practical subgroup','text',subgroup,v=>{subgroup=v;reset();});field(files,'Programming-lab label','text',programming,v=>{programming=v;reset();});
  const status=message(root,'Choose both documents. Q3 physics mapping must be confirmed from a separate source; it will not be guessed.');
  const output=el('div');output.dataset.importOutput='true';
  const run=action(root,'Extract editable draft',async()=>{
    if(!timetable||!calendar){status.textContent='Choose both files first.';return;}
    if(busy)return;const token=++generation;busy=true;run.disabled=true;submitted=false;output.replaceChildren();draft=null;
    try{
      const source=async file=>{if(file.size>15*1024*1024)throw Error('Each file must be at most 15 MB.');return {fileName:file.name,mimeType:file.type,bytes:new Uint8Array(await file.arrayBuffer())};};
      const request={timetable:await source(timetable),academicCalendar:await source(calendar),section,subgroup,programmingGroup:programming,onProgress:p=>{status.textContent=`${p.sourceRole==='TIMETABLE'?'Timetable':'Calendar'}: ${p.stage.toLowerCase().replaceAll('_',' ')}${p.page?` · page ${p.page}/${p.pages}`:''}`;}};
      if(token!==generation)return;draft=await jobs.run(request);status.textContent=draft.status==='REVIEW_REQUIRED'?'Extraction produced an unconfirmed draft. Check every page and unresolved item before continuing.':draft.issues.map(i=>i.message).join(' ');
      if(draft.status==='REVIEW_REQUIRED')reviewDraft(output);
    }catch(e){if(e.name!=='AbortError')status.textContent=e.message;}
    finally{if(token===generation){busy=false;run.disabled=false;}}
  });
  action(root,'Cancel / discard import',()=>{reset();tt.value='';cal.value='';timetable=calendar=null;status.textContent='Import discarded. Personal state was not changed.';});root.append(output);
  function reset(){generation++;jobs.cancel();busy=false;run.disabled=false;draft=null;output.replaceChildren();submitted=false;status.textContent='Source changed. Extract again; previous draft discarded.';}
  return root;
}
function reviewDraft(parent){
  const d=draft;
  parent.append(el('h3','1. Review sources and extracted coverage'),el('p',`Sections found: ${d.sectionCandidates.join(', ')}. Selected ${d.selectedSection}. ${d.timetableEntries.filter(r=>r.kind==='LECTURE').length} lecture periods; ${d.timetableEntries.filter(r=>r.kind==='LAB').length} merged lab blocks. Every weight, count and policy still requires confirmation.`));
  const warnings=detail(parent,`Extraction notices (${d.issues.length})`);for(const i of d.issues)warnings.append(el('p',i.message));
  const pageBox=detail(parent,'Source preview, raw text and page coverage',true);pageBox.dataset.sourceView='true';
  const picker=field(pageBox,'Source page','select','',()=>{},d.pages.map(p=>[`${p.sourceId}:${p.page}`,`${d.sources.find(s=>s.id===p.sourceId).fileName} · page ${p.page}`]));picker.dataset.pagePicker='true';
  const view=el('div');pageBox.append(view);
  const show=()=>{
    const p=d.pages.find(p=>`${p.sourceId}:${p.page}`===picker.value);if(!p)return;view.replaceChildren();
    const img=el('img');img.src=p.preview;img.alt=`Source page ${p.page}`;view.append(img);
    field(view,'Zoom source preview','range','100',v=>{img.style.maxWidth='none';img.style.width=`${v}%`;}).setAttribute('max','250');
    const raw=detail(view,'Raw extracted text (not an instruction or planner verdict)');raw.append(el('pre',p.text));
    field(view,'I checked this whole page, including legends, footnotes, omitted rows and cohort rules; I added all applicable missing obligations below','checkbox',p.reviewed,v=>{p.reviewed=v;invalidate();});
  };picker.addEventListener('change',show);picker.value=`${d.pages[0].sourceId}:${d.pages[0].page}`;show();
  const roster=detail(parent,'2. Review subjects and aliases',true);
  for(const s of d.subjects){const box=detail(roster,s.name);field(box,'Subject family name','text',s.name,v=>{s.name=v;invalidate();});box.append(el('p',`Alias proposals from source: ${s.aliases.join(' / ')}. Theory and practical registers remain separate.`));field(box,'I reviewed this subject and its alias proposal','checkbox',reviewed(s),v=>{s.review=v?'CONFIRMED':'UNREVIEWED';invalidate();renderConfirmation();});sourceEvidence(box,s);}
  action(roster,'Confirm reviewed subject and register labels',()=>{for(const s of d.subjects)s.review='CONFIRMED';for(const r of d.registers)r.review='CONFIRMED';invalidate();renderConfirmation();message(roster,'Names and alias proposals confirmed. Occurrences, units and group mapping still require review.');});
  const timetable=detail(parent,'3. Review weekly periods, groups and attendance units',true);
  const rowList=el('div');timetable.append(rowList);
  function showTimetable(){rowList.replaceChildren();for(const r of d.timetableEntries){
    const s=d.subjects.find(s=>s.id===r.subjectId),box=detail(rowList,`${DAYS[r.weekday-1]??'Day?'} ${r.start}–${r.end} · ${s?.name??'Unknown'} · ${r.kind}`);box.dataset.importRow=r.id;
    const fields=el('div');fields.className='import-fields';box.append(fields);
    field(fields,'Weekday','select',r.weekday,v=>{r.weekday=number(v);invalidate();},DAYS.map((s,i)=>[i+1,s]));field(fields,'Start','time',r.start,v=>{r.start=v;invalidate();});field(fields,'End','time',r.end,v=>{r.end=v;invalidate();});
    field(fields,'Applies to me','select',r.applicability,v=>{r.applicability=v;invalidate();renderConfirmation();},choices(['UNRESOLVED','APPLIES','DOES_NOT_APPLY']));
    if(r.groupOptions.length){field(fields,'Source group label (confirm its mapping)','select',r.groupChoice??'',v=>{r.groupChoice=v||null;invalidate();},[['','Unresolved'],...r.groupOptions.map(s=>[s,s])]);box.append(el('p',`Declared: ${d.declaredSubgroup} / programming ${d.declaredProgrammingGroup}. Source choices: ${r.groupOptions.join(', ')}. A mapping explanation is required; Physics Q1/Q2 does not establish Q3.`));}
    field(fields,'Attendance treatment','select',r.treatment,v=>{r.treatment=v;invalidate();renderConfirmation();},choices(['UNRESOLVED','ATTENDANCE','COMPULSORY_ZERO_UNITS','OPTIONAL','BREAK']));
    field(fields,'Attendance units per occurrence (not duration)','number',r.weight,v=>{r.weight=number(v);invalidate();});
    const reg=d.registers.find(v=>v.id===r.registerId);field(fields,'Independent register name','text',reg?.name??'',v=>{if(reg)reg.name=v;invalidate();});
    rowNote(box,r);field(box,'I reviewed this occurrence, including applicability and any group mapping','checkbox',reviewed(r),v=>{r.review=v?'CONFIRMED':'UNREVIEWED';if(reg)reg.review=r.review;invalidate();});sourceEvidence(box,r);
  }}showTimetable();
  action(timetable,'Add missing weekly occurrence from source',()=>{
    const p=d.pages.find(p=>d.sources.find(s=>s.id===p.sourceId)?.role==='TIMETABLE');const ev=evidence(d.sources.find(s=>s.id===p.sourceId),p,p.items);
    const sub={id:crypto.randomUUID(),name:'Correct from source',aliases:[],review:'UNREVIEWED',evidence:[ev]};d.subjects.push(sub);const reg={id:crypto.randomUUID(),subjectId:sub.id,name:'Correct register name',kind:'THEORY',review:'UNREVIEWED',evidence:[ev]};d.registers.push(reg);
    d.timetableEntries.push({id:crypto.randomUUID(),kind:'UNKNOWN',subjectId:sub.id,registerId:reg.id,weekday:null,start:null,end:null,groupOptions:[],groupChoice:null,applicability:'UNRESOLVED',treatment:'UNRESOLVED',weight:null,review:'UNREVIEWED',evidence:[ev]});parent.replaceChildren();reviewDraft(parent);
  });
  const calendar=detail(parent,`4. Review academic dates and exceptions (${d.calendarEntries.length} candidates)`,true);
  calendar.append(el('p','Review clear holidays together; keep exams, boundaries, tentative windows and administrative activities distinct. Exams do not cancel classes. Whole-window protection is a deliberate choice, not an extracted exam timetable. Dates from other institutions must never fill gaps in this semester.'));
  const calendarList=el('div');calendar.append(calendarList);
  const renderCalendar=()=>{calendarList.replaceChildren();for(const r of d.calendarEntries){
    const box=detail(calendarList,`${r.kind} · ${r.startDate??'Date unresolved'} · ${r.title.slice(0,125)}`);box.dataset.calendarRow=r.id;
    const fields=el('div');fields.className='import-fields';box.append(fields);
    for(const [key,label,type] of [['title','Title','text'],['startDate','Start date','date'],['endDate','End date','date']])field(fields,label,type,r[key],v=>{r[key]=v||null;invalidate();});
    field(fields,'Source category','select',r.kind,v=>{r.kind=v;invalidate();},choices(['HOLIDAY','NON_TEACHING','REPLACEMENT','WORKING_DAY_NOTICE','TEACHING_BOUNDARY','EXAM_WINDOW','ACADEMIC_ACTIVITY','VACATION','UNKNOWN']));
    field(fields,'Term','select',r.term,v=>{r.term=v;invalidate();},choices(['ODD','EVEN','BOTH','UNSPECIFIED']));
    field(fields,'Applies to my cohort','select',r.applicability,v=>{r.applicability=v;invalidate();},choices(['UNRESOLVED','APPLIES','DOES_NOT_APPLY']));
    field(fields,'Planner treatment','select',r.treatment,v=>{r.treatment=v;invalidate();},choices(['UNRESOLVED','HOLIDAY','NON_TEACHING','REPLACEMENT','TEACHING_BOUNDARY','COMPULSORY','INFORMATION_ONLY','DOES_NOT_APPLY']));
    field(fields,'Replacement weekday (only if explicitly established)','select',r.replacementWeekday??'',v=>{r.replacementWeekday=number(v);invalidate();},[['','Unknown'],...DAYS.map((s,i)=>[i+1,s])]);
    field(fields,'Actual event start','time',r.startTime,v=>{r.startTime=v||null;invalidate();});field(fields,'Actual event end','time',r.endTime,v=>{r.endTime=v||null;invalidate();});
    field(box,'I explicitly choose whole-window all-day protection for this event (00:00–23:59 each included day)','checkbox',r.allDay,v=>{r.allDay=v;invalidate();});
    box.append(el('p',`Source certainty: ${r.certainty}. Source date text: ${r.rawDateText}`));rowNote(box,r);
    field(box,'Review decision','select',r.review,v=>{r.review=v;invalidate();},choices(['UNREVIEWED','CONFIRMED','CORRECTED']));sourceEvidence(box,r);
  }};renderCalendar();
  action(calendar,'Confirm clearly administrative rows as information after review',()=>{let count=0;for(const r of d.calendarEntries)if(/committee|HoDs|IQAC|\bPAC\b|\bDAC\b|faculty workload|CO-PO|course files|\bERP\b|audit|SAR/i.test(r.title)&&!/student|sessional|exam|orientation|holiday|teaching period/i.test(r.title)){r.review='CONFIRMED';r.applicability='APPLIES';r.treatment='INFORMATION_ONLY';r.resolutionNote='Reviewed staff/administrative information; no student restriction.';count++;}renderCalendar();invalidate();message(calendar,`${count} clearly administrative rows reviewed. Remaining ambiguous obligations still require decisions.`);});
  action(calendar,'Confirm clear holiday candidates after source review',()=>{for(const r of d.calendarEntries)if(r.kind==='HOLIDAY'&&r.startDate&&r.startDate===r.endDate){r.review='CONFIRMED';r.applicability='APPLIES';r.treatment='HOLIDAY';}renderCalendar();invalidate();});
  action(calendar,'Add missing date / exception from displayed calendar page',()=>{
    const p=d.pages.find(p=>`${p.sourceId}:${p.page}`===picker.value);if(d.sources.find(s=>s.id===p.sourceId)?.role!=='ACADEMIC_CALENDAR'){message(calendar,'Choose the calendar page in the source preview first.');return;}
    d.calendarEntries.push({id:crypto.randomUUID(),title:'Correct from source',kind:'UNKNOWN',startDate:null,endDate:null,rawDateText:p.text,term:'UNSPECIFIED',audienceText:null,printedCalendarWeekday:null,replacementWeekday:null,replacesDate:null,certainty:'UNSPECIFIED',applicability:'UNRESOLVED',treatment:'UNRESOLVED',allDay:null,startTime:null,endTime:null,review:'UNREVIEWED',evidence:[evidence(d.sources.find(s=>s.id===p.sourceId),p,p.items)]});renderCalendar();invalidate();
  });
  const confirm=detail(parent,'5. Subjects I must attend, actual counts and final confirmation',true),content=el('div');confirm.append(content);
  // Keep confirmation values in memory across treatment edits. They never enter localStorage.
  const formState=d.confirmation??(d.confirmation={values:{},rules:{},counts:{},protected:[],sources:{}});
  const options=()=>buildOptions(d,formState);
  function renderConfirmation(){
    content.replaceChildren();const values=formState.values;
    const input=(label,type,key,initial='',choices_)=>field(content,label,type,values[key]??initial,v=>{values[key]=v;invalidate();},choices_);
    const filter=input('Search reviewed subjects','search','search');
    const protectedSelect=el('select');protectedSelect.multiple=true;protectedSelect.size=6;protectedSelect.setAttribute('aria-label','Subjects I must attend');content.append(protectedSelect);
    function fill(){protectedSelect.replaceChildren();for(const s of d.subjects.filter(reviewed).filter(s=>d.timetableEntries.some(r=>r.subjectId===s.id&&r.applicability==='APPLIES'&&r.treatment==='ATTENDANCE')).filter(s=>s.name.toLowerCase().includes(filter.value.toLowerCase()))){const opt=el('option',s.name);opt.value=s.id;opt.selected=formState.protected.includes(s.id);protectedSelect.append(opt);}}
    filter.addEventListener('input',fill);protectedSelect.addEventListener('change',()=>{const visible=[...protectedSelect.options].map(o=>o.value);formState.protected=[...formState.protected.filter(id=>!visible.includes(id)),...[...protectedSelect.selectedOptions].map(o=>o.value)];invalidate();});fill();
    const selected=el('p',`Selected protections: ${formState.protected.map(id=>d.subjects.find(s=>s.id===id)?.name).join(', ')||'None'}`);content.append(selected);protectedSelect.addEventListener('change',()=>{selected.textContent=`Selected protections: ${formState.protected.map(id=>d.subjects.find(s=>s.id===id)?.name).join(', ')||'None'}`;});
    for(const [key,label,value] of [['institution','Institution',''],['year','Academic year',''],['semester','Semester number',''],['programme','Programme',''],['start','Confirmed schedule start',''],['end','Confirmed last teaching day',''],['snapshot','Counts complete through',''],['candidateStart','First candidate break date',''],['candidateEnd','Last candidate break date',''],['k','Number of NEW days requested','2']])input(label,['start','end','snapshot','candidateStart','candidateEnd'].includes(key)?'date':'text',key,value);
    input('Term','select','term','ODD',choices(['ODD','EVEN']));input('Degree group','select','degree','UG',choices(['UG','PG','PHD','OTHER']));
    input('Teaching-assistant role','select','ta','',[["","Unconfirmed"],['yes','Yes'],['no','No']]);
    input('I checked academic identity, source applicability and teaching horizon','checkbox','horizon',false);input('All actual counts refer to this same completed day','checkbox','snapshotConfirm',false);input('If today, every attendance meeting ended and none remain','checkbox','completeToday',false);
    for(const s of d.sources){const yes=formState.sources[s.id]??(formState.sources[s.id]={});const box=detail(content,`Applicability: ${s.fileName}`);box.append(el('p',`Detected institution: ${s.institutionLabel??'Not established'} · SHA-256 ${s.sha256}. Confirm identity against your actual institution; filenames do not select a template.`));for(const [key,label] of [['institutionConfirmed','I verified this source institution'],['termConfirmed','I verified its term / academic year'],['cohortConfirmed','I verified first-year / programme / cohort applicability, exceptions and notices']])field(box,label,'checkbox',yes[key],v=>{yes[key]=v;invalidate();});}
    const used=new Set(d.timetableEntries.filter(r=>r.applicability==='APPLIES'&&r.treatment==='ATTENDANCE').map(r=>r.registerId));
    for(const r of d.registers.filter(r=>used.has(r.id))){const box=detail(content,`Actual counts and policy: ${r.name}`),rules=formState.rules[r.id]??(formState.rules[r.id]={}),counts=formState.counts[r.id]??(formState.counts[r.id]={});
      for(const [key,label] of [['R','Requirement R (%)'],['T','Optional personal target T (%)'],['B','Buffer B (percentage points)']])field(box,label,'text',rules[key],v=>{rules[key]=v;invalidate();});
      for(const [key,label] of [['attended','Actually attended units'],['held','Actually held units']])field(box,label,'number',counts[key],v=>{counts[key]=v;invalidate();});
    }
    field(content,'Confirmed teaching on labelled holiday dates (comma-separated, only if explicitly notified)','text',values.holidayTeaching??'',v=>{values.holidayTeaching=v;invalidate();});
    const errors=el('div');errors.setAttribute('role','alert');errors.dataset.importErrors='true';content.append(errors);
    action(content,'Validate reviewed draft and save initial setup',()=>{
      if(submitted)return;if(live.state.model||live.state.mode!=='personal'){errors.textContent='Import is initial setup only; existing models/history cannot be replaced.';return;}
      const result=compileConfirmedImport(d,options());errors.replaceChildren();
      if(!result.ok){errors.append(el('p',`${result.issues.filter(i=>i.severity==='ERROR').length} unresolved issues. No model was saved.`));for(const i of result.issues.filter(i=>i.severity==='ERROR'))errors.append(el('p',`${i.code}: ${i.message}${i.rowIds.length?` (${d.timetableEntries.find(r=>r.id===i.rowIds[0])?.start??d.calendarEntries.find(r=>r.id===i.rowIds[0])?.title.slice(0,80)??'review row'})`:''}`));errors.scrollIntoView({block:'nearest'});return;}
      submitted=true;live.callbacks.onReplaceSetup({model:result.model});
      // The controller synchronously renders success or its real rejection notice.
      if(!live.state.model){submitted=false;errors.textContent=`Setup was not saved: ${live.state.notice||'Controller rejected the setup. Review the draft.'}`;}
    });
  }
  renderConfirmation();
}
function basis(s,optional=false){if(optional&&(s===undefined||s===''))return null;if(!/^\d+(?:\.\d{1,2})?$/.test(s??''))return NaN;const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
function buildOptions(d,f){
  const v=f.values,now=live.clock(),used=new Set(d.timetableEntries.filter(r=>r.applicability==='APPLIES'&&r.treatment==='ATTENDANCE').map(r=>r.registerId));
  return {modelId:`import-${d.id}`,context:{college:v.institution??'',academicYear:v.year??'',semester:v.semester??'',programme:v.programme??'',section:d.selectedSection,sourceLabel:d.sources.map(s=>s.fileName).join(' + '),preparedOn:now.date,applicabilityConfirmed:v.horizon===true},academicScope:{institution:v.institution??'',academicYear:v.year??'',term:v.term??'ODD',degreeGroup:v.degree??'UG',semesterNumber:number(v.semester??''),programme:v.programme??'',isTeachingAssistant:v.ta==='yes'?true:v.ta==='no'?false:null},sourceApplicability:f.sources,clockPlaceholder:now,startDate:v.start,teachingEnd:v.end,horizonConfirmed:v.horizon===true,protectedSubjectIds:f.protected,registerRules:Object.fromEntries([...used].map(id=>{const r=f.rules[id]??{};return [id,{requiredBps:basis(r.R),personalMinBps:basis(r.T,true),bufferBps:basis(r.B)}];})),snapshot:{date:v.snapshot,confirmed:v.snapshotConfirm===true,completeToday:v.completeToday===true,counts:Object.fromEntries([...used].map(id=>[id,{attended:number(f.counts[id]?.attended??''),held:number(f.counts[id]?.held??'')}]))},preferences:{candidateStart:v.candidateStart,candidateEnd:v.candidateEnd,requestedDays:number(v.k??'2'),preferredDates:[],notes:''},replacements:[],holidayTeachingDates:(v.holidayTeaching??'').split(/[,\s]+/).filter(Boolean)};
}
