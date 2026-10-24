# SemesterSpace Release Contract — RC-001.2 Amendment (B integrated)

**Date:** 2026-10-24. **Authority:** A integration owner. Applies on top of RC-001 and RC-001.1; everything not explicitly clarified remains unchanged. **No new API fields, signature, storage key, model schema, journal version, engine statuses, or file ownership.**

## 1. Integrated B adapter and official snapshots

- The live `src/main.js` imports B's existing `src/attendance/ledger.js` and passes the module to `createController({engine,render,storage,attendance})`. C must use the existing `onConfirmAttendanceDay` callback; no direct browser storage writes.
- When B is supplied, existing `onConfirmSnapshot({date,counts,confirmed,completeToday})` invokes B's `reconcileOfficialSnapshot` using the **single controller-captured transaction clock** and accepts the complete returned model/journal pair in **one save-before-swap envelope**. B must not append a second revision during A commit. This preserves prior confirmed records and appends the official snapshot ID; B's `reconciliationIssues` are retained and C should show their meaning.
- The compatibility path without a B adapter is permitted **only** for legacy controller tests and an empty attendance journal. It must reject an official update when confirmed daily history exists, rather than silently ignoring reconciliation. The production entrypoint always provides B.
- An official as-of date older than the most recently materialized derived/official snapshot is rejected (`REQUIRES_CHRONOLOGICAL_OFFICIAL_SNAPSHOT` at controller entry). Supporting retroactive attestations needs a new explicit versioned protocol; do not reorder the engine's historical snapshots or fabricate corrections.

## 2. Enforced journal and retry boundary

- Existing B dispositions remain `ATTENDED`, `MISSED`, and `NOT_HELD`. `UNKNOWN` is a transient unconfirmed draft-view value and **cannot** be persisted as confirmed attendance. `NOT_HELD` is a positive attestation that the meeting did not take place; a missing extraction row is **not** such an attestation and does not automatically cancel a session.
- An exact `dayKey` retry must match not only date and marks but also **the original correction target**, `confirmCompleteDay:true`, and `confirmNoUnlistedMeetings:true`; mismatches return `IDEMPOTENCY_CONFLICT` and do not write.
- `validateRelease` now calls B's `validateAttendanceJournal` when loading or writing a v2 envelope. Invalid or relocated confirmed occurrence bindings quarantine storage without overwriting the existing bytes. A's existing independent shape and correction checks remain in place; B does not independently perform persistence.
- Durable incomplete UI drafts remain **outside** the persistence contract. C may keep them in local transient UI state and must not present them as confirmed/saved. Adding durable drafts or `CANCELLED` as a fourth persisted mark requires a later explicit contract amendment.
- Recorded occurrence identity and weight/register/date must remain fixed across revisions. A/Codex must reject an effective historical rewrite; recognized future occurrence moves keep stable session identity, and past conflicts require a separately reviewed reconciliation contract.

## 3. Owners informed / next deliveries

| Owner | Action required by RC-001.2 |
|---|---|
| A | Own controller/storage/main wiring, journal validation, mutation atomicity, integrated tests, authoritative tree and final release gate. |
| B | No changes requested. The supplied 3-file pure ledger implementation is merged byte-for-byte. Revisit only on a reproduced engine/ledger defect or explicit interface amendment. |
| C | Use existing day-close and snapshot confirmation callback shapes. Treat `UNKNOWN` as draft only; show `NOT_HELD` distinctly, incomplete intervals and official count discrepancies. On failures never imply persistence. No edits to `src/main.js`. |
| Codex | Continue revision proposal/builder under original contract. Never alter history with a changed source, and never equate an omitted extraction with a cancellation or `NOT_HELD` mark. |
| D | Independently exercise same-key replay with altered correction target, snapshot cutover discrepancies/incomplete intervals, backdated snapshot refusal, moved-session quarantine, failed storage, reload and retained commitments. |

## 4. Gate limitation

The merged B + A local controller integration is covered by actual automated Node tests, **not** a browser-tested C flow or deployed release. The installed PDF.js/Playwright environment and Codex revision builder/C UI remain pending. Final gate stays HOLD. Synthetic tests do not resolve real Q3 Physics, attendance counts, policy or schedule applicability.
