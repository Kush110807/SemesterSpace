# Document import implementation handoff — review required

24 October 2026 IST. Implementation branch: `feature/document-import`. Parent repository HEAD: `985ae01a7edf0f27dbc96a1c3abb8bef1a6a7a3c`. BASELINE.txt is preserved: starter source `621a4ff10797ac05a0e5bb9c5dbd0ba8ae67c7fe`, runtime SS-INT-002 / contract 1.1.0 / schema 1. Historical B/D approvals have not been extended to this change. SS-INT-002 independent UI-delta review remains pending. This delivery is the current implementation-state handoff; protected CURRENT_STATE.md remains the supplied historical document.

A working initial-import path is implemented and exercised against the actual supplied timetable and scanned MAIT calendar. Automatic calendar interpretation is **partial**, particularly the dense calendar grids. This does not satisfy every semantic case in prospective import contract 0.2.0. The application requires source review and supports manual correction/addition of missing rows, with the original manual setup retained. Do not treat a readable OCR page, candidate row, test pass, or this report as release approval.

## Inspection and preservation

Read START_CODEX.md, PRODUCT_SPEC.md, CONTRACT.md, CURRENT_STATE.md, DOCUMENT_IMPORT_ADDENDUM.md, both document-import Codex briefs, IMPORT_CONTRACT.md, IMPORT_TYPES.d.ts, source observations, both annotated references, calendar corpus notes, integration/UI delivery and independent review reports. No applicable AGENTS.md was found. All required named handoff/specification files and all six reference inputs are present. The starter ZIP mentioned in START_CODEX.md and `.openai/hosting.json` are absent from this checkout; the extracted application and provenance are present, so neither is needed for local development. No hosting identity was created or changed.

The initial working tree had only generated `semester-space/dist/` from environment setup. A dedicated feature branch was created before application edits. No default-branch merge, push, deployment, site replacement, engine/schema migration, or revision-reconciliation feature was performed. Additional paid services/spend: ₹0.

Unchanged protected paths: `src/engine/**`, `src/controller.js`, `src/storage.js`, `src/main.js`, `src/shared/**`, all existing tests, PRODUCT_SPEC.md, CONTRACT.md, BASELINE.txt and reference inputs. Existing engine exports, six statuses, final acceptance transaction, snapshot provenance and commitment preservation remain authoritative.

## Implementation and data flow

- `src/import/read.js`: validate actual file signatures and size, read PDF text with geometry, render PDF pages, and perform local English Tesseract OCR for scans/images. PDF JavaScript/XFA are not used. Bounds are 15 MB/file, 20 PDF pages, 40 megapixels per decoded image. PDF rendering uses at most 2200px along the long edge; dense images use up to 2× / 4000px after the initial low-resolution run proved inadequate. Worker/page cleanup, progress, abort and actionable missing-asset errors are implemented.
- `src/import/image.js`: OCR-only adaptive contrast and removal of long table rules, including white text on dark backgrounds. The original colour preview remains available; colours are not converted to holiday semantics.
- `src/import/parse.js`: locate section headings and day/time geometry, propose subject aliases and separate registers, merge alternate lab staff rows into single occurrences, preserve atomic adjacent lectures, interpret Gregorian dates and some calendar tables/notes. Source text/page/normalized location accompanies candidates. No runtime import from human references, filenames or expected-output JSON exists.
- `src/import/index.js`: public extraction API, provenance SHA-256, independent source roles, direct declared-group matching, memory-only page previews, and job tokens rejecting stale completions. Q3/Q23 are explicit editable declarations. Physics Q1/Q2 does not resolve Q3.
- `src/import/compile.js`: pure draft validation and schema-1 adapter. Requires source/page/section/cohort review, explicit attendance units/counts/R/T/B, horizon/snapshot confirmation, resolved groups and relevant calendar obligations. It recomputes group requirements from evidence, rather than trusting an issue-resolution flag. Compiles positive attendance templates and independent zero-unit events; uses public engine expansion/validation, without reimplementing attendance arithmetic/search. Returns an uninitialized Model; the existing controller expands and stamps the snapshot on the actual transaction. Raw files, OCR, previews and draft metadata are not persisted.
- `src/ui/import.js`: actual file inputs, cancellation/progress, source previews/zoom/raw text, editable weekly/calendar rows, missing-row entry, grouped review of clear holidays/administrative rows, searchable subject protection, separate register rules/counts, and final validation through existing `onReplaceSetup`. A rejected controller transaction leaves the draft available. The document UI is initial-setup-only; an existing model retains manual update/history controls. The manual setup wizard is still available in a disclosure.
- `tools/serve.mjs` adds only required module/WASM/gzip MIME types. `tools/build.mjs` prepares local dependencies before copying the static app. QA/browser evidence is under tests and excluded from the build.

