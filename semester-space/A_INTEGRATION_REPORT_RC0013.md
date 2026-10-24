# SemesterSpace — A integration report RC-001.3

**2026-10-24. Outcome: C UI accepted into local RC-001.2 source; NOT release approved.**

## Source and ownership

Source: supplied `SEMESTERSPACE_RC0012_INTEGRATED_SOURCE.zip` (A+B accepted candidate). The working copy of `src/main.js`, `src/controller.js`, UI and ledger files matched that ZIP before merging. Applied C's exact 8 files: `src/ui/index.js`, `src/ui/release.js`, `src/ui/import.js`, `src/ui/styles.css`, `docs/UI_DELIVERY.md`, `tests/ui/release-requests.test.mjs`, `tests/ui/browser-fixture.py`, `tests/ui/workspace-views-fixture.py`. All eight verified byte-for-byte against C's delivered patch ZIP upon merge. This is local file-level source integration; no Git merge or deployment has occurred.

A updated ONLY `src/controller.js`, `RELEASE_CONTRACT.md` and new A-owned `tests/integration/rc0013-ui-bridge.test.mjs` plus this report and the RC-001.3 amendment. A's controller exposes a deep-copied ephemeral proposal as `state.stagedCalendarRevision`; it does not write proposals, guess source conversions or weaken the stale/atomic gates.

## Actual commands from integrated source

| Check | Actual result | Limit |
|---|---|---|
| `npm run check` | PASS, 49 JS files | Syntax only |
| `node --test tests/attendance/*.test.mjs tests/integration/*.test.mjs tests/ui/*.test.mjs` | PASS 123/123 | Includes 3 read-only staged-bridge tests; no connected browser |
| `node --test tests/engine/*.test.mjs` | PASS 26/26 | Engine unchanged |
| `python tests/checker.py` | PASS 342/342 | Independent arithmetic only |
| `node --test tests/import/link-effects.test.mjs` | PASS 28/28 | D-IMP-01 regression only |
| `npm test` | 196 passing, 1 load failure, exit 1 | `tests/import/draft.test.mjs` cannot import `pdfjs-dist/legacy/build/pdf.mjs`; not a failed assertion |
| `npm run build` | FAIL, exit 1 | `node_modules/pdfjs-dist/build/pdf.min.mjs` absent |
| `npm ci --no-audit --no-fund --prefer-offline` | STALLED and manually killed | No completed install; this specific attempt generated no useful log (previous RC-001.2 reported registry trouble) |
| `python tests/ui/browser-fixture.py` | PASS, 5/5 fixture groups | C synthetic callbacks and in-memory Blob code, not actual A/B integration |
| `python tests/ui/workspace-views-fixture.py` | PASS, 5/5 fixture groups | Synthetic UI and stubbed importer/controller |
| Real app Chromium navigation | BLOCKED before load: `ERR_BLOCKED_BY_ADMINISTRATOR` | Both localhost HTTP and route-fulfilled local origin attempts; cannot claim connected workflow success |

The 196 passing test cases count both existing source tests and C/A additions. The sole failure occurs before the dependent import module's assertions execute. No npm dependency, framework, engine or persistent data was changed to mask it.

## What is working and what is not established

**Locally wired:** C's Today view reads A's release journal and calls the real A `onConfirmAttendanceDay` callback, which already delegates to B; C's presentation of corrections, unresolved marks and failed callbacks is tested with mocks. A's own Node integration tests cover confirmed day/correction, retry, official snapshots, storage rollback, reloaded journal, and retained commitments under a controlled revision builder. The staged revision projection now exists and is not persisted.

**Still missing:** Codex's real file-to-proposal conversion and builder module, A's installation/wiring of this adapter in `src/main.js`, full source import/OCR dependency restoration, actual native browser day confirmation/correction and reload from a served/deployed origin, independent D acceptance, institutional applicability and personal data confirmation. Picking a revised file in C does not yet compare or stage it and is visibly labelled as such. A's apply callback rejects absent builder; missing extracted rows never assert cancellations.

**Potential C consistency issue:** `src/ui/release.js` uses device wall time for the submit disable guard, whereas A's synthetic demo uses `FIXED_CLOCK`. A controlled fixture shows the guard responds to device time, not demo time. In the currently frozen demo (08:00 before its first 09:00 meeting) both clocks disallow that day's closure, so this is a clock-source risk rather than a demonstrated incorrect persisted record. Request C audit; A's controller remains authoritative.

## Release verdict / next owners

**HOLD — NOT DEPLOYABLE.** A retains the one authoritative RC-001.3 local source tree and single-envelope saved model. B accepted, C merged locally, Codex pending, D pending. Defer cosmetic work. Once Codex's bounded delivery arrives, validate source file coverage and cancellation evidence, wire builder/producer, then run installed tests/build and connected browser workflows before final 90-minute release reserve.
