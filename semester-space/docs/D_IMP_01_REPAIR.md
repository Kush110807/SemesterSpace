# D-IMP-01 importer link repair — independent review handoff

24 October 2026 IST. Branch `feature/document-import`. Exact repair base: `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`. The root `SOURCE_PACKAGE_MANIFEST.json` records the exact tested repair commit; external `D_REVIEW_PACKAGE.json` records the exact packaged descendant and ZIP checksum. SS-INT-002 remains the fallback. No merge or deployment. Additional spend: ₹0.

## Reproduction and finding

D’s attachment was read as review evidence, not as authorization to expand the task. The supplied script is retained unchanged at `tests/import/SS_D_IMPORT_LINK_REPRO.mjs`; the review is in `tests/import/evidence/d-imp-01/independent-review.md`. Against the current implementation before editing, running `node /tmp/ss-d-imp-01-input/SS_D_IMPORT_LINK_REPRO.mjs` reproduced the bypass. Two OCR exam candidates on 26/27 October were initially represented by two events. Redirecting the first candidate to the second, then moving the second to 10 January 2027 outside the 24 October–9 November horizon, left coverage errors empty and import accepted, with zero events. Public-engine absence on 26 October returned `MEETS_PLANNING_RULES`.

This is a confirmed importer validation defect, not an attendance arithmetic defect. Equivalent controlled nonteaching and substitution cases also passed the archived exact base compiler with zero corresponding effects. See `before.json` (D’s exact script), `before-extended.json` (all three cases), and `after.json` in that evidence directory. The extended harness imports the archived base compiler/coverage functions without resetting the feature checkout. `node tests/import/d-imp-01-repro.mjs --run` reports current behavior. D’s unchanged original script intentionally asserts that the vulnerable behavior succeeds; after repair it fails that assertion because coverage errors are now present. It is retained as evidence rather than included as a passing regression.

## Confined repair

Only importer validation, its correction UI and import regression/browser tests change runtime behavior. `src/import/link-effects.js` checks the adapter’s effective future dates after the completed snapshot, within the teaching horizon and confirmed academic scope. It adds no attendance calculations. `coverage.js` applies those checks both to REPRESENTED source dispositions and page-level ENTERED links.

- Every linked target must have the claimed effective restriction. Exams require actual compulsory events with valid timing; explicit nonteaching requires teaching suppression; substitutions require a real, unsuppressed replacement pattern containing reviewed obligations. Historical/out-of-horizon, wrong-scope, empty-pattern and suppressed replacement targets cannot satisfy the link.
- Correspondence is checked against original source dates, times and known substitution weekday. Sharing page and treatment is insufficient. Multiple linked occurrences can collectively cover a source window.
- A legitimate source-date, OCR-year or pattern correction can be explicitly reconciled in the UI. A separate explanation and confirmation bind the original candidate/evidence/source SHA, selected target effect fields and current scope/horizon/snapshot/overrides. Editing those invalidates reconciliation. Reconciliation cannot rescue an ineffective target or convert a wrong-scope source into an applicable one. It remains a human assertion, not proof that the document was interpreted correctly.
- Genuine exclusions retain the justified, confirmed `NO_APPLICABLE_EFFECT` path. A page-reviewed checkbox does not supply this decision or calendar completion. Source candidates and user-confirmed coverage remain distinct.
- Existing confirmed holiday-teaching semantics remain: an actual HOLIDAY marker can coexist with explicitly confirmed teaching. An explicit NON_TEACHING/VACATION source must still suppress teaching; reclassifying it as a holiday marker cannot satisfy the stronger claim.

The UI now offers source-specific reconciliation and clears both stored and displayed source confirmation after edits. Reconciliation metadata remains draft-only and is not persisted into the shared Model.

## Actual verification

Commands were run from `semester-space`. Logs and JSON evidence are in `tests/import/evidence/d-imp-01/`.