## Dependencies, licenses and reproduction

Node.js **20.16+** (compatible Node 20 release required by PDF.js) and Python **3.10+**. Tested here: Node 20.20.2 and 24.19.0; Python 3.12.14. Preserve the pinned lockfile. README.md still describes the dependency-free SS-INT-002 baseline; use these installation steps for the import branch.

```sh
cd /workspace/SemesterSpace/semester-space
npm ci
npm run check
npm test
node --test tests/engine/*.test.mjs
python3 tests/checker.py
npm run build
npm start
```

Pinned production packages: `pdfjs-dist@5.4.624`, `tesseract.js@7.0.0`, `@tesseract.js-data/eng@1.0.0`. Browser-test dependency: `playwright@1.58.2`. npm artifact integrity/TLS verification was retained. No external document-processing service, backend, paid API, runtime CDN or credentials are used. Registry access is needed for installation; subsequent browser processing uses self-hosted assets.

`npm ci` runs `prepare:assets`, copying pinned PDF/OCR workers, standard fonts, English language data and CPU/WASM variants into ignored generated `src/import/vendor/`. A SHA-256 inventory and license notices are included in that generated directory. PDF.js/Tesseract/core and upstream trained data use Apache-2.0; the English npm wrapper declares MIT in package metadata (recorded separately from upstream data licensing). The full upstream trained-data license is retained under `src/import/licenses/`. The generated asset tree is approximately **50,167,829 bytes (47.8 MiB)**; this is total retained assets, not a measured first-load transfer or peak RAM claim. Source PDF/OCR workers choose applicable variants at runtime. Do not commit node_modules, vendor or dist.

For repeatable real-browser checks, start the server, then:

```sh
SS_ORIGIN=http://127.0.0.1:5174 npm run test:import-browser
SS_ORIGIN=http://127.0.0.1:5174 npm run test:import-corpus
```

Set SS_ORIGIN to the server actually started; default is port 5173. These checks use system Chromium at `/usr/bin/chromium`; SS_CHROMIUM can override it. SS_EVIDENCE_DIR controls generated evidence (default `/tmp/ss-browser-evidence`). The corpus runner invokes the real browser decoder on supplied bytes; it does not substitute references. Reference matching happens only after extraction, in test code.

## Checks actually executed

Before editing, all five documented commands passed: 23 syntax modules, **70/70 full tests**, **26/26 engine tests**, **342/342 independent Fraction cases**, static build. No failures/skips/TODOs.

After implementation:

| Command | Actual outcome |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; lockfile install and local asset preparation repeated successfully |
| `npm run check` | Passed, 43 JS modules (including generated vendor JS) |
| `npm test` | **89 passed, 0 failed/skipped/TODO**: original 70 plus 19 import regressions |
| Node 20.20.2 `node --test` | **89 passed, 0 failed/skipped/TODO** |
| `node --test tests/engine/*.test.mjs` | **26 passed**, no skips/TODOs |
| `python3 tests/checker.py` | **342** independent public-engine decisions matched |
| `npm run build` | Passed, with self-hosted assets; source entry and QA exclusion retained |
| `npm run test:import-browser` | Passed on served Chromium; actual file selection, real extraction/controller/engine and native storage |
| `npm run test:import-corpus` | All five calendar documents decoded/OCRed; reports partial/unmatched semantic cases explicitly |

New regressions cover actual PDF content/geometry, changed content and renamed source metadata, moved/unknown sections, lab alternatives, compact/OCR date errors, source year/weekday conflicts, input/cancellation races, missing critical fields, erased group options, cohorts/TA/term/institution separation, overlapping attendance, independent registers, stable IDs, tentative exam choices, protection, holiday teaching conflicts, nonteaching/makeup substitutions and zero-unit events. Tests exercise the real controller through suggestions, atomic subset acceptance, count invalidation, reload and demo isolation. No existing tests were disabled or rewritten.

## Browser evidence and measured limits

[Browser outcome report](../tests/import/evidence/browser-report.json) and [390px connected view](../tests/import/evidence/connected-mobile.png) are retained for review. Further generated screenshots are under `/tmp/ss-browser-evidence/` in the current machine.

The connected browser check selects the actual four-page timetable and eight-page calendar, rejects an unresolved draft without a storage write, reviews sources and uses **explicit synthetic** counts/policy/row treatments. For the test alone, Physics practical is explicitly excluded with a synthetic explanation; this does not resolve the real student's Q3 mapping. All source-applicability exclusions in that harness are synthetic test choices, not personal confirmations.

