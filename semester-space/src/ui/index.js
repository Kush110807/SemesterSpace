// SemesterSpace UI — role C, SS-INT-001, contract 1.1.0.
// DOM-only rendering. A owns every state transition and B owns every decision.
const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHORT_LABELS={HOLIDAY:'Holiday',TEACHING:'Class',PROTECTED:'Must',COMPULSORY:'Event',SELECTED:'Chosen',COMMITTED:'Saved',INVALID_COMMITMENT:'Invalid',ALREADY_OFF:'Off',HISTORICAL:'Past',OUTSIDE_HORIZON:'Outside',SUGGESTED:'Suggest'};
const LABELS = {
  HOLIDAY:'Holiday', TEACHING:'Teaching', PROTECTED:'Must attend',
  COMPULSORY:'Compulsory event', SELECTED:'Manual selection', COMMITTED:'Committed',
  INVALID_COMMITMENT:'Invalid commitment', ALREADY_OFF:'Already off',
  HISTORICAL:'Historical', OUTSIDE_HORIZON:'Outside horizon', SUGGESTED:'Suggested',
};
const STATES = {
  INVALID_SETUP:['Correct the setup','Invalid inputs or confirmation metadata; no valid plan verdict.','danger'],
  ATTENDANCE_UPDATE_NEEDED:['Attendance update needed','A teaching session has started since the last completed-day snapshot. Update actual counts before planning.','warning'],
  EXISTING_UNRECOVERABLE_SHORTFALL:['Existing shortfall cannot recover','Even attending every remaining class cannot meet the planning floor in this model.','danger'],
  PLAN_BLOCKED:['Combined plan blocked','The evaluated dates do not satisfy the supplied rules.','danger'],
  CONDITIONAL_RECOVERY:['Conditional recovery plan','Possible only if all required recovery sessions and other assumed meetings are attended.','warning'],
  MEETS_PLANNING_RULES:['Meets supplied planning rules','Conditional projection, not institutional approval.','good'],
};
const DRAFTS = new Map();
const PANEL_OPEN = new Map();
let live = null;
let scope = null;
let pendingSubmission = null;
let setupRowSerial = 1;
// One opaque ID per local draft row, never derived from names or render order.
const setupNonce=Math.random().toString(36).slice(2,10);
const setupRows = {courses:[0],registers:[0],weekly:[0],extra:[],events:[]};
let setupStep=0, wizardIssue='', pendingFocusKey=null;
const STEP_TITLES=['Academic identity','Courses, registers and actual counts','Timetable, exceptions and events','Confirm snapshot and request'];
const internalId=(kind,row)=>`ss-${kind}-${setupNonce}-${row}`;
const nameFromDraft=(kind,row,key)=>draftMap().get(`setup-${kind}-${row}::${kind==='courses'?'course':kind==='registers'?'register':'extra'}-${row}-${key}`)??'';
function setupOptions(kind){
  const title=kind==='courses'?'course':kind==='registers'?'register':'extra meeting';
  return [{value:'',label:`Select a ${title} explicitly`},...setupRows[kind].map((row,i)=>({
    value:internalId(kind,row),label:`${title[0].toUpperCase()+title.slice(1)} ${i+1} · ${String(nameFromDraft(kind,row,kind==='courses'?'name':kind==='registers'?'name':'date')).trim()||'unnamed / incomplete'}`
  }))];
}


