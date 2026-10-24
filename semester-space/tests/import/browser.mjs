// Real Chromium file selection and native localStorage. No mocked extraction or engine.
// Run: npm run test:import-browser (start npm start first; SS_ORIGIN can override).
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fixture,completeSyntheticCoverage} from './coverage-fixture.mjs';
import {parseCalendar} from '../../src/import/parse.js';
import {recordPageCoverage} from '../../src/import/coverage.js';
export async function runBrowserCheck(){
 const {chromium}=await import('playwright');
 const origin=process.env.SS_ORIGIN??'http://127.0.0.1:5173';
 const browser=await chromium.launch({executablePath:process.env.SS_CHROMIUM??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
 const dir=process.env.SS_EVIDENCE_DIR??'/tmp/ss-browser-evidence';await mkdir(dir,{recursive:true});const report={clock:'Synthetic browser clock: 2026-10-24 20:00 Asia/Kolkata'};
 await page.clock.install({time:new Date('2026-10-24T14:30:00Z')});
 try{
  await page.goto(origin);
  const apiCases=[];
  for(const name of ['omitted','readable-opaque','deleted','information-only','page-reviewed']){
   const {d,o}=fixture();const p=d.pages[1];Object.assign(p,{text:'Mandatory exam 26.10.2026',method:'OCR',width:1000,height:1000,items:[{text:'Mandatory exam 26.10.2026',x:10,y:100,w:800,h:20}]});
   if(name==='readable-opaque'){p.text='M S T shown by colour codes; symbols require human interpretation.';p.items=[{text:p.text,x:10,y:100,w:800,h:20}];}
   else if(['deleted','information-only'].includes(name)){d.calendarEntries=parseCalendar(d.sources[1],[p],d.id).calendarEntries;for(const r of d.calendarEntries)Object.assign(r,{review:'CONFIRMED',applicability:'APPLIES',treatment:'COMPULSORY',allDay:true});completeSyntheticCoverage(d,o);if(name==='deleted')d.calendarEntries=[];else{d.calendarEntries[0].kind='HOLIDAY';d.calendarEntries[0].treatment='INFORMATION_ONLY';d.calendarEntries[0].resolutionNote='Generic administrative note';}for(const r of d.calendarCoverage.pages)recordPageCoverage(d,o,r);}
   if(name==='page-reviewed')d.pages[1].reviewed=true;
   const r=await page.evaluate(async({d,o})=>{const {compileConfirmedImport}=await import('/src/import/compile.js');const r=compileConfirmedImport(d,o);return {ok:r.ok,codes:r.issues.map(i=>i.code)};},{d,o});assert.equal(r.ok,false,name);apiCases.push({name,...r});
  }
  report.syntheticBrowserApiCoverageCases=apiCases;
  await page.getByRole('heading',{name:'Start with your documents',exact:true}).waitFor();
  const file=n=>fileURLToPath(new URL('../../../reference-inputs/'+n,import.meta.url));
  await page.getByLabel('Timetable file',{exact:true}).setInputFiles(file('1stSemPoolB.pdf'));await page.getByLabel('Academic calendar file',{exact:true}).setInputFiles(file('Academic_Calendar_Odd_Semester_2026-2027.pdf'));
  const start=Date.now();await page.getByRole('button',{name:'Extract editable draft',exact:true}).click();await page.getByRole('heading',{name:'1. Review source pages and extracted candidates',exact:true}).waitFor({timeout:180000});report.extractionMs=Date.now()-start;
  assert.equal(await page.locator('[data-import-row]').count(),29);assert.match(await page.locator('[data-import-output]').innerText(),/18 lecture periods; 4 merged lab blocks/);
  await page.getByRole('button',{name:'Validate reviewed draft and save initial setup',exact:true}).click();assert.match(await page.locator('[data-import-errors]').innerText(),/unresolved issues/);assert.equal(await page.evaluate(()=>localStorage.length),0);report.unresolvedBlocked=true;
  await page.screenshot({path:dir+'/draft-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});report.draftMobileWidths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(report.draftMobileWidths.scroll<=390);await page.screenshot({path:dir+'/draft-mobile.png',fullPage:true});await page.setViewportSize({width:1280,height:900});
  // Mark each source page covered by this synthetic QA review, using the real preview controls.
  const picker=page.locator('[data-page-picker]');for(const value of await picker.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value))){await picker.selectOption(value);await page.getByLabel('I viewed this source page (this does not confirm calendar coverage)',{exact:true}).check();}
  await page.locator('[data-import-output] details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  const subjects=page.getByLabel('I reviewed this subject and its alias proposal',{exact:true});for(let i=0;i<await subjects.count();i++)await subjects.nth(i).check();
  for(const row of await page.locator('[data-import-row]').all()){
   await row.evaluate(e=>{e.open=true;});const title=await row.locator(':scope > summary').innerText();
   const note=row.getByLabel('Resolution / correction reason',{exact:true});
   if(/ACTIVITY/.test(title)){await row.getByLabel('Attendance treatment',{exact:true}).selectOption(title.includes('Library')&&title.includes('Monday')?'COMPULSORY_ZERO_UNITS':'OPTIONAL');await note.fill('Synthetic QA only: explicit activity treatment, not personal policy.');}
   else await row.getByLabel('Attendance units per occurrence (not duration)',{exact:true}).fill('1');
   const group=row.getByLabel('Source group label (confirm its mapping)',{exact:true});
   if(await group.count()){
    if(title.includes('Physics')){await row.getByLabel('Applies to me',{exact:true}).selectOption('DOES_NOT_APPLY');await note.fill('Synthetic QA only: exclude this block for test setup. Real Q3 physics remains unresolved.');}
    else{await group.selectOption(title.toLowerCase().includes('programming')?'Q23':'Q3');await row.getByLabel('Applies to me',{exact:true}).selectOption('APPLIES');await note.fill('Synthetic QA: source group explicitly selected and reviewed.');}
   }
   await row.getByLabel('I reviewed this occurrence, including applicability and any group mapping',{exact:true}).check();
  }
  for(const row of await page.locator('[data-calendar-row]').all()){
   await row.evaluate(e=>{e.open=true;});const category=await row.getByLabel('Source category',{exact:true}).inputValue();
   if(category==='HOLIDAY'&&(await row.getByLabel('Start date',{exact:true}).inputValue())&&(await row.getByLabel('Start date',{exact:true}).inputValue())===(await row.getByLabel('End date',{exact:true}).inputValue())){
    await row.getByLabel('Applies to my cohort',{exact:true}).selectOption('APPLIES');await row.getByLabel('Planner treatment',{exact:true}).selectOption('HOLIDAY');
   }else{
    await row.getByLabel('Applies to my cohort',{exact:true}).selectOption('DOES_NOT_APPLY');await row.getByLabel('Planner treatment',{exact:true}).selectOption('DOES_NOT_APPLY');
   }
   await row.getByLabel('Resolution / correction reason',{exact:true}).fill('Synthetic QA only: scoped test confirmations. These are not the student’s actual applicability decisions.');await row.getByLabel('Review decision',{exact:true}).selectOption('CORRECTED');
   await row.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
   const represented=await row.getByLabel('Planner treatment',{exact:true}).inputValue()==='HOLIDAY';
   await row.getByLabel('Source candidate resolution',{exact:true}).selectOption(represented?'REPRESENTED':'NO_APPLICABLE_EFFECT');
   if(represented)await row.getByLabel('Planner entries representing this source candidate',{exact:true}).selectOption(await row.getAttribute('data-calendar-row'));
   await row.getByLabel('Source-based resolution explanation',{exact:true}).fill(represented?'Synthetic reviewer explicitly represents this holiday.':'Synthetic review only: no student obligation applies to the synthetic programme. This is not a personal confirmation.');
   await row.getByLabel('I explicitly confirm this source candidate resolution',{exact:true}).check();
  }
  await page.locator('[data-import-output] details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  const confirm=page.getByText('5. Subjects I must attend, actual counts and final confirmation',{exact:true}).locator('..');
  for(const [label,value] of [['Institution','MAIT'],['Academic year','2026-27'],['Semester number','1'],['Programme','Synthetic QA UG'],['Confirmed schedule start','2026-10-24'],['Confirmed last teaching day','2026-11-09'],['Counts complete through','2026-10-23'],['First candidate break date','2026-10-24'],['Last candidate break date','2026-11-09']])await confirm.getByLabel(label,{exact:true}).fill(value);
  await confirm.getByLabel('I checked academic identity, source applicability and teaching horizon',{exact:true}).check();await confirm.getByLabel('All actual counts refer to this same completed day',{exact:true}).check();
  for(const label of ['I verified this source institution','I verified its term / academic year','I verified first-year / programme / cohort applicability, exceptions and notices'])for(const node of await confirm.getByLabel(label,{exact:true}).all())await node.check();
  // Refresh active count roster after treatments and applicability edits (without losing draft inputs).
  for(const box of await confirm.locator('details').all())await box.evaluate(e=>{e.open=true;});
  for(const [label,value] of [['Requirement R (%)','75'],['Buffer B (percentage points)','3'],['Actually attended units','90'],['Actually held units','100']])for(const node of await confirm.getByLabel(label,{exact:true}).all())await node.fill(value);
  await confirm.getByLabel('Search reviewed subjects',{exact:true}).fill('Communication');const selection=confirm.getByLabel('Subjects I must attend',{exact:true});await selection.selectOption({label:'Communication Skills'});
  await page.getByRole('button',{name:'Validate reviewed draft and save initial setup',exact:true}).click();
  assert.match(await page.locator('[data-import-errors]').innerText(),/CALENDAR_MANUAL_COMPLETION/);assert.equal(await page.evaluate(()=>localStorage.length),0);report.pageViewingCannotCompleteCoverage=true;
  const effects=new Map();for(const row of await page.locator('[data-calendar-row]').all())effects.set(await row.getAttribute('data-calendar-row'),await row.getByLabel('Planner treatment',{exact:true}).inputValue());
  for(const panel of await page.locator('[data-coverage-page]').all()){
   await panel.evaluate(n=>n.open=true);
   for(const area of await panel.locator('[data-coverage-area]').all()){
    await area.evaluate(n=>n.open=true);const key=await area.getAttribute('data-coverage-area'),rows=area.getByLabel('Entered planner rows for this coverage area',{exact:true});
    const ids=await rows.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));const selected=ids.filter(id=>key==='NON_TEACHING'&&effects.get(id)==='HOLIDAY');
    await area.getByLabel('Manual coverage decision',{exact:true}).selectOption(selected.length?'ENTERED':'NONE_APPLICABLE');if(selected.length)await rows.selectOption(selected);
    await area.getByLabel('Manual completion explanation',{exact:true}).fill('Explicit synthetic manual comparison with this source page, cohort and horizon. All nonholiday obligations are excluded only in this synthetic scenario.');
   }
   await panel.getByRole('button',{name:'Confirm this page’s manual coverage for current entries and scope',exact:true}).click();
  }
  await page.getByRole('button',{name:'Validate reviewed draft and save initial setup',exact:true}).click();
  await page.getByRole('heading',{name:'Projected attendance by separate register',exact:true}).waitFor({timeout:15000}).catch(async()=>{throw Error('Setup failed: '+await page.locator('[data-import-errors]').innerText());});
  report.connectedSetup=true;assert.match(await page.locator('body').innerText(),/Calendar coverage was manually confirmed from partial extraction/);
  assert.equal(await page.locator('[data-document-import]').count(),0);const savedBefore=await page.evaluate(()=>Object.values(localStorage));assert.ok(savedBefore.some(s=>s.includes('Synthetic QA UG')));assert.ok(!savedBefore.some(s=>s.includes('rawText')||s.includes('preview')));
  await page.getByRole('button',{name:'Find suggested teaching days off',exact:true}).click();const commit=page.getByRole('button',{name:'Commit selected dates together',exact:true});await commit.waitFor();
  const accept=commit.locator('..'),checks=accept.locator('input[type=checkbox]');assert.equal(await checks.count(),2);await checks.nth(1).uncheck();await commit.click();report.subsetAccepted=true;
  await page.locator('[data-ui-panel="existing-setup-controls"], [data-ui-panel="existing-snapshot"]').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
  const snapshot=page.locator('form[data-form-group="snapshot"]');for(const input of await snapshot.locator('input[data-ui-key$=":attended"]').all())await input.fill('78');
  await snapshot.locator('[data-ui-key="snapshot::confirm"]').check();await snapshot.getByRole('button',{name:'Confirm new snapshot',exact:true}).click();await page.getByRole('heading',{name:'Combined plan blocked',exact:true}).waitFor();report.actualInvalidation=true;
  const model=await page.evaluate(()=>Object.values(localStorage).map(v=>JSON.parse(v)).find(v=>v.model)?.model);assert.equal(model.commitments.length,1);assert.equal(model.snapshots.length,2);
  await page.reload();await page.getByRole('heading',{name:'Combined plan blocked',exact:true}).waitFor();report.nativeReload=true;
  const recheck=page.getByRole('button',{name:'Recheck current plan',exact:true});await recheck.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Recheck current plan');await page.keyboard.press('Tab');report.keyboardRecheck=true;
  const persisted=await page.evaluate(()=>Object.values(localStorage));await page.getByRole('button',{name:'Open synthetic demo',exact:true}).click();await page.getByRole('button',{name:'Exit synthetic demo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>Object.values(localStorage)),persisted);report.demoIsolation=true;
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:dir+'/connected-mobile.png',fullPage:true});report.mobileWidths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(report.mobileWidths.scroll<=report.mobileWidths.client);
  const fresh=await browser.newContext(),cancelPage=await fresh.newPage();await cancelPage.goto(origin);
  await cancelPage.getByLabel('Timetable file',{exact:true}).setInputFiles(file('1stSemPoolB.pdf'));await cancelPage.getByLabel('Academic calendar file',{exact:true}).setInputFiles(file('Academic_Calendar_Odd_Semester_2026-2027.pdf'));
  await cancelPage.getByRole('button',{name:'Extract editable draft',exact:true}).click();await cancelPage.getByRole('button',{name:'Cancel / discard import',exact:true}).click();assert.equal(await cancelPage.locator('[data-import-row]').count(),0);assert.equal(await cancelPage.evaluate(()=>localStorage.length),0);report.cancelPreservesState=true;
  const assetPage=await fresh.newPage();await assetPage.goto(origin);await assetPage.route('**/src/import/vendor/pdf.mjs',route=>route.fulfill({status:404,body:'Missing asset test'}));
  const failure=await assetPage.evaluate(async()=>{const {extractDocuments}=await import('/src/import/index.js');return extractDocuments({section:'Q',timetable:{fileName:'missing.pdf',bytes:new TextEncoder().encode('%PDF- invalid')},academicCalendar:{bytes:new Uint8Array([1])}});});assert.equal(failure.status,'UNREADABLE');assert.match(failure.issues.at(-1).message,/MISSING_ASSETS/);report.missingAssetsActionable=true;await fresh.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.pageErrors=errors;report.externalRequests=external;
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){await writeFile(dir+'/failure.html',await page.content());await writeFile(dir+'/failure.txt',JSON.stringify({message:e.message,errors,body:(await page.locator('body').innerText()).slice(0,3000)}));throw e;}finally{await browser.close();}
}
if(process.argv.includes('--run'))await runBrowserCheck();
