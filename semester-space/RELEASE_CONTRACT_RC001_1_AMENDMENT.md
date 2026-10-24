# SemesterSpace Release Contract — RC-001.1 Amendment

**Date:** 2026-10-24
**Authority:** A integration owner
**Supersedes:** RC-001 only where explicitly stated below. All other RC-001 interfaces and ownership restrictions remain in force.

## 1. Compatibility and scope

**No new request/result fields, callback names, engine statuses, engine model schema, envelope schema or storage key.** `Model.schemaVersion = 1`, storage envelope `schemaVersion = 2`, and storage key `semesterspace.v1` are unchanged. The changes below tighten the implementation requirements and make one old failure behavior safer.

### A-owned transaction behavior (A; notify C and D)

Every controller *model mutation*, including ordinary preferences, threshold, course-protection, gap-confirmation, schedule/session/event edits, uncommit, official snapshots and break acceptance, must validate and attempt the **single-envelope save before the in-memory model/release swap**. A failed storage write or persisted-revision mismatch leaves the previous model, journal, snapshots and commitments untouched in memory; report persistence `FAILED`. Demo mode remains in-memory only. Read-only navigation and manual suggestions need not write. The earlier test that permitted in-memory preference updates after a failed save is superseded because it created a phantom accepted change.

For live integration, **A additionally owns `src/main.js` only for importing and wiring B's/Codex's pure adapters into `createController`**. C and Codex must not edit this entrypoint; do not change it before their deliveries are available. A may edit **only the atomic-write expectation** in `tests/integration/controller.test.mjs`, in addition to already-owned `tests/integration/release-*.test.mjs`. C must surface the existing persistence error and must not claim a saved update when storage fails. D should test this rollback against all legacy edit callbacks.

### B attendance journal boundary (B, A; notify C and D)

For every accepted `evaluateDayClose()` result, A now independently checks all of the following against the user's *actual* confirmation request, in addition to engine and schema validation:

- Prior journal `records`, `closedDays`, and `reconciliationIssues` are an **unchanged prefix**; `officialSnapshotIds` are unchanged.
- Exactly **one** new `DayClose` is appended per new dayKey, with exactly **one** new `DailyRecord` for every confirmed mark. Every new record must match the mark's occurrence ID, register ID, date, disposition, note, and the model's scheduled weight, be linked by `recordIds`, and carry the A transaction clock and current source model revision.
- An initial record uses `recordRevision:1` and `supersedesRecordId:null`. An explicit correction uses the immediate preceding day's record ID for the same occurrence, with `recordRevision` incremented exactly once. A correction must keep the same occurrence roster.
- A derived snapshot is appended once, confirmed, with the next sequence and A transaction clock; its date is the just-closed date for new closure, or the previous latest confirmed-through date for a historical correction. It must agree with `attendanceConfirmation`.
- Persistence validation quarantines **two independent closures of one date, forked corrections, multiple active records for a single occurrence, or missing correction links**. An active record must never count twice.
- An exact replay of an already accepted `dayKey` and the same marks is idempotent and writes nothing, including when the client still carries its *original* `expectedModelRevision`. Reusing the key for different marks rejects with `IDEMPOTENCY_CONFLICT`. A *new* dayKey still requires an up-to-date model revision.

These enforce RC-001's existing semantics, without changing B's function signature. B must not rewrite old audit entries, alter official IDs or reuse record IDs. C should reuse the same `dayKey` when retrying a potentially completed submission; for a correction C must generate a new key and explicitly point to `correctionOfDayKey`.

### Codex proposal staging boundary (Codex, A; notify C and D)

A second `onProposeCalendarRevision()` submission with the same `proposalId` and identical serialized proposal is accepted as an idempotent restage. Reusing that ID with different proposal content rejects with `IDEMPOTENCY_CONFLICT`; the previously staged proposal is retained. Codex must use stable proposal identity tied to source/content and not recycle IDs for modified results. No change to the revision apply schema or positive cancellation evidence requirements.

## 2. Actual verification limits

The A-owned checks use a **controlled B adapter** for daily records/correction and a **controlled Codex adapter** for calendar changes; those are not independent B/Codex deliveries. Browser end-to-end confirmation/real OCR and deployed-origin persistence require actual workers, installed PDF/OCR assets, and the C UI. Do not infer completion from synthetic adapters.

## 3. Affected owners and required actions

| Owner | Action | Signature change? |
|---|---|---|
| A | Apply protected storage transactions, journal-boundary assertions, regressions, and future `src/main.js` adapter wiring | No |
| B | Return one immutable append-only, source-matched journal update per full-day close; correction records link the immediate predecessor | No |
| C | Display failed-save state; reuse dayKey for retry; new dayKey for correction | No |
| Codex | Stable proposal IDs; never reuse an ID for modified content | No |
| D | Adversarially test pref rollback, worker-record forgery, correction forks, restart and stale proposal IDs | No |

**Gate remains HOLD** until dependency-complete checks, real served-browser workflow, delivered workers, independent D review, deployment and submission evidence pass. Nothing here is permission to bypass the final verification reserve.
