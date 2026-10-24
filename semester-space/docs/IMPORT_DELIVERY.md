# RC14-D-01 confined legacy-source correction

25 October 2026 IST. Delivery branch `fix/rc14-d-01`. This section supersedes the first revision delivery’s claim that prior filename/hash metadata needs conversion to v1 before comparison. No other release behavior is changed.

## Exact RC-001.4 baseline and reproduction

User supplied `SEMESTERSPACE_RC0014_A_D02_SOURCE.zip`, SHA-256 **`b0a5086f12ded21e89cec85a31e3e758577837f01c646f9195f58deed4595633`**. ZIP CRC and **182/182** current manifest entries verified before modification. Read RELEASE_CONTRACT.md and RC-001.1/2/3/4 amendments. The earlier D preliminary ZIP contained only the report and four probes; this later archive supplies the actual source and amendment.

The archive’s `src/import/revision.js`, importer-local types and this existing handoff are byte-identical to declared imported head `6a8d0a09abbfa7cefc0b3cf9a8227fcdb190c115`; the source patch is based on those exact bytes. Original revision.js SHA-256: `062d41abaf574462a4e2b7df320a89bfc5083fd80c1d7c04de9a2ceefe872ae2`. Existing worker branches and A’s supplied tree were preserved separately. No A integration or default-branch merge is performed by this delivery.

D’s unchanged `independent_rc14_legacy.mjs` ran against the actual supplied tree before repair: missing metadata → no unresolved items; reviewed legacy `{sha256,fileName}` → SOURCE_METADATA_REVIEW; valid v1 → no unresolved items. This confirms RC14-D-01. After the repair, all three reviewed cases have no unresolved items and one proposed change. Both runs used synthetic fixture confirmations, not personal/institutional confirmation.

## Bounded repair and exact changed files

- `src/import/revision.js`: distinguishes missing metadata, the exact two-field legacy filename/SHA-256 JSON shape, valid version-1 crosswalks and unsupported/malformed metadata. Missing and valid legacy metadata require `legacySourceReviewed === true` plus a nonblank string note. Legacy SHA must be a 64-hex string and filename nonblank; unknown/versioned records cannot masquerade as legacy. Only actual v1 crosswalks supply `priorLinks`; malformed links no longer cause an unchecked array operation. Review never fabricates a v1 record or prior links. The supplied legacy object, filename and SHA spelling/case remain unmodified. Candidate/proposal result shapes remain unchanged.
- `src/import/revision-types.d.ts`: importer-local input union adds `LegacySourceRevision`; no shared interfaces or output fields change.
- `tests/import/legacy-source.test.mjs`: 12 regression groups for positive/negative missing, legacy and v1 inputs; strict/incomplete review, immutable identity, no fabricated links, competing matches, unknown prior references, applicability/effective date/coverage, unsupported input, historical edits, cancellation evidence and known missing rows.
- `tests/import/rc14-legacy-apply.mjs`: guarded manual probe for A’s RC-001.4 tree. Uses the actual A controller/storage adapter with serialized in-memory storage; checks reviewed legacy → stage → single write → prior identity retained → reconstructed controller readback. It is not a native-browser test and does not run automatically without `--run`.
- `tests/import/evidence/rc14-d-01/results.json`: before/after results and actual verification summary.
- `docs/IMPORT_DELIVERY.md`: this bounded handoff; prior reports below retained as historical.

A’s existing merge routine retains `{sha256,fileName}` in `sourceHistory` verbatim. The importer leaves A’s original legacy record read-only rather than replacing it with the new source or inventing old crosswalks. Candidate source links describe only the newly reviewed effects. All prior missing-row, affirmative cancellation evidence, ambiguity, source review, scope and historical guards remain in force.

## Actual commands / results on the supplied RC-001.4 A-D02 source

Runtime: Node 24.19.0, Python 3.12.14. All commands below exited 0 unless the pre-fix observation is explicitly noted.

