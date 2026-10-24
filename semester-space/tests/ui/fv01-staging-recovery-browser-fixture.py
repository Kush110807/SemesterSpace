"""FV-01 isolated C UI Chromium regression. Mock source importer and staging callback;
not proof of installed PDF extraction, real A persistence, or a native browser reload.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
REV=Path(os.environ.get('SS_FV01_BASELINE_REV',ROOT/'src/ui/revision-review.js')).read_text().replace("import {extractCalendarRevision} from '../import/revision-extract.js';",'').replace("import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';",'').replace('export function renderRevisionIntake','function renderRevisionIntake').replace('export function isRevisionStageLocallyOutdated','function isRevisionStageLocallyOutdated')
REL=(ROOT/'src/ui/release.js').read_text().replace("import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';",'').replace("import {FIXED_CLOCK} from '../shared/fixtures.js';",'').replace('export function ','function ')
fix=(ROOT/'tests/ui/revision-rc0014-browser-fixture.py').read_text(); STUBS=fix.split("STUBS=r'''",1)[1].split("'''",1)[0]
source='const {renderRevisionIntake,isRevisionStageLocallyOutdated}=(()=>{\n'+REV+'\nreturn {renderRevisionIntake,isRevisionStageLocallyOutdated};})();\nconst FIXED_CLOCK={date:"2026-11-02",time:"08:00"};\n'+REL+'\n'+STUBS+'\nwindow.mockCallbacks=mockCallbacks;window.stageOutdated=()=>isRevisionStageLocallyOutdated(mockState);'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><p>FV-01 synthetic Chromium UI fixture, not connected release browser</p><main id="root"></main></body></html>')
 page.evaluate('''async source=>{let url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await import(url);URL.revokeObjectURL(url)}''',source)
 page.evaluate('''() => {window.pendingStages=[];mockCallbacks.onProposeCalendarRevision=(req)=>new Promise(resolve=>{calls.push(['stage',structuredClone(req)]);mockState.stagedCalendarRevision=structuredClone(req.proposal);pendingStages.push({req,resolve});});redraw()}''')
 def review_initial():
  page.locator('[data-revision-intake] input[type=file]').set_input_files({'name':'original.pdf','mimeType':'application/pdf','buffer':b'%PDF fixture'})
  page.get_by_role('button',name='Read selected calendar').click();page.get_by_text('Reader result: PARTIAL',exact=False).wait_for()
  page.evaluate('() => document.querySelectorAll("details").forEach(d=>d.open=true)')
  page.get_by_label('Academic term').select_option('ODD')
  page.get_by_label('Degree group').select_option('UG')
  page.get_by_label('I checked this notice against my actual course').check()
  page.get_by_label('I manually checked the original calendar').check()
  page.get_by_label('Which prior documents and rows').fill('Fixture prior review')
  page.get_by_label('I compared original page 1').check()
  page.get_by_label('I verified this entry is applicable').check()
  page.get_by_label('I checked the meaning and effective date').check()
  page.get_by_label('Include this interpreted effect in the comparison').check()
  page.get_by_label('What did you manually verify').fill('Fixture checked source page and all footnotes.')
  page.get_by_label('I checked the source and manually resolved').check()
  page.get_by_label('I explicitly reviewed all interpretations').check()
  page.get_by_role('button',name='Prepare comparison').click()
  page.get_by_label('I have read this comparison').check()
 def fresh_comparison(note):
  page.evaluate('() => document.querySelectorAll("details").forEach(d=>d.open=true)')
  page.get_by_label('What did you manually verify').fill(note)
  page.get_by_label('I explicitly reviewed all interpretations').check()
  page.get_by_role('button',name='Prepare comparison').click()
  page.get_by_label('I have read this comparison').check()
 def begin_stage():
  b=page.get_by_role('button',name='Stage reviewed proposal')
  assert b.is_enabled(),'Fresh stage stays blocked even after explicit rereview'
  b.click()
 review_initial();begin_stage()
 assert page.evaluate('pendingStages.length')==1
 fresh_comparison('Updated full-page review after earlier staging request.')
 # Regression 1: newly valid reviewed proposal can begin staging while old is pending.
 begin_stage();assert page.evaluate('pendingStages.length')==2
 # Old completion may not release the newer request or authorize the stale result.
 page.evaluate('pendingStages[0].resolve({ok:true,code:"REVIEW_REQUIRED",proposalId:pendingStages[0].req.proposal.proposalId,issues:[],changeCount:1})')
 page.wait_for_timeout(80)
 assert page.evaluate('pendingStages.length')==2, 'Obsolete completion caused an additional stage'
 # The visible button can remain enabled until redraw; the synchronous click guard
 # must reject while the newer operation still owns the stage slot.
 page.get_by_role('button',name='Stage reviewed proposal').click(force=True)
 assert page.evaluate('pendingStages.length')==2,'Older completion released newer operation ownership'
 assert page.evaluate('stageOutdated()'),'Old stage wrongly authorized'
 page.evaluate('pendingStages[1].resolve({ok:true,code:"REVIEW_REQUIRED",proposalId:pendingStages[1].req.proposal.proposalId,issues:[],changeCount:1})')
 page.wait_for_function('() => !stageOutdated()')
 print('PASS: previous staging completion does not authorize stale data or clear newer request')
 # Regression 2: stale completed stage allows fresh review without document reread.
 fresh_comparison('Third reviewed note, no document reload')
 begin_stage();assert page.evaluate('pendingStages.length')==3
 fresh_comparison('Fourth reviewed note, no document reload')
 page.evaluate('pendingStages[2].resolve({ok:true,code:"REVIEW_REQUIRED",proposalId:pendingStages[2].req.proposal.proposalId,issues:[],changeCount:1})')
 page.wait_for_timeout(80)
 assert page.get_by_role('button',name='Stage reviewed proposal').is_enabled(),'FV-01: obsolete request retained busy guard'
 assert page.evaluate('stageOutdated()')
 print('PASS: stale completed response permits new comparison to stage without rereading source')
 # Regression 3: replacement revokes pending request while preserving new source path.
 begin_stage();assert page.evaluate('pendingStages.length')==4
 page.locator('[data-revision-intake] input[type=file]').set_input_files({'name':'replacement.pdf','mimeType':'application/pdf','buffer':b'%PDF replacement'})
 page.evaluate('pendingStages[3].resolve({ok:true,code:"REVIEW_REQUIRED",proposalId:pendingStages[3].req.proposal.proposalId,issues:[],changeCount:1})')
 page.wait_for_timeout(80)
 assert page.evaluate('stageOutdated()')
 assert 'replacement.pdf' in page.locator('[data-revision-intake]').inner_text()
 assert page.get_by_role('button',name='Read selected calendar').is_enabled()
 print('PASS: superseded document never regains apply authority')
 assert not errors,errors
 browser.close()
