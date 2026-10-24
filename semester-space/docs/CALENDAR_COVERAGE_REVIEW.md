# Calendar coverage investigation and repair — independent review required

**Packaging correction:** [D_REVIEW_PACKAGE.md](../../D_REVIEW_PACKAGE.md) defines the current source/integrity manifests and distinguishes the tested implementation commit from metadata-only packaging commits. Runtime, tests, evidence and extraction limitations in this handoff are preserved. The feature branch was subsequently published for source review only; no merge or deployment was performed.

24 October 2026 IST. Branch: `feature/document-import`. Exact investigation base: **`feb40999bdc59fc7ef41eb55e24665a690985fa6`**. Original repository parent before the first import implementation: `985ae01a7edf0f27dbc96a1c3abb8bef1a6a7a3c`. The final feature SHA is provided in the source ZIP's `SOURCE_PACKAGE_MANIFEST.json` and delivery response; this handoff is part of that commit. SS-INT-002 remains the fallback. No default-branch merge, push or deployment was performed; additional spend: ₹0.

This review supersedes the original import handoff's calendar-completion behavior. Read README.md for current installation and supported-format limitations. Existing partial-extraction results were not promoted to complete interpretation.

## Reproduction and findings

The working tree was clean on the feature branch. The existing 89-test suite passed before repair. The current implementation and original import handoff were read before changes. Controlled draft cases were executed against the exact base compiler extracted with `git archive`, without resetting or modifying the working checkout. The unchanged public attendance engine was then used to simulate the returned model.

[Before evidence](../tests/import/evidence/coverage-before.json) and [after evidence](../tests/import/evidence/coverage-after.json) retain the actual results. `node tests/import/reproduce-coverage.mjs --run` reproduces current outcomes; its exported function also accepts the archived base compiler for the before comparison. Six initial regression assertions failed on the base and passed after the repair.

| Requested case | Confirmed finding at base | Repair and current outcome |
| --- | --- | --- |
| 1. Extraction omits an exam or substitution | With a synthetic source describing an exam and a Saturday substitution, removing the interpreted rows allowed compilation with zero events and zero replacements. The engine accepted the exam-day absence as `MEETS_PLANNING_RULES`, and produced zero Saturday sessions. This is an import-validation defect over incomplete inputs, not an arithmetic-engine defect. | No automatic candidate list can establish coverage. Each calendar page requires explicit manual completion of obligations, substitutions/working days, and nonteaching dates. Known source candidates must remain present with a disposition. The incomplete reproduction returns no Model. |
| 2. Readable OCR misses calendar meaning | Readable OCR and an unsupported-grid warning could still accompany a successfully compiled setup. Corpus decoding already established that readable text did not reliably recover calendar semantics. | The same manual gate applies to readable PDF text and OCR alike. It does not infer successful interpretation from confidence/text length, or clear a gap by deleting an issue flag. A manual transcription path is tested positively. Unsupported semantics remain unsupported. |
| 3. Delete or reclassify an unresolved candidate | At the draft API boundary, deleting the unresolved candidate made it disappear from validation. The UI did not have a delete button, so this is not evidence of an observed delete-button interaction. Information-only with a generic note also passed; changing the editable kind could avoid the note requirement. | Validation regenerates original candidate identities/categories/provenance from read-only decoded source pages and requires retained candidates. Changing their editable category cannot remove the original obligation/exception. Link actual reviewed planner rows, or make a separate explicit no-applicable-effect decision with a justification. Information-only alone is insufficient. |
| 4. Page review while meaning is unresolved | A viewed/reviewed page plus `NO_CALENDAR_ROWS` or a layout warning could still compile with missing meaning. **An existing unresolved row was already blocked** by `CALENDAR_REVIEW`; the generic checkbox did not clear that row's fields. | Page viewing is explicitly labelled as viewing only. It cannot complete the three manual coverage areas or source-candidate resolutions. The real served-browser test fills other valid inputs, marks every page viewed, and still cannot save until manual completion is supplied. |