- `git apply --check` and application of the importer runtime/type diff: passed against the actual source archive. The final complete patch is also checked against a pristine extraction.
- D’s `node independent_rc14_legacy.mjs`: reproduced the legacy-only blocker before repair; after repair, missing/reviewed legacy/v1 cases all return `unresolved: []`.
- `npm --cache /tmp/ss-npm-cache ci --no-audit --no-fund`: clean pinned installation passed; 39 local assets prepared. No document-processing service or paid API.
- `npm test`: **274 passed**, 0 failures/skips/TODOs, including the 12 new regression groups and A’s unchanged existing integration tests.
- `node --test tests/import/legacy-source.test.mjs tests/import/revision.test.mjs tests/import/layouts.test.mjs tests/import/link-effects.test.mjs tests/import/coverage.test.mjs tests/import/draft.test.mjs`: **111 passed** on the worker source.
- `npm run check`: passed on the RC-001.4 tree after adding the guarded probe: **69 modules**.
- `node --test tests/engine/*.test.mjs`: **26 passed**. `python3 tests/checker.py`: **342 passed**. `npm run build`: passed.
- `node tests/import/rc14-legacy-apply.mjs --run`: passed on the supplied RC-001.4 tree. Exactly one serialized write, model revision 3→4, snapshots/commitments unchanged, exact old identity retained in persisted history, no fabricated old links, reconstructed controller reads back the accepted state. This is synthetic in-memory storage evidence, not browser/native localStorage reload.

An initial new history test asserted the later projection guard rather than the earlier HISTORICAL_CONFLICT guard. It was corrected to assert the actual fail-closed historical rejection; production historical validation was unchanged. The original legacy positive regression failed before the fix and passes after it.

## Preservation / limits / A handoff

A controller/storage/main/release integration, C UI, B attendance ledger, engine, shared files, original tests, parser/extractor, dependencies and assets scripts are unchanged. The patch does not fix or reopen other D findings and does not create personal confirmations. Q3 Physics/activity treatment, attendance counts/policy and teaching horizon remain unresolved.

A must independently apply the bounded patch to its corrected RC-001.4 working tree, verify legacy review through the final C UI, and test the atomic acceptance and **native browser reload**, including persistence-failure rollback. Those UI/native-browser checks were not run by this repair. Extraction limitations remain unchanged; missing extraction is not deletion and software cannot prove every omitted event was found. No schema/interface migration, broad refactor, source-package regeneration, merge or deployment. Additional spend ₹0.

---

# RC-001 first bounded revision delivery — for A integration

This section supersedes only the earlier milestone’s initial-import-only boundary. The historical initial delivery below is retained. Contract supplied by A on 24 October 2026: RC-001. No controller, storage, UI, attendance or engine files were edited. No merge or deployment. ₹0 additional spend.

## Follow-up: bounded layouts and final evidence

Early delivery was published as **`d1a62c4b4a64b167cd4d0a468e6e0718e42c86f4`**, before this layout follow-up. The follow-up adds no UI/controller/storage/engine changes. It also exposes each ambiguous existing-target alternative in `proposal.changes` as AMBIGUOUS alongside the possible addition, so C can show the competing before/after choices. Already-started linked events are checked through their canonical session; malformed prior-source metadata is a review blocker.

Bounded parser changes:

- Named-date phrases retain both explicit endpoints across months and preserve stated years. Academic-year headings no longer supply a spurious day. Two explicit day numbers followed by a year can survive an OCR-lost range dash, as unreviewed candidates.
- Explicit OCR exam-range lines can supply candidates when word boxes lose text. Page evidence is retained; location is null when no trustworthy box exists. Grid colours, implicit dates and omitted Sundays are not inferred.
- Event/date table geometry associates merged start/end/exam parents with separate cohort qualifiers. Wrapped cohort/programme exceptions still require review and retain a warning.
- Explicit paired working Saturdays are separate notices, not a continuous teaching week. A misspelt weekday such as the actual OCR token `Tuesaday` stays unresolved; it is not guessed from the Saturday’s calendar weekday.
- Numeric OCR punctuation/spacing such as the actual `04:01:2027t0` is read as an unreviewed date candidate. Malformed merged years such as actual `21.09. 202610` are **not** repaired to an expected answer. An adjacent malformed exam-start line keeps the source window’s start unknown, with DATE_TOKEN_REVIEW. The sessional-I date range remains a measured extraction gap until visually resolved.

