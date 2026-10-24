# SemesterSpace A integration report — RC-001.2 / B attendance import

**Status: B source INTEGRATED locally, release HOLD.** Parent A RC-001.1 source ZIP retained as immutable reference; no engine/importer/UI production edits or deployment. The authoritative working tree adds the 3 B-owned source/test/doc files unchanged, plus A wiring, storage validation, snapshot-cutover acceptance, controller regressions and contract amendment.

## Verified delivery identity & ownership

- Received `SEMESTERSPACE_B_ATTENDANCE_RC001_DELIVERY(1).zip`; it contains exactly `src/attendance/ledger.js`, `tests/attendance/ledger.test.mjs`, `docs/ATTENDANCE_DELIVERY.md` plus B's non-production evidence.
- Integrated all three B-owned files byte-for-byte. A changed only `src/controller.js`, `src/storage.js`, `src/main.js`, `tests/integration/release-migrations.test.mjs`, new `tests/integration/release-attendance-real.test.mjs` and A-owned contract/report docs.
- No engine, shared, import or UI production file changed from RC-001.1. Calendar revision callback still needs Codex's pure builder. C's connected attendance/revision UI and D independent integrated review were not supplied here.

## Concrete integration changes

1. The real browser entrypoint injects B's pure attendance module into `createController`.
2. Official snapshot confirmation now uses B's `reconcileOfficialSnapshot` (when available) and atomically persists both model and append-only journal in the existing schema-v2 envelope; declines if B missing while historical daily records exist.
3. Every v2 save/load checks the authoritative B `validateAttendanceJournal` plus existing A invariants. A missing or moved bound occurrence quarantines without rewriting bytes.
4. A rejects replays that reuse a `dayKey` with a changed `correctionOfDayKey`, without either explicit completion confirmation, or altered marks.
5. A integration regressions exercise actual B logic, not controlled stand-ins: attended→corrected missed counts; replay without double-writing; unresolved previous day blocking; official discrepancy; official supersession; zero-session day; reload; write-failure rollback; backdated official refusal; historic occurrence moved quarantine; correction-target tampering.

## Results run against integrated source / Node.js v22.16.0

| Command/check | Actual result |
|---|---|
| `npm run check` | PASS, 46 JS modules |
| `node --test tests/attendance/*.test.mjs` | PASS, 47/47 |
| `node --test tests/integration/release-migrations.test.mjs tests/integration/release-attendance-real.test.mjs tests/attendance/*.test.mjs` | PASS, 73/73 |
| `node --test tests/engine/*.test.mjs` | PASS, 26/26 |
| `python3 tests/checker.py` | PASS, 342/342 |
| `node --test tests/import/link-effects.test.mjs` | PASS, 28/28 |
| `npm test` | 190 tests PASS, one test-module load FAIL (`tests/import/draft.test.mjs` cannot find `node_modules/pdfjs-dist/legacy/build/pdf.mjs`); **no test-assertion failure seen** |
| `npm run build` | FAIL: absent `node_modules/pdfjs-dist/build/pdf.min.mjs` |
| `npm ci --no-audit --no-fund --prefer-offline --fetch-retries=0 --fetch-timeout=7000` | Timed out at 22s; no successful clean installation. Prior A evidence reported registry DNS failure; this specific call produced no diagnostic log. |
| Real C UI, browser OCR, installed Playwright, external hosted origin | NOT RUN |
| Deployed release, institutional/personal validation | NOT RUN |

## Decisions & unresolved work

- RC-001.2 fixes vocabulary: persist only ATTENDED, MISSED, NOT_HELD, never UNKNOWN. A does not add a CANCELLED record or durable unfinished drafts without a new contract.
- Backdated official snapshots stay blocked due to engine snapshot chronology; the user may enter a newer official attestation after the most recent derived date. No retroactive reordering of history.
- Historical confirmed occurrence edits remain fail-closed. Absence of a row in extraction does not prove absence of a session.
- C must supply the connected UI and Codex must supply the real revision builder. D must audit the exact integrated final candidate. No claim that final release is ready or that browser features passed.
- Preserve the final 90-minute verification/deployment/submission reserve. If install or browser gate still fails, keep SS-INT-002 fallback.
