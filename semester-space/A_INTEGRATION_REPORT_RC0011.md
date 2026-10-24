# SemesterSpace — A Integration Report RC-001.1

**Date:** 24 October 2026  
**Integration owner:** A  
**Release decision:** HOLD — incomplete worker and installed/browser gates  
**Authoritative working tree:** `ss-authoritative-rc002/SemesterSpace/semester-space` (source ZIP and bounded patch attached). Not an authenticated Git commit; supplied RC-001 ZIP has no `.git`.

## Provenance

- Original repaired ZIP SHA-256: `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2` (previous independent verification).
- This iteration derives strictly from provided `SEMESTERSPACE_RC001_A_SOURCE.zip`; no alternate worker branch or new dependency was silently introduced.
- Only A-owned controller, storage and integration regression paths were edited. One historical controller test expectation was changed by the explicit RC-001.1 amendment. Engine, import code, UI code, shared types, dependencies and supplied reference documents remain unchanged.
- **No new B, C, Codex or D worker deliveries were attached for this turn.** Synthetic adapters in regression tests are not worker implementations.

## Bounded changes

1. `src/controller.js`: all model-mutating callbacks now use validated **save-before-swap** with persisted-revision check; quota/stale write failures leave in-memory data intact. Day-close adapter proposals are checked for immutable journal prefix, one record per confirmed mark, exact occurrence/register/weight/notes, controller clock, explicit correction linkage, and one correctly sequenced derived snapshot. Exact dayKey retries no longer require a fresh revision; altered content conflicts. A repeated calendar proposal ID is accepted only with identical content, not silently restaged with changes.
2. `src/storage.js`: a persisted attendance date has one original closure and a linear correction chain, not independent/forked closes; active records cannot credit one occurrence multiple times; correction links and per-record clock/revision must agree with the day attestation. Malformed records quarantine without writes.
3. `tests/integration/controller.test.mjs`: obsolete quota behavior assertion corrected to require no phantom accepted edit.
4. `tests/integration/release-migrations.test.mjs`: eight added tests exercise forged daily marks, mutation of old history, duplicate independent day closure quarantine, dayKey replay/conflict, staged-proposal ID conflict, write rollback, explicit attendance correction+snapshot supersession+reload and preservation of invalid commitments after calendar revision.
5. `RELEASE_CONTRACT.md` plus `RELEASE_CONTRACT_RC001_1_AMENDMENT.md`: versioned clarification; no new callback/request shape or schema version; A/B/C/Codex/D notification obligations enumerated.

## Actual checks (fresh RC-001.1 tree)

| Command/check | Actual outcome | Meaning |
|---|---|---|
| `npm run check` | PASS: syntax 43 modules | Static syntax, not browser proof |
| `node --test tests/integration/controller.test.mjs tests/integration/release-migrations.test.mjs` | PASS: **39/39** | A integration with controlled B/Codex adapters |
| `node --test tests/engine/*.test.mjs` | PASS: **26/26** | No engine regression detected |
| `python3 tests/checker.py` | PASS: **342/342** | Deterministic independent fractional arithmetic check |
| `node --test tests/import/link-effects.test.mjs` | PASS: **28/28** | Prior D-IMP-01 link effects retained |
| `npm test` | FAIL: **137 pass, one test-file import-load failure**, no test assertions failed in loaded modules | Missing `pdfjs-dist` in `tests/import/draft.test.mjs` |
| `npm run build` | FAIL: `ENOENT node_modules/pdfjs-dist/build/pdf.min.mjs` | PDF asset dependency not installed; build unverified |
| Clean `npm ci` | FAIL/blocked: first attempt npm internal `Exit handler never called` following registry `EAI_AGAIN` failures; follow-up timed out | No successful dependency installation |
| `npm run test:import-browser` / `npm run test:import-corpus` | FAIL to start: cannot import Playwright | Browser/OCR end-to-end suite unrun |
| HTTP GET `/` on served app | **200 OK** | Static HTTP route only, not a working UI assertion |
| Headless Chromium startup (`--dump-dom`) | TIMEOUT, no usable DOM | Cannot claim an actual Chromium smoke pass |

See included `evidence/` files for captured stdout/stderr and exit codes. Dependency and headless-host failures are **not** application assertion failures. The full integration gate remains blocked.

## Demonstrated behavior vs gaps

**Demonstrated at A integration boundary using controlled adapters:** explicit day closure, one-change replay, append-only correction, derived snapshot supersession, official snapshot superseding the baseline without changing journal records, legacy envelope in-memory migration, quarantine of invalid saved history, persistence rollback, actual engine re-evaluation of retained commitments after future protective calendar change, and model/journal reload through the same simulated browser-local storage key.

**Not demonstrated end-to-end:** delivered B real arithmetic logic, C connected attendance/revision UI, Codex actual revision proposal/compare/apply and extraction variations, PDF/OCR import, native browser reload across navigation, two-tab CAS behavior, real student Q3 applicability, physical-device/keyboard/screen-reader, D approval and deployed-origin tests. An initial HTTP 200 response is not a passing browser workflow.

## Integration ownership, next handoffs, release gate

- **B** deliver `src/attendance/**`, pure `evaluateDayClose` per RC-001.1; validate normal closure, corrections, official rebase, gaps and no double count with independently checkable arithmetic. A must plug it into `createController({attendance})` and rerun real app tests.
- **Codex** deliver `src/import/**` including pure proposal generation and `buildRevisionCandidate`. A must integrate adapter, source-evidence checks and future-vs-historical identity protection.
- **C** deliver `src/ui/**` with actual attendance and revision screens; A integrates callback wiring in A-owned `src/main.js` **only after explicit ownership authorization** (see note below) and tests every failure/confirmation path in browser.
- **D** independently review this delta and the combined B/C/Codex behavior. A will not promote RC-001.1 synthetic tests as D acceptance.
- **Contract caveat:** `src/main.js` is an integration entry point *not assigned explicitly in RC-001*. A must coordinate an explicit contract update before modifying it to wire adapters; it is unchanged in this delivery. Next integration cannot be declared complete until live wiring is implemented.
- Once network/npm installation succeeds: require `npm ci`, full `npm test`, engine tests, checker, production build and the real served-browser flow: upload+OCR+manual coverage; complete-day close, correction and restart; official baseline rebase; revised-calendar compare/apply; retained commitment invalidation; source-evidence negative tests; origin reload. Then D re-review and deploy/submission, protecting the final 90-minute reserve.

**Current decision:** HOLD. No production deployment performed. Keep SS-INT-002 fallback. Do not silently replace the baseline with independently generated worker patches or alter the engine. 
