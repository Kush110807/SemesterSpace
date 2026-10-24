import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {parseTimetable,parseCalendar,parseDates,validDate} from '../../src/import/parse.js';
import {validateImportDraft,compileConfirmedImport} from '../../src/import/compile.js';
import {createImportJob,extractDocuments} from '../../src/import/index.js';
import {checkSource} from '../../src/import/read.js';
import * as engine from '../../src/engine/index.js';
import {createController} from '../../src/controller.js';
const clock={date:'2026-10-24',time:'20:00',timeZone:'Asia/Kolkata'};
const ev=(id='tt',raw='Synthetic source evidence')=>[{sourceId:id,page:1,bbox:[0,0,1,1],rawText:raw,method:'PDF_TEXT',confidence:null}];
function fixture(){
 const d={importVersion:'0.2.0',id:'test',status:'REVIEW_REQUIRED',selectedSection:'Q',sectionCandidates:['Q'],declaredSubgroup:'Q3',sources:[{id:'tt',role:'TIMETABLE',sha256:'a'.repeat(64),pageCount:1},{id:'cal',role:'ACADEMIC_CALENDAR',sha256:'b'.repeat(64),pageCount:1,academicYear:2026}],pages:[{sourceId:'tt',page:1,reviewed:true},{sourceId:'cal',page:1,reviewed:true}],subjects:[{id:'s',name:'Synthetic subject',review:'CONFIRMED',evidence:ev()}],registers:[{id:'r',subjectId:'s',name:'Independent theory',kind:'THEORY',review:'CONFIRMED',evidence:ev()}],timetableEntries:[{id:'t',kind:'LECTURE',subjectId:'s',registerId:'r',weekday:1,start:'09:00',end:'10:00',weight:1,treatment:'ATTENDANCE',applicability:'APPLIES',review:'CONFIRMED',groupOptions:[],groupChoice:null,evidence:ev()}],calendarEntries:[],issues:[]};
 const o={modelId:'synthetic-import',context:{college:'Synthetic college',academicYear:'2026-27',semester:'1',programme:'Synthetic UG',section:'Q',sourceLabel:'Synthetic source',preparedOn:clock.date,applicabilityConfirmed:true},academicScope:{institution:'Synthetic college',academicYear:'2026-27',term:'ODD',degreeGroup:'UG',semesterNumber:1,programme:'Synthetic UG',isTeachingAssistant:false},sourceApplicability:{tt:{institutionConfirmed:true,termConfirmed:true,cohortConfirmed:true},cal:{institutionConfirmed:true,termConfirmed:true,cohortConfirmed:true}},clockPlaceholder:clock,startDate:'2026-10-24',teachingEnd:'2026-11-09',horizonConfirmed:true,protectedSubjectIds:[],registerRules:{r:{requiredBps:7500,personalMinBps:null,bufferBps:300}},snapshot:{date:'2026-10-23',counts:{r:{attended:90,held:100}},confirmed:true,completeToday:false},preferences:{candidateStart:'2026-10-24',candidateEnd:'2026-11-09',requestedDays:2,preferredDates:[],notes:''},replacements:[],holidayTeachingDates:[]};return {d,o};
}
const calendar=(overrides={})=>({id:'c',title:'Synthetic holiday',kind:'HOLIDAY',startDate:'2026-10-26',endDate:'2026-10-26',term:'ODD',certainty:'AS_LISTED',applicability:'APPLIES',treatment:'HOLIDAY',review:'CONFIRMED',printedCalendarWeekday:null,replacementWeekday:null,allDay:null,startTime:null,endTime:null,evidence:ev('cal'),...overrides});
async function pdfPages(name){const pdf=await getDocument({data:new Uint8Array(await readFile(new URL('../../../reference-inputs/'+name,import.meta.url))),useSystemFonts:true}).promise;try{const pages=[];for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1}),c=await p.getTextContent();const items=c.items.filter(i=>i.str?.trim()).map(i=>({text:i.str,x:i.transform[4],y:v.height-i.transform[5]-i.height,w:i.width,h:i.height}));pages.push({page:n,width:v.width,height:v.height,items,text:items.map(i=>i.text).join(' '),method:'PDF_TEXT'});}return pages;}finally{await pdf.destroy();}}
let original;
test('actual timetable bytes: eight sections, Q boundaries, 18 theory periods, four merged labs and seven academic families',async()=>{
 original=await pdfPages('1stSemPoolB.pdf');const r=parseTimetable({id:'tt'},original,'Q','test');
 assert.deepEqual(r.sectionCandidates,['O','P','Q','R','S','T','U','V']);assert.equal(r.timetableEntries.filter(r=>r.kind==='LECTURE').length,18);assert.equal(r.timetableEntries.filter(r=>r.kind==='LAB').length,4);
 const academic=new Set(r.timetableEntries.filter(r=>r.kind!=='ACTIVITY').map(r=>r.subjectId));assert.equal(academic.size,7);assert.equal(r.registers.filter(r=>r.kind!=='ACTIVITY').length,10);
 assert.equal(r.timetableEntries.filter(r=>r.kind==='ACTIVITY').length,7);
 assert.ok(r.timetableEntries.every(r=>r.evidence[0].page===2&&!/\bR[123]/.test(r.evidence[0].rawText)));
 const physics=r.timetableEntries.find(r=>r.kind==='LAB'&&r.evidence[0].rawText.includes('PHY-LAB'));assert.deepEqual(physics.groupOptions,['Q1','Q2']);assert.equal(physics.groupChoice,null);
 const c=r.timetableEntries.find(r=>r.kind==='LAB'&&r.evidence[0].rawText.includes('Q23'));assert.deepEqual(c.groupOptions,['Q12','Q23']);
 const comm=r.timetableEntries.filter(r=>r.weekday===1&&r.kind==='LECTURE');assert.deepEqual(comm.map(r=>[r.start,r.end]),[['15:20','16:10'],['16:10','17:00']]);
});
test('actual extraction is content-driven: moved section, changed name, renamed input metadata and unknown section',async()=>{
 const pages=original??await pdfPages('1stSemPoolB.pdf'),changed=structuredClone(pages);
 for(const p of changed)for(const i of p.items){i.y+=13;if(i.text==='Communication Skills')i.text='Changed source subject';}
 const r=parseTimetable({id:'a',fileName:'unrelated.pdf'},changed,'Q','changed');assert.ok(r.subjects.some(s=>s.name==='Changed source subject'));assert.ok(!r.subjects.some(s=>s.name==='Communication Skills'));assert.equal(r.timetableEntries.filter(r=>r.kind==='LECTURE').length,18);
 const unknown=parseTimetable({id:'a'},pages,'ZZ','unknown');assert.equal(unknown.timetableEntries.length,0);assert.ok(unknown.issues.some(i=>i.code==='SECTION_NOT_FOUND'));
});
test('actual IIT(BHU) text layer is exposed separately from unusable Hindi glyph encoding',async()=>{
 const pages=await pdfPages('IIT_BHU_calendar_26-27_odd.pdf'),r=parseCalendar({id:'cal'},pages,'bhu');assert.match(pages[0].text,/INDIAN INSTITUTE OF TECHNOLOGY/);assert.ok(r.calendarEntries.some(r=>r.evidence[0].page===1&&r.startDate==='2026-08-07'));assert.ok(r.issues.some(r=>r.code==='TEXT_ENCODING_OR_LAYOUT'));
});
test('Gregorian dates, raw OCR errors and compact OCR dates are preserved for review',()=>{
 assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);
 assert.deepEqual(parseDates('04.09.2028 Friday',2026).map(r=>r.date),['2028-09-04']);assert.equal(parseDates('15082026',2026)[0].date,'2026-08-15');assert.equal(parseDates('Janmashtami',2026).length,0);
 const {d,o}=fixture();d.calendarEntries=[calendar({startDate:'2028-09-04',endDate:'2028-09-04',printedCalendarWeekday:5})];let r=validateImportDraft(d,o);assert.ok(r.issues.some(r=>r.code==='SOURCE_YEAR_CONFLICT'));assert.ok(r.issues.some(r=>r.code==='SOURCE_WEEKDAY_CONFLICT'));
 d.calendarEntries[0].startDate=d.calendarEntries[0].endDate='2026-09-04';d.calendarEntries[0].review='CORRECTED';d.calendarEntries[0].resolutionNote='Visually corrected the year from source';assert.equal(validateImportDraft(d,o).ok,true);
});
test('positive review flags cannot override missing weights, groups, counts, dates or coverage',()=>{
 for(const mutate of [({d})=>d.timetableEntries[0].weight=null,({d})=>Object.assign(d.timetableEntries[0],{groupOptions:['Q1','Q2'],groupChoice:'Q3'}),({o})=>o.snapshot.counts.r.attended=null,({d})=>d.pages[1].reviewed=false,({d})=>d.calendarEntries.push(calendar({startDate:null,endDate:null})),({d})=>d.timetableEntries[0].applicability='UNRESOLVED',({d})=>d.timetableEntries[0].registerId='missing']){
 const f=fixture();mutate(f);assert.equal(compileConfirmedImport(f.d,f.o).ok,false);assert.equal(compileConfirmedImport(f.d,f.o).model,null);
 }
});
test('cohort, institution and selected term cannot be silently combined',()=>{
 const {d,o}=fixture();d.sources[1].institutionLabel='INDIAN INSTITUTE OF TECHNOLOGY (BHU)';assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='WRONG_INSTITUTION'));delete d.sources[1].institutionLabel;
 d.calendarEntries=[calendar({term:'EVEN'})];assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='WRONG_TERM'));
 d.calendarEntries[0].applicability='DOES_NOT_APPLY';d.calendarEntries[0].resolutionNote='Even semester does not apply to my odd term';assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('tentative exams require resolution and explicit times/all-day choice; they never cancel classes',()=>{
 const {d,o}=fixture();d.calendarEntries=[calendar({kind:'EXAM_WINDOW',treatment:'COMPULSORY',certainty:'TENTATIVE'})];assert.equal(compileConfirmedImport(d,o).ok,false);
 Object.assign(d.calendarEntries[0],{allDay:true,resolutionNote:'Synthetic review: protect the whole tentative window'});const r=compileConfirmedImport(d,o);assert.equal(r.ok,true);assert.equal(r.model.events[0].start,'00:00');assert.equal(r.model.events[0].end,'23:59');assert.equal(r.model.schedule.holidays.length,0);
 const expanded=engine.expandSchedule({schedule:r.model.schedule,courses:r.model.courses,registers:r.model.registers,extraSessions:[],overrides:[]});assert.ok(expanded.sessions.some(s=>s.date==='2026-10-26'));
});
test('holiday suppression, non-teaching/makeup substitutions and zero-unit events follow effective weekday exactly once',()=>{
 const {d,o}=fixture();d.timetableEntries.push({...structuredClone(d.timetableEntries[0]),id:'zero',treatment:'COMPULSORY_ZERO_UNITS',weight:null,start:'11:00',end:'12:00'});
 d.calendarEntries=[calendar({kind:'NON_TEACHING',treatment:'NON_TEACHING'}),calendar({id:'replacement',kind:'REPLACEMENT',treatment:'REPLACEMENT',startDate:'2026-10-31',endDate:'2026-10-31',replacementWeekday:1})];
 const r=compileConfirmedImport(d,o);assert.equal(r.ok,true);const m=r.model,e=engine.expandSchedule({schedule:m.schedule,courses:m.courses,registers:m.registers,extraSessions:[],overrides:[]});assert.ok(e.ok);assert.deepEqual(m.events.map(e=>e.date),e.sessions.map(s=>s.date));assert.equal(m.events.filter(e=>e.date==='2026-10-31').length,1);assert.equal(e.sessions.some(s=>s.date==='2026-10-26'),false);assert.equal(m.registers.length,1);
});
test('overlaps, unconfirmed holiday teaching and ambiguous replacements return no model',()=>{
 const f=fixture();f.d.timetableEntries.push({...structuredClone(f.d.timetableEntries[0]),id:'overlap'});assert.equal(compileConfirmedImport(f.d,f.o).ok,false);
 const {d,o}=fixture();d.calendarEntries=[calendar(),calendar({id:'replacement',kind:'REPLACEMENT',treatment:'REPLACEMENT',replacementWeekday:1})];assert.equal(compileConfirmedImport(d,o).ok,false);o.holidayTeachingDates=['2026-10-26'];assert.equal(compileConfirmedImport(d,o).ok,true);
 o.replacements=[{date:'2026-10-26',weekday:2,confirmed:true}];assert.equal(compileConfirmedImport(d,o).ok,false);
});
test('compilation is pure, identities survive name edits and theory/practical registers stay independent',()=>{
 const {d,o}=fixture();d.registers.push({...structuredClone(d.registers[0]),id:'practical',kind:'PRACTICAL'});d.timetableEntries.push({...structuredClone(d.timetableEntries[0]),id:'lab',registerId:'practical',kind:'LAB',start:'11:00',end:'13:00'});o.registerRules.practical={...o.registerRules.r};o.snapshot.counts.practical={attended:20,held:20};
 const before=structuredClone({d,o});const a=compileConfirmedImport(d,o);assert.equal(a.ok,true);assert.deepEqual({d,o},before);d.subjects[0].name='Renamed';const b=compileConfirmedImport(d,o);assert.deepEqual(a.model.schedule.weeklyTemplates,b.model.schedule.weeklyTemplates);assert.equal(b.model.registers.length,2);
 assert.equal(JSON.stringify(b.model).includes('rawText'),false);assert.equal(JSON.stringify(b.model).includes('sha256'),false);
});
test('real controller -> engine -> suggestions -> subset acceptance -> actual invalidation -> reload and demo isolation',()=>{
 const {d,o}=fixture(),compiled=compileConfirmedImport(d,o);assert.ok(compiled.ok);let saved=null,writes=0,last;
 const storage={getItem:()=>saved,setItem:(k,v)=>{writes++;saved=v;}};
 const app=createController({engine,storage,clock:()=>clock,render:(state,results)=>{last={state:structuredClone(state),results:structuredClone(results)};}});
 app.callbacks.onReplaceSetup({model:compiled.model});assert.equal(last.results.runtime,'READY');assert.equal(last.state.model.schedule.initialized,true);app.callbacks.onSuggest();assert.equal(last.state.batch.dates.length,2);
 const date=last.state.batch.dates[0];app.callbacks.onAccept({dates:[date],modelRevision:last.state.model.revision});assert.deepEqual(last.state.model.commitments.map(c=>c.date),[date]);
 app.callbacks.onConfirmSnapshot({date:'2026-10-23',counts:{r:{attended:78,held:100}},confirmed:true,completeToday:false});assert.equal(last.results.evaluation.status,'PLAN_BLOCKED');assert.equal(last.state.model.commitments.length,1);
 const snapshot=saved;app.callbacks.onEnterDemo();app.callbacks.onSuggest();assert.equal(saved,snapshot);app.callbacks.onExitDemo();assert.equal(last.state.model.commitments[0].date,date);
 createController({engine,storage,clock:()=>clock,render:(state,results)=>{last={state,results};}});assert.equal(last.results.evaluation.status,'PLAN_BLOCKED');assert.equal(last.state.model.snapshots.length,2);
 const old=saved;app.callbacks.onReplaceSetup({model:compiled.model});assert.equal(saved,old);assert.ok(writes>0);
});
test('unsupported, oversized, empty, malformed and aborted sources do not produce a model',async()=>{
 assert.throws(()=>checkSource({bytes:new Uint8Array()}),/EMPTY_FILE/);assert.throws(()=>checkSource({bytes:new Uint8Array(16*1024*1024)}),/FILE_LIMIT/);assert.throws(()=>checkSource({bytes:new TextEncoder().encode('not a document')}),/UNSUPPORTED/);
 const r=await extractDocuments({timetable:{fileName:'real.pdf',bytes:new Uint8Array([1,2,3])},academicCalendar:null,section:'Q'});assert.equal(r.status,'UNSUPPORTED');assert.ok(r.issues.some(i=>i.code==='EXTRACTION_FAILED'));
 const c=new AbortController();c.abort();await assert.rejects(extractDocuments({signal:c.signal,section:'Q'}),{name:'AbortError'});
});
test('source replacement and cancellation reject late results even from a non-cooperative decoder',async()=>{
 const resolvers=[];const job=createImportJob(()=>new Promise(resolve=>resolvers.push(resolve)));const first=job.run({});const old=assert.rejects(first,{name:'AbortError'});const second=job.run({});resolvers[1]('new');assert.equal(await second,'new');resolvers[0]('old');await old;
 const third=job.run({}),cancelled=assert.rejects(third,{name:'AbortError'});job.cancel();resolvers[2]('late');await cancelled;
});
test('replacement pattern differs from printed date weekday; unknown working Saturdays stay unresolved',()=>{
 const page={page:1,width:1200,height:1000,method:'OCR',text:'Academic Calendar 2026-27',items:[{text:'Saturday, August 22, 2026 will have the timetable of Tuesday',x:100,y:100,w:900,h:15},{text:'Saturday October 10, 2026 will be a Working Saturday in view of exams',x:100,y:200,w:900,h:15}]};
 const r=parseCalendar({id:'cal'},[page],'x');assert.equal(r.calendarEntries[0].kind,'REPLACEMENT');assert.equal(r.calendarEntries[0].replacementWeekday,2);assert.equal(r.calendarEntries[1].kind,'WORKING_DAY_NOTICE');assert.equal(r.calendarEntries[1].replacementWeekday,null);
});
test('wrong cohorts and TA exclusions need explicit resolution; foreign sources cannot borrow confirmed scope',()=>{
 const {d,o}=fixture();d.calendarEntries=[calendar({audienceText:'PG-I only'})];assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='WRONG_COHORT'));
 d.calendarEntries=[calendar({audienceText:'UG students except TAs'})];o.academicScope.isTeachingAssistant=null;assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='TA_APPLICABILITY'));
 o.academicScope.isTeachingAssistant=false;assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('out-of-horizon vacation cannot extend projection and all protection uses existing Course.mustAttend',()=>{
 const {d,o}=fixture();d.calendarEntries=[calendar({kind:'VACATION',treatment:'NON_TEACHING',startDate:'2027-01-04',endDate:'2027-01-17'})];o.protectedSubjectIds=['s'];const c=compileConfirmedImport(d,o);assert.equal(c.ok,true);assert.equal(c.model.schedule.teachingEnd,o.teachingEnd);assert.equal(c.model.schedule.holidays.length,0);assert.equal(c.model.courses[0].mustAttend,true);
 d.subjects.push({id:'unused',name:'Unused optional candidate',review:'CONFIRMED',evidence:ev()});o.protectedSubjectIds.push('unused');assert.equal(compileConfirmedImport(d,o).ok,false);o.protectedSubjectIds=['s'];
 const e=engine.expandSchedule({schedule:c.model.schedule,courses:c.model.courses,registers:c.model.registers,extraSessions:[],overrides:[]});const model={...c.model,schedule:{...c.model.schedule,initialized:true},sessions:e.sessions};assert.equal(engine.evaluatePlan(model,{clock,additionalDates:['2026-10-26']}).status,'PLAN_BLOCKED');
});
test('malformed draft arrays return structured issues rather than throwing',()=>{
 const {d,o}=fixture();d.timetableEntries=[null];assert.doesNotThrow(()=>validateImportDraft(d,o));assert.equal(compileConfirmedImport(d,o).model,null);
});
test('erasing proposed group options or toggling an issue flag cannot hide source group ambiguity',()=>{
 const {d,o}=fixture();Object.assign(d.timetableEntries[0],{kind:'LAB',groupOptions:[],groupChoice:null,evidence:ev('tt','Physics Lab Q1 teacher, Q2 teacher')});d.issues=[{code:'GROUP',resolved:true}];assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='GROUP_CHOICE'));
 d.timetableEntries[0].groupChoice='Q1';d.timetableEntries[0].resolutionNote='Synthetic QA explicit mapping confirmation';assert.equal(compileConfirmedImport(d,o).ok,true);
});
test('exam-related teaching suppression needs an explicit reason; ordinary attainment text is not a TTA notice',()=>{
 const {d,o}=fixture();d.calendarEntries=[calendar({kind:'EXAM_WINDOW',treatment:'NON_TEACHING'})];assert.ok(validateImportDraft(d,o).issues.some(i=>i.code==='EXAM_CANCELLATION_CONFIRMATION'));d.calendarEntries[0].resolutionNote='Synthetic confirmed class suspension notice';assert.equal(compileConfirmedImport(d,o).ok,true);
 const p={page:1,width:1000,height:1000,text:'Academic Calendar 2026-27',method:'PDF_TEXT',items:[{text:'Course Attainment Update 09.11.2026',x:100,y:100,w:700,h:15}]};assert.notEqual(parseCalendar({id:'cal'},[p],'t').calendarEntries[0].kind,'REPLACEMENT');
 assert.equal(parseDates('1508.2026',2026)[0].date,'2026-08-15');
});