Fresh served-browser OCR/PDF decoding on all five actual calendars produced the following **date/kind reference matches**, used only for verification. These are not semantic accuracy scores, confirmation of applicability, or a universal-format claim. Other institutions remain format-only examples.

| Actual input | Before / after matching cases | Remaining unmatched checks |
| --- | --- | --- |
| MAIT eight-page scanned PDF | 15 → 16 | First-year orientation and Sessional-I window. |
| IIT(BHU) bilingual PDF | 7 → 12 | None of the annotated date/kind checks; wrapped exceptions, source weekday conflicts and legacy Hindi encoding still need review. |
| Colour week-grid image | 0 → 2 | Starts/last class, recess and ten timetable-adjustment cases. |
| Cohort-grid image | 2 → 2 | Cohort starts, recess/exam meaning, two nonteaching dates and holiday overlap. |
| Dual-term image | 8 → 11 | Even-term exams, two substitution cases, TBA/no-last-day interpretations. |

No previously matched annotated date/kind case was lost. The before comparison replayed the exact initial parser against actual stored device-local decoding; `node tests/import/measure-layouts.mjs --run` provides the reusable parser-only measurement. The after table comes from a **fresh** `SS_ORIGIN=http://127.0.0.1:5190 SS_EVIDENCE_DIR=/tmp/ss-rc001-corpus-final npm run test:import-corpus` run, not reference substitution. `tests/import/evidence/rc001-layouts/` includes before/after measurements, recovered source excerpts and exact remaining misses.

Final relevant checks (no full-suite rerun):

- `node --test tests/import/layouts.test.mjs tests/import/revision.test.mjs tests/import/link-effects.test.mjs tests/import/coverage.test.mjs tests/import/draft.test.mjs`: **99 passed**, zero failures/skips/TODOs (27 revision, 6 layout, 66 unchanged import regressions). Includes true session additions, canonical rescheduling, event changes, holiday cancellation/restoration, substitution expansion, teaching-end extension/shrink and retained history/commitments, checked through public engine functions.
- `npm run check`: **58 modules**, passed. `npm run build`: passed, 39 existing local assets prepared. Dependencies/asset scripts unchanged.
- Final-parser `SS_ORIGIN=http://127.0.0.1:5190 SS_EVIDENCE_DIR=/tmp/ss-rc001-revision-browser-latest node tests/import/revision-browser.mjs --run`: passed. Actual PDF/file-input staging and pure reviewed candidate preserve source provenance and absent prior exam, with no storage writes, page errors or external requests. Subsequent linked-history/metadata guards were covered by targeted Node tests; the exercised positive browser path was unchanged.
- The unchanged existing `npm run test:import-browser` also passed on the intermediate parser before the final numeric-OCR/malformed-date guard. Its report is explicitly labelled **interim**; that entire initial UI flow was not repeated after the final parser guard. This does not substitute for C/A’s final release UI/integration checks.
- Full suite, engine-only suite and arithmetic checker were not rerun for this bounded importer follow-up. The earlier attached-baseline runs remain historical baseline evidence. A must execute the full integrated release gate with A/B/C implementations.

The original layout assertions exposed the MAIT row-association gap during development (expected unknown start was still a readable endpoint). The guard now retains the malformed adjacent raw line and fails closed, with a passing regression; it never inserts the reference start date. All new extraction remains PARTIAL/unconfirmed. No actual personal confirmations were supplied.

## Exact baseline and ownership

Branch `feature/calendar-revision-rc001` starts at package source **`2eb474f955b76eec4476f9f1c473455ade32a29b`**, containing D-accepted repair `9486866f1d8f50d584dc8481d516fefbbe0b638e` against `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`. Its archive SHA-256 is `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2`. The prior supplemental verification branch is preserved separately. Its only differences from this baseline were documentation/evidence, not runtime. A’s new contract is read from the supplied attachment; this worker does not modify A-owned RELEASE_CONTRACT.md.

