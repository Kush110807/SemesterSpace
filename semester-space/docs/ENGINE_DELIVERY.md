# SemesterSpace — Worker B engine delivery (complete implementation)

**Role:** B, deterministic browser-side planning engine.
**Baseline:** SS-PREP-002, source commit `0899a295d139d02e66a76b0f71005734ea31b50f` (`BASELINE.txt`).
**Contract:** 1.1.0 (`CONTRACT.md`); product specification revision 2.
**Transfer:** B-owned files only; A integrates and commits. This is not a replacement application.

## Owned paths supplied

- `src/engine/index.js` — exact synchronous exports, no fixture response path.
- `src/engine/common.js` — date-key/clock primitives, BigInt ratio and exact floor helpers.
- `src/engine/validation.js` — full model, references, safe bounds, schedule overlaps, snapshot confirmation-time validation.
- `src/engine/plan.js` — full-semester plan simulation, recovery, protection, freshness, failures, register evidence and date markers.
- `src/engine/expand.js` — one-time weekly expansion, holiday/replacement handling, stable IDs, extras, overrides and all-or-none validation.
- `src/engine/search.js` — finite greedy preferred/adjacency/length/units/date ranking, skip, re-rank, whole-plan trials.
- `tests/engine/first-slice.test.mjs` — golden real-facade decisions and SS-PREP-002 B1/B2 fixtures.
- `tests/engine/pending.test.mjs` — **replaced** the TODO placeholder with real decision/regression tests (no TODO remains in this B-owned file).
- `tests/engine/actual-controller-smoke.test.mjs` — tests A's **unchanged** controller with the actual B engine, storage and callbacks.
- `tests/checker.py` — independent Python `Fraction` feasibility oracle for exhaustive tiny absence subsets.
- `docs/ENGINE_DELIVERY.md` — this handoff.

All paths outside those listed remain owned by A/C and are NOT supplied as edits. No npm dependencies, UI, storage, backend, model API or secrets.

## Exports and behavior

All four exported synchronous functions are now implemented and nonmutating:

1. `validateModel(model,clock)` — `{ok,issues}` for schema 1, context/roster/weights/floors, times/dates, conflicts, all snapshots' own confirmation timestamps (including same-day last-session-end), sequences, gap metadata, future safe cumulative counts, event link consistency, commitments, preferences and clock.
2. `expandSchedule(draft)` — `{ok,issues,sessions}`; weekly template + occurrence ID, replacement weekday substitution, holiday suppression unless explicitly confirmed, extras/overrides by stable ID and overlap rejection, all-or-none.
3. `evaluatePlan(model,{additionalDates,clock})` — six status vocabulary, invalid-input nullable revision/clock (1.1.0), chronological exact attendance per register, R/T/B, 0/0, baseline recovery, full-horizon future attendance, combined commitments/new absences, out-of-horizon and already-off markers, linked/independent compulsory events, first-failure evidence, PLAN-scoped joint conflicts and future-attendance assumptions.
4. `suggestPlan(model,{clock})` — evaluates commitments first; K **new** days, hard candidate range only for new days, blocks unresolved plans, finite ranking/re-ranking and rejected-date skipping, whole-plan evaluation through horizon, preference warnings, batch only for passing nonempty selections. No maximum/optimality claim.

Exact arithmetic uses `BigInt` internally and rounds only string percentages. No raw BigInt reaches serializable results. Date iteration manipulates Gregorian date keys, not local-to-UTC timestamps. Session ordering is deterministic: date/start/end/ID.

## Executed checks (final owned-file version)

Environment: Node `v22.16.0`; Python `3.13.5`.

| Command | Actual result |
|---|---|
| `npm run check` | PASS — syntax checked 22 JavaScript modules. |
| `node --test tests/engine/*.test.mjs` | PASS — **26/26** B-owned tests; 0 TODO. |
| `python tests/checker.py` | PASS — **342** real public-JS decisions match independent Python `Fraction` arithmetic for all small absence subsets generated. Feasibility only; not greedy optimality. |
| `npm test` | **FAIL: 66 passed, 1 failed, 0 TODO (67 total)**. Sole failure is an A-owned *obsolete scaffold assertion* in `tests/integration/controller.test.mjs:133` that insists the real engine must return `ENGINE_UNAVAILABLE`. It now correctly returns `READY`. B does not change this A-owned file. |
| `node --test --test-skip-pattern='scaffold: unavailable real engine'` | PASS — **66/66**, omitting only the obsolete scaffold test; this is not a substitute for A repairing the full suite. |
| `npm run build` | PASS — static files copied. Build success is not browser/deployment validation. |

Real tests cover the goldens (79/100 two absences fail 79/102 at s2, 37/48 recovery reaches 39/50); all 5 malformed-input and 7 timestamp fixture cases; R/T/B and margin-versus-requirement; exact 100% and 0/0; last-failure chronology despite final-ratio recovery; independent registers, atomic weights, count overflow; started sessions and nonteaching-gap freshness; superseded/same-day snapshots; protected/linked/independent events; cancellations and changed commitments; already-off/out-of-horizon/historical commitments; full-horizon validation outside candidate range; holiday/replacement/extra/override expansion, conflicts and stable IDs; search ranking, K, rejections and finite termination; JSON purity; and real controller manual-check/suggestion/commit/persist/invalidation.

The B-owned first validator-only slice was also packaged separately as `SemesterSpace_B_First_Slice_SS-PREP-002.zip`. The **complete** B delivery supersedes it; integrate complete files only once.

## Known limitations and evidence boundary

- **A integration task (required):** Replace/retire the obsolete `ENGINE_UNAVAILABLE` scaffold assertion at `tests/integration/controller.test.mjs:133` with real-facade behavior expectations (and ideally a real input -> result regression). Rerun the unfiltered `npm test` after A's change. Do not alter A's controller merely to satisfy the old test. This is a test expectation conflict, not an engine API change.
- Engine uses the *supplied* timetable, holiday confirmations, attestation of no unlisted sessions, and target basis points. It does not verify college regulations or real attendance. There is no live data discovery.
- Greedy ranking is deterministic but not a proof of maximal feasible days. The independent Python checker validates bounded feasibility/arithmetic decisions, not optimization quality.
- Contract specifies no maximum allowed length for a `startDate..teachingEnd` calendar. Extremely unrealistic multi-year ranges may be expensive to expand/render. A may elect a product-approved size bound; **none has been silently added by B**.
- Browser interaction, mobile/keyboard, live reload, actual static deployment, persistence in a real browser, user testing, and independent D release review: **UNRUN by B**. A/C/D own those checks.
- All files are specific to contract **1.1.0**. If A changes the contract, B must verify the delta before reuse.

## Next integration action

A: unpack **only these B-owned paths** into a backed-up SS-PREP-002/integration tree; verify import and real input-to-engine-to-calendar behavior with C's UI; replace the obsolete A-owned unavailable-stub assertion; rerun unfiltered test/check/build plus browser tests. Inspect file-by-file rather than replacing current app or copying B's old first slice over this full one.

**Proposed contract changes:** NONE. The optional maximum-horizon safety rule above would require A to explicitly decide and version it; B has not changed the accepted semantics.
