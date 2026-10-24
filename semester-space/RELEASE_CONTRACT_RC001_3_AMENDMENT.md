# SemesterSpace Release Contract — RC-001.3 Amendment (C UI integrated locally)

**2026-10-24 — Authority: A integration owner.** Supersedes only conflicting presentation-bridge details of RC-001, RC-001.1 and RC-001.2. Otherwise all existing contracts, model schema v1, release-envelope v2, journal version 1, engine behaviors and file ownership remain unchanged.

## A. Read-only staged-proposal presentation projection

A's `createController` now supplies **`state.stagedCalendarRevision`** to `render(state, results, callbacks)` and `getState()`. The field is **a deep-copied `CalendarRevisionProposal` v1 object or `null`**, never persisted. It is populated only after a successful `onProposeCalendarRevision({expectedModelRevision, proposal})` return (`code: REVIEW_REQUIRED`), and is cleared after accepted model changes, acceptance of a calendar revision, initial setup replacement, and transition to synthetic demo. Rejected writes must retain existing in-memory state and an already staged proposal. Refresh does not falsely clear staging. Returned/rendered references must not mutate the controller's protected proposal.

This projection is display-only, not a new write callback, file conversion, revision parser, source authority, automatic comparison or authentication. No change to `onProposeCalendarRevision` or `onApplyCalendarRevision` request/result signatures. Any staged proposal remains revalidated and is never itself a persistence guarantee.

## B. UI disposition, submissions and ownership

C's existing `src/ui/index.js`, new `src/ui/release.js`, `src/ui/import.js`, `src/ui/styles.css`, UI tests and `docs/UI_DELIVERY.md` have been merged byte-for-byte. Their synthetic screenshots and request-shape tests are not integrated browser evidence. All saved attendance records remain `ATTENDED | MISSED | NOT_HELD`; `UNKNOWN` is an unsaved, blocking view/draft state. Marks and completed-day consents must be explicit. Accepted revisions cannot rewrite historical attendance and missing source rows do not assert cancellation. UI must never claim a chosen revised-calendar file was processed until Codex/A's file-to-proposal producer actually succeeds.

**C follow-up (owned by C, no A UI edit):** Review the source of the date/time-based UI disable guard against the controller's authoritative transaction clock, especially the fixed synthetic demo clock. Maintain server/controller final validation; do not infer current time from academic dates. No demonstrated wrong persistence was found; this is a clock-source consistency risk.

## C. Integration status and affected workers

- **A:** Owns this presentation projection in `src/controller.js`, read-only projection tests in `tests/integration/rc0013-ui-bridge.test.mjs`, and merging/manifest/deployment. Has NOT connected Codex file-to-revision builder. No changes to engine, existing B attendance logic or source import implementation.
- **B:** No change. RC-001.2 ledger and controller cutover remain authoritative.
- **C:** UI integrated as delivered; fix UI clock consistency if confirmed and return only C-owned bounded diff. Await the Codex file-to-proposal adapter and A's wiring before claiming a functional revision-upload screen.
- **Codex:** Must provide `prepareCalendarRevision` / file-to-proposal conversion and `buildRevisionCandidate` by the current contract without altering attendance, engine, storage or C files. Explicit partial/unsupported states; never treat omissions as cancellations.
- **D:** Read-only review of this exact merged candidate; prioritize persisted-day submission through UI, stale proposals, keyboard/mobile, official reconciliation, retained invalid commitments, reload, and import-missing dependency release gate.

## D. RC-001.3 release gate

Status: **LOCAL UI MERGE ACCEPTED / PRODUCTION RELEASE HOLD**. Node unit and adapter integration passes are not evidence of actual connected origin/reload. Installed full-suite/build and deployed-origin HTTP browser checks remain outstanding. The required 90-minute final verification/deployment/demo/submission reserve is not waived.
