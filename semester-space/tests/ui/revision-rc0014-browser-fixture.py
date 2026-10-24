"""Headless Chromium RC-001.4 UI-fixture verification. Not live extraction, storage or A integration.

Source review, rendered C controls and request/response shape; importer and controller
are test doubles. Uses inline document because this sandbox blocks served-origin Chrome.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parents[2]
OUT=HERE/'tests/ui/evidence'; OUT.mkdir(exist_ok=True,parents=True)
REV=(HERE/'src/ui/revision-review.js').read_text()
REL=(HERE/'src/ui/release.js').read_text()
CSS=(HERE/'src/ui/styles.css').read_text()
assert "import {extractCalendarRevision}" in REV and "import {renderRevisionIntake,isRevisionStageLocallyOutdated}" in REL
REV=REV.replace("import {extractCalendarRevision} from '../import/revision-extract.js';",'').replace("import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';",'').replace('export function renderRevisionIntake','function renderRevisionIntake').replace('export function isRevisionStageLocallyOutdated','function isRevisionStageLocallyOutdated')
REL=REL.replace("import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';",'').replace("import {FIXED_CLOCK} from '../shared/fixtures.js';",'').replace('export function ','function ')
STUBS=r'''
window.calls=[];
let mockState={mode:'personal',selectedDate:'2026-11-02',model:{id:'synthetic-only',revision:7,context:{college:'Synthetic academy',academicYear:'2026-27',semester:'1',programme:'Fixture UG',section:'Q'},schedule:{startDate:'2026-11-01',teachingEnd:'2026-11-30',holidays:[]},sessions:[{id:'s1',registerId:'lecture',date:'2026-11-02',start:'09:00',end:'10:00',weight:1,cancelled:false}],events:[],snapshots:[{id:'base',date:'2026-11-01'}],registers:[{id:'lecture',courseId:'subj',name:'Lecture'}],courses:[{id:'subj',name:'Fixture'}],commitments:[{id:'saved-day',date:'2026-11-04'}]},
release:{calendar:{version:1,sourceRevision:null,appliedRevisions:[]},attendance:{version:1,records:[],closedDays:[],officialSnapshotIds:[],reconciliationIssues:[]}}};
const decoded=()=>({revisionDraftVersion:1,status:'PARTIAL',source:{id:'source',sha256:'c'.repeat(64),fileName:'revised.pdf',role:'ACADEMIC_CALENDAR',section:'Q',coverage:'PARTIAL',pageCount:1,pageRefs:['source#page=1']},pages:[{page:1,sourceId:'source',method:'PDF_TEXT',text:'Holiday 04.11.2026',items:[{text:'Holiday 04.11.2026'}]}],issues:[{code:'PARTIAL_EXTRACTION',message:'Some content may be missing'}],calendarEntries:[{id:'row1',kind:'HOLIDAY',title:'Holiday',startDate:'2026-11-04',endDate:'2026-11-04',evidence:[{sourceId:'source',page:1,rawText:'Holiday 04.11.2026'}]}],review:{scope:null,scopeConfirmed:false,sourceCoverageConfirmed:false,coverageNote:'',effects:[{id:'fx1',sourceRef:'row1',kind:'ADD_HOLIDAY',after:{date:'2026-11-04',label:'Holiday'},confirmed:false,applicabilityConfirmed:false,effectiveDateConfirmed:false}],exclusions:[],missing:[]}});
async function extractCalendarRevision({academicCalendar,section,signal,onProgress}){
 onProgress({stage:'EXTRACTING_TEXT',page:1,pages:1});
 if(window.slowRead)await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true}));
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 return decoded();
}
function reconcileRevisionEffect(draft,effectId,note){
 const e=draft.review.effects.find(x=>x.id===effectId);if(!e)throw Error('Unknown source row');
 e.reconciliation={confirmed:true,note,binding:'MOCK_BINDING'};
}
function prepareCalendarRevision({currentModel,existingSourceRevision,extractedDraft}){
 calls.push(['prepare',{revision:currentModel.revision,hasPrevious:!!existingSourceRevision,scopeConfirmed:extractedDraft.review.scopeConfirmed,coverage:extractedDraft.review.sourceCoverageConfirmed,legacy:extractedDraft.review.legacySourceReviewed,effects:structuredClone(extractedDraft.review.effects)}]);
 const effect=extractedDraft.review.effects[0];
 return {proposal:{proposalVersion:1,proposalId:'proposal:fixture-1',baseModelRevision:currentModel.revision,source:{sha256:'c'.repeat(64),fileName:'revised.pdf',role:'ACADEMIC_CALENDAR',coverage:'PARTIAL',section:'Q',pageRefs:['source#page=1']},scope:structuredClone(extractedDraft.review.scope),changes:[{changeId:'change:fx1',kind:'ADD_HOLIDAY',occurrenceId:null,before:null,after:structuredClone(effect.after),evidence:{sourceId:'source',page:1,excerpt:'Holiday 04.11.2026',basis:'DIRECT_SOURCE'},match:'ADDED',affectsConfirmedHistory:false}],unresolved:[],createdAtUntrusted:null},comparison:[{sourceRef:'row1',changeId:'change:fx1',status:'ADDED',targetId:null}]};
}
const mockCallbacks={onProposeCalendarRevision:async req=>{
 calls.push(['stage',structuredClone(req)]);
 mockState.stagedCalendarRevision=structuredClone(req.proposal);
 return {ok:true,code:'REVIEW_REQUIRED',proposalId:req.proposal.proposalId,modelRevision:7,changeCount:req.proposal.changes.length,issues:[]};},
 onApplyCalendarRevision:async req=>{
 calls.push(['apply',structuredClone(req)]);
 return {ok:false,code:'STORAGE_WRITE_FAILED',modelRevision:7,appliedChangeIds:[],preservedCommitmentIds:[],engineStatus:'PLAN_BLOCKED',issues:[{code:'STORAGE_WRITE_FAILED',message:'Fixture: storage failed; nothing was accepted.'}]};}
};
function redraw(){const host=document.querySelector('#root');host.replaceChildren();renderCalendarRevision(host,mockState,mockCallbacks,redraw);}
window.mockState=mockState;
window.redraw=redraw;
redraw();
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content('<!doctype html><html><head><meta charset="utf-8"/></head><body><header><h1>SEMESTERSPACE · RC-001.4 UI FIXTURE</h1><p>Mock extraction and callbacks. Not institutional data or live persistence.</p></header><main id="root"></main></body></html>')
 page.add_style_tag(content='body{font-family:system-ui;background:#f5f7f5;color:#1e4133;padding:20px}body>header,body>main{margin:auto;max-width:1000px}button{cursor:pointer}')
 page.add_style_tag(content=CSS)
 page.evaluate('''async source=>{const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await import(url);URL.revokeObjectURL(url);}''','const {renderRevisionIntake,isRevisionStageLocallyOutdated}=(()=>{\n'+REV+'\nreturn {renderRevisionIntake,isRevisionStageLocallyOutdated};})();\n'+'const FIXED_CLOCK={date:"2026-11-02",time:"08:00"};\n'+REL+'\n'+STUBS)
 assert not errors,errors
 assert page.locator('[data-release-revision]').count()==1
 assert 'No revised calendar selected' in page.locator('[data-release-revision]').inner_text()
 page.screenshot(path=str(OUT/'RC0014_Upload_Desktop_1440.png'))
 page.locator('[data-revision-intake] input[type=file]').set_input_files({'name':'revised.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7 fixture'})
 assert 'Not read yet' in page.locator('[data-release-revision]').inner_text()
 assert not any(x[0]=='prepare' for x in page.evaluate('calls'))
 page.get_by_role('button',name='Read selected calendar').click()
 page.get_by_text('Reader result: PARTIAL',exact=False).wait_for()
 assert page.get_by_text('Reader result: PARTIAL',exact=False).count()>0
 print('PASS: native file selection, explicit local extraction, partial result and original source warnings')
 page.evaluate("() => document.querySelectorAll('details').forEach(d=>d.open=true)")
 page.get_by_text('1. Scope and applicability',exact=False).scroll_into_view_if_needed()
 page.screenshot(path=str(OUT/'RC0014_EditableReview_Desktop_1440.png'))
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(OUT/'RC0014_EditableReview_Mobile_390.png'))
 assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
 page.set_viewport_size({'width':1440,'height':900})
 # Full review remains blocked; failed attempt retains entered details.
 page.get_by_role('button',name='Prepare comparison').click()
 assert 'Complete the explicit source' in page.locator('[data-release-revision]').inner_text()
 assert not any(x[0]=='prepare' for x in page.evaluate('calls'))
 print('PASS: no silent preparation or source coverage confirmation')
 page.evaluate("() => document.querySelectorAll('details').forEach(d=>d.open=true)")
 # Fill core scope and per-page confirmations. Scoped inputs survive later client rejection.
 page.get_by_label('Academic term').select_option('ODD')
 page.get_by_label('Degree group').select_option('UG')
 page.get_by_label('I checked this notice against my actual course').check()
 page.get_by_label('I manually checked the original calendar').check()
 page.get_by_label('Which prior documents and rows').fill('Manual synthetic original crosswalk review; no old links assumed')
 page.get_by_label('I compared original page 1').check()
 page.get_by_label('I verified this entry is applicable').check()
 page.get_by_label('I checked the meaning and effective date').check()
 page.get_by_label('Include this interpreted effect in the comparison').check()
 page.get_by_label('What did you manually verify').fill('Fixture manually checked the original source page, cohort, legend, events, teaching end and missing rows.')
 page.get_by_label('I checked the source and manually resolved').check()
 page.get_by_label('I explicitly reviewed all interpretations').check()
 page.get_by_role('button',name='Prepare comparison').click()
 assert any(x[0]=='prepare' for x in page.evaluate('calls'))
 assert 'Comparison — not yet staged' in page.locator('[data-release-revision]').inner_text()
 assert 'Proposed addition' in page.locator('[data-release-revision]').inner_text()
 page.screenshot(path=str(OUT/'RC0014_Comparison_Desktop_1440.png'))
 print('PASS: manual scope, page and effect review before pure proposal; comparison displayed')
 page.get_by_label('I have read this comparison').check()
 page.get_by_role('button',name='Stage reviewed proposal').click()
 page.wait_for_function('() => calls.some(x=>x[0]==="stage")')
 page.wait_for_function('() => document.querySelector("[data-release-revision]").textContent.includes("Proposal staged")')
 stage=page.evaluate('calls.find(x=>x[0]==="stage")[1]')
 assert set(stage)=={'expectedModelRevision','proposal'} and stage['expectedModelRevision']==7
 print('PASS: exact RC-001.4 stage request; no automatic model write')
 page.get_by_label('Include this change in the application').check()
 page.get_by_label('I have reviewed source coverage, my cohort').check()
 page.get_by_label('Apply the checked changes only').check()
 page.get_by_role('button',name='Apply selected calendar changes').click()
 page.wait_for_function('() => calls.some(x=>x[0]==="apply")')
 apply=page.evaluate('calls.find(x=>x[0]==="apply")[1]')
 assert apply=={'expectedModelRevision':7,'proposalId':'proposal:fixture-1','acceptedChangeIds':['change:fx1'],'confirmedSourceCoverage':True,'historicalResolutions':[],'confirmation':True},apply
 assert 'Calendar was not updated' in page.locator('[data-release-revision]').inner_text()
 assert page.get_by_label('Include this change in the application').is_checked()
 assert 'Synthetic' not in str(apply)
 assert not errors,errors
 print('PASS: exact apply shape, failed save visibly reported, review selection retained')
 # A staged proposal must not remain actionable when the local review changes.
 page.locator('[data-revision-intake] input[type=file]').set_input_files({'name':'different.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7 different fixture'})
 assert page.get_by_role('button',name='Apply selected calendar changes').is_disabled()
 assert 'older staged proposal cannot be applied' in page.locator('[data-release-revision]').inner_text()
 page.evaluate('window.slowRead=true')
 page.get_by_role('button',name='Read selected calendar').click()
 page.get_by_role('button',name='Cancel extraction').click()
 assert 'Extraction cancelled' in page.locator('[data-release-revision]').inner_text()
 assert page.get_by_role('button',name='Apply selected calendar changes').is_disabled()
 page.get_by_role('button',name='Discard selected review').click()
 assert page.get_by_role('button',name='Apply selected calendar changes').is_disabled()
 print('PASS: locally edited source, cancellation and discard all block earlier stage')
 page.screenshot(path=str(OUT/'RC0014_ReviewRejection_Desktop_1440.png'))
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(OUT/'RC0014_ReviewRejection_Mobile_390.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),page.evaluate('[document.documentElement.scrollWidth,document.documentElement.clientWidth]')
 page.keyboard.press('Tab')
 assert page.evaluate('document.activeElement.tagName') in ('BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','BODY')
 print('PASS: 390px no horizontal overflow, keyboard traversable, desktop/mobile evidence captured')
 browser.close()
