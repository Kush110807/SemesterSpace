# SemesterSpace D-IMP-01 Repair — Independent Recheck

**Disposition: ACCEPT FOR INTEGRATION (D-IMP-01 repair only).**

**Scope:** This is an isolated, source-level and dependency-free executable recheck of the previously reproduced coverage-link defect, not renewed approval of full document extraction, the live installed browser workflow, deployment or academic applicability. No production files were edited, merged or deployed. A retains merge authority and SS-INT-002 remains the fallback.

## Exact inspected artifact

- Supplied source ZIP: `SemesterSpace-D-IMP-01-source.zip`
- Independently computed complete ZIP SHA-256: `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2`
- `sha256sum -c PACKAGE_INTEGRITY.sha256`: **134/134 payload files verified**, 0 mismatches. Older bundle manifests are historical, not current.
- `SOURCE_PACKAGE_MANIFEST.json` identifies base `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9` and tested feature commit `9486866f1d8f50d584dc8481d516fefbbe0b638e`. These are *declared identities*. `.git`, external `D_REVIEW_PACKAGE.json` and whole-ZIP checksum sidecar are absent from the upload, so the claimed commit ancestry and packaged-descendant identity were not independently authenticated.
- Compared ZIP contents with the earlier reviewed `SemesterSpace-D-review-source(1).zip`: production runtime differences are `src/import/coverage.js`, `src/ui/import.js`, and new `src/import/link-effects.js`. Engine, controller, storage, shared types and contracts, import compiler, PDF/OCR reader and parser, and original tests remained byte-identical to the previously reviewed ZIP.

## Reproduced defect and result

**The exact original D reproduction script is preserved byte-for-byte** at `tests/import/SS_D_IMPORT_LINK_REPRO.mjs` (confirmed by file comparison with the previously supplied independent script). It intentionally asserts the old vulnerability, so it correctly fails its assertion against the repaired source.

`node tests/import/d-imp-01-repro.mjs --run`: **PASS as a defect-recheck operation** (exit 0). The three independently executable controlled cases yielded:

| Adversarial redirected representation | Baseline before attack | Repaired attack result |
| --- | --- | --- |
| Compulsory exams, 26–27 Oct, linked to 10 Jan out-of-horizon | Two compiled events; 26 Oct absence `PLAN_BLOCKED` | Compilation **rejected**, `CALENDAR_RESOLUTION_EFFECT` and `CALENDAR_COVERAGE_EFFECT` |
| Explicit nonteaching dates, 26–27 Oct, linked out of horizon | Two holiday/suspension dates; 26 Oct absence `PLAN_BLOCKED` | Compilation **rejected**, same effect errors |
| Working-day substitutions linked out of horizon | Two replacements; 31 Oct expands one session | Compilation **rejected**, same effect errors |

`src/import/coverage.js:77–87` rejects ineffective `REPRESENTED` links, requires original source/target correspondence or explicitly confirmed source-specific reconciliation, and enforces scope. Lines 110–118 independently reject ineffective or mismatched page-level `ENTERED` links. `src/import/link-effects.js:12–39` computes effective dates after the snapshot inside the confirmed teaching horizon and relevant scope, requiring actual compulsory events, actual nonteaching suppression when claimed, or a non-suppressed replacement pattern with reviewed obligations. Lines 47–58 bind source/target/scope snapshots for reconciliation; subsequent edits invalidate those bindings. `src/ui/import.js:114–131` exposes the reconciliation controls and unchecks source confirmation after reconciliation changes. The existing page fingerprint in coverage.js invalidates stale page confirmation after relevant edits.

The new 28 regressions additionally cover wrong same-page dates, snapshot/horizon/scope mismatch, conflicting holiday teaching, pattern changes, stale/copied reconciliation, legitimate corrected dates, and justified exclusions. No regression failure was observed in the executable subset.

## Independently executed commands — Node 22.16.0 / npm 10.9.2 / Python 3.13.5

| Command | Observed result |
| --- | --- |
| `sha256sum -c PACKAGE_INTEGRITY.sha256` | **PASS, 134/134** |
| `npm run check` | **PASS, 42** syntax-checked modules (reported 52 requires generated vendor modules, absent here) |
| `node --test tests/import/link-effects.test.mjs` | **PASS, 28/28** |
| `node --test tests/engine/*.test.mjs` | **PASS, 26/26** |
| `python3 tests/checker.py` | **PASS, 342/342** independent arithmetic cases |
| `node tests/import/d-imp-01-repro.mjs --run` | **PASS** as recheck: all three attacks rejected |
| `node tests/import/SS_D_IMPORT_LINK_REPRO.mjs` | **Expected failed assertion**: old vulnerability is not reproduced (not an included regression) |
| `node tests/import/reproduce-coverage.mjs --run` | Executed, existing controlled incomplete-coverage cases blocked |
| `npm ci --no-audit --no-fund --prefer-offline` | **UNABLE TO COMPLETE**: npm installation failed; underlying log shows repeated registry `EAI_AGAIN` DNS failures, followed by npm `Exit handler never called!` |
| `npm test` | **117 tests passed, 1 test-module load failure**, 0 skips/TODOs. `tests/import/draft.test.mjs` cannot import missing `pdfjs-dist/legacy/build/pdf.mjs`; this is not a demonstrated assertion defect. Claimed complete 136-pass run **not independently reproduced**. |
| `npm run build` | **UNRUN SUCCESSFULLY**: exits 1 because generated PDF.js asset dependency missing. |
| `npm run test:import-browser`, `npm run test:import-corpus` | **Not executable**: missing Playwright dependency; actual browser flow and corpus decoding therefore **UNRUN** independently. |

The package includes logs and a `tests/import/evidence/d-imp-01/browser-report.json` that *reports* a successful synthetic served-browser upload/OCR, reconciliation, planning, subset acceptance, invalidation and native reload, plus partial corpus results. These are **supplied evidence**, not independently executed browser observations in this recheck. Their claims are not silently promoted to verified facts.

## Remaining boundaries and integration actions

**No surviving D-IMP-01 blocker** was found in the original exploit or the three linked effect categories. The approval is to integrate the *confined coverage-link repair* for further end-to-end validation, not to release the application. A should run a clean online `npm ci`, reproduce the full 136-test suite and build, and execute the live HTTP browser flow (especially source reconciliation, upload/OCR, native reload and count-driven commitment invalidation) in a functioning dependency environment before advancing the integrated release gate. If A's asserted successful run cannot be reproduced, reopen this review. B need not change attendance mathematics; C owns any actual UI defects found in its observed browser flow.

Extraction remains partial, especially MAIT calendar omissions, dense grids, cohort/legend/footnotes and legacy Hindi encodings. Undetected omissions and dishonest user confirmations cannot be machine-proven away. **Q3 Physics remains unresolved.** Synthetic fixture decisions are not confirmations for an actual student, academic institution or attendance policy. Physical-device, screen-reader, new-format, deployed-origin and institutional applicability checks remain UNRUN.