Changed paths are confined to `src/import/**`, `tests/import/**`, and this handoff. No packaging or checksum-manifest regeneration is part of this delivery; old manifests identify D’s frozen archive, not this new feature branch. A alone cherry-picks/integrates.

## Working revision slice / adapter interface

Import directly from `src/import/revision-extract.js` and `src/import/revision.js`. Importer-local input/result types are in `src/import/revision-types.d.ts`; shared engine types remain untouched. RC-001 fixes the two function argument signatures but leaves extracted-draft, prior source metadata and result shapes unspecified; the local adapter shapes below make those explicit without changing A’s callback payloads.

1. `await extractCalendarRevision({academicCalendar:{fileName,bytes},section,signal,onProgress})` reads only the revised calendar using existing local PDF text/render/OCR assets. It returns source SHA/page provenance, pages/previews, raw candidates and **unconfirmed** effect suggestions. Successful decoding returns `PARTIAL`, not complete semantic support. Other statuses distinguish unsupported formats and unreadable input. Abort rejects; no late output is accepted by A/C. Existing `createImportJob(extractCalendarRevision)` can provide the established cancel/replacement token boundary. No saved setup/timetable is replaced and no upload leaves the device.
2. C edits `draft.review`: confirm `scope`, `academicScope`, per-effect applicability/effective date/interpretation, source-based coverage note, exclusions and missing-row decisions. Effect `id` is a once-generated draft UUID, never an occurrence ID from document row order. Keep it through editing. For a new staging after a previous proposal was staged, use a fresh `review.proposalKey`. The raw source pages stay read-only. Regenerated original candidates prevent deleting/reclassifying an editable row from erasing its source requirement.
3. `prepareCalendarRevision({currentModel,existingSourceRevision,extractedDraft})` returns **`{proposal,comparison}`**. Pass `result.proposal` in A’s unchanged `ProposeRevisionRequest`. Comparison statuses are unchanged, added, changed, needs review and possible removal. Proposed before/after rows use the actual schema-1 Session/Event/Holiday/Replacement shapes; TEACHING_END uses `{date}`. The proposal object itself follows RC-001 exactly. Unknown source interpretation, dates, cohort, incomplete coverage, ambiguous targets and missing prior-source reconciliation remain unresolved and block candidate building.
4. Existing source metadata adapter: `{version:1,source?,scope?,links:[{sourceRef,kind,targetId,value,evidence?}]}`. `sourceRef` is an opaque prior applied-effect reference, not a new occurrence ID. Explicit `previousSourceRef` links a new reviewed effect to the old target. Multiple matches remain ambiguous. Without metadata, the legacy setup needs explicit manual comparison (`legacySourceReviewed` and a reason); no source links are fabricated from filenames or personal assumptions. Missing old rows yield possible-removal review, **never an automatic cancellation**. `review.missing` can explicitly keep the old effect with a reason; an actual removal is a separate effect linked to affirmative current-source evidence and the prior crosswalk.
5. `reconcileRevisionEffect(draft,effectId,note)` explicitly binds source-specific date/pattern/meaning correction to the original source/effect/scope. Later edits invalidate it. Exams never gain inferred times: enter actual times or explicitly enter whole-day protection. Unsupported meanings require this manual resolution or a justified source exclusion. Page/coverage confirmation cannot resolve known source gaps alone.
6. A calls `buildRevisionCandidate({model,proposal,acceptedChangeIds,clock})` using its captured transaction clock. Returns `{ok,issues,proposedModel,sourceRevisionPatch,engineStatus,preservedCommitmentIds}`; failure returns no model/patch. Revision and snapshots are unchanged. It never writes, increments revisions, stamps confirmations or swaps state. Selection is checked for stale before-images, competing targets, identity remapping, removal evidence, scope and history. Schedule changes use public schedule expansion and preserve canonical IDs. Manual occurrence overrides touched by projection fail closed and need explicit reviewed session changes.
7. A **merges** successful `sourceRevisionPatch.links` into its own source metadata by **effect family and target identity** (ADD/EDIT/CANCEL_SESSION are one family; ADD/REMOVE_HOLIDAY are one family), retaining old/unselected links and source history. Do not replace all old metadata with a subset patch. New links carry source SHA/page/excerpt, target identity, normalized value, and `sourceRef=changeId` for the next comparison. A owns the exact release-envelope representation. No unselected proposal change is silently applied. A must keep declined/unapplied differences visible and must not claim complete adoption of a partially selected revision. Both automatic coverage and the source patch stay PARTIAL.
8. A binds the staged proposal’s complete digest and base revision, handles duplicate IDs idempotently, validates acceptance confirmations and journal conflicts, preserves all histories/commitments and atomically writes model+journal+metadata or nothing. Only then may it increment the revision/clear suggestions/swap state. `PLAN_BLOCKED` from retained commitments is reported, not a reason to drop commitments. A’s journal check remains essential: the importer has no journal parameter and therefore rejects snapshot/started/original-service-date historical changes conservatively; it cannot authorize recorded-attendance corrections. `KEEP_HISTORY` means omit the historical mutation; explicit attendance correction remains A/B’s path.

