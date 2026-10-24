# SemesterSpace — D independent initial contract review

**Verdict: BLOCKED (narrow, repairable interface/lifecycle issues).**

- Packet: `SS-PREP-001`, contract `1.0.0`, `PRODUCT_SPEC.md` revision 2.
- Scope: initial ~15-minute contract review, **not** a release audit. I read all of `PRODUCT_SPEC.md`, `CONTRACT.md`, `src/shared/types.d.ts`, `constants.js`, `fixtures.js`, `CURRENT_STATE.md`, plus the current A controller, UI boundary and preparation tests. No production source was edited.
- The engine's explicit `EngineUnavailable` placeholder is expected and **is not** a blocker.

## Blocking findings and minimum A-owned corrections

### B1 — Malformed-input promise conflicts with required result fields

**Where:** `CONTRACT.md` lines 50–56 and 72–76; `src/shared/types.d.ts` lines 76–89.

The engine is required to return `INVALID_SETUP`, not throw, for undefined/malformed callers, including missing/invalid `model` or `clock`. Yet `PlanResult.modelRevision: number` and `PlanResult.evaluatedAt: Clock` are mandatory, even if neither valid value exists. For invalid `requestedDays`, `SearchResult.search.requested: number` similarly has no truthful value. B must invent undocumented sentinels or violate the schema.

**Minimal fix:** A defines the exact invalid-input return convention before B/C implement. Prefer `modelRevision: number|null` and `evaluatedAt: Clock|null` in `PlanResult`, with `null` only when the value cannot be validated/recovered; make `search.requested` nullable for an invalid/unreadable K (or explicitly document a sentinel and hide it in UI). Preserve all other fields and the six statuses. Add a small malformed-model/missing-clock schema fixture/test; ensure A/C show setup issues rather than fabricated date/time/K.

### B2 — Snapshot completeness must be verified as of confirmation, not just later evaluation

**Where:** `PRODUCT_SPEC.md` lines 59–65; `CONTRACT.md` lines 40–46; `src/shared/types.d.ts` lines 24–27.

The spec requires a **completed-day** snapshot, including confirmation on its own day only after all attendance sessions have ended. The contract names `confirmedAt` but does not explicitly require `confirmedAt.date >= snapshot.date`, nor does it explicitly bind same-day completeness to `confirmedAt` instead of the clock of a later evaluation. Example of an impossible saved baseline: a snapshot dated Nov 2 confirmed at Nov 2, 08:00 although a counted session starts at 09:00; if checked only at a Nov 3 clock, Nov 2 sessions are now excluded (`date <= S`) and their outcomes could disappear.

**Minimal fix:** A explicitly mandates in validation: each snapshot's `confirmedAt` is a valid college-local clock no later than the injected evaluation clock and not before snapshot date; where `confirmedAt.date===snapshot.date`, `completeToday===true` and confirmation time is at/after the end of every active recorded attendance session on S, with user confirmation of no further meetings. Same-date corrections remain ordered by sequence. Add boundary cases for a prematurely confirmed prior-day snapshot and a snapshot whose date is later than `confirmedAt.date`. This is a rule clarification, not a new feature.

### B3 — Current controller can commit after its own final evaluation becomes stale (reproduced)

**Where:** `src/controller.js` lines 152–164 and 36–49; `CONTRACT.md` lines 99–104; `PRODUCT_SPEC.md` lines 60–65 and 119–120.

`onAccept` evaluates selected dates at a fresh time, then calls `transact`, which fetches the clock again and evaluates the committed model **without checking that its result passes**. At a session-start minute boundary, the first evaluation can pass at 08:59 and the second can return `ATTENDANCE_UPDATE_NEEDED` at 09:00, yet the commitment is still persisted and the notice claims success.

**Executed reproduction (independent test double, not the real engine):** the controller saved a `2026-11-02` commitment while the last evaluation status was `ATTENDANCE_UPDATE_NEEDED`; notice was “Selected dates committed together.”

**Minimal fix:** A makes acceptance one atomic fresh-clock checked transition: validate/re-evaluate the exact post-commit model and require a passing result **before** swapping/saving state. Use a single captured acceptance clock across preflight/commit evaluation, or guard the last evaluation's status and abort all writes. Add a time-boundary regression that confirms no commitment and no saved success message after the clock advances.

### B4 — `onInitializeSchedule` accepts a draft roster but silently discards it (reproduced)

**Where:** `src/shared/types.d.ts` lines 35–39, 106–110; `CONTRACT.md` lines 30–36 and 86–89; `src/controller.js` lines 92–97.

