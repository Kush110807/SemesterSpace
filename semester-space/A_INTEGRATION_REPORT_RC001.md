# SemesterSpace A RC-001 — Actual integration evidence

**Owner:** A (controller, storage, migrations). **Status:** CONTRACT ISSUED / A BOUNDARY IMPLEMENTED / RELEASE HOLD. **Date:** 2026-10-24.

## Baseline
- Starting ZIP: `SemesterSpace-D-IMP-01-source (1)(1).zip`.
- Locally computed complete SHA-256: `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2` (exact supplied value).
- Declared (not Git-authenticated) base `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`, repair `9486866f1d8f50d584dc8481d516fefbbe0b638e`, package source `2eb474f955b76eec4476f9f1c473455ade32a29b`.
- D accepted confined D-IMP-01 repair only. No full installed build/browser gate inherited.

## A-owned modifications
1. `RELEASE_CONTRACT.md`: versioned daily attendance and revised calendar interfaces; immutable occurrence IDs; source evidence; explicit complete-day confirmation; rebaseline/corrections; schema v2 envelope; A/B/C/Codex ownership; release gate.
2. `src/storage.js`: read-only v1 -> v2 in-memory migration; engine schema remains 1; same existing storage key `semesterspace.v1`; journal and calendar metadata in a single stored envelope; rejects malformed/unknown schema; duplicate IDs, invalid correction chains, missing official references; detects stale persisted revision before writing; no writes on quarantine.
3. `src/controller.js`: retains existing callbacks; persists release metadata together with Model; controller-stamped official snapshot marker; new `onConfirmAttendanceDay`, `onProposeCalendarRevision`, `onApplyCalendarRevision` callbacks with bounded pure worker adapters; explicit acceptance, stale-model rejection, confirmed-session history preservation, gap and duplicate-day guards, proof of affirmative cancellation evidence, single-envelope persisted-before-state-swap atomic operation, retention of commitments and re-evaluation. Native demo still never writes personal data. New release callbacks reject safely until worker implementations arrive.
4. `tests/integration/release-migrations.test.mjs`: 12 new integration/regression cases for v1 migration, malformed v2, real engine validation on calendar application, rejection, rollback, session-history protection, daily record idempotency, official baselines, stale stored state, missing source cancellation evidence, missing daily occurrences and quota failure.

**No edits** to `src/engine/**`, `src/import/**`, `src/ui/**`, `src/shared/types.d.ts`, the live corpus, source documents, or package dependencies. No Git merge, deployed build or personal attendance confirmation was performed.

## Executed checks — current A worktree

| Command | Observed result | Interpretation |
|---|---|---|
| `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=12000` | FAIL (exit 1), repeated npm registry `EAI_AGAIN`, then npm `Exit handler never called!` | Environment dependency/registry failure; no application assertions executed by install |
| `npm run check` | PASS, syntax-checked 43 modules | Static syntax only |
| `npm test` | 129 passed; **one test-file module-load failure** (exit 1) | `tests/import/draft.test.mjs` cannot load `pdfjs-dist/legacy/build/pdf.mjs`; **not** an application assertion failure; full package suite not clean |
| `node --test tests/integration/controller.test.mjs tests/integration/release-migrations.test.mjs` | PASS, 31/31 | Existing controller and 12 new A integration tests |
| `node --test tests/engine/*.test.mjs` | PASS, 26/26 | Public engine regressions; engine unchanged |
| `python3 tests/checker.py` | PASS, 342/342 | Independent exact arithmetic checker |
| `node --test tests/import/link-effects.test.mjs` | PASS, 28/28 | Repaired coverage-link defenses unchanged |
| `node tests/import/d-imp-01-repro.mjs --run` | PASS (exit 0); controlled attacks rejected | D-IMP-01 bounded reproduction |
| `npm run build` | FAIL (exit 1), `ENOENT` missing `node_modules/pdfjs-dist/build/pdf.min.mjs` | Dependency install blocker, not verified production build |
| live served browser and corpus | **NOT RUN** in this environment | Browser and OCR release gate open; Playwright installation incomplete |

Logs are included in the delivery evidence folder. The 12 A tests use an explicit simulated B/Codex adapter while controller validation uses the real engine; they **do not** prove delivered B/C/Codex feature implementations.

## Integration blockers (not disguised as passes)
1. **B delivery outstanding:** `src/attendance/**` pure `evaluateDayClose` responsible for confirmed baseline plus subsequent unique records, weighted register reconciliation, corrections, no gap inference and conservative mismatch detection. A callback currently rejects if adapter absent.
2. **Codex delivery outstanding:** `src/import/**` `prepareCalendarRevision` and pure `buildRevisionCandidate`, evidence-based comparison, stable identity crosswalk, explicit partial/unsupported detection. A callback currently rejects if adapter absent.
3. **C delivery outstanding:** `src/ui/**` day review/closure and proposed revision change selection; new callbacks are exposed but have no UI integration in this A patch.
4. **Final install/browser/release gate outstanding:** clean dependencies; full tests/build; real served-origin OCR/attendance/revised calendar + native reload; 390px/keyboard smoke, independent D review, deployment/submission.
5. **Data applicability outstanding:** Q/Q3/Q23 only declarations; Physics mapping, activities, counts, weights, policy, teaching horizon unconfirmed. No synthetic test provides real personal confirmations.

## Explicit limitations / watchlist
- Existing legacy preference/schedule edit callbacks retain their original in-memory-on-save-failure behavior; the **new release acceptance paths, official snapshot acceptance and date commitment acceptance** save before state change. Avoid claiming blanket ACID transactions across all UI callbacks.
- Browser localStorage offers one-key write atomicity, **not compare-and-swap across simultaneous tabs**. Controller checks the persisted revision immediately before write, catching ordinary stale tabs; a narrow cross-tab time-of-check/time-of-use race cannot be excluded without a different persistence architecture.
- `onConfirmAttendanceDay` and `onApplyCalendarRevision` have integration boundaries only; their complete semantics require B/Codex workers and independent review. A must audit complete-day arithmetic and affirmative source evidence against actual worker implementations before merging.
- A release with `ATTENDANCE_UPDATE_NEEDED` or `PLAN_BLOCKED` may still retain invalid earlier commitments; do not silently drop them. Acceptance of new break dates still requires passing status.
- No migration claims to reconstruct historic sessions from aggregate v1 snapshots.
- **Release status: HOLD.** Preserve SS-INT-002 fallback. A must reserve the final 90 minutes for tests, browser checks, deployment and submission, not further UX decoration or packaging review.
