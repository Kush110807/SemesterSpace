# RELEASE-GATE-PASS — SemesterSpace final bounded FV-01 gate

25 October 2026 IST. **All requested installed/build and genuine Chromium FV-01 gates passed.** This is a verification result for the exact candidate below, not permission to deploy or submit. No application logic, unrelated source, controller/storage, attendance engine or shared interface was modified during verification.

## Authoritative source and bounded patch

- Sole runtime candidate: attached `SS_FV01_Final_Source.zip`.
- SHA-256: **`5e46451335fb8e96d2cc9efab21222e9b0630996e69acc5dffed0490937a3acb`**.
- ZIP CRC and current `PACKAGE_INTEGRITY_RC0014_FV01_LOCAL.sha256`: **198/198 entries verified**.
- All **199 original files** remain byte-for-byte unchanged after testing. Generated node_modules/vendor/dist and all QA evidence were separate from the original payload identity.
- Compared with the previous exact candidate, the only production delta is `src/ui/revision-review.js`; added files are the new C UI regression and current manifest. No files removed. The supplied bounded patch applies to the previous UI source and reproduces both corrected candidate files exactly. See source-delta.json and patch-verification.json.
- No earlier feature branch or older implementation supplied the tested runtime. Old verification scripts were reused only as external QA drivers and point exclusively to this new candidate's production dist.

## Environment and exact commands

Node 24.19.0, npm 11.9.0, Python 3.12.14, Chromium 154.0.8037.57 on Debian GNU/Linux 13/Linux x86_64, Playwright 1.58.2. Commands ran from this candidate's semester-space directory.

| Command | Exit | Actual result |
| --- | --- | --- |
| `npm --cache /tmp/ss-npm-cache ci --no-audit --no-fund` | 0 | Clean pinned installation; 21 packages; 39 local PDF/OCR assets. |
| `npm run check` | 0 | 70 modules passed. |
| `npm test` | 0 | 274 passed; no failures/skips/TODOs. |
| `node --test tests/engine/*.test.mjs` | 0 | 26 passed. |
| `python3 tests/checker.py` | 0 | 342 independent Fraction arithmetic cases passed. |
| `npm run build` | 0 | Production static dist built. |

Logs are install.log, syntax.log, full-tests.log, engine.log, arithmetic.log and build.log. No dependency failure was classified as an application assertion. The new mock C fixture supplied in the patch was inspected as evidence; the acceptance below uses actual installed modules, not its mocks.

## Genuine served-origin FV-01 acceptance

The exact production dist was served at `http://127.0.0.1:5290` using the supplied makeServer. The real main.js creates the actual A controller with C UI, importer, B ledger, engine and native localStorage. A DevTools breakpoint exposes that controller for assertions; no source response/module is replaced. Controlled latency wraps delivery of the actual A handler's real result; it does not fabricate a stage result or proposal.

`node fv01-gate-browser.mjs` — **exit 0**:

1. Actual generated PDF uploaded and read through the genuine PDF reader. Explicit page/scope/legacy/effect/coverage review; zero-unresolved comparison.
2. Stage request made, review edited while its genuine result was delayed, then obsolete result delivered. Old proposal remained unapplyable.
3. Corrected review/consent prepared and **successfully staged without rereading the document**. Exactly one Read-selected-calendar click; draft effect IDs retained; real A accepted the new proposal and C authorized only it.
4. A newer stage started while an older stage remained pending. Completing the old one did not authorize stale application or release the newer busy operation; no extra controller call was admitted. Newer completion correctly authorized the current proposal.
5. Document replacement while staging was pending revoked authority; delayed old completion could not restore it.
6. Five real A staging calls, no stored data writes or model revision change from staging; no page errors or external requests.

This directly closes FV-01's previously failing recovery path. The gate has **no reread workaround**. Report: fv01-gate-browser-report.json. Genuine desktop/mobile captures: FV01-corrected-stage-desktop.png and FV01-corrected-stage-mobile.png.

## Import, application, failure and native persistence checks

All these external browser drivers exited 0 against this candidate:

- **initial-browser.mjs:** real supplied four-page timetable and eight-page scanned MAIT calendar selected through actual file controls, PDF/OCR extraction, explicit page/coverage/source reconciliation and synthetic confirmed setup. 9 QA registers/39 sessions saved. Generic page-view confirmation could not complete calendar coverage. Source data decisions are QA only, never personal confirmations.
- **connected-browser.mjs:** genuine revised PDF, legacy hash/filename retention, comparison/staging, actual selective application (2 of 3 changes), daily attendance/append-only correction and official-count discrepancy handling. Existing commitment retained and recalculated as PLAN_BLOCKED after the new exam. Storage failure on official snapshot produced no partial acceptance. Fresh comparison stages without the old FV-01 workaround; delayed replacement remained safe.
- **native-and-negative.mjs:** closed Chromium and reopened the same persistent profile in a new process with **no reseeding**. Exact accepted model/release/source history/snapshots/journal/invalid commitment read back. Ambiguous and insufficiently evidenced changes remained blocked in the UI; actual A apply rejected them without native stored-byte changes. Unresolved proposals may be staged for ephemeral review, not applied.
- **calendar-write-failure.mjs:** native Storage.setItem quota fault during actual calendar acceptance: one attempted write, unchanged model/journal/source metadata/bytes, retained staged proposal for retry and no phantom holiday.

Desktop 1440px and 390×844 mobile viewport screenshots are genuine browser renderings, not mock fixtures. No physical phone or screen-reader claim. Synthetic QA seed, generated notices, source identity, logs and driver scripts are included. Browser clocks are explicitly controlled for reproducibility (24 October 20:00 IST for initial import; 26 October 20:00/20:59 for daily/revision/native tests). Only the controller stamps authoritative confirmation times within those test conditions.

## Deployable output and remaining limits

Deployable output is **`semester-space/dist/`**. The included `SS_FV01_VERIFIED_DIST.zip` has index.html at root and all 72 static files. It matches the tested source and prepared assets; see source-and-build-identity.json and BUILD_INTEGRITY.sha256. Read SAFE_DEPLOYMENT_PROCEDURE.md before any separately authorized publication.

No remaining blocker was reproduced for this bounded gate. Existing limits remain: partial document semantics and OCR diagnostics; Q3 Physics/activity treatment, actual personal counts/policy/horizon and institutional applicability unconfirmed; no universal/held-out format accuracy or greedy-optimality claim; physical devices/screen readers/Firefox/Safari not tested; concurrent-tab serializability not established. The production host/HTTPS/CSP/cache behavior must be smoke-tested after an explicitly approved deployment. This PASS does not claim institutional approval or change D's prior review scope.

Additional spend ₹0. No feature, redesign, unrelated edit, default-branch merge, deployment or Devfolio publication occurred. The previously authorized artifact-only handoff branch may carry the downloadable ZIP; application branches remain unchanged.