These controlled omission tests establish the compiler bypass; they are not a claim that a parser necessarily omits every synthetic sentence used in a test. The corpus report separately records actual unsupported/unmatched extraction cases. No claim is made that software can detect every omitted event.

## Review protocol and implementation

New `src/import/coverage.js` is an import-layer module. It does not change the attendance engine, controller, storage envelope or shared Model types.

- Every decoded calendar page remains available with its original text/items and source provenance. Re-running the existing parser from those pages provides a baseline candidate inventory independent of editable rows and extraction issue flags. A removed known candidate, lost source-page link, or category reclassification is checked against that inventory.
- A relevant source candidate requires a separate `coverageResolution`: represent it with linked planner-effect rows, or explicitly confirm why it has no applicable effect. A represented exam links compulsory entries; a timetable substitution links an actual replacement pattern. A working-examination notice can link a precise compulsory occurrence without inventing an ordinary timetable. Holidays/nonteaching records link suppression rows. Duplicate/incorrect candidates can be retained with links to corrected entries.
- Information-only/non-applicability remains possible as a **human decision**, with a dedicated disposition, reason and confirmation. It is not inferred from a generic note or page checkbox. Bulk administrative classification does not automatically confirm source dispositions.
- Each calendar page also requires separate manual answers for obligations, substitutions/working days, and nonteaching dates. The reviewer links applicable entered rows or explicitly explains that none apply to the confirmed scope. Empty/missing areas, information-only links, contradictory none-applicable choices and missing effect links block compilation.
- Completion is bound by exact comparison to the source, current candidate/effect rows and dispositions, academic scope, teaching horizon, snapshot date and exception overrides. The page's completion answers are bound too. Relevant edits invalidate declarations and require rechecking. This is a review-consistency mechanism, **not a cryptographic security boundary** or protection against a caller forging an entire source/model.
- The UI shows candidates as candidates, provides original source previews, keeps manual correction/addition and manual setup, and separates page viewing from completion. Confirmation records remain memory-only.
- Successful imported Models use the existing `context.sourceLabel` string to disclose manual calendar completion. A visible planner note retains this distinction after native reload. No new shared-schema fields or sidecar storage were introduced.

The compiler remains pure; the existing controller still performs initial expansion, captures the authoritative snapshot clock, evaluates, and persists the normalized Model. Original transaction and acceptance protections remain in force.

## Tests and actual checks

The original SS-INT-002 **70 engine/integration tests are byte-for-byte unchanged**. All 19 prior import test cases remain: their synthetic fixture setup now supplies explicit manual review records, rather than relying on implicit coverage. One case was strengthened: an explicitly confirmed teaching suspension during an exam also needs an actual represented exam obligation before it can pass; a class-cancellation explanation alone is insufficient. No test was removed, skipped or disabled.

Nineteen new coverage tests exercise all four requested cases, source-category retention, deletion after new declarations, explicit no-effect decisions, opaque OCR/manual transcription, unknown omissions as human assertions, scope/horizon/source/answer staleness, real planner links, duplicate/missing page records, unresolved candidates and actual exam/substitution effects through the public engine.

| Command/check | Actual result |
| --- | --- |
| Before repair `npm test` | 89 passed, 0 failures/skips/TODOs |
| Initial six coverage regression assertions at base | 6 failed as expected, reproducing the bypasses |
| `npm run check` | 47 JavaScript modules passed (includes generated vendor JS) |
| `npm test` | **108 passed**, 0 failures/skips/TODOs |
| Node 20.20.2 `node --test` | **108 passed**, 0 failures/skips/TODOs |
| `node --test tests/engine/*.test.mjs` | **26 passed**, no skips/TODOs |
| `python3 tests/checker.py` | **342** public-engine decisions matched the independent Fraction oracle |
| `npm run build` | Passed, including asset generation |
| Served `npm run test:import-browser` | Passed; actual file inputs, local PDF/OCR, manual-coverage gate, real controller/engine and native storage |
| Served `npm run test:import-corpus` | All five calendar documents decoded/OCRed; extraction remains partial, all coverage starts unconfirmed |