function el(tag,text=null,cls='') {
  const e=document.createElement(tag);
  if(text!==null)e.textContent=String(text);
  if(cls)e.className=cls;
  return e;
}
function add(parent,...nodes){for(const n of nodes)parent.append(n);return parent;}
function copy(v){return structuredClone(v);}
function safeInt(raw,{positive=false}={}) {
  const s=String(raw).trim();
  if(!/^(0|[1-9]\d*)$/.test(s))throw Error('Use a nonnegative whole number, without fractions or signs.');
  const n=Number(s);
  if(!Number.isSafeInteger(n)||(positive&&n<1))throw Error(positive?'Enter a positive safe integer.':'Number exceeds the safe integer limit.');
  return n;
}
function percentBps(raw,optional=false,allowZero=false) {
  const s=String(raw).trim();
  if(optional&&s==='')return null;
  if(!/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.test(s))throw Error('Enter a percentage with no more than two decimal places.');
  const [whole,fraction='']=s.split('.');
  const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(n)||n>(allowZero?10000:10000)||(!allowZero&&n===0))throw Error('Percentage out of range.');
  return n;
}
function registerLabel(model, register){
  if(!register)return 'Unknown register';
  const course=model?.courses?.find(c=>c.id===register.courseId);
  const index=model?.registers?.findIndex(r=>r.id===register.id)??-1;
  return `${register.name} · ${course?.name??'Unknown course'} (register ${index+1})`;
}
function ratio(v){return v?.percentage===null?'Not started':v?.percentage===undefined?'Not calculated':`${v.percentage}%`;}
function pct(bp){return bp==null?'—':`${(bp/100).toFixed(2)}%`;}
function timeNow(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,timeZone:'Asia/Kolkata'};
}
function monthShift(month,n){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
function dateList(value){return value.trim()?value.split(/[\s,;]+/).filter(Boolean):[];}
function pipeRows(value,columns,heading){
  return value.split('\n').map(s=>s.trim()).filter(Boolean).map((line,index)=>{
    const cells=line.split('|').map(x=>x.trim());
    if(cells.length!==columns)throw Error(`${heading}, line ${index+1}: expected ${columns} values separated by |.`);
    return cells;
  });
}
function draftMap(){if(!DRAFTS.has(scope))DRAFTS.set(scope,new Map());return DRAFTS.get(scope);}
function control(key,type,value,attributes={}) {
  const input=el(type==='textarea'?'textarea':type==='select'?'select':'input');
  if(!['textarea','select'].includes(type))input.type=type;
  input.dataset.uiKey=key;
  if(type==='select')for(const option of attributes.options??[]){const o=el('option',option.label);o.value=String(option.value);input.append(o);}

  for(const [name,val] of Object.entries(attributes)){
    if(name==='options'||name==='checked')continue;
    if(name==='required'||name==='disabled'||name==='readOnly')input[name]=Boolean(val);
    else if(name==='rows'||name==='min'||name==='max'||name==='step'||name==='placeholder'||name==='autocomplete')input[name]=val;
  }
  const saved=draftMap().get(key);
  if(type==='checkbox')input.checked=saved===undefined?Boolean(attributes.checked??value):Boolean(saved);
  else {
    const choice=saved===undefined?String(value??''):String(saved);
    if(type==='select'&&choice&&!Array.from(input.options).some(o=>o.value===choice)){
      // Do not remap a reference when its target draft row was removed.
      const missing=el('option','Removed selection — choose a valid row');missing.value=choice;missing.disabled=true;input.prepend(missing);
    }
    input.value=choice;
  }
  return input;
}
function field(parent,group,id,label,type,value,attrs={}){
  const key=`${group}::${id}`;
  const wrap=el('label',null,type==='checkbox'?'check-field':'form-field');
  const input=control(key,type,value,attrs);
  const title=el('span',label);
  if(type==='checkbox')add(wrap,input,title);else add(wrap,title,input);
  if(attrs.hint)add(wrap,el('small',attrs.hint,'field-help'));
  parent.append(wrap);
  return input;
}
function button(text,handler,{secondary=false,disabled=false,focusKey=null,danger=false}={}){
  const b=el('button',text,`action ${secondary?'secondary':''} ${danger?'danger-action':''}`.trim());
  b.type='button';b.disabled=disabled;
  if(focusKey)b.dataset.uiKey=focusKey;
  b.addEventListener('click',handler);return b;
}
function submit(parent,text){const b=el('button',text,'action');b.type='submit';b.dataset.uiKey=`submit:${parent.dataset.formGroup??text}`;parent.append(b);return b;}
function notice(parent,text,kind='muted'){return add(parent,el('p',text,kind));}
function section(title,lead,cls=''){const s=el('section',null,cls);add(s,el('h2',title),el('p',lead,'section-intro'));return s;}
function details(parent,id,title,open=false){
  const d=el('details',null,'panel');d.dataset.uiPanel=id;d.open=PANEL_OPEN.has(`${scope}:${id}`)?PANEL_OPEN.get(`${scope}:${id}`):open;
  const summary=el('summary',title);summary.dataset.uiKey=`panel:${id}`;add(d,summary);parent.append(d);return d;
}
function form(group,handler){
  const f=el('form',null,'control-form');f.dataset.formGroup=group;f.noValidate=false;
  f.addEventListener('submit',ev=>{
    ev.preventDefault();
    const existing=f.querySelector('[data-form-error]');if(existing)existing.remove();
    try{
      const prev=live?.state?.model?.revision??null;
      // A's callbacks synchronously render; reset ONLY this submitted group on revision change.
      pendingSubmission={group,previousRevision:prev,previousModelId:live?.state?.model?.id??null};
      handler();
      pendingSubmission=null;
    }catch(e){pendingSubmission=null;const p=el('p',e.message||'Invalid form values.','form-error');p.dataset.formError='true';p.setAttribute('role','alert');f.append(p);}
  });return f;
}
function issueList(parent,items,empty='No issues returned.'){
  if(!items?.length)return notice(parent,empty);
  const list=el('ul',null,'issue-list');for(const item of items)add(list,el('li',item.message??String(item)));
  return add(parent,list);
}
function capture(app){
  if(!app||!scope)return null;
  const draft=draftMap();
  for(const node of app.querySelectorAll('[data-ui-key]')){
    if(!['INPUT','TEXTAREA','SELECT'].includes(node.tagName))continue;
    draft.set(node.dataset.uiKey,node.type==='checkbox'?node.checked:node.value);
  }
  for(const d of app.querySelectorAll('[data-ui-panel]'))PANEL_OPEN.set(`${scope}:${d.dataset.uiPanel}`,d.open);
  const active=document.activeElement;
  if(!app.contains(active)||!active.dataset?.uiKey)return null;
  const f={key:active.dataset.uiKey};
  try{f.start=active.selectionStart;f.end=active.selectionEnd;}catch{}return f;
}
function restoreFocus(app,focus){
  if(!focus)return;
  const candidate=Array.from(app.querySelectorAll('[data-ui-key]')).find(e=>e.dataset.uiKey===focus.key);
  if(candidate){candidate.focus({preventScroll:true});if(typeof focus.start==='number')try{candidate.setSelectionRange(focus.start,focus.end);}catch{}}
}
function refreshLocal(){if(live)render(live.state,live.results,live.callbacks);}
function rowsPanel(parent,kind,title,renderer,open=false){
  const box=details(parent,`initial-${kind}`,title,open);
  for(const i of setupRows[kind])renderer(box,i);
  box.append(button(`Add ${title.toLowerCase().replace(/s$/,'')}`,()=>{setupRows[kind].push(setupRowSerial++);refreshLocal();},{secondary:true,focusKey:`row:add:${kind}`}));
  return box;
}
function rowRemove(parent,kind,id){
  parent.append(button('Remove row',()=>{
    pendingFocusKey=`row:add:${kind}`;setupRows[kind]=setupRows[kind].filter(n=>n!==id);
    const prefix=`setup-${kind}-${id}::`;for(const key of draftMap().keys())if(key.startsWith(prefix))draftMap().delete(key);
    refreshLocal();
  },{secondary:true,focusKey:`row:remove:${kind}:${id}`}));
}
function snapshotForm(parent,state,callbacks){
  const m=state.model,last=m.snapshots.at(-1);if(!last)return notice(parent,'No confirmed attendance baseline found.');
  const g='snapshot',f=form(g,()=>{
    const counts=Object.fromEntries(items.map(v=>{const attended=safeInt(v.a.value),held=safeInt(v.h.value);if(attended>held)throw Error(`Attended cannot exceed held for ${v.id}.`);return [v.id,{attended,held}];}));
    if(!yes.checked)throw Error('Explicitly confirm that all registers refer to the same completed day.');
    callbacks.onConfirmSnapshot({date:date.value,counts,confirmed:yes.checked,completeToday:today.checked});
  });
  add(f,el('h3','New completed-day snapshot'),el('p',`Current baseline: ${last.date}. New values REPLACE the baseline, not add to it.`,'form-note'));
  const date=field(f,g,'date','Counts complete through date','date',last.date,{required:true});
  const items=m.registers.map(r=>{
    const line=el('div',null,'row-fields');add(line,el('h4',registerLabel(m,r)));
    const a=field(line,g,`${r.id}:attended`,'Attended units','number',last.counts[r.id]?.attended??'',{min:0,step:1,required:true});
    const h=field(line,g,`${r.id}:held`,'Held units','number',last.counts[r.id]?.held??'',{min:0,step:1,required:true});f.append(line);return {id:r.id,a,h};
  });
  const yes=field(f,g,'confirm','I confirm all counts cover this same completed day','checkbox',false);
  const today=field(f,g,'today','If dated today: all classes have ended and no further attendance meetings remain','checkbox',false);
  submit(f,'Confirm new snapshot');parent.append(f);
}
function buildInitialModel(read){
  const now=timeNow(), get=(key)=>read[key].value.trim(), flag=key=>read[key].checked;
  const context={college:get('college'),academicYear:get('year'),semester:get('semester'),programme:get('programme'),section:get('section'),sourceLabel:get('source'),preparedOn:now.date,applicabilityConfirmed:flag('applicable')};
  for(const key of ['college','year','semester','programme','section','source'])if(!get(key))throw Error(`Complete the ${key} field.`);
  if(!context.applicabilityConfirmed)throw Error('Confirm that the schedule and counts apply to your own programme and section.');
  const roster=setupRows.courses.map(id=>({id:internalId('courses',id),name:get(`course-${id}-name`),mustAttend:flag(`course-${id}-protect`)}));
  const registers=setupRows.registers.map(id=>({id:internalId('registers',id),courseId:get(`register-${id}-course`),name:get(`register-${id}-name`),requiredBps:percentBps(get(`register-${id}-r`)),personalMinBps:percentBps(get(`register-${id}-t`),true),bufferBps:percentBps(get(`register-${id}-b`),false,true)}));
  for(const row of [...roster,...registers])if(!row.id||!row.name)throw Error('Give every course and attendance register a name.');
  if(new Set(roster.map(r=>r.id)).size!==roster.length||new Set(registers.map(r=>r.id)).size!==registers.length)throw Error('Course and register IDs must be unique.');
  if(registers.some(r=>!roster.some(c=>c.id===r.courseId)))throw Error('Every register must reference an existing course ID.');
  if(registers.some(r=>Math.max(r.requiredBps,r.personalMinBps??r.requiredBps)+r.bufferBps>10000))throw Error('Required/personal target plus the buffer cannot exceed 100%.');
  const counts=Object.fromEntries(setupRows.registers.map(id=>{
    const regId=internalId('registers',id),a=safeInt(get(`register-${id}-a`)),h=safeInt(get(`register-${id}-h`));
    if(a>h)throw Error(`Attended exceeds held for ${regId}.`);return [regId,{attended:a,held:h}];
  }));
  const weeklyTemplates=flag('skip-weekly')?[]:setupRows.weekly.map(id=>({id:internalId('weekly',id),registerId:get(`weekly-${id}-register`),weekday:safeInt(get(`weekly-${id}-day`),{positive:true}),start:get(`weekly-${id}-start`),end:get(`weekly-${id}-end`),weight:safeInt(get(`weekly-${id}-weight`),{positive:true}),protected:flag(`weekly-${id}-protect`)}));
  if(weeklyTemplates.some(w=>!registers.some(r=>r.id===w.registerId)||w.weekday>7||w.start>=w.end))throw Error('Each weekly pattern needs a selected register, weekday 1–7 and end time after start.');
  const holidays=pipeRows(get('holidays'),2,'Holidays').map(([date,label])=>({date,label}));
  const replacements=pipeRows(get('replacements'),2,'Replacements').map(([date,weekday])=>({date,weekday:safeInt(weekday,{positive:true}),confirmed:true}));
  const holidayTeachingDates=dateList(get('holiday-teaching'));
  const sessions=setupRows.extra.map(id=>({id:internalId('extra',id),registerId:get(`extra-${id}-register`),date:get(`extra-${id}-date`),start:get(`extra-${id}-start`),end:get(`extra-${id}-end`),weight:safeInt(get(`extra-${id}-weight`),{positive:true}),protected:flag(`extra-${id}-protect`),cancelled:false,origin:'extra',templateId:null}));
  if(sessions.some(v=>!registers.some(r=>r.id===v.registerId)||v.start>=v.end))throw Error('Each extra meeting needs a selected register and end time after start.');
  const events=setupRows.events.map(id=>{
    const link=get(`event-${id}-session`);return {id:internalId('events',id),title:get(`event-${id}-title`),cancelled:false,sessionId:link||null,date:link?null:get(`event-${id}-date`),start:link?null:get(`event-${id}-start`),end:link?null:get(`event-${id}-end`)};
  });
  if(events.some(e=>!e.title||(!e.sessionId&&(!e.date||!e.start||!e.end))||(e.sessionId&&!sessions.some(s=>s.id===e.sessionId))))throw Error('Each event needs a title and either a valid linked extra meeting or independent date/times.');
  if(!flag('schedule-confirm'))throw Error('Confirm the timetable and teaching end date.');
  if(!flag('snapshot-confirm'))throw Error('Confirm the initial snapshot for EVERY register.');
  const modelId=`personal-${now.date}-${Math.random().toString(36).slice(2,11)}`;
  const snapshotDate=get('snapshot-date');
  // Shape-only value for the required Model field. A's P1 controller must
  // replace it with ONE captured transaction clock before validation/evaluation.
  // It is neither a user-supplied historical receipt nor an authoritative time.
  const initialConfirmationPlaceholder={date:now.date,time:now.time,timeZone:'Asia/Kolkata'};
  const preferences={candidateStart:get('candidate-start'),candidateEnd:get('candidate-end'),preferredDates:dateList(get('preferred')),requestedDays:safeInt(get('k')),notes:get('notes')};
  return {schemaVersion:1,revision:0,id:modelId,timeZone:'Asia/Kolkata',context,
    schedule:{startDate:get('start'),teachingEnd:get('end'),confirmed:flag('schedule-confirm'),initialized:false,weeklyTemplates,holidays,replacements,holidayTeachingDates},
    courses:roster,registers,sessions,events,snapshots:[{id:`${modelId}:snapshot:1`,date:snapshotDate,counts,confirmed:true,completeToday:flag('snapshot-today'),confirmedAt:initialConfirmationPlaceholder,sequence:1}],
    commitments:[],attendanceConfirmation:{throughDate:snapshotDate,noUnlistedClasses:true},preferences};
}
function validateSetupStep(step, refs){
  const get=k=>refs[k]?.value?.trim()??'',flag=k=>refs[k]?.checked;
  if(step===0){
    for(const [key,label] of [['college','college'],['year','academic year'],['semester','semester'],['programme','programme'],['section','batch/section'],['source','schedule source'],['start','schedule start'],['end','last teaching day']])
      if(!get(key))throw Error(`Complete the ${label} field.`);
    if(get('start')>get('end'))throw Error('Last teaching day must be on or after the semester start.');
    if(!flag('applicable')||!flag('schedule-confirm'))throw Error('Check both academic applicability and timetable confirmations.');
  }
  if(step===1){
    if(!setupRows.courses.length||!setupRows.registers.length)throw Error('Add at least one course and one attendance register.');
    for(const row of setupRows.courses)if(!get(`course-${row}-name`))throw Error(`Course ${setupRows.courses.indexOf(row)+1} needs a name.`);
    for(const row of setupRows.registers){
      const num=setupRows.registers.indexOf(row)+1, chosen=get(`register-${row}-course`);
      if(!get(`register-${row}-name`))throw Error(`Register ${num} needs a label.`);
      if(!setupRows.courses.some(c=>internalId('courses',c)===chosen))throw Error(`Register ${num}: select an existing course (a removed course cannot be used).`);
      const R=percentBps(get(`register-${row}-r`)),T=percentBps(get(`register-${row}-t`),true),B=percentBps(get(`register-${row}-b`),false,true);
      if(Math.max(R,T??R)+B>10000)throw Error(`Register ${num}: max(R,T)+B cannot exceed 100%.`);
      const a=safeInt(get(`register-${row}-a`)),h=safeInt(get(`register-${row}-h`));
      if(a>h)throw Error(`Register ${num}: attended units cannot exceed held units.`);
    }
  }
  if(step===2){
    if(!flag('skip-weekly'))for(const row of setupRows.weekly){
      const chosen=get(`weekly-${row}-register`),n=setupRows.weekly.indexOf(row)+1;
      if(!setupRows.registers.some(r=>internalId('registers',r)===chosen))throw Error(`Weekly pattern ${n}: select an existing register.`);
      const weekday=safeInt(get(`weekly-${row}-day`),{positive:true});
      if(weekday>7||!get(`weekly-${row}-start`)||!get(`weekly-${row}-end`)||get(`weekly-${row}-start`)>=get(`weekly-${row}-end`))throw Error(`Weekly pattern ${n}: weekday must be 1–7 and end must be later than start.`);
      safeInt(get(`weekly-${row}-weight`),{positive:true});
    }
    for(const row of setupRows.extra){
      if(!setupRows.registers.some(r=>internalId('registers',r)===get(`extra-${row}-register`)))throw Error('Choose a valid register for every extra meeting.');
      if(!get(`extra-${row}-date`)||get(`extra-${row}-start`)>=get(`extra-${row}-end`))throw Error('Extra meetings need a date and end after start.');
      safeInt(get(`extra-${row}-weight`),{positive:true});
    }
    for(const row of setupRows.events){
      const link=get(`event-${row}-session`);
      if(!get(`event-${row}-title`))throw Error('Give every compulsory event a title.');
      if(link&&!setupRows.extra.some(e=>internalId('extra',e)===link))throw Error('Linked event refers to a removed meeting. Choose an existing extra meeting.');
      if(!link&&(!get(`event-${row}-date`)||!get(`event-${row}-start`)||!get(`event-${row}-end`)||get(`event-${row}-start`)>=get(`event-${row}-end`)))throw Error('Independent event requires a date and end after start.');
    }
    pipeRows(get('holidays'),2,'Holidays');pipeRows(get('replacements'),2,'Replacements');
  }
}
function initialSetup(parent,callbacks){
  const now=timeNow(),g='setup-basic',f=form('initial-submit',()=>{
    const refs={};for(const input of parent.querySelectorAll('[data-initial-input]'))refs[input.dataset.initialInput]=input;
    for(let i=0;i<3;i++)validateSetupStep(i,refs);
    const model=buildInitialModel(refs);callbacks.onReplaceSetup({model});
  });
  f.noValidate=true; // Progressively hidden fields are validated explicitly before submission.
  notice(f,'Use your own confirmed timetable and complete actual counts. No college template or policy has been verified. Nothing is saved until the final confirmation.','form-note');
  const progress=el('ol',null,'setup-progress');progress.setAttribute('aria-label','Initial setup progress');
  STEP_TITLES.forEach((name,i)=>{const li=el('li',`${i+1}. ${name}`,i===setupStep?'current-step':'');if(i===setupStep)li.setAttribute('aria-current','step');progress.append(li);});f.append(progress);
  const refs={};
  function setupField(container,group,key,label,type,value,attrs={}){
    const input=field(container,group,key,label,type,value,attrs);input.dataset.initialInput=key;refs[key]=input;
    const named=key.match(/^(course|register)-(\d+)-name$/);
    if(named)input.addEventListener('input',()=>{
      // Relabel choices in place; don't replace the focused input per keystroke.
      const kind=named[1]==='course'?'courses':'registers',row=Number(named[2]);
      const stable=internalId(kind,row),position=setupRows[kind].indexOf(row)+1;
      const title=kind==='courses'?'Course':'Register';
      for(const option of f.querySelectorAll('option'))if(option.value===stable)
        option.textContent=`${title} ${position} · ${input.value.trim()||'unnamed / incomplete'}`;
    });
    return input;
  }
  const basics=details(f,'setup-identity','Step 1 · Academic identity and dates',true);
  for(const [key,label,placeholder] of [['college','College','Your college'],['year','Academic year','2026–27'],['semester','Semester','1'],['programme','Programme','Your programme'],['section','Batch / section','Your batch'],['source','Schedule source / version','Manual, student-confirmed']])setupField(basics,g,key,label,'text','',{placeholder,required:true});
  setupField(basics,g,'start','Semester schedule start','date',now.date,{required:true});
  setupField(basics,g,'end','Confirmed last teaching day','date',now.date,{required:true});
  setupField(basics,g,'applicable','I have checked that these details apply to my batch','checkbox',false);
  setupField(basics,g,'schedule-confirm','I confirm the teaching end date and timetable','checkbox',false);
  const rosterBox=details(f,'setup-roster','Step 2 · Courses, registers and actual counts',true);
  notice(rosterBox,'Each row has a permanent internal ID. Select its course by row and name. Registers remain independent even when labels are identical. R, T, B and BOTH actual counts must be entered explicitly.','form-note');
  rowsPanel(rosterBox,'courses','Courses',(box,id)=>{
    const line=el('div',null,'edit-row');line.append(el('h4',`Course ${setupRows.courses.indexOf(id)+1}`));
    setupField(line,`setup-courses-${id}`,`course-${id}-name`,'Course name','text','',{required:true});
    setupField(line,`setup-courses-${id}`,`course-${id}-protect`,'Protect every class for this course','checkbox',false);
    if(setupRows.courses.length>1)rowRemove(line,'courses',id);box.append(line);
  },true);
  rowsPanel(rosterBox,'registers','Attendance registers',(box,id)=>{
    const line=el('div',null,'edit-row');line.append(el('h4',`Register ${setupRows.registers.indexOf(id)+1}`));
    const items=[['course','Course (choose row/name)','select','',{options:setupOptions('courses'),required:true}],['name','Register label','text','',{required:true}],['r','Required R (%)','text','',{placeholder:'Enter confirmed requirement',required:true}],['t','Optional personal T (%)','text','',{placeholder:'Optional'}],['b','Buffer B (percentage points)','text','',{placeholder:'Enter buffer, including 0',required:true}],['a','Actually attended units','number','',{min:0,step:1,required:true}],['h','Actually held units','number','',{min:0,step:1,required:true}]];
    for(const [key,label,type,val,attrs] of items)setupField(line,`setup-registers-${id}`,`register-${id}-${key}`,label,type,val,attrs);
    if(setupRows.registers.length>1)rowRemove(line,'registers',id);box.append(line);
  },true);
  const teaching=details(f,'setup-timetable','Step 3 · Timetable, exceptions and compulsory events',true);
  notice(teaching,'Weekday: 1 = Monday … 7 = Sunday. Weight is a positive ATTENDANCE UNIT count, independent of meeting duration. Linked events can point to an extra meeting in this setup; recurring-session links may be added individually after expansion.','form-note');
  setupField(teaching,g,'skip-weekly','No recurring timetable (I will enter dated sessions instead)','checkbox',false);
  rowsPanel(teaching,'weekly','Weekly meeting patterns',(box,id)=>{
    const line=el('div',null,'edit-row');line.append(el('h4',`Pattern ${setupRows.weekly.indexOf(id)+1}`));
    for(const [key,label,type,value,attrs] of [['register','Register','select','',{options:setupOptions('registers'),required:true}],['day','ISO weekday (1–7)','number','1',{min:1,max:7,required:true}],['start','Start','time','09:00',{required:true}],['end','End','time','10:00',{required:true}],['weight','Attendance weight','number','1',{min:1,step:1,required:true}]])setupField(line,`setup-weekly-${id}`,`weekly-${id}-${key}`,label,type,value,attrs);
    setupField(line,`setup-weekly-${id}`,`weekly-${id}-protect`,'Must attend','checkbox',false);
    if(setupRows.weekly.length>1)rowRemove(line,'weekly',id);box.append(line);
  },true);
  setupField(teaching,g,'holidays','Holidays, one line: date | label','textarea','',{rows:3});
  setupField(teaching,g,'replacements','Replacement teaching days, one line: date | ISO weekday','textarea','',{rows:3});
  setupField(teaching,g,'holiday-teaching','Explicit teaching-on-holiday dates (comma-separated)','text','');
  rowsPanel(teaching,'extra','Extra dated sessions',(box,id)=>{
    const line=el('div',null,'edit-row');line.append(el('h4',`Extra meeting ${setupRows.extra.indexOf(id)+1}`));
    for(const [key,label,type,value,attrs] of [['register','Register','select','',{options:setupOptions('registers'),required:true}],['date','Date','date',now.date,{required:true}],['start','Start','time','09:00',{required:true}],['end','End','time','10:00',{required:true}],['weight','Attendance weight','number','1',{min:1,step:1,required:true}]])setupField(line,`setup-extra-${id}`,`extra-${id}-${key}`,label,type,value,attrs);
    setupField(line,`setup-extra-${id}`,`extra-${id}-protect`,'Must attend','checkbox',false);rowRemove(line,'extra',id);box.append(line);
  });
  rowsPanel(teaching,'events','Compulsory events',(box,id)=>{
    const line=el('div',null,'edit-row');line.append(el('h4',`Event ${setupRows.events.indexOf(id)+1}`));
    setupField(line,`setup-events-${id}`,`event-${id}-title`,'Event title','text','',{required:true});
    setupField(line,`setup-events-${id}`,`event-${id}-session`,'Link to an extra meeting (optional)','select','',{options:[{value:'',label:'Independent event (enter date and time)'},...setupOptions('extra').slice(1)]});
    for(const [key,label,type,value] of [['date','Independent event date','date',now.date],['start','Start','time','09:00'],['end','End','time','10:00']])setupField(line,`setup-events-${id}`,`event-${id}-${key}`,label,type,value);
    rowRemove(line,'events',id);box.append(line);
  });
  const actual=details(f,'setup-counts','Step 4 · Confirm snapshot and planning request',true);
  notice(actual,'Actual counts are from Step 2. This confirmation covers all registers on ONE completed day. Today may be used only when every scheduled attendance meeting has ended; A captures the authoritative confirmation clock at submission.','form-note');
  setupField(actual,g,'snapshot-date','All counts complete through','date',now.date,{required:true});
  setupField(actual,g,'snapshot-confirm','I confirm every register has complete actual counts through the same day','checkbox',false);
  setupField(actual,g,'snapshot-today','If today: all scheduled attendance meetings ended; none remain','checkbox',false);
  setupField(actual,g,'candidate-start','First candidate break date','date',now.date);
  setupField(actual,g,'candidate-end','Last candidate break date (hard restriction)','date',now.date);
  setupField(actual,g,'k','Number of NEW break days K','number',2,{min:0,step:1});
  setupField(actual,g,'preferred','Preferred dates, comma-separated','text','');
  setupField(actual,g,'notes','Notes (not enforced by calculations)','textarea','',{rows:2});
  const panels=[basics,rosterBox,teaching,actual];
  panels.forEach((panel,i)=>{panel.hidden=i!==setupStep;if(i===setupStep){panel.open=true;panel.querySelector('summary').dataset.uiKey='setup-active-heading';}});
  const nav=el('div',null,'wizard-nav');
  if(setupStep>0)nav.append(button('Back',()=>{setupStep--;wizardIssue='';pendingFocusKey='setup-active-heading';refreshLocal();},{secondary:true,focusKey:'setup-back'}));
  if(setupStep<3)nav.append(button('Check & continue',()=>{
    try{validateSetupStep(setupStep,refs);wizardIssue='';setupStep++;pendingFocusKey='setup-active-heading';refreshLocal();}
    catch(e){wizardIssue=e.message??'Correct this step before continuing.';refreshLocal();}
  },{focusKey:'setup-next'}));
  else {nav.dataset.formGroup='initial-submit';submit(nav,'Validate & save confirmed setup');}
  if(wizardIssue){const error=el('p',wizardIssue,'form-error');error.setAttribute('role','alert');error.dataset.uiKey='wizard-error';f.append(error);}
  f.append(nav);parent.append(f);
}
function existingSetup(parent,state,callbacks){
  const m=state.model;
  add(parent,el('p',`${m.context.college} · ${m.context.programme} · ${m.context.section}`,'context-name'),
    el('p',`Confirmed by student: ${m.context.applicabilityConfirmed?'yes':'no'} · Source: ${m.context.sourceLabel}`,'muted'),
    el('p',`Teaching dates ${m.schedule.startDate} → ${m.schedule.teachingEnd}; ${m.sessions.length} concrete session(s), ${m.events.length} compulsory event(s). Recurring patterns are reference-only after initialization.`,'muted'));
  const actual=details(parent,'existing-snapshot','Actual attendance · confirm a new completed day',true);
  snapshotForm(actual,state,callbacks);
  const targets=details(parent,'existing-targets','Attendance registers · required R, optional T, buffer B',false);
  for(const r of m.registers){
    const g=`threshold:${r.id}`,f=form(g,()=>{
      const R=percentBps(req.value),T=percentBps(personal.value,true),B=percentBps(buf.value,false,true);
      if(Math.max(R,T??R)+B>10000)throw Error('The planning floor cannot exceed 100%.');
      callbacks.onSetThreshold({registerId:r.id,requiredBps:R,personalMinBps:T,bufferBps:B});
    });
    add(f,el('h3',registerLabel(m,r)));
    const req=field(f,g,'r','Institutional requirement R (%)','text',r.requiredBps/100,{required:true});
    const personal=field(f,g,'t','Optional personal target T (%)','text',r.personalMinBps===null?'':r.personalMinBps/100);
    const buf=field(f,g,'b','Planning buffer B (percentage points)','text',r.bufferBps/100,{required:true});
    const computed=el('p',null,'form-note');
    const updatePreview=()=>{
      try{const R=percentBps(req.value),T=percentBps(personal.value,true),B=percentBps(buf.value,false,true);
        computed.textContent=`Input preview: F = max(R,T) + B = ${pct(Math.max(R,T??R)+B)}. Only the engine can validate attendance.`;
      }catch{computed.textContent='Enter valid percentages to preview the planning floor.';}
    };
    // Pure display of the *input formula*, never attendance calculation or a passing verdict.
    for(const input of [req,personal,buf])input.addEventListener('input',updatePreview);
    updatePreview();f.append(computed);submit(f,'Save register targets');targets.append(f);
  }
  const protectedPanel=details(parent,'existing-protected','Courses that must always be attended',false);
  for(const c of m.courses){
    const line=el('div',null,'inline-action');const g=`protect:${c.id}`;
    const v=field(line,g,'checked',c.name,'checkbox',c.mustAttend);
    line.append(button('Apply protection',()=>callbacks.onSetCourseProtection({courseId:c.id,mustAttend:v.checked}),{secondary:true}));protectedPanel.append(line);
  }
  const endPanel=details(parent,'existing-end','Adjust confirmed last teaching day',false);
  const gf='teaching-end',f=form(gf,()=>{if(!affirm.checked)throw Error('Explicitly confirm the teaching end date.');callbacks.onSetTeachingEnd({date:date.value,confirmed:true});});
  const date=field(f,gf,'date','Confirmed last teaching day','date',m.schedule.teachingEnd,{required:true});
  const affirm=field(f,gf,'confirmed','Confirm this is the last teaching day (existing commitments remain visible)','checkbox',false);
  submit(f,'Save teaching end');endPanel.append(f);
}
function resultCard(parent,state,results){
  const wrap=el('div',null,'result-wrap');
  const runtime=results?.runtime??'ERROR';
  if(runtime!=='READY'){
    const info=runtime==='NO_SETUP'?'No confirmed setup yet. Enter actual details or open the labelled synthetic demo.':runtime==='ENGINE_UNAVAILABLE'?'Planning engine unavailable. This UI shows schedule markers only; no attendance result or feasible date has been verified.':`A runtime error stopped calculations: ${results?.error??'Unknown error'}`;
    const b=el('div',null,'status-card warning');b.setAttribute('role','status');add(b,el('h3',runtime.replaceAll('_',' ')),el('p',info));wrap.append(b);
  }
  const evaluation=runtime==='READY'?results.evaluation:null;
  if(runtime==='READY'&&!evaluation){
    notice(wrap,'No evaluation returned; nothing has been checked.','status-card warning');
  }
  if(evaluation){
    const [title,explanation,tone]=STATES[evaluation.status]??[evaluation.status,'Unrecognised status; do not act on this result.','warning'];
    const card=el('div',null,`status-card ${tone}`);card.setAttribute('role','status');
    add(card,el('p',`Engine contract ${evaluation.contractVersion} · model revision ${evaluation.modelRevision??'unknown'} · evaluated ${evaluation.evaluatedAt?`${evaluation.evaluatedAt.date} ${evaluation.evaluatedAt.time} IST`:'clock unavailable'}`,'eyebrow'),el('h3',title),el('p',explanation));
    const next={INVALID_SETUP:'Next: correct the reported setup or confirmation fields; no feasible result exists.',ATTENDANCE_UPDATE_NEEDED:'Next: confirm a new completed-day snapshot with actual counts.',EXISTING_UNRECOVERABLE_SHORTFALL:'Next: review the actual counts and planning constraints; no proposed break resolves this shortfall.',PLAN_BLOCKED:'Next: inspect conflicting dates and existing commitments. This evaluation does not authorize additional breaks.',CONDITIONAL_RECOVERY:'Next: review every required recovery meeting before accepting a checked subset.',MEETS_PLANNING_RULES:'Next: inspect dates, then explicitly commit a checked subset if desired.'};
    if(next[evaluation.status])add(card,el('p',next[evaluation.status],'next-action'));
    const invalidDates=evaluation.dates?.filter(d=>d.markers?.includes('INVALID_COMMITMENT')).map(d=>d.date)??[];
    if(invalidDates.length)add(card,el('p',`Committed dates now invalid: ${invalidDates.join(', ')}. Navigate the calendar to inspect each date.`,'invalid-summary'));
    if(evaluation.issues?.length){add(card,el('h4','Input / policy issues'));issueList(card,evaluation.issues);}
    if(evaluation.firstFailure){
      const x=evaluation.firstFailure;
      const detail=el('div',null,'failure-detail');add(detail,el('h4','First failing consequence'),el('p',x.message));
      const evidence=el('details',null,'failure-evidence');add(evidence,el('summary','Exact session, counts, requirements and combined absences'),el('p',`Type: ${x.kind}${x.date?' · Date: '+x.date:''}${x.sessionId?' · Session: '+x.sessionId:''}${x.registerId?' · Register: '+x.registerId:''}${x.eventId?' · Event: '+x.eventId:''}`,'muted'));
      if(x.attended!==null&&x.held!==null)add(evidence,el('p',`At failure: ${x.attended}/${x.held} (${x.percentage===null?'Not started':x.percentage+'%'}); R ${pct(x.requiredBps)}, F ${pct(x.floorBps)}.`));
      if(x.combinedAbsenceDates?.length)add(evidence,el('p',`Combined absences: ${x.combinedAbsenceDates.join(', ')}. This is not a minimum causal set.`));
      detail.append(evidence);card.append(detail);
    }
    wrap.append(card);
    if(evaluation.registers?.length){
      const area=el('div',null,'ratio-area');add(area,el('h4','Projected attendance by separate register'),el('p','Scroll horizontally to inspect every column, including R, F and recovery.','table-hint'));
      const table=el('table',null,'ratio-table'),thead=el('thead');const head=el('tr');
      for(const h of ['Register','Confirmed baseline','Projected semester end','Requirement R','Planning floor F','Recovery'])head.append(el('th',h));
      thead.append(head);const tbody=el('tbody');
      for(const r of evaluation.registers){
        const tr=el('tr');const sourceReg=state.model?.registers.find(reg=>reg.id===r.registerId);const name=sourceReg?registerLabel(state.model,sourceReg):r.registerId;
        const recovered=r.recovery?.status==='RECOVERABLE'?`At ${r.recovery.date} (${r.recovery.sessionId})`:(r.recovery?.status??'—').toLowerCase().replaceAll('_',' ');
        for(const value of [name,`${r.initial.attended}/${r.initial.held} · ${ratio(r.initial)}`,`${r.final.attended}/${r.final.held} · ${ratio(r.final)}`,pct(r.requiredBps),pct(r.floorBps),recovered])add(tr,el('td',value));tbody.append(tr);
      }
      add(table,thead,tbody);area.append(table);wrap.append(area);
    }
    if(evaluation.assumptions?.length){
      const d=el('details',null,'assumption-panel');add(d,el('summary','Evaluation assumptions'));issueList(d,evaluation.assumptions.map(message=>({message})));wrap.append(d);
    }
  }
  if(runtime==='READY'&&results.search){
    const s=results.search.search,blk=el('div',null,'search-report');
    add(blk,el('h4','Suggestion search'),el('p',s.requested===null?'Requested K is invalid; correct the setup.':`Found ${s.found} days using this search; requested ${s.requested}. Outcome: ${s.outcome.toLowerCase().replaceAll('_',' ')}. Candidates considered: ${s.considered}.`));
    if(s.preferenceWarnings?.length){add(blk,el('h4','Preferred dates not used'));issueList(blk,s.preferenceWarnings);}
    if(s.rejections?.length){const details=el('details');add(details,el('summary',`${s.rejections.length} candidate(s) rejected by the combined check`));
      for(const item of s.rejections)add(details,el('p',`${item.date}: ${item.evaluation?.firstFailure?.message??item.evaluation?.status??'Not verified'}`));blk.append(details);
    }
    wrap.append(blk);
  }
  parent.append(wrap);
}
function modelDateMarkers(state,results,date){
  const m=state.model, dateResult=results.runtime==='READY'?results.evaluation?.dates?.find(r=>r.date===date):null;
  const marker=new Set(dateResult?.markers??[]);
  if(!m)return {marker,dateResult};
  // Structural overlays never claim feasibility. Retain overlapping signals even on blocked dates.
  if(m.schedule.holidays.some(h=>h.date===date))marker.add('HOLIDAY');
  if(m.sessions.some(s=>s.date===date&&!s.cancelled))marker.add('TEACHING');
  if(m.sessions.some(s=>s.date===date&&!s.cancelled&&(s.protected||m.courses.some(c=>c.id===m.registers.find(r=>r.id===s.registerId)?.courseId&&c.mustAttend))))marker.add('PROTECTED');
  if(m.events.some(ev=>{
    if(ev.cancelled)return false;
    if(ev.sessionId){const session=m.sessions.find(s=>s.id===ev.sessionId);return session&&!session.cancelled&&session.date===date;}
    return ev.date===date;
  }))marker.add('COMPULSORY');
  if(m.commitments.some(c=>c.date===date))marker.add('COMMITTED');
  if(state.manualDates.includes(date))marker.add('SELECTED');
  if(state.batch?.dates.includes(date))marker.add('SUGGESTED');
  return {marker,dateResult};
}
function buildCalendar(parent,state,results,callbacks){
  const panel=el('div',null,'calendar-panel');
  const nav=el('div',null,'month-controls');
  const month=state.month;
  const prev=button('←',()=>callbacks.onSetMonth({month:monthShift(month,-1)}),{secondary:true,focusKey:'month-prev'}),next=button('→',()=>callbacks.onSetMonth({month:monthShift(month,1)}),{secondary:true,focusKey:'month-next'});
  prev.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');
  add(nav,prev,el('h3',new Date(`${month}-01T12:00:00Z`).toLocaleString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})),next);
  panel.append(nav);
  const legend=el('p','Each day shows ALL applicable labels; a label is not proof that taking a break is safe. Click any date for its known consequences.','muted');panel.append(legend);
  const grid=el('div',null,'calendar');grid.setAttribute('role','group');grid.setAttribute('aria-label',`Calendar ${month}`);
  for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])add(grid,el('div',label,'weekday'));
  const [year,mon]=month.split('-').map(Number);
  const offset=(new Date(Date.UTC(year,mon-1,1)).getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,mon,0)).getUTCDate();
  for(let i=0;i<offset;i++){const blank=el('div',null,'calendar-blank');blank.setAttribute('aria-hidden','true');grid.append(blank);}
  for(let day=1;day<=count;day++){
    const date=`${month}-${String(day).padStart(2,'0')}`;
    const {marker,dateResult}=modelDateMarkers(state,results,date),names=[...marker];
    const b=button(String(day),()=>callbacks.onSelectDate({date}),{secondary:true,focusKey:`calendar:${date}`});
    b.classList.add('day');b.setAttribute('aria-label',`${date}${names.length?': '+names.map(k=>LABELS[k]??k).join(', '):': no calculated status'}`);
    if(state.selectedDate===date){b.classList.add('selected-day');b.setAttribute('aria-pressed','true');}else b.setAttribute('aria-pressed','false');
    if(marker.has('INVALID_COMMITMENT'))b.classList.add('invalid-day');
    if(marker.has('COMMITTED'))b.classList.add('committed-day');
    if(marker.has('SUGGESTED'))b.classList.add('suggested-day');
    if(marker.has('HOLIDAY'))b.classList.add('holiday-day');
    // Never replace a marker with another one: holiday+event+invalid must coexist.
    for(const code of names){const tag=el('span',null,`marker m-${code.toLowerCase().replaceAll('_','-')}`);add(tag,el('span',LABELS[code]??code.replaceAll('_',' '),'marker-long'),el('span',SHORT_LABELS[code]??code,'marker-short'));b.append(tag);}
    if(dateResult?.conflictScope!=='NONE'&&dateResult?.conflictScope)b.dataset.conflictScope=dateResult.conflictScope;
    grid.append(b);
  }
  panel.append(grid);
  if(state.selectedDate){
    const date=state.selectedDate,{marker,dateResult}=modelDateMarkers(state,results,date);
    const box=el('div',null,'date-detail');add(box,el('h3',date),el('p',marker.size?[...marker].map(x=>LABELS[x]??x).join(' · '):'No schedule obligations recorded or calculated.','muted'));
    if(dateResult){
      for(const message of dateResult.messages??[])add(box,el('p',message));
      if(dateResult.absenceUnits?.length)add(box,el('p',`Attendance units on this date: ${dateResult.absenceUnits.map(u=>`${state.model?.registers.find(r=>r.id===u.registerId)?.name??u.registerId} ${u.units}`).join('; ')}. Missed only if a full-day break is taken.`));
      if(dateResult.conflictScope!=='NONE')add(box,el('p',`Conflict scope: ${dateResult.conflictScope.toLowerCase()} (joint-plan failures cannot necessarily be assigned to a single date).`,'form-note'));
    }else notice(box,'No current engine evaluation for this date. Schedule facts below are not a feasibility verdict.');
    for(const s of state.model?.sessions.filter(x=>x.date===date)??[]){
      const label=state.model.registers.find(r=>r.id===s.registerId)?.name??s.registerId;
      add(box,el('p',`${s.start}–${s.end}: ${label} · weight ${s.weight}${s.cancelled?' · cancelled':''}${s.protected?' · must attend':''}`,'session-line'));
    }
    for(const e of state.model?.events??[]){
      const linked=state.model.sessions.find(s=>s.id===e.sessionId);
      if((linked?.date===date)||(e.sessionId===null&&e.date===date))add(box,el('p',`Event: ${e.title}${e.cancelled||linked?.cancelled?' (cancelled)':' · compulsory'}${e.sessionId?' · linked to '+e.sessionId:''}`,'session-line'));
    }
    for(const h of state.model?.schedule.holidays.filter(x=>x.date===date)??[])add(box,el('p',`Holiday: ${h.label}`,'session-line'));
    const selected=state.manualDates.includes(date);
    if(state.model){
      box.append(button(selected?'Remove from manual selection':'Add to manual selection',()=>callbacks.onSetManualDates({dates:selected?state.manualDates.filter(d=>d!==date):[...state.manualDates,date]}),{secondary:true,focusKey:'date:toggle-selection'}));
      if(selected)box.append(button('Check manual selection together',()=>callbacks.onCheckManual(),{focusKey:'date:check-selection'}));
    }
    panel.append(box);
  }
  parent.append(panel);
}
function planSection(parent,state,results,callbacks){
  resultCard(parent,state,results);
  if(state.model){
    const actionRow=el('div',null,'cta-row');actionRow.setAttribute('aria-label','Next planning actions');
    actionRow.append(button('Find suggested teaching days off',()=>callbacks.onSuggest(),{disabled:results.runtime==='ENGINE_UNAVAILABLE',focusKey:'plan:suggest'}));
    actionRow.append(button('Recheck current plan',()=>callbacks.onRefresh(),{secondary:true,focusKey:'plan:recheck'}));parent.append(actionRow);
  }
  if(state.model)buildCalendar(parent,state,results,callbacks);
  else notice(parent,'The calendar and planning controls appear after confirmed setup, not from unverified sample data.');
  if(state.model){
    if(state.batch){
      const batch=state.batch,g='accept',f=form(g,()=>{
        const selected=checks.filter(x=>x.input.checked).map(x=>x.date);
        if(!selected.length)throw Error('Select at least one date.');
        callbacks.onAccept({dates:selected,modelRevision:batch.modelRevision});
      });
      add(f,el('h3','Checked suggestions · explicit atomic acceptance'),el('p','Select any nonempty subset. A will revalidate the whole set with existing commitments and current time before saving.','form-note'));
      const checks=batch.dates.map(date=>({date,input:field(f,g,`date:${date}`,date,'checkbox',true)}));
      submit(f,'Commit selected dates together');parent.append(f);
    }
    const manual=details(parent,'manual-dates','Check a custom combination of NEW dates',false),mf=form('manual-dates',()=>{
      const parsed=dateList(manualDates.value);callbacks.onSetManualDates({dates:parsed});callbacks.onCheckManual();
    });
    const manualDates=field(mf,'manual-dates','dates','Dates separated by comma or spaces','text',state.manualDates.join(', '),{placeholder:'YYYY-MM-DD, YYYY-MM-DD'});
    add(mf,el('p','Checked jointly against existing commitments and all remaining projected sessions.','form-note'));submit(mf,'Check selected dates together');manual.append(mf);
    const m=state.model,p=m.preferences,g='preferences';
    const preferences=details(parent,'preferences','Planning preferences · hard range, K and preferred dates',false);
    const formEl=form(g,()=>{
      callbacks.onSetPreferences({candidateStart:start.value,candidateEnd:end.value,requestedDays:safeInt(k.value),preferredDates:dateList(preferred.value),notes:notes.value});
    });
    const range=el('div',null,'form-row');
    const start=field(range,g,'start','Hard range start','date',p.candidateStart,{required:true});
    const end=field(range,g,'end','Hard range end','date',p.candidateEnd,{required:true});
    const k=field(range,g,'k','Requested NEW days (K)','number',p.requestedDays,{min:0,step:1,required:true});formEl.append(range);
    const preferred=field(formEl,g,'preferred','Preferred dates (comma-separated, soft ranking only)','text',p.preferredDates.join(', '));
    const notes=field(formEl,g,'notes','Personal notes (not enforced)','textarea',p.notes,{rows:2});
    submit(formEl,'Save preferences');preferences.append(formEl);
  }
  notice(parent,'All projections assume attendance at every other future meeting. These are conditional checks, not guaranteed college approval. The chronological planning floor is a conservative planner rule.');
}
let chosenSession=null;
let chosenEvent='new';
let newIds=1;
function makeLocalId(prefix){return `${prefix}-${setupNonce}-${newIds++}`;}
let addSessionId=null,addEventId=null;
function reviewSection(parent,state,callbacks){
  if(!state.model){notice(parent,'Create a confirmed setup first. No saved plan is available to update.');return;}
  const m=state.model,defaultDate=state.mode==='demo'?'2026-11-02':timeNow().date;
  const commits=details(parent,'commitments','Existing commitments · never silently removed',true);
  if(!m.commitments.length)notice(commits,'No committed dates yet.');
  for(const c of m.commitments){
    const line=el('div',null,'commit-row');const {marker,dateResult}=modelDateMarkers(state,live.results,c.date);
    add(line,el('div',null,'commit-main'));
    const main=line.firstChild;
    add(main,el('strong',c.date),el('span',marker.has('INVALID_COMMITMENT')?'Invalid under current evaluation':dateResult?.conflictScope==='PLAN'?'Combined-plan conflict':live.results.runtime==='READY'?'Retained commitment':'Not checked','commit-status'));
    if(marker.has('HOLIDAY'))add(main,el('small','Holiday marker retained'));
    if(marker.has('COMPULSORY'))add(main,el('small','Compulsory event marker retained'));
    line.append(button(`Uncommit ${c.date}`,()=>{pendingFocusKey='panel:commitments';callbacks.onUncommit({commitmentId:c.id});},{secondary:true,danger:true}));commits.append(line);
  }
  const gap=details(parent,'gap','Confirm no unlisted classes in the elapsed gap',false),gapForm=form('gap',()=>{
    if(!checked.checked)throw Error('Confirm no unlisted meetings occurred.');
    callbacks.onConfirmGap({throughDate:through.value,noUnlistedClasses:checked.checked});
  });
  const through=field(gapForm,'gap','through','Confirmed through date','date',m.attendanceConfirmation?.throughDate??m.snapshots.at(-1)?.date??timeNow().date);
  const checked=field(gapForm,'gap','checked','I confirm no unlisted classes occurred through this date','checkbox',false);
  submit(gapForm,'Confirm elapsed gap');gap.append(gapForm);
  const editing=details(parent,'sessions','Edit or cancel ONE not-yet-started attendance meeting',false);
  if(m.sessions.length){
    const options=m.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(s=>({value:s.id,label:`${s.date} ${s.start} · ${registerLabel(m,m.registers.find(r=>r.id===s.registerId))} · ${s.id}`}));
    if(!options.some(x=>x.value===chosenSession))chosenSession=options[0].value;
    const choose=el('div',null,'picker');const picker=field(choose,'choose-session','id','Meeting to edit','select',chosenSession,{options});
    picker.addEventListener('change',()=>{chosenSession=picker.value;refreshLocal();});editing.append(choose);
    const s=m.sessions.find(s=>s.id===chosenSession),g=`edit-session:${s.id}`;
    const f=form(g,()=>{
      const changes={date:date.value,start:start.value,end:end.value,registerId:registerId.value,weight:safeInt(weight.value,{positive:true}),protected:protect.checked,cancelled:cancel.checked};
      callbacks.onEditSession({sessionId:s.id,changes,teachingOnHolidayConfirmed:holiday.checked});
    });
    add(f,el('p',`Stable session ID: ${s.id} · origin: ${s.origin}. Linked compulsory events follow moves/cancellations. Changes apply to this occurrence only.`,'form-note'));
    const date=field(f,g,'date','New date','date',s.date,{required:true});
    const start=field(f,g,'start','Start time','time',s.start,{required:true});
    const end=field(f,g,'end','End time','time',s.end,{required:true});
    const registerId=field(f,g,'register','Attendance register','select',s.registerId,{options:m.registers.map(r=>({value:r.id,label:registerLabel(m,r)}))});
    const weight=field(f,g,'weight','Weight','number',s.weight,{min:1,step:1,required:true});
    const protect=field(f,g,'protected','Protect this occurrence','checkbox',s.protected);
    const cancel=field(f,g,'cancelled','Cancel this attendance meeting (does not cancel independent events)','checkbox',s.cancelled);
    const holiday=field(f,g,'holiday','If moved onto a holiday: confirm teaching occurs','checkbox',false);
    submit(f,'Update single meeting');editing.append(f);
  }else notice(editing,'No concrete meetings recorded.');
  const adding=details(parent,'add-session','Add ONE extra attendance meeting',false),g='add-session',f=form(g,()=>{
    const session={id:sid.value.trim(),registerId:register.value,date:date.value,start:start.value,end:end.value,weight:safeInt(weight.value,{positive:true}),protected:protectedInput.checked,cancelled:false,origin:'extra',templateId:null};
    callbacks.onAddSession({session,teachingOnHolidayConfirmed:holiday.checked});
  });
  if(!addSessionId)do{addSessionId=makeLocalId('extra');}while(m.sessions.some(s=>s.id===addSessionId));
  const sid={value:addSessionId};add(f,el('p','An internal meeting ID will be retained for linked events and diagnostics.','form-note'));
  const register=field(f,g,'register','Register','select',m.registers[0]?.id??'',{options:m.registers.map(r=>({value:r.id,label:registerLabel(m,r)}))});
  const date=field(f,g,'date','Date','date',defaultDate,{required:true});
  const start=field(f,g,'start','Start','time','09:00',{required:true});
  const end=field(f,g,'end','End','time','10:00',{required:true});
  const weight=field(f,g,'weight','Weight','number',1,{min:1,step:1,required:true});
  const protectedInput=field(f,g,'protected','Must attend','checkbox',false);
  const holiday=field(f,g,'holiday','If on a holiday: explicitly confirm teaching occurs','checkbox',false);
  submit(f,'Add one meeting');adding.append(f);
  const evBox=details(parent,'events','Compulsory events · independent or linked to a session',false);
  const eventOptions=[{value:'new',label:'Create new event'},...m.events.map(e=>({value:e.id,label:`Edit: ${e.title} (${e.id})`}))];
  if(!eventOptions.some(v=>v.value===chosenEvent))chosenEvent='new';
  const chooser=el('div',null,'picker');const eventPicker=field(chooser,'choose-event','id','Event to edit','select',chosenEvent,{options:eventOptions});
  eventPicker.addEventListener('change',()=>{chosenEvent=eventPicker.value;refreshLocal();});evBox.append(chooser);
  const existing=m.events.find(e=>e.id===chosenEvent),eg=`event:${chosenEvent}`;
  const ef=form(eg,()=>{
    const link=linked.value.trim();
    if(link&&!m.sessions.some(s=>s.id===link))throw Error('The linked meeting ID does not exist.');
    const event={id:eid.value.trim(),title:title.value.trim(),cancelled:cancelled.checked,sessionId:link||null,date:link?null:evDate.value,start:link?null:evStart.value,end:link?null:evEnd.value};
    if(existing&&event.id!==existing.id)throw Error('Editing an event cannot change its stable ID.');
    if(!event.id||!event.title)throw Error('An event title is required.');
    callbacks.onUpsertEvent({event});
  });
  if(!addEventId)do{addEventId=makeLocalId('event');}while(m.events.some(e=>e.id===addEventId));
  const eid={value:existing?.id??addEventId};
  const title=field(ef,eg,'title','Event title','text',existing?.title??'',{required:true});
  const linked=field(ef,eg,'linked','Linked attendance meeting (optional)','select',existing?.sessionId??'',{options:[{value:'',label:'Independent event · enter date/time'},...m.sessions.map(s=>({value:s.id,label:`${s.date} ${s.start} · ${m.registers.find(r=>r.id===s.registerId)?.name??'Register'} (${s.id})`}))]});
  const evDate=field(ef,eg,'date','Independent event date','date',existing?.date??defaultDate);
  const evStart=field(ef,eg,'start','Independent event start','time',existing?.start??'09:00');
  const evEnd=field(ef,eg,'end','Independent event end','time',existing?.end??'10:00');
  const cancelled=field(ef,eg,'cancelled','Cancel this event','checkbox',existing?.cancelled??false);
  add(ef,el('p','Every active event blocks a full-day break, even when it carries no attendance units. A linked event follows its meeting; an independent event does not.','form-note'));
  submit(ef,existing?'Save event changes':'Add compulsory event');evBox.append(ef);
  const history=details(parent,'snapshot-history','Earlier snapshots (read-only)',false);
  for(const snapshot of m.snapshots.slice().reverse()){
    const p=el('p',`${snapshot.date} · confirmed ${snapshot.confirmedAt?.date??'?'} ${snapshot.confirmedAt?.time??'?'} IST · ${m.registers.map(r=>`${r.name}: ${snapshot.counts[r.id]?.attended??'?'}/${snapshot.counts[r.id]?.held??'?'}`).join(' | ')}`,'history-row');history.append(p);
  }
}