## Actual checks for this first slice

- `npm run check`: PASS, 56 modules after existing generated assets.
- `node --test tests/import/revision.test.mjs tests/import/link-effects.test.mjs tests/import/coverage.test.mjs tests/import/draft.test.mjs`: PASS, **90 tests**, zero skips/TODOs. Includes 24 new revision tests alongside unchanged D-IMP-01/coverage/extraction regressions.
- `SS_ORIGIN=http://127.0.0.1:5190 node tests/import/revision-browser.mjs --run`: PASS. Test harness uses an actual file input and the actual MAIT eight-page PDF, invokes served calendar-only extraction/compare/candidate APIs, and manually reviews a dynamically selected extracted holiday with explicitly synthetic QA inputs. Initial gaps block; keeping an absent prior exam preserves it. Successful candidate retains provenance, model revision and input immutability; zero storage keys, page errors and external requests. This is a module/file-input integration harness, **not C’s revision UI or A’s transaction/reload test**. Report/logs in `tests/import/evidence/rc001-revision/`.
- No new full-suite/build/engine-only/arithmetic reruns for this bounded slice: unchanged baseline was freshly installed and verified earlier (136 full tests, 26 engine tests, 342 arithmetic, build and initial-flow browser). These historical baseline runs do not claim a new integrated release pass.

## Boundaries / next bounded extraction work

Raw extraction remains partial; no parser behavior changed in this first delivery. Source-derived automatic effect suggestions never supply personal confirmations. Human scope/coverage/exclusions and reconciliation cannot prove every source event was found. Missing extraction is never deletion. Zero-unit recurring event provenance and manually edited/cancelled occurrences cannot be regenerated from unavailable source metadata; retain them and require explicit reviewed changes. A’s atomic apply, durable source metadata merge, daily journal reconciliation, C’s actual UI, reload after apply and storage-failure tests remain unrun because those owner implementations are absent here. Physical-device/screen-reader/deployed-origin checks remain unrun.

Q / Q3 / programming Q23 are declarations only. Physics mapping, activity treatment, actual counts, policy and teaching horizon remain unconfirmed. Synthetic tests do not resolve them. Next delivery targets actual missed exam ranges, teaching boundaries and substitutions in the supplied layouts, with measured before/after corpus gaps and explicit unsupported handling.

---

# Document import implementation handoff — review required

**Historical initial delivery at `feb40999bdc59fc7ef41eb55e24665a690985fa6`. Calendar-coverage validation findings and repairs supersede the original review behavior below: see [CALENDAR_COVERAGE_REVIEW.md](CALENDAR_COVERAGE_REVIEW.md).**

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