| Command/check | Actual result |
| --- | --- |
| `npm --cache /tmp/ss-npm-cache ci --no-audit --no-fund` | Clean install: 21 packages; postinstall generated 39 local PDF/OCR assets. |
| `npm run check` | Passed: 52 JavaScript modules. |
| `npm test` | Passed: 136 tests, zero failures/skips/TODOs. The existing 108 unit tests remain unchanged; 28 new link-effect regressions. |
| `node --test tests/engine/*.test.mjs` | Passed: 26 tests. |
| `python3 tests/checker.py` | Passed: 342 independent Fraction arithmetic cases. |
| `npm run build` | Passed: local assets prepared and static dist built. |
| `SS_ORIGIN=http://127.0.0.1:5174 SS_EVIDENCE_DIR=/tmp/ss-dimp-browser-final npm run test:import-browser` | Passed: actual upload/OCR, correction/reconciliation UI, unresolved guard, confirmed save, schedule/planner flow, subset acceptance, commitment invalidation, reload, keyboard and 390px emulation. No page errors or external requests. |
| `SS_ORIGIN=http://127.0.0.1:5174 SS_EVIDENCE_DIR=/tmp/ss-dimp-corpus npm run test:import-corpus` | Completed: all five actual calendar examples decoded; partial semantic extraction recorded, not a completeness pass. |

The browser uses a synthetic 24 October 2026 20:00 IST clock. All three malicious link cases and corrected counterparts were also executed through the served browser’s module API; these are controlled API cases, distinct from clicking actual document upload/correction UI. `browser-report.json` identifies both. The initial browser run reached the connected planner but failed its invalidation assertion because generic 78/100 synthetic counts no longer guaranteed a blocked recovery session under the corrected schedule. The final harness independently chooses counts whose deficit recovers at the committed session and retains the `PLAN_BLOCKED` assertion. This test-data repair is recorded in `actualInvalidationCounts`; it does not change planner behavior.

New regressions inspect compiled events/holidays/replacements and public schedule expansion, plus public-engine exam blocking and valid corrected mappings. They cover same-page wrong dates, out-of-horizon and snapshot targets, wrong terms, empty/suppressed replacements, shortened source windows, changed patterns, corrected OCR year, stale/copied reconciliation, page-level reconciliation and justified exclusions.

## Corpus results and remaining limits

The reader/parser are unchanged. Counts below are extracted candidates and date/kind reference matches, not confirmed coverage or semantic accuracy scores. Other institutions remain format examples, not active MAIT data.

| Input | Decoding | Candidates / dated | Reference matches / unmatched |
| --- | --- | --- | --- |
| MAIT eight-page calendar | OCR | 120 / 73 | 15 / 3 |
| IIT(BHU) two-page calendar | PDF text | 48 / 37 | 7 / 5 |
| Colour grid image | OCR | 5 / 5 | 0 / 16 |
| Cohort grid image | OCR | 6 / 6 | 2 / 8 |
| Dual-term image | OCR | 57 / 47 | 8 / 9 |

See `corpus-report.json` for exact unmatched expectations, decoding methods and limitations. Dense grids, cohort/colour/footnote interpretation and legacy Hindi glyph encoding remain partial or unsupported. Readable text does not establish understood calendar meaning. Software cannot detect every omitted event, validate a dishonest justification, or establish human review correctness. Manual completion is still required; manual setup remains available. Q3 Physics mapping remains unresolved, and no actual student mapping or attendance policy was invented.

Physical-device testing, a screen-reader audit, unseen-format generalization, automated calendar revision reconciliation and deployment checks were not run. No claim of release readiness or perfect extraction is made.

## Preservation and package

Engine, controller, storage, main entry point, shared schema/contracts, original unit/engine/integration/arithmetic tests, dependency lockfile, asset-generation scripts, parser, reader and reference inputs are unchanged against the repair base. Only the existing import browser harness gains served regression/UI coverage. The absent historical `.openai/hosting.json` was not recreated or changed. README installation and supported-format limitations remain accurate.

The source package includes complete implementation, lockfile, asset-generation scripts, tests and evidence. It excludes node_modules, generated vendor assets, dist and Git internals. Current `PACKAGE_INTEGRITY.sha256` covers every payload file except itself; an external ZIP SHA-256 covers the full archive. Historical manifests retain their historical labels. The external package metadata and isolated patch identify exact commits without embedding a commit’s own hash circularly.
