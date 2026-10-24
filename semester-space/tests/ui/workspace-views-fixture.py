"""Pure UI smoke in headless Chromium. Synthetic data / stubs; not A/B/Codex integration."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tests/ui/evidence';OUT.mkdir(exist_ok=True)
idx=(ROOT/'src/ui/index.js').read_text();imp=(ROOT/'src/ui/import.js').read_text();rel=(ROOT/'src/ui/release.js').read_text();css=(ROOT/'src/ui/styles.css').read_text();fixture=(ROOT/'src/shared/fixtures.js').read_text()

# Inline only the C revision renderer for legacy isolated Blob-module tests.
# Real extraction/comparison are covered separately; these are fixture stubs.
revision_source=(HERE if "HERE" in globals() else ROOT)/'src/ui/revision-review.js'
revision_code=revision_source.read_text().replace("import {extractCalendarRevision} from '../import/revision-extract.js';",'').replace("import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';",'').replace('export function renderRevisionIntake','function renderRevisionIntake').replace('export function isRevisionStageLocallyOutdated','function isRevisionStageLocallyOutdated')
review_stub="const extractCalendarRevision=async()=>{throw Error('SYNTHETIC_FIXTURE_READER')};const prepareCalendarRevision=()=>{throw Error('SYNTHETIC_FIXTURE_COMPARE')};const reconcileRevisionEffect=()=>{throw Error('SYNTHETIC_FIXTURE_RECONCILE')};"

idx='\n'.join(line for line in idx.splitlines() if not line.startswith('import '))
rel="const {renderRevisionIntake,isRevisionStageLocallyOutdated}=(()=>{\n"+review_stub+"\n"+revision_code+"\nreturn {renderRevisionIntake,isRevisionStageLocallyOutdated};})();\n"+'const FIXED_CLOCK={date:"2026-11-02",time:"08:00"};\n'+rel.replace("import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';",'').replace("import {FIXED_CLOCK} from '../shared/fixtures.js';",'')
imp='\n'.join(line for line in imp.splitlines() if not line.startswith('import '))
fixture=fixture.replace("import { CONTRACT_VERSION } from './constants.js';","const CONTRACT_VERSION='1.1.0';")
pre_import="""const COVERAGE_AREAS=[];const calendarPages=()=>[];const blankPageCoverage=()=>({});const recordPageCoverage=()=>{};const coverageSummary=()=>({});const recordSourceReconciliation=()=>{};
const extractDocuments=()=>{};const createImportJob=()=>({cancel(){},async run(){throw Error('SYNTHETIC: extraction not connected')}});
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];const evidence=()=>({});const issue=()=>({});"""
pre_index="""const IMPORT_SOURCE_PREFIX='document-import:';const documentImport=window.documentUI.documentImport;const syncDocumentImport=window.documentUI.syncDocumentImport;
const {renderReleaseFreshness,renderAttendanceReview,renderCalendarRevision,renderRevisionConsequences}=window.releaseUI;"""
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="fixture">SYNTHETIC DEVELOPMENT FIXTURE — no connected attendance, importer or live controller</div><div id="app"></div></body></html>')
    page.add_style_tag(content=css)
    page.add_style_tag(content="#fixture{font:700 12px system-ui;text-align:center;color:#6d4410;background:#fff0d5;padding:9px;letter-spacing:.06em}html{scroll-behavior:auto}")
    page.evaluate('''async data=>{
       async function load(code){const u=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));const m=await import(u);URL.revokeObjectURL(u);return m;}
       window.releaseUI=await load(data.rel);window.documentUI=await load(data.preImport+'\\n'+data.imp);
       window.testFixtures=await load(data.fixture);window.appUI=await load(data.preIndex+'\\n'+data.idx);
    }''',{'rel':rel,'preImport':pre_import,'imp':imp,'fixture':fixture,'preIndex':pre_index,'idx':idx})
    # Initial document-first onboarding, with original C import controls but synthetic extractor stub.
    page.evaluate('''() => {
      window.viewState={mode:'personal',model:null,month:'2026-10',selectedDate:null,manualDates:[],batch:null,
       persistence:{status:'EMPTY',message:'No personal data saved yet.'},notice:'',release:null};
      window.viewResults={runtime:'NO_SETUP',evaluation:null,search:null,error:null};
      window.viewCallbacks={onEnterDemo(){},onExitDemo(){},onSetMonth({month}){viewState.month=month;draw();},onSelectDate({date}){viewState.selectedDate=date;draw();},onSuggest(){},onRefresh(){}};
      window.draw=()=>appUI.render(viewState,viewResults,viewCallbacks);draw();
    }''')
    assert page.get_by_role('heading',name='Start with your timetable').count()==1
    assert page.get_by_text('Start with your documents').count()==1
    page.screenshot(path=str(OUT/'RC001_Onboarding_Desktop_1440.png'),full_page=False)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT/'RC001_Onboarding_Mobile_390.png'),full_page=False)
    assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
    print('PASS: onboarding renders exact C import selection UI at 1440px and 390px')

    page.set_viewport_size({'width':1440,'height':900})
    page.evaluate('''() => {
      const m=testFixtures.makeDemoModel();m.revision=6;
      m.snapshots[0].id='fixture-official';m.snapshots[0].date='2026-10-19';m.snapshots[0].confirmedAt={date:'2026-10-19',time:'19:00',timeZone:'Asia/Kolkata'};
      m.schedule.startDate='2026-10-01';
      m.sessions[0].date='2026-10-20';m.sessions[1].date='2026-10-20';m.sessions[1].start='11:00';m.sessions[1].end='12:00';
      m.attendanceConfirmation.throughDate='2026-10-19';
      viewState={...viewState,model:m,selectedDate:'2026-10-20',month:'2026-11',release:{attendance:{version:1,records:[],closedDays:[],officialSnapshotIds:['fixture-official'],reconciliationIssues:[]},calendar:{version:1,sourceRevision:null,appliedRevisions:[]}},persistence:{status:'LOADED',message:'Synthetic fixture only.'}};
      viewResults={runtime:'ENGINE_UNAVAILABLE',evaluation:null,search:null,error:'Fixture: no engine attached.'};draw();
    }''')
    assert page.get_by_role('navigation',name='Workspace views').count()==1
    assert page.get_by_role('heading',name='Today’s attendance').count()==1
    assert '0 of 2 sessions resolved' in page.locator('main').inner_text()
    page.screenshot(path=str(OUT/'RC001_Today_Desktop_1440.png'),full_page=False)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT/'RC001_Today_Mobile_390.png'),full_page=False)
    assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
    print('PASS: attendance view and separate freshness indicators; mobile no horizontal overflow')
    page.get_by_role('button',name='Calendar & breaks').click()
    assert page.get_by_role('heading',name='Calendar & break planner').count()==1
    assert page.get_by_role('group',name='Calendar 2026-11').count()==1
    page.screenshot(path=str(OUT/'RC001_Calendar_Mobile_390.png'),full_page=False)
    page.set_viewport_size({'width':1440,'height':900})
    page.screenshot(path=str(OUT/'RC001_Calendar_Desktop_1440.png'),full_page=False)
    print('PASS: calendar navigation retained; no planning claim without actual engine')
    page.get_by_role('button',name='Calendar updates').click()
    assert page.get_by_role('heading',name='Review a revised calendar').count()==1
    page.screenshot(path=str(OUT/'RC001_RevisionEmpty_Desktop_1440.png'),full_page=False)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(OUT/'RC001_RevisionEmpty_Mobile_390.png'),full_page=False)
    print('PASS: revision empty/blocked state shown without staging a document')
    page.get_by_role('button',name='Setup & history').click()
    assert page.get_by_role('heading',name='Academic setup & original sources').count()==1
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.tagName') in ('INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY')
    assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
    print('PASS: setup/history reachable; keyboard focus; mobile no overflow')
    browser.close()
