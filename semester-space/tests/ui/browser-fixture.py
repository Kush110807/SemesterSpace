"""Browser fixture only: does NOT test unavailable A/B/Codex release integrations."""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parents[2]
SRC=(HERE/'src/ui/release.js').read_text()

# Inline only the C revision renderer for legacy isolated Blob-module tests.
# Real extraction/comparison are covered separately; these are fixture stubs.
revision_source=(HERE if "HERE" in globals() else ROOT)/'src/ui/revision-review.js'
revision_code=revision_source.read_text().replace("import {extractCalendarRevision} from '../import/revision-extract.js';",'').replace("import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';",'').replace('export function renderRevisionIntake','function renderRevisionIntake').replace('export function isRevisionStageLocallyOutdated','function isRevisionStageLocallyOutdated')
review_stub="const extractCalendarRevision=async()=>{throw Error('SYNTHETIC_FIXTURE_READER')};const prepareCalendarRevision=()=>{throw Error('SYNTHETIC_FIXTURE_COMPARE')};const reconcileRevisionEffect=()=>{throw Error('SYNTHETIC_FIXTURE_RECONCILE')};"

CSS=(HERE/'src/ui/styles.css').read_text()
SRC="const {renderRevisionIntake,isRevisionStageLocallyOutdated}=(()=>{\n"+review_stub+"\n"+revision_code+"\nreturn {renderRevisionIntake,isRevisionStageLocallyOutdated};})();\n"+'const FIXED_CLOCK={date:"2026-11-02",time:"08:00"};\n'+SRC.replace("import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';",'').replace("import {FIXED_CLOCK} from '../shared/fixtures.js';",'')
OUTPUT=HERE/'tests/ui/evidence'
OUTPUT.mkdir(parents=True,exist_ok=True)
DESKTOP=str(OUTPUT/'RC001_DEV_FIXTURE_Desktop_1440.png')
MOBILE=str(OUTPUT/'RC001_DEV_FIXTURE_Mobile_390.png')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    page.set_content('<!doctype html><meta charset="utf-8"><main><h1>SEMESTERSPACE / SYNTHETIC DEVELOPMENT FIXTURE</h1><p>Not a connected live attendance or calendar integration.</p><div id="root"></div></main>')
    page.add_style_tag(content='body{font-family:system-ui;background:#f3f6f5;margin:20px;color:#183f37}main{max-width:1020px;margin:auto}button{cursor:pointer}h1{font-size:1.5rem}')
    page.add_style_tag(content=CSS)
    page.evaluate("""async src=>{const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));window.releaseUI=await import(url);URL.revokeObjectURL(url);}""",SRC)
    page.evaluate("""() => {
      const m={id:'synthetic-model',revision:7,registers:[{id:'lecture',name:'Lecture',courseId:'course-1'},{id:'lab',name:'Lab',courseId:'course-1'}],courses:[{id:'course-1',name:'Fixture subject'}],sessions:[
        {id:'weekly:w1:2026-10-20',registerId:'lecture',date:'2026-10-20',start:'09:00',end:'10:00',weight:1,protected:false,cancelled:false},
        {id:'extra:lab-1',registerId:'lab',date:'2026-10-20',start:'11:00',end:'13:00',weight:2,protected:true,cancelled:false}
      ],snapshots:[{id:'s1',date:'2026-10-19'}],commitments:[]};
      window.mockState={model:m,mode:'personal',selectedDate:'2026-10-20',release:{attendance:{version:1,records:[],closedDays:[],officialSnapshotIds:['s1'],reconciliationIssues:[]},calendar:{version:1,sourceRevision:null,appliedRevisions:[]}}};
      window.mockResults={runtime:'READY',evaluation:{dates:[]}};
      window.calls=[];
      window.mockCallbacks={
        onConfirmAttendanceDay:req=>{calls.push(['confirm',req]);return {ok:false,code:'STALE_REVISION',modelRevision:7,dayKey:null,snapshotId:null,registerTotals:null,engineStatus:'ATTENDANCE_UPDATE_NEEDED',issues:[{code:'STALE_REVISION',message:'The model changed; refresh before confirming.'}]};},
        onProposeCalendarRevision:req=>{calls.push(['propose',req]);return {ok:true,code:'PROPOSAL_STAGED'};},
        onApplyCalendarRevision:req=>{calls.push(['apply',req]);return {ok:true,code:'REVISION_APPLIED',modelRevision:8,appliedChangeIds:req.acceptedChangeIds,preservedCommitmentIds:[],engineStatus:'PLAN_BLOCKED',issues:[]};}
      };
      window.redraw=()=>{const root=document.querySelector('#root');root.replaceChildren();releaseUI.renderReleaseFreshness(root,mockState);releaseUI.renderAttendanceReview(root,mockState,mockCallbacks,redraw);releaseUI.renderCalendarRevision(root,mockState,mockCallbacks,redraw);releaseUI.renderRevisionConsequences(root,mockState,mockResults);};
      redraw();
    }""")
    assert page.locator('[data-release-attendance]').count()==1
    assert page.locator('[data-release-revision]').count()==1
    assert page.get_by_text('Daily record integration unavailable').count()==0
    page.get_by_role('button',name='Confirm completed attendance day').click()
    assert '2 scheduled meeting(s) unresolved' in page.locator('[data-release-attendance]').inner_text()
    page.locator('[data-release-attendance] select').nth(0).select_option('ATTENDED')
    page.locator('[data-release-attendance] select').nth(1).select_option('NOT_HELD')
    page.locator('[data-release-attendance] input[type=checkbox]').nth(0).check()
    page.locator('[data-release-attendance] input[type=checkbox]').nth(1).check()
    page.get_by_role('button',name='Confirm completed attendance day').click()
    page.wait_for_function("() => document.querySelector('[data-release-attendance]').textContent.includes('STALE_REVISION')")
    calls=page.evaluate('calls')
    assert len(calls)==1 and calls[0][1]['expectedModelRevision']==7 and calls[0][1]['marks'][1]['disposition']=='NOT_HELD'
    assert set(calls[0][1].keys())=={'expectedModelRevision','date','marks','confirmCompleteDay','confirmNoUnlistedMeetings','dayKey'}
    assert page.locator('[data-release-attendance] select').nth(0).input_value()=='ATTENDED', 'rejected mark should persist'
    assert page.locator('[data-release-attendance] select').nth(1).input_value()=='NOT_HELD', 'rejected mark should persist'
    assert 'Attendance was not saved' in page.locator('[data-release-attendance]').inner_text()
    print('PASS: unresolved blocks; failed callback visible; exact attendance request; NOT_HELD sent without totals')

    # Correction fixture is a synthetic controller projection of a closed day.
    page.evaluate("""() => {
      mockState.release.attendance.records=[
       {recordId:'r1',occurrenceId:'weekly:w1:2026-10-20',registerId:'lecture',disposition:'ATTENDED',note:'',dayKey:'old-day'},
       {recordId:'r2',occurrenceId:'extra:lab-1',registerId:'lab',disposition:'MISSED',note:'',dayKey:'old-day'}];
      mockState.release.attendance.closedDays=[{date:'2026-10-20',dayKey:'old-day',recordIds:['r1','r2'],supersedesDayKey:null}];
      mockState.model.revision=8;
      redraw();
    }""")
    assert page.get_by_role('button',name='Submit attendance correction').is_disabled()
    page.get_by_label('I want to correct this previously closed day').check()
    assert page.get_by_role('button',name='Submit attendance correction').is_enabled()
    page.get_by_label('Every listed session has ended').check()
    page.get_by_label('No additional attendance meetings took place').check()
    page.get_by_label('Keep the original record and save this as a correction').check()
    page.get_by_role('button',name='Submit attendance correction').click()
    page.wait_for_function('() => calls.length===2')
    assert page.evaluate('calls[1][1].correctionOfDayKey')=='old-day'
    assert page.evaluate('calls[1][1].dayKey')!='old-day'
    print('PASS: existing closure read; correction intent required; new dayKey; explicit old close reference')

    page.evaluate("""() => {
      mockState.stagedCalendarRevision={proposalVersion:1,proposalId:'fixture:revision-a',baseModelRevision:8,
       source:{sha256:'fakehash',fileName:'example-revision.pdf',role:'ACADEMIC_CALENDAR',coverage:'PARTIAL',section:'Q',pageRefs:['p2']},
       scope:{start:'2026-10-20',end:'2026-12-01',section:'Q',subgroup:'Q3',programmingGroup:'Q23'},
       changes:[{changeId:'c1',kind:'CANCEL_SESSION',occurrenceId:'extra:lab-1',before:{date:'2026-10-20'},after:{cancelled:true},evidence:{sourceId:'file1',page:2,excerpt:'Not detected'},match:'AMBIGUOUS',affectsConfirmedHistory:true}],
       unresolved:[{code:'COVERAGE_GAP',sourceRef:'p2',message:'Source page uncertain; no cancellation can be inferred.'}],createdAtUntrusted:null};
      redraw();
    }""")
    # File selection is local only and must stay in the native input (no redraw or fabricated upload).
    page.locator('[data-release-revision] input[type=file]').set_input_files({'name':'fixture-source.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7 synthetic fixture'})
    assert 'Selected: fixture-source.pdf' in page.locator('[data-release-revision]').inner_text()
    assert 'Not read yet' in page.locator('[data-release-revision]').inner_text()
    assert page.get_by_role('button',name='Apply selected calendar changes').is_disabled()
    assert 'Missing extracted sessions are not cancellations' in page.locator('[data-release-revision]').inner_text()
    print('PASS: ambiguous/partial calendar revision blocked; missing row not treated as cancellation')
    page.evaluate("""() => {
      mockState.stagedCalendarRevision={...mockState.stagedCalendarRevision,proposalId:'fixture:revision-b',source:{...mockState.stagedCalendarRevision.source,coverage:'COMPLETE'},
       changes:[{changeId:'c2',kind:'ADD_HOLIDAY',occurrenceId:null,before:null,after:{date:'2026-11-06',label:'Synthetic holiday'},evidence:{sourceId:'file1',page:1,excerpt:'Synthetic source states holiday',basis:'DIRECT_SOURCE'},match:'ADDED',affectsConfirmedHistory:false}],unresolved:[]};
      mockResults.evaluation.dates=[{date:'2026-10-21',markers:['INVALID_COMMITMENT'],messages:['A committed absence now conflicts with an obligatory meeting.']}];
      mockState.model.commitments=[{date:'2026-10-21',id:'c10'}];redraw();
    }""")
    assert 'Saved breaks need another look' in page.locator('#root').inner_text()
    page.get_by_label('Include this change in the application').check()
    page.get_by_label('I have reviewed source coverage').check()
    page.get_by_label('Apply the checked changes only').check()
    assert page.get_by_role('button',name='Apply selected calendar changes').is_disabled()
    assert not any(row[0]=='apply' for row in page.evaluate('calls'))
    print('PASS: controller-staged proposal without matching local source review cannot be applied; retained break conflict shown')
    page.locator('[data-release-attendance]').screenshot(path=str(OUTPUT/'RC001_Attendance_Desktop_1440.png'))
    page.locator('[data-release-revision]').screenshot(path=str(OUTPUT/'RC001_Revision_Desktop_1440.png'))
    page.screenshot(path=DESKTOP,full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-release-attendance]').screenshot(path=str(OUTPUT/'RC001_Attendance_Mobile_390.png'))
    page.locator('[data-release-revision]').screenshot(path=str(OUTPUT/'RC001_Revision_Mobile_390.png'))
    page.screenshot(path=MOBILE,full_page=True)
    width=page.evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})')
    assert width['scroll']<=width['client']+1, width
    # Depending on the prior screenshot/autofocus, a Tab may cycle via BODY.
    # Confirm keyboard traversal actually reaches at least one native control.
    focus=None
    for _ in range(8):
      page.keyboard.press('Tab')
      focus=page.evaluate('document.activeElement?.tagName')
      if focus in ['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY']:break
    assert focus in ['BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY'],focus
    print('PASS: 390px no page overflow; keyboard Tab reaches native control; desktop/mobile fixture screenshots')
    browser.close()
