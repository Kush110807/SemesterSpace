# SemesterSpace — A integration report RC-001.4

**Status: CODE MERGED LOCALLY / RELEASE HOLD.** Sole local authoritative source derives from RC-001.3 A+B+C and only overlays Codex-owned paths from commit `6a8d0a09abbfa7cefc0b3cf9a8227fcdb190c115`. No merge/push/deployment. GitHub confirmed this head is **two commits ahead** of source `2eb474f955b76eec4476f9f1c473455ade32a29b` (merge base identical); no controller/UI/engine/storage files changed in Codex branch.

## Changes and exact boundaries

- Imported Codex's `src/import/parse.js`, `revision.js`, `revision-extract.js`, `revision-types.d.ts`; corresponding importer tests/browser evidence and `docs/IMPORT_DELIVERY.md` byte-for-byte from the uploaded archive.
- A changed only `src/main.js` (real revision adapter injection), `src/controller.js` (verified source crosswalk merge and atomic save), `src/storage.js` (additive v1 metadata validation and legacy compatibility), and A's `tests/integration/release-migrations.test.mjs` (controlled fixtures now supply exact source patches). New `tests/integration/rc0014-importer-real.test.mjs` uses Codex's **real** builder with A's actual controller/engine/storage.
- Added `RELEASE_CONTRACT_RC001_4_AMENDMENT.md`; no shared engine/source type, B ledger, C UI implementation or npm manifest changes.

## Actual executed evidence (this merged tree)

- `npm run check`: PASS **56 JS modules**.
- `node --test tests/integration/*.test.mjs tests/attendance/*.test.mjs tests/import/revision.test.mjs tests/import/link-effects.test.mjs tests/import/coverage.test.mjs tests/ui/release-requests.test.mjs`: PASS **202/202** on the final candidate; no failures/skips/TODOs.
- `node --test tests/integration/rc0014-importer-real.test.mjs`: PASS **5/5** including 2 consecutive reviewed revisions, preserved old source link and missing-row restriction, atomic persisted application+reload, storage failure rollback and malformed-source quarantine.
- `node --test tests/engine/*.test.mjs`: PASS **26/26**.
- `python3 tests/checker.py`: PASS **342/342** independent Fraction cases.
- `npm test`: **228 passed, 2 module-load failures** (final candidate). The failed **modules** `tests/import/draft.test.mjs` and `tests/import/layouts.test.mjs` cannot import `node_modules/pdfjs-dist/legacy/build/pdf.mjs`; they did not execute assertions. No failed application assertions in this run.
- `npm ci --no-audit --no-fund --prefer-offline --fetch-retries=0 --fetch-timeout=6000` with a bounded timeout: process killed after wrapper timeout (exit 137); no npm success or final network cause established by this attempt. It left incomplete node_modules. Earlier isolated attempts reported dependency access problems. Do not report this attempt as installed successfully.
- `npm run build`: FAIL before bundle due to missing `node_modules/pdfjs-dist/build/pdf.min.mjs` (`ENOENT`); dependency/asset blocker, not demonstrated engine assertion defect.
- Served HTTP startup: **4/4 asset GETs returned 200** (`/`, `/src/main.js`, `/src/import/revision.js`, `/src/import/revision-extract.js`); this does not prove a browser module graph or interactive flow.
- Real browser upload/review/apply/native-reload workflow: **NOT EXECUTED** here. Codex's file-input and corpus evidence is source-branch evidence, not an integrated candidate pass. C's currently merged file selector still explicitly does not process the selected file; full release is functionally incomplete.

## Critical verified behavior

- A actual-real-module tests verify a reviewed holiday revision through `prepareCalendarRevision` → `onProposeCalendarRevision` → real `buildRevisionCandidate` → `onApplyCalendarRevision` → single saved envelope → new controller reload. A second source with absent prior holiday retains the old holiday and its source lineage after explicit keep, rather than interpreting omission as cancellation.
- Candidate source/target mismatch fails closed. Crosswalk links bind accepted IDs and stable targets. Persisted malformed evidence or invalid source version quarantines without overwriting stored data.
- A retains all B attendance records, snapshots and commitments. No revision history rewrite, planner arithmetic changes, automatic personal confirmation or cancellation-from-absence was introduced.

## Integration blockers / owners

1. **C — P0:** implement file-to-reviewed-draft UI using Codex extraction, source preview, manual scope/coverage/ambiguity/missing-effect review, `prepareCalendarRevision`, then existing stage/apply callbacks. Do not treat `File` selection as an upload or comparison. Also resolve previously identified real-clock vs synthetic-demo-clock inconsistency in daily confirmation UI. No A change to attendance timestamps.
2. **A / environment — P0:** restore verified pinned `npm ci`, build, full installed suite, and actual HTTP Chromium end-to-end tests with real A+B+C+Codex wiring and native storage reload. Resolve any findings, never mask missing assets as assertion failures.
3. **D — P0:** independently review exact RC-001.4 candidate with sources and executable evidence, including source crosswalk persistence/retention and negative malicious/ambiguous proposals. Report no approval from stale fixture screenshots.
4. **Concurrency limitation — D/A review:** The version-2 envelope is saved as one `localStorage` key and rejects a stale revision when observed before writing, but browser `localStorage` supplies no compare-and-swap transaction across two simultaneously writing tabs. A true simultaneous-tab race has not been independently eliminated. Avoid claiming cross-tab serializability.
5. **Student confirmations — separate:** Q/Q3/Q23 declarations are not confirmed Physics mapping, activity treatment, current attended/held counts, academic policy or teaching horizon. Do not invent these from samples.

**Decision:** ACCEPT Codex into A's local integration tree. **HOLD final release** pending functional C review connection and complete installed/browser/deployment gates. Preserve last-90-minute verification reserve.
