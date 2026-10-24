"""C-only legacy-source handoff test in inline Chromium.
The importer/controller are test doubles. NOT connected release verification.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
REV = (ROOT/'src/ui/revision-review.js').read_text().replace("import {extractCalendarRevision} from '../import/revision-extract.js';",'').replace("import {prepareCalendarRevision,reconcileRevisionEffect} from '../import/revision.js';",'').replace('export function renderRevisionIntake','function renderRevisionIntake').replace('export function isRevisionStageLocallyOutdated','function isRevisionStageLocallyOutdated')
REL = (ROOT/'src/ui/release.js').read_text().replace("import {renderRevisionIntake,isRevisionStageLocallyOutdated} from './revision-review.js';",'').replace("import {FIXED_CLOCK} from '../shared/fixtures.js';",'').replace('export function ','function ')
fixture = (ROOT/'tests/ui/revision-rc0014-browser-fixture.py').read_text()
stubs = fixture.split("STUBS=r'''",1)[1].split("'''",1)[0]
stubs = stubs.replace("hasPrevious:!!existingSourceRevision,", "previousSource:structuredClone(existingSourceRevision),hasPrevious:!!existingSourceRevision,")
source = 'const {renderRevisionIntake,isRevisionStageLocallyOutdated}=(()=>{\n'+REV+'\nreturn {renderRevisionIntake,isRevisionStageLocallyOutdated};})();\nconst FIXED_CLOCK={date:"2026-11-02",time:"08:00"};\n'+REL+'\n'+stubs
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':900})
  errors=[];page.on('pageerror',lambda error: errors.append(str(error)))
  page.set_content('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div>DEVELOPMENT FIXTURE — no connected importer/persistence</div><main id="root"></main></body></html>')
  page.add_style_tag(content=(ROOT/'src/ui/styles.css').read_text())
  page.evaluate('''async source=>{let url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await import(url);URL.revokeObjectURL(url)}''',source)
  legacy={'sha256':'a'*64, 'fileName':'previous-approved.pdf'}
  page.evaluate('(legacy)=>{mockState.release.calendar.sourceRevision=legacy;redraw()}',legacy)
  page.locator('[data-revision-intake] input[type=file]').set_input_files({'name':'new-calendar.pdf','mimeType':'application/pdf','buffer':b'%PDF mock'})
  page.get_by_role('button',name='Read selected calendar').click()
  page.get_by_text('Reader result: PARTIAL',exact=False).wait_for()
  page.evaluate('() => document.querySelectorAll("details").forEach(d=>d.open=true)')
  page.get_by_label('Academic term').select_option('ODD')
  page.get_by_label('Degree group').select_option('UG')
  page.get_by_label('I checked this notice against my actual course').check()
  page.get_by_label('I compared original page 1').check()
  page.get_by_label('I verified this entry is applicable').check()
  page.get_by_label('I checked the meaning and effective date').check()
  page.get_by_label('Include this interpreted effect in the comparison').check()
  page.get_by_label('What did you manually verify').fill('Fixture checked page, footnotes and missing rows; no cancellations assumed.')
  page.get_by_label('I checked the source and manually resolved').check()
  page.get_by_label('I explicitly reviewed all interpretations').check()
  page.get_by_role('button',name='Prepare comparison').click()
  assert page.evaluate('calls.filter(v=>v[0]==="prepare").length')==0, 'comparison invoked without explicit legacy review'
  print('PASS legacy metadata cannot be compared before explicit prior-source review')
  page.evaluate('() => document.querySelectorAll("details").forEach(d=>d.open=true)')
  page.get_by_label('I manually checked the original calendar').check()
  page.get_by_label('Which prior documents and rows').fill('I examined previous-approved.pdf and checked all relevant source rows against the updated notice.')
  page.get_by_label('I explicitly reviewed all interpretations').check()
  page.get_by_role('button',name='Prepare comparison').click()
  preparations=page.evaluate('calls.filter(v=>v[0]==="prepare").map(v=>v[1])')
  if not preparations:
    print('DEBUG INPUTS',page.evaluate('''() => Array.from(document.querySelectorAll("[data-revision-intake] input[type=checkbox]")).map(e=>[e.parentElement.textContent,e.checked])'''))
    print('DEBUG', page.locator('[data-release-revision]').inner_text()[-2500:])
  assert len(preparations)==1 and preparations[0]['previousSource']==legacy,preparations
  assert preparations[0]['legacy'] is True and preparations[0]['scopeConfirmed'] is True and preparations[0]['coverage'] is True
  assert page.evaluate('mockState.release.calendar.sourceRevision')==legacy
  print('PASS original legacy {sha256,fileName} reaches preparation unchanged after consent')
  assert 'Comparison — not yet staged' in page.locator('[data-release-revision]').inner_text()
  assert page.evaluate('calls.filter(v=>v[0]==="stage").length')==0
  page.get_by_label('I have read this comparison').check()
  page.get_by_role('button',name='Stage reviewed proposal').click()
  page.wait_for_function('calls.some(v=>v[0]==="stage")')
  assert page.evaluate('calls.find(v=>v[0]==="stage")[1].expectedModelRevision')==7
  assert page.evaluate('calls.filter(v=>v[0]==="apply").length')==0
  print('PASS compared legacy source stages using exact existing callback; no automatic application')
  assert not errors,errors
  browser.close()