Passed: searchable Communication Skills protection; initial setup through the real engine/calendar; suggest two dates and accept one; update actual counts to 78/100, retain the resulting blocked commitment; native reload retaining snapshots/conflict; demo isolation; Enter on Recheck retaining focus; draft and connected widths 390/390; cancellation preserving personal state; fresh-page missing PDF assets returning an actionable failure. No external page requests or JS page errors were observed in the connected run. The test uses fresh browser profiles and does not modify the student's browser data.

This is bounded Chromium evidence, not a full accessibility/device audit. Physical Windows/16GB laptop latency, touch, NVDA/VoiceOver, exhaustive keyboard traversal, browser storage-denial settings, deployed-origin behavior, PDF encryption/full malformed-PDF matrix, and all unknown calendar formats remain **UNRUN**. Size/type/cancel bounds are tested; no universal PDF robustness or memory ceiling is claimed.

## Extraction coverage and corrections

[Full per-document report](../tests/import/evidence/corpus-report.json) lists timing, page methods, candidate rows and every unmatched annotated case. Date/kind matching is only a candidate-level diagnostic; it does not verify titles, cohort correctness, all notices, or semantic accuracy. These are developer-visible examples, not held-out evaluation or trained weights.


| Calendar | Browser decode/extraction time | Candidate rows | Date/kind diagnostic matches |
| --- | --- | --- | --- |
| Academic_Calendar_Odd_Semester_2026-2027.pdf | 33.15 s | 120 | 15 |
| IIT_BHU_calendar_26-27_odd.pdf | 1.19 s | 48 | 7 |
| calendar_grid_colour_150735.png | 14.22 s | 5 | 0 |
| calendar_grid_cohort_150809.png | 5.58 s | 6 | 2 |
| calendar_dual_term_150940.png | 6.31 s | 57 | 8 |

Times are for this cloud Chromium run, including timetable extraction on each pass. Module/asset caches were warm on later files; these are not cold Windows-laptop benchmarks. Match counts are diagnostics only.

The genuine timetable extraction finds O/P/Q/R/S/T/U/V, isolates Q on page 2, and yields **18 theory periods, four merged lab blocks, seven academic subject families and ten academic candidate registers**, plus seven Library/NCC/Sports occurrences in two separate activity families. Adjacent Communication Skills periods remain separate. Graphics and EVS have Q1/Q2/Q3 options; programming has Q12/Q23 alternatives; Physics has Q1/Q2 only. Positive weights, actual attendance, attendance treatment and policy are not inferred.

The scanned MAIT calendar recovers all **nine holiday dates** in the latest corpus run, including 26 October and 24 November. OCR can mangle titles and date punctuation. The historical 2028-vs-2026 error remains an explicit negative regression; it was not reproduced as that same year error in this browser run. Page 1/7 notices, uncertain activity rows and first-year applicability still require source review. Some relevant activity dates/ranges are not assembled correctly; the report names them. Do not infer the first-year effective start, last ordinary class or actual exam timetable from an incomplete candidate.

IIT(BHU): English text is usable, but several wrapped/cohort/merged rows are only partial candidates. The legacy Hindi text layer is flagged and not added as duplicate translated events; the original page must be inspected for the documented bilingual year disagreement. Source weekday/date discrepancies are preserved and checked. Automatic bilingual semantic reconciliation is not implemented.

Colour week grid: OCR and source previews work, but automatic cell/legend/rollover reconstruction and all ten TTA statements are **not reliably recovered**. Treat those rows as unsupported automatic interpretation and correct them from the preview or use manual setup. A grid colour, omitted Sunday, teaching counter or unknown cell never becomes an attendance weight or inferred free day.

Cohort/makeup grid: the wrapped 31 October / 19 October and 28 November / 23 November makeup notes can be extracted with Monday as the replacement pattern. Original nonteaching dates, cohort starts, MST/EST windows and colour/code meanings still need manual reconstruction/review; no original date is suppressed merely because it appears in an `in lieu` phrase.

Dual-term table: columns are separated geometrically and some first-year/other, vacation and bottom-note dates are retained. Several exam ranges, TBA entries and adjustment details remain unassembled or OCR-corrupted. They require explicit correction; odd/even or faculty/student data cannot be combined to complete an active MAIT schedule.

## Remaining decisions and independent review

The real student's Physics mapping, Library/NCC/Sports treatment, attendance units, current counts, R/T/B, applicable programme/term, source revision and confirmed teaching horizon remain unconfirmed. They deliberately block a personal planner setup. No user confirmation was invented from synthetic tests or annotated expectations.

A should review the feature-branch diff and this report before integrating. D should independently challenge extraction with perturbed/unknown documents, dense grids, source conflicts, missing assets, correction/coverage bypasses, races and the connected planner transaction. The incomplete calendar-geometry/semantic coverage above is a remaining implementation limitation, not an approved release condition. Preserve SS-INT-002 as fallback. No deployment or default-branch merge is authorized by this delivery.
