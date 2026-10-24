# SemesterSpace RC-001 — B attendance delivery

**Disposition:** B-owned source implementation delivered for A integration; **not merged, not deployed, not live-browser validated.** Source baseline is the repaired D-IMP-01 ZIP (whole ZIP SHA-256 `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2`). No claim that the declared Git ancestry is independently authenticated.

## Owned additions only

- `src/attendance/ledger.js`: pure journal validation, day draft projection, exact day-close/correction, full-register aggregate derivation, and official-cutover reconciliation.
- `tests/attendance/ledger.test.mjs`: negative and positive source-level tests.
- `docs/ATTENDANCE_DELIVERY.md`: this handoff.

**Unchanged:** `src/controller.js`, `src/storage.js`, `src/engine/**`, `src/shared/**`, `src/ui/**`, `src/import/**`, `RELEASE_CONTRACT.md`, and all pre-existing tests. No added dependency, API, framework or I/O.

## Exact exported interfaces

```js
import {
  createAttendanceJournal,
  validateAttendanceJournal,
  viewAttendanceDay,
  evaluateDayClose,
  deriveAttendanceTotals,
  reconcileOfficialSnapshot,
} from './src/attendance/ledger.js';
```

- `createAttendanceJournal(model)`: `{version:1,records:[],closedDays:[],officialSnapshotIds:[...model.snapshots.map(s=>s.id)],reconciliationIssues:[]}`. Intended for A's v1 in-memory migration (all existing legacy snapshots marked official) or new initial setup, not a write operation. A must validate model before use.
- `validateAttendanceJournal(model,journal)`: `{ok,issues}`; verifies journal shape, official IDs, unique records and day keys, correction chains, exact record/day links, schedule binding and complete active days. A remains responsible for whole-envelope validation/quarantine, serialization and atomic storage.
- `viewAttendanceDay({model,journal,date})`: `{ok,issues,marks,confirmed,dayKey}`. Marks for unconfirmed active sessions are `UNKNOWN` **only in the view**, not persisted. A/C may use this as the initial draft state. It does not save partial drafts.
- `evaluateDayClose({model,journal,request,clock})`: RC-001 pure function; `{ok,issues,proposedJournal,proposedModel,registerTotals}` plus additive `code`, `snapshotId`, `idempotent`. On rejection, proposed values are null. On replay, `idempotent:true` and proposed values are **unchanged references**, with no new revision/snapshot.
- `deriveAttendanceTotals({model,journal,throughDate})`: exact safe-integer all-register totals from **latest official-marked** snapshot plus one effective record for every scheduled occurrence of each consecutively closed post-baseline day through `throughDate`.
- `reconcileOfficialSnapshot({previousModel,journal,officialSnapshot,clock})`: optional B-owned pure helper for A's existing official snapshot path. A constructs an official snapshot with its unique ID, `sequence = previousModel.snapshots.at(-1).sequence + 1`, complete counts and **the same captured authoritative clock**. Returns a new model/journal proposal. Discrepancies are appended as strings in `reconciliationIssues`, never silently folded into old marks.

### A-only integration sketch (illustrative, not a controller patch)

```js
// A obtains expectedModelRevision from the client and checks it in B's evaluator.
// clock() is invoked ONCE; neither UI nor importer controls the timestamp.
const transactionClock = clock();
const candidate = evaluateDayClose({
  model: state.model, journal: release.attendance,
  request: confirmDayRequest, clock: transactionClock,
});
if (!candidate.ok) return {
  ok:false, code:candidate.code, modelRevision:state.model.revision,
  dayKey:null, snapshotId:null, registerTotals:null,
  engineStatus:'ATTENDANCE_UPDATE_NEEDED', issues:candidate.issues,
};
if (candidate.idempotent) return {
  ok:true, code:candidate.code, modelRevision:state.model.revision,
  dayKey:confirmDayRequest.dayKey, snapshotId:candidate.snapshotId,
  registerTotals:candidate.registerTotals, engineStatus:null, issues:[],
};
// A: validate candidate, run engine evaluation with transactionClock,
// serialize envelope v2, perform ONE fail-closed storage write,
// THEN swap model/release in memory and clear suggestions.
// A alone supplies final engineStatus. Never write journal and model separately.
```

### Correction example

```js
// After 2026-11-02 was closed as day:nov02:1:
const corrected = evaluateDayClose({model, journal, clock:transactionClock, request:{
  expectedModelRevision:model.revision, date:'2026-11-02',
  dayKey:'day:nov02:correction-2', correctionOfDayKey:'day:nov02:1',
  marks:[{occurrenceId:'s1',registerId:'lecture',disposition:'ATTENDED',note:'Reviewed correction'}],
  confirmCompleteDay:true, confirmNoUnlistedMeetings:true,
}});
// Appends a newer record and close; never edits the old one.
// Reprojects current confirmed-through day from latest official baseline.
```

### Official cutover example

```js
const officialSnapshot={
  id:`${model.id}:snapshot:${model.snapshots.at(-1).sequence+1}`,
  sequence:model.snapshots.at(-1).sequence+1,
  date:'2026-11-05', counts:officialUserConfirmedCounts,
  confirmed:true, completeToday:false, confirmedAt:transactionClock,
};
const cutover=reconcileOfficialSnapshot({
  previousModel:model, journal, officialSnapshot, clock:transactionClock,
});
// The official baseline is preserved as an official ID. Earlier daily
// records and snapshots survive; future derivation excludes records <= Nov 05.
// A alone commits the pair and presents any reconciliationIssues to C.
```