`ScheduleDraft` includes `courses` and `registers`. The public controller callback accepts the whole draft and installs `draft.schedule` and the expanded `sessions`, but leaves `model.courses` and `model.registers` untouched. If the draft roster differs, expanded sessions can refer to missing registers; B/C have no stated invariant forbidding this payload.

**Executed reproduction (permissive test double to isolate wiring):** after `onInitializeSchedule` with a new `new-reg`, installed sessions referenced `new-reg` while model registers still contained only `lecture`.

**Minimal fix:** Since snapshots reference existing registers, the simplest bounded fix is to *require* `draft.courses`/`draft.registers` to match the model roster and reject mismatches, explicitly defining that invariant in the callback contract. Alternatively atomically adopt the roster only with correctly remapped/confirmed snapshot counts; this is larger and not necessary for this checkpoint. Add one rejection test. `onReplaceSetup` can already initialize a complete initial model.

## No blocking mismatch found in these checked areas

- **R/T/B:** `F=max(R,T or R)+B`, exact basis-point arithmetic, default 300 bp, F up to 10000 bp; optional personal T cannot lower requirement; no clamping. `CONTRACT.md` lines 24–26 and fixture targets agree with revision 2.
- **Joint arithmetic:** Combined baseline 79/100 and two one-unit sessions -> 81/102 if both attended; 80/102 if one missed; 79/102 if both missed, first failure at second session `s2` under F7800. Chronology from 40/50 fails at second missed unit, 40/52. Exact 39/50 is F7800 boundary; 77999/100000 remains below F even if rounded display is 78.00. `0/0` is neutral; first missed 0/1 fails, first attended 1/1 passes.
- **Recovery:** 37/48 -> 38/49 (still short) -> 39/50 (first recovery, `s2` on Nov 4). In the recovery fixture, Nov 3 misses only practical `p2` before lecture recovery; projected practical is 11/12, still above F. At F100 with an initial absence, exact recovery is impossible.
- **Whole semester vs hard range:** candidate dates are constrained by the hard range, while `evaluatePlan` considers all active sessions through teaching end and all current future commitments; K counts new dates. Greedy ranking/rejection/termination is stated without optimality claims.
- **Linked events/weights:** session ID linkage, move/cancellation semantics, separate zero-unit compulsory events, atomic positive integer weights and cancellation effects are specified. Six plan statuses, search outcomes, date markers and subset-acceptance payloads are otherwise compatible.
- **Ownership:** B's `src/engine/**`, C's `src/ui/**` and A's controller/shared/state paths are non-overlapping. Minor wording cleanup: `CONTRACT.md` line 11 gives A all `docs/**` while lines 12–13 also assign `docs/ENGINE_DELIVERY.md` to B and `docs/UI_DELIVERY.md` to C. Add those two explicit exceptions; no redesign necessary.

## Commands and actual results

Commands run against a separate unpacked copy of the provided ZIP, without changing the uploaded ZIP or production paths:

| Check | Result |
|---|---|
| `sha256sum -c MANIFEST.sha256` | All listed files `OK` (packet-byte integrity) |
| `node --version` / `npm --version` | v22.16.0 / 10.9.2 in reviewer environment |
| `npm run check` | 14 JavaScript modules syntax-checked; pass |
| `npm test` | 25 tests total: **24 pass, 0 fail, 1 TODO** (engine placeholder) |
| `npm run build` | Static build produced `dist/`; pass |
| Separate controller test-double reproduction | Demonstrated B3 stale acceptance and B4 schedule-draft roster mismatch |

Fixture arithmetic tests were **executed independently of the real engine**. B's real `evaluatePlan`, `validateModel`, `expandSchedule`, and `suggestPlan` remain **UNRUN** as behaviors because the facade intentionally throws `EngineUnavailable`. Browser/mobile/deployed-origin checks, personal state reload and official hackathon-submission verification were **not performed in this D checkpoint**. The Git source commit in `BASELINE.txt` cannot be independently reconstructed/verified from a ZIP without its `.git` history; manifest byte hashes were verified.

## Transfer to A — exact next action

A should repair/document **B1–B4 only**, add tightly targeted regression checks, update `CONTRACT.md`, `src/shared/types.d.ts` (where needed), controller/tests, fixture/version metadata, and `CURRENT_STATE.md`, then issue a new numbered transfer baseline for B/C. Do not send uncorrected SS-PREP-001 as an approved interface. Once those fixes are in place, rerun `npm run check`, `npm test`, and `npm run build` and have D verify only the deltas if necessary. B and C should work against the **same revised contract**. Do not infer app correctness from controller doubles or static-build success.