Runtime versions: Node 24.19.0 and 20.20.2; Python 3.12.14. The source package requires Node 20.16+ and Python 3.10+. Pinned packages, lockfile, local asset-generation scripts and license material are retained.

[Served-browser report](../tests/import/evidence/coverage-review/browser-report.json), [connected 390px view](../tests/import/evidence/coverage-review/connected-mobile.png), and [refreshed corpus report](../tests/import/evidence/coverage-review/corpus-report.json) are included in the source package. The original delivery's evidence remains historical.

The browser runner uses a disclosed synthetic clock of 24 October 2026, 20:00 Asia/Kolkata. It uses the actual supplied timetable/calendar bytes, real browser file selection/local OCR, real DOM edits, controller, engine and native localStorage. Its five synthetic draft-API checks run separately in the served browser and are labelled separately from the actual-upload flow. No external page requests or page JavaScript errors were observed. Synthetic policy/counts and source-exclusion decisions are test data, not the student's personal confirmations.

After all pages were viewed and candidates classified, a save attempt was rejected by `CALENDAR_MANUAL_COMPLETION` without a storage write. Only explicit area declarations allowed the connected synthetic setup. Subsequent suggestions, one-of-two subset commitment, actual-count invalidation, native reload, demo isolation, keyboard recheck, cancellation, missing-asset handling and 390/390 draft/connected widths passed. The manual-calendar provenance note was visible after setup.

The corpus runner is an extraction diagnostic, not a completeness test or accuracy score. Its metadata now explicitly says that automatic completeness is not claimed and manual completion is unconfirmed. No reference expected values enter runtime extraction.

## Remaining limits and unrun concerns

- **Unknown omissions cannot all be detected.** If neither OCR nor the parser captures an event's meaning, only a diligent human comparison with the original can supply it. The tests deliberately show that an explicit none-applicable declaration remains a human assertion. Software cannot establish that it is true.
- The partial colour/cohort grids, unreadable Hindi encoding, some dual-term/cohort rows, timetable-adjustment notes and source conflicts documented in the original handoff remain parser limitations. This repair prevents implicit completion; it does not implement universal calendar semantics or recover all missing entries.
- A source candidate that was never detected cannot be protected by the detected-candidate inventory. Generic page review is no longer enough, but a user can still make an incorrect explicit manual decision. This limitation is disclosed before save and in the planner.
- The real student's Q3 Physics mapping, Library/NCC/Sports treatment, units, counts, policy, applicability, teaching horizon and detailed exam occurrences remain unconfirmed. Nothing in the synthetic tests resolves them.
- Full physical-device/touch/screen-reader accessibility, real Windows-laptop performance, storage-denial settings, deployed-origin behavior, universal malformed/encrypted PDF handling, malicious whole-draft forgery and exhaustive unknown-document evaluation are **UNRUN**. No release readiness or general safety proof is claimed.

## Protected paths, source package and next review

Protected `src/engine/**`, `src/controller.js`, `src/storage.js`, `src/main.js`, `src/shared/**`, original `tests/engine/**`, `tests/integration/**`, `tests/checker.py`, PRODUCT_SPEC.md, CONTRACT.md, CURRENT_STATE.md, BASELINE.txt and reference inputs were not changed. The new importer tests/fixtures and browser/corpus harnesses were updated as described above. README.md now contains actual install, asset preparation and format limitations.

Delivery is a complete committed source ZIP, not a pasted/truncated diff. It includes the repository source, reference documents, complete lockfile, asset-generation scripts, tests, before/after findings, browser/corpus evidence and this handoff. It excludes `.git`, node_modules, generated vendor assets and dist. `npm ci` regenerates assets from the pinned lockfile. The ZIP-root manifest records exact investigation-base and feature SHAs; an external package manifest records the ZIP SHA-256. The source ZIP is unpacked and its clean install/tests/build are checked before delivery.

Independent review should challenge retained-source decisions, manual coverage link validation, stale declarations, false none-applicable choices, missing original information, and the connected transaction. Review actual data separately from synthetic evidence. SS-INT-002 remains the fallback; integration and deployment require separate authorization.
