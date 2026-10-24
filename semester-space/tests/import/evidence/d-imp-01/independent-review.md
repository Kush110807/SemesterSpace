# SemesterSpace document-import milestone — Independent D review

**Verdict: CHANGES REQUIRED** — 24 October 2026. One reproducible high-severity import-layer validation defect. No production files modified, merged, or deployed.

## Exact reviewed source

- User-supplied archive: `SemesterSpace-D-review-source(1).zip`
- Reviewed archive SHA-256 (computed here): `e78c6b36eba6ce9cca71646232d9d125f353ea854d3a31e5e97152ccf3c7e10d`
- `SOURCE_PACKAGE_MANIFEST.json`: repository `Kush110807/SemesterSpace`, branch `feature/document-import`; investigation base `feb40999bdc59fc7ef41eb55e24665a690985fa6`; tested feature `044252287a3bebb7c2199076f52c531b5c2c90bb`; repository intake `985ae01a7edf0f27dbc96a1c3abb8bef1a6a7a3c`.
- The archive contains no `.git` or external `D_REVIEW_PACKAGE.json` / ZIP `.sha256` sidecar. Those Git provenance assertions and external-package SHA therefore could not be independently authenticated here. They are metadata assertions, not demonstrated by the file-level checksum alone.
- `sha256sum -c PACKAGE_INTEGRITY.sha256`: **113 of 113 files verified, 0 mismatches**. The two older starter manifests are explicitly historical and were not used as current checksums.
- Required reading: `D_REVIEW_PACKAGE.md`, `SOURCE_PACKAGE_MANIFEST.json`, `semester-space/docs/CALENDAR_COVERAGE_REVIEW.md`, `semester-space/README.md` plus source, test and evidence files.

## Blocking finding D-IMP-01 (High): represented coverage link has no in-horizon planner effect

**Locations:** `semester-space/src/import/coverage.js:67–71`, `:83–88`; `semester-space/src/import/compile.js:101–107`.

`validateCalendarCoverage()` allows a source obligation to be declared `REPRESENTED` by *any* reviewed, applicable compulsory calendar entry on the same source page with valid date syntax. It does not require that the target's effective date overlaps the teaching scope or that it actually generates the claimed planner effect. The page-level `ENTERED` link check similarly allows out-of-horizon rows.

**Fresh adversarial reproduction (executed here, not part of the package tests):**

1. Start with the package's synthetic fixture, replacing its calendar page with two separate source text/items: `Mandatory exam 26.10.2026` and `Mandatory exam 27.10.2026`. Parse them with the production `parseCalendar()`. The baseline fully reviewed fixture compiles **two** compulsory events.
2. Keep both candidates and their original source-page provenance. Change the 26 October candidate to reviewed `INFORMATION_ONLY`; explicitly set its `coverageResolution` to `REPRESENTED`, linking the second candidate on the same page.
3. Edit the second candidate's confirmed date to `2027-01-10`, outside the valid teaching horizon `2026-10-24` through `2026-11-09`. Leave it reviewed, applicable and compulsory. Update its resolution to link itself. Supply an `ENTERED` obligations coverage record referencing that second candidate and reconfirm the page using the production `recordPageCoverage()`.
4. Call production `validateCalendarCoverage()`, `compileConfirmedImport()`, `expandSchedule()`, and `evaluatePlan()` for a 26 October proposed absence.

**Actual output:**

```json
{
  "sourceExams": ["2026-10-26", "2026-10-27"],
  "teachingHorizon": ["2026-10-24", "2026-11-09"],
  "baselineCompiledEvents": ["2026-10-26", "2026-10-27"],
  "coverageErrors": [],
  "importAccepted": true,
  "compiledEvents": [],
  "oct26PlanStatus": "MEETS_PLANNING_RULES",
  "oct26Blockers": null
}
```

The parser detected both source exams, yet a completely validated and manually confirmed *representation link* results in no compulsory event. This is stronger than a false human claim that an undetected source item is irrelevant: the validator has the known source candidate and can see the target produces no in-scope effect. The existing attendance engine cannot block an event omitted by the compiler.

**Reproduce:** Download `SS_D_IMPORT_LINK_REPRO.mjs`. From the extracted `semester-space/` application directory, run `node /path/to/SS_D_IMPORT_LINK_REPRO.mjs`. It imports the package's actual modules and test fixture via the working directory, checks the baseline, confirms the bypass, and prints the above JSON. No PDF/OCR dependency or file edit is needed.

**Minimum correction for import owner / A:** For `REPRESENTED` links, reject a link that produces no effect in the relevant scope and horizon. Apply the equivalent guarantee to `ENTERED` page-area links. Preserve valid corrected-date mapping, but demand source-specific explicit reconciliation when the target does not naturally correspond to the source candidate. A true exclusion belongs under the existing justified `NO_APPLICABLE_EFFECT` path, not `REPRESENTED`. Add regression tests for an exam, a nonteaching date and a substitution linked only to a non-effective/out-of-scope row; verify public engine behavior. No shared schema/contract/engine change is needed from this finding.

## Independently executed checks