## Rules and release behavior

1. **No phantom attendance:** `ATTENDED` adds weight to attended and held. `MISSED` adds only weight to held. `NOT_HELD` adds neither. `UNKNOWN` blocks completion. Weights come from `Session`, not user input. Full register counts are derived using safe integer arithmetic; overflow fails closed.
2. **One canonical occurrence:** identity is `Session.id` + `registerId`, checked against the current scheduled occurrence, its original recorded date and weight. A later move/cancellation/register/weight change is a conflict; B will not remap records or count the moved session twice. A/Codex must manage reviewed crosswalks and source revisions; B does not invent them.
3. **Complete actual days:** every active scheduled occurrence on the day requires an explicit mark. `confirmCompleteDay:true` and `confirmNoUnlistedMeetings:true` are mandatory, including zero-session days. Future/unfinished sessions reject. Unresolved previous calendar days reject newer closure, so a completed day can never be inferred from a planned holiday or break.
4. **Idempotency:** repeated `dayKey` with the same normalized marks and correction target succeeds as no-op (even if caller's expected revision is now old); changed evidence using the same key returns `IDEMPOTENCY_CONFLICT`. Different key for already closed day must be an explicit correction of its current active `dayKey`. Corrections append new rows and a new derived snapshot without removing previous rows/snapshots.
5. **Official snapshot:** a newer official snapshot supersedes calculation baseline; only records on dates strictly AFTER its `date` contribute to subsequent totals. A disagreement with derivable journal totals is recorded in `reconciliationIssues`. Incomplete intervals log `OFFICIAL_RECONCILIATION_INCOMPLETE`, not a fabricated outcome. A day on/before the latest official snapshot cannot be corrected with local arithmetic (`REQUIRES_OFFICIAL_RECONCILIATION`).
6. **Clock/revision ownership:** A stamps the transaction clock and performs the single-envelope write. B creates a model candidate with one increment to `model.revision`; `sourceModelRevision` on records and closes points to the input revision. A must not double-increment. Rejected calls return no accepted state.
7. **Preservation:** planned commitments are copied unchanged, never converted to actual missed attendance. The engine's six statuses and schema v1 are untouched. A reevaluates retained commitments after successful atomic commit.

## Contract conflicts to A — NO interfaces changed by B

1. **Disposition vocabulary:** the user's narrative asks for per-occurrence “Cancelled” and “Unresolved records.” RC-001 instead persists `ATTENDED | MISSED | NOT_HELD` and permits `UNKNOWN` only as a draft mark that prevents day closure. B implements exactly RC-001. A must approve a contract delta before introducing a fourth persisted disposition, a durable UNKNOWN draft store, or a cancellation audit record for `Session.cancelled:true` rows. In the current contract, active sessions explicitly marked `NOT_HELD` are auditable, and pre-cancelled scheduled rows are excluded from day marks.
2. **Backdated official snapshot:** engine v1 requires nondecreasing snapshot dates. Therefore B's official helper refuses an official as-of date earlier than the newest already-materialized derived snapshot. Supporting a retroactive official attestation would require an A-approved re-projection protocol and possibly an RC-001 delta; B does NOT rewrite engine or journal chronology.
3. **No complete independent daily draft persistence:** the schema contains closedDays and confirmed DailyRecord rows, but no durable partial draft schema; C drafts remain unconfirmed UI state, and only accepted complete days are durable through A's envelope. A must decide whether persistent unfinished drafts are a separate requirement.
4. **Historical model edits:** B rejects journal conflicts after a previously confirmed occurrence changes date/register/weight/cancelled state. A/Codex must choose KEEP_HISTORY or require explicit correction/reconciliation before allowing such edits. B does not accept a crosswalk supplied outside its declared input.

These items are requests for A's decision, **not modifications to shared interfaces**.

## Actual observed checks and limitations

Run from the extracted repaired baseline, Node.js **22.16.0**:

- `node --test tests/attendance/*.test.mjs`: **47/47 PASS** (focused B tests).
- `npm run check`: **PASS, 44 JS modules** syntax-checked.
- `node --test tests/engine/*.test.mjs`: **26/26 PASS**.
- `python3 tests/checker.py`: **342/342 PASS** independent engine arithmetic cases.
- `npm test`: **164 passed; one `tests/import/draft.test.mjs` module load failure** because `pdfjs-dist/legacy/build/pdf.mjs` is unavailable locally. This is an installed-dependency blocker, **not an attendance assertion failure**.
- `npm run build`: **blocked** by missing `node_modules/pdfjs-dist/build/pdf.min.mjs`.
- No live browser, storage-write, migrated-envelope, installed document extraction/OCR, screen-reader, deployed-origin, actual personal attendance or institution-policy checks executed by B. **A retains the clean npm install, full test/build, atomic persistence and browser release gates.**

A should integrate this B-only diff first; D should independently test the integrated controller/storage write path, repeated day submissions, corrections and snapshot cutovers. This report makes no release/deploy claim.