/** Exact export required by A's controller. Every argument is treated read-only. */
export function render(state,results,callbacks){
  const app=document.getElementById('app');
  if(!app)return;
  const newScope=`${state.mode}:${state.model?.id??'new'}`;
  const captured=capture(app); // Save drafts on demo entry/exit too.
  const focus=scope===newScope?captured:(captured?.key==='switch-demo'?captured:null);
  // A synchronous callback re-renders before returning, so detect successful edits here.
  if(pendingSubmission && scope===newScope && state.model?.revision!==pendingSubmission.previousRevision){
    const values=draftMap();for(const key of values.keys())if(key.startsWith(`${pendingSubmission.group}::`))values.delete(key);
    if(pendingSubmission.group==='add-session')addSessionId=null;
    if(pendingSubmission.group==='event:new')addEventId=null;
  }
  scope=newScope;
  live={state,results,callbacks};
  if(state.mode==='personal'){
    chosenSession=state.model?.sessions.some(s=>s.id===chosenSession)?chosenSession:null;
    chosenEvent=state.model?.events.some(e=>e.id===chosenEvent)?chosenEvent:'new';
  }
  const setupJustSucceeded=pendingSubmission?.group==='initial-submit'&&state.model&&results?.runtime==='READY';
  if(setupJustSucceeded){setupStep=0;wizardIssue='';pendingFocusKey='plan-heading';}
  const root=el('div',null,'layout');
  const header=el('header',null,'site-header');
  const branding=el('div');add(branding,el('p','SEMESTERSPACE  /  SEMESTER PLANNER','eyebrow'),el('h1','Make room for a break.'),el('p','See every date, separate register and consequence before you commit.','hero-subtitle'));
  add(header,branding,button(state.mode==='demo'?'Exit synthetic demo':'Open synthetic demo',()=>{pendingFocusKey='switch-demo';state.mode==='demo'?callbacks.onExitDemo():callbacks.onEnterDemo();},{secondary:true,focusKey:'switch-demo'}));root.append(header);
  if(state.mode==='demo'){
    const b=el('div',null,'demo-banner');b.setAttribute('role','status');add(b,el('strong','SYNTHETIC DEMO · NOT YOUR COLLEGE DATA'),el('span','Fixed clock: 2 Nov 2026, 08:00 IST. All edits stay in isolated demo memory.'),button('Exit demo / restore personal setup',()=>{pendingFocusKey='switch-demo';callbacks.onExitDemo();},{secondary:true,focusKey:'demo-exit'}));root.append(b);
  }
  const noticeArea=el('div',null,'notices');
  if(state.notice){const n=el('p',state.notice,'notice');n.setAttribute('role','status');noticeArea.append(n);}
  const savingProblem=state.persistence.status==='FAILED'||state.persistence.status==='QUARANTINED';
  const persistence=el('p',`${state.persistence.status.replaceAll('_',' ')} — ${state.persistence.message}${savingProblem?' Changes may exist only in this tab. Do not rely on reload until storage is restored.':''}`,`persistence ${savingProblem?'save-failed':'muted'}`);persistence.setAttribute('role',savingProblem?'alert':'status');noticeArea.append(persistence);root.append(noticeArea);
  const grid=el('div',null,`main-grid ${state.model?'has-setup':'needs-setup'}`);
  const sidebar=el('div',null,'sidebar');
  const setup=section('Academic setup','Confirm actual counts or review the original source details. Plans never change actual attendance.');
  if(state.model){const advanced=details(setup,'existing-setup-controls','Review setup, counts and targets',false);existingSetup(advanced,state,callbacks);}
  else initialSetup(setup,callbacks);
  sidebar.append(setup);
  const review=section('Updates & history','Edit individual future meetings/events, inspect commitments and retained history.');
  if(state.model){const advanced=details(review,'review-controls','Open updates and commitment review',false);reviewSection(advanced,state,callbacks);sidebar.append(review);}
  const main=el('div',null,'planning-column');
  const plan=section('Current plan & calendar','Check the engine result and each date before suggesting or committing new breaks.');
  plan.querySelector('h2').dataset.uiKey='plan-heading';plan.querySelector('h2').tabIndex=-1;
  planSection(plan,state,results,callbacks);main.append(plan);
  if(state.model)add(grid,main,sidebar);else add(grid,sidebar,main);
  root.append(grid);
  const footer=el('footer','Local-only prototype · No automatic college verification, cloud backup, institutional approval or guarantees.');root.append(footer);
  // Build before clearing to preserve keyboard focus and unsubmitted inputs.
  // Deterministic fallback focus identity for actions without an explicit key.
  const buttonSeen=new Map();
  for(const b of root.querySelectorAll('button:not([data-ui-key])')){
    const owner=b.closest('[data-form-group]')?.dataset.formGroup??b.closest('[data-ui-panel]')?.dataset.uiPanel??'global';
    const base=`action:${owner}:${b.textContent}`;const count=buttonSeen.get(base)??0;buttonSeen.set(base,count+1);
    b.dataset.uiKey=`${base}:${count}`;
  }
  app.replaceChildren(root);
  restoreFocus(app,pendingFocusKey?{key:pendingFocusKey}:focus);
  pendingFocusKey=null;
}
