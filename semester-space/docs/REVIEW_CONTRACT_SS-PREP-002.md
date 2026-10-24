# SemesterSpace — D independent bounded delta review

**Verdict: BLOCKED — one remaining B2 interface/controller contradiction.**

Packet `SS-PREP-002`, contract `1.1.0`, product revision 2. Scope: the four original B1–B4 issues only. This is **not** a release/engine review. Source inspected from an isolated extraction of the supplied ZIP; no production files changed.

## Findings

| Item | Delta verdict | Evidence |
|---|---|---|
| **B1 invalid result metadata/K** | **READY as interface** | `CONTRACT.md:61–67`, `src/shared/types.d.ts:78–93`, constants and five `makeInvalidInputCases()` fixtures agree: null metadata/K only when unrecoverable; complete INVALID_SETUP and blocked-search envelopes. Controller's `onSuggest` avoids interpolating null K; its targeted test passes. These fixtures construct expected shapes; they do not execute the future real engine. |
| **B2 confirmation-time snapshots** | **BLOCKED (one remaining path)** | `CONTRACT.md:42` explicitly says A generates `confirmedAt` using the same captured clock used to validate, and callbacks cannot supply or edit it. `onConfirmSnapshot` follows this (`src/controller.js:125–130`). Seven fixtures independently cover premature/late/same-day boundary scenarios and their schema/timestamp checks pass. **However**, initial `onReplaceSetup({model})` (`src/controller.js:95–108`) accepts and saves the caller-provided `model.snapshots[0].confirmedAt`, never stamps it, and calls `now()` separately for validation/evaluation. This contradicts the general B2 contract and leaves C unclear whether to supply a timestamp. |
| **B3 final post-commit guard** | **READY as controller wiring** | `src/controller.js:44–67,171–183` constructs the updated model, captures one transaction clock, validates and evaluates before state swap/save, and requires the final evaluation to pass on acceptance. Tests cover preflight-to-final time rollover, post-commit PLAN_BLOCKED, unexpected exceptions, no write/no success notice. Ordinary edits still accept blocked status. These are engine doubles, not live planner evidence. |
| **B4 exact roster match** | **READY as controller wiring** | `src/controller.js:15–22,110–116` verifies identical IDs and every primitive field, independent of row/property order, before calling expansion. Tests verify mismatch prevents expansion/saving and matching roster preserves counts. Again, doubles are used. |

### B2 targeted reproduction (executed with permissive engine double)

Start with no stored model and a model whose initial snapshot has `confirmedAt=2026-11-01 20:00 IST`; inject transaction clock `2026-11-02 08:30 IST`; call `onReplaceSetup({model})`. Observed: saved model **retains** `2026-11-01 20:00`, **one write occurs**, and runtime is `READY`. The test double isolates A's payload/timestamp behavior. It does not establish whether a real validator would allow any particular setup; this timestamp is otherwise chronology-valid.

**Minimal A-owned correction:** In `onReplaceSetup`, capture the transaction clock once; for the newly entered initial confirmed snapshot, have A set `confirmedAt` to that clock, and pass the same captured clock to `validateModel` and `evaluatePlan` before any state swap/write. Keep its original snapshot date and counts; the engine's completed-day validation must still reject a too-early confirmation. Make the contract/UI payload convention unambiguous: for initial setup either permit a placeholder `confirmedAt` that A always overwrites, or define a separate input shape that does not require C to supply it. Add an isolated controller regression for the initial path. Do **not** expand project scope or add a correction-entry feature.

If A intentionally wants to allow imported historical confirmation timestamps, that is a *different* policy: it must be explicitly scoped/verified rather than silently contradict the existing `confirmedAt` provenance rule. That policy change is not recommended for this checkpoint.

## Executed commands and boundaries

| Check | Actual result |
|---|---|
| `sha256sum -c MANIFEST.sha256` | 35/35 entries OK (the manifest itself is excluded) |
| `node --version`, `npm --version` | v22.16.0, 10.9.2 |
| `npm run check` | Passed, 15 JS modules |
| `npm test` | 42 tests: **41 passed, 0 failed, 1 TODO** (engine facade) |
| `npm run build` | Passed; static files copied to `dist/` |
| Extra direct `onReplaceSetup` timestamp probe | **Reproduced B2 contradiction**: supplied historical confirmation retained and saved instead of captured clock |

The engine facade still throws `EngineUnavailable` by design. No real `validateModel`, `evaluatePlan`, `expandSchedule`, or `suggestPlan` implementation was tested. Thus B1/B2 fixture checks are only schema/direct timestamp arithmetic; B3/B4 controller checks depend on doubles. No deployed-origin/browser/release claim is made. This bounded review does not reopen R/T/B, greedy search, UX, or unrelated product scope.

**Transfer to A:** Fix only the initial-snapshot timestamp provenance gap in `onReplaceSetup` and add one targeted test. B/C can continue their independently owned implementation, but C's initial-setup timestamp payload must be aligned before integration. The four-blocker delta becomes READY only after this correction is demonstrated.