Executed in isolated extraction on Linux, Node **22.16.0**, npm **10.9.2**, Python **3.13.5**.

| Check | Actual result |
| --- | --- |
| `sha256sum -c PACKAGE_INTEGRITY.sha256` | PASS — 113/113 payload files |
| `npm ci` | **UNABLE TO COMPLETE** — registry DNS error `EAI_AGAIN` (clean install timed out; `npm ping` independently reproduced DNS failure) |
| `npm run check` | PASS — **37** JavaScript files. The claimed **47** includes regenerated vendor assets absent here. |
| `npm test` | **89 passed, 1 test module failed to load** (`tests/import/draft.test.mjs` due missing `pdfjs-dist`); 0 skips/TODOs. Not a product test failure; clean dependency installation could not be completed. |
| `node --test tests/engine/*.test.mjs` | PASS — **26/26** |
| `python3 tests/checker.py` | PASS — **342** exact-arithmetic cases |
| `node --test tests/import/coverage.test.mjs` | PASS — **19/19** existing coverage assertions |
| `node tests/import/reproduce-coverage.mjs --run` | Executed — existing omission cases blocked as expected; synthetic fixture-based checks |
| Independent adversarial event-loss script | **REPRODUCED D-IMP-01** — validator returns no errors, compiler accepts, 0 compiled compulsory events, engine permits the exam-day absence |
| `npm run build` | **UNABLE TO COMPLETE** — generated PDF asset dependency `node_modules/pdfjs-dist/build/pdf.min.mjs` missing |
| `npm run test:import-browser` | **UNRUN** — cannot load missing Playwright package |
| `npm run test:import-corpus` | **UNRUN** — cannot load missing Playwright package |
| `npm start` and HTTP smoke | Dev server starts; `/` HTTP 200. Missing PDF vendor asset returns HTTP 404. This is a local-install limitation, not a successful document upload test. |

## Source extraction vs annotated references

- I independently read the supplied text-native Section Q timetable PDF page 2 using `pdftotext -layout` and checked its visible labels. The supplied source includes 18 theory periods, four merged lab areas, Q12/Q23 alternatives and a Physics lab labelled Q1/Q2 only. **Q3 Physics remains unresolved**. This is independent source observation, not a rerun of PDF.js geometry extraction.
- `src/import/parse.js`, `read.js`, and `index.js` perform runtime source extraction/geometry/OCR and do not import the annotated expected-results JSON. The corpus test reads annotated references for **comparison** outside production. No evidence of an embedded answer key in the runtime path was found.
- The included `tests/import/evidence/coverage-review/corpus-report.json` documents **archived prior-run results only**: MAIT calendar 120 candidates, 73 dated, three listed unmatched reference cases (first-year orientation, first sessional window, winter vacation); IIT(BHU) 48 candidates with five unmatched references; colour grid 5 candidates with 16 unmatched; cohort grid 6 with eight unmatched; dual-term grid 57 with nine unmatched. These are not independently rerun here and are not an extraction accuracy statistic.
- README and UI source explicitly retain incomplete-extraction, undetected-omission, source scope, unsupported grid/Hindi, and manual declaration limitations. Confirmed page viewing is not treated as completed meaning; synthetic coverage tests confirm multiple related rejection paths. A deliberate but wrong human `NO_APPLICABLE_EFFECT` claim cannot be fully machine-verified; **D-IMP-01 is distinct** because `REPRESENTED` asserts a real link whose effect can be checked mechanically.
- The reference corpus is development-visible, not held-out institutional validation. The archive does not establish real student counts/attendance policy, latest MAIT notices or Section Q3 Physics assignment.

## Preservation and browser limitations

- The existing engine/controller/storage paths are still separate from the new import compiler and source. Core engine tests (26) and independent arithmetic checker (342) pass. The importer builds schema-1 models with placeholder `confirmedAt`, empty initial commitments, independent registers and a manual-coverage source label; controller remains authoritative for final snapshot time, atomic acceptance and local persistence.
- The included prior-run browser report claims real served upload -> manual review -> setup -> suggestions -> subset commitment -> count invalidation -> native reload, plus 390-px width, keyboard and demo isolation. I inspected its runner and report but **could not independently reproduce this flow**, because `npm ci` cannot resolve registry packages in this environment. No independent claim of native reload or OCR/browser equivalence is made.
- **UNRUN**: actual browser upload/OCR, real native reload, live installed build, physical-device/touch/screen-reader tests, storage-denial settings, deployed-origin verification, Windows performance, malformed/encrypted-document breadth, malicious whole-draft tampering, and institutional applicability.

## Handoff and disposition

**CHANGES REQUIRED**, narrowly scoped to the importer coverage-link validation. No merger/deployment authorization. A should assign the importer owner a targeted fix and a new regression, review that isolated diff, and rerun full install/tests/browser/corpus on a machine with the pinned dependencies available. B need not change the attendance engine for this defect. C should ensure the manual link UI makes genuine source-to-effect correspondence and out-of-scope targets clear if the corrected contract requires it. Retain the SS-INT-002 fallback, keep Q3 Physics unresolved, and do not promote synthetic browser choices to personal confirmations.
