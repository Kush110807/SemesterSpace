# SemesterSpace — Release Contract RC-001

**Status:** A integration contract, issued 2026-10-24. **Authority:** A owns integration and deploy. This contract defines new interfaces; it does not claim B/C/Codex implementations or an end-to-end release passed. Previous engine `CONTRACT_VERSION = 1.1.0`, its six statuses, `Model.schemaVersion = 1`, and its exact integer arithmetic remain unchanged.

## 0. Trust, scope, clocks

- The repaired ZIP with whole-file SHA-256 `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2` is the **only source baseline**. Package metadata declares base `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`, repair `9486866f1d8f50d584dc8481d516fefbbe0b638e` and package source `2eb474f955b76eec4476f9f1c473455ade32a29b`; those Git identities are not independently proven without `.git`.
- Date `YYYY-MM-DD` and time `HH:mm`, Asia/Kolkata clock `{date,time,timeZone:'Asia/Kolkata'}`. **Controller** captures one transaction clock per attempted acceptance, validation, derived computation and pre-commit evaluation. The UI/importer must never supply authoritative `confirmedAt` or session `observedAt`.
- `model.revision` is the optimistic concurrency token for **all** persisted model/release operations. Engine reads schema-1 `model`, not raw unconfirmed daily records. No worker may mutate this field or commit direct storage writes.
- User declarations: Section Q, practical subgroup Q3, programming Q23. Physics mapping, activity treatment, actual attended/held counts, policy, source applicability, and confirmed teaching horizon are unresolved. No test fixture establishes them.

## 1. Stable occurrence identity (B/A/Codex)

`Session.id` remains the immutable canonical **occurrenceId**. Weekly generated identity stays `weekly:${templateId}:${originalServiceDate}`; the *original service date*, not editable current date, anchors the ID. `extra` rows keep their once-generated `id`. Do not derive IDs from display name, index, the revised document row number, modified start time, or re-import order. Course/register/template IDs must remain stable. An explicit rescheduling of the same recognized occurrence retains `id` even when `date/start/end` change; a truly added occurrence gets a new ID; cancellation retains the row with `cancelled:true` (do not delete it or reuse its ID). Ambiguous match => `NEEDS_REVIEW`, no automatic linkage.

Canonical immutable attendance key: `occurrenceId` (session.id) + `registerId` for identity binding; a changed register, weight, or date after recording is a historical conflict requiring review, not a quiet attendance rewrite. `Session` owns scheduled weight and register; **attendance cannot override them**. Recognized old/new crosswalk must be explicit in proposed revision. Imported sources are untrusted suggestions.

## 2. Daily attendance draft and completed-day confirmation (B -> A controller -> C)

Journal is a durable, separately typed object alongside the model in the **same versioned storage envelope**, never a `model.commitments` row. Shape (all arrays JSON-serializable):

```ts
type DayMark = {occurrenceId:string; registerId:string;
  disposition:'ATTENDED'|'MISSED'|'NOT_HELD'|'UNKNOWN'; note:string};
type ConfirmDayRequest = {expectedModelRevision:number; date:DateKey;
  marks:DayMark[]; confirmCompleteDay:true; confirmNoUnlistedMeetings:true;
  dayKey:string; correctionOfDayKey?:string}; // stable replay token; correction explicitly names old close
type DailyRecord = {recordId:string; dayKey:string; occurrenceId:string;
  registerId:string; date:DateKey; weight:number;
  disposition:'ATTENDED'|'MISSED'|'NOT_HELD'; confirmedAt:Clock;
  recordRevision:number; supersedesRecordId:string|null;
  sourceModelRevision:number; note:string};
type DayClose = {dayKey:string; date:DateKey; recordIds:string[];
  confirmedAt:Clock; sourceModelRevision:number;
  noUnlistedMeetings:true; supersedesDayKey:string|null};
type AttendanceJournal = {version:1; records:DailyRecord[]; closedDays:DayClose[];
  officialSnapshotIds:string[]; reconciliationIssues:string[]};
type AttendanceResult = {ok:boolean; code:string; modelRevision:number;
  dayKey:string|null; snapshotId:string|null;
  registerTotals:Record<string,{attended:number;held:number}>|null;
  engineStatus:string|null; issues:{code:string;message:string;occurrenceId?:string}[]};
```

**B owns** a pure no-I/O `evaluateDayClose({model,journal,request,clock})` returning `{ok,issues,proposedJournal,proposedModel,registerTotals}`; no state changes. **A owns** `callbacks.onConfirmAttendanceDay(request)` and the sole write/accept path. **C owns** draft collection, explicit confirmation and result display. A will expose a controller operation returning `AttendanceResult` (the legacy `guarded` callbacks render errors but do not return results; new operations must return their result so callers can distinguish acceptance/rejection). For the first version, B must demand a mark for every **scheduled occurrence active on the requested day**, with exact ID/register/weight correspondence. `UNKNOWN` disallows day closure. `NOT_HELD` must be explicitly confirmed and only suppresses that occurrence's held units; it is not synonymous with `MISSED`. Double marks, omitted rows, copied keys, future or currently in-progress sessions and unlisted-meeting uncertainty all block closure. A day containing **zero meetings** can be closed only after explicit `confirmNoUnlistedMeetings`, never by assumption. A planned absence does not automatically become a missed record.

### Count reconciliation and idempotency

- Source of truth for derived totals = **latest official confirmed baseline counts** plus **latest effective, confirmed attendance for eligible occurrences strictly after that baseline date and through the proposed day**. Sum per register in exact safe integers: attended += weight only for `ATTENDED`; held += weight for `ATTENDED` or `MISSED`; `NOT_HELD` adds neither. No fractional/inferred credit.
- Daily-derived engine snapshots are materialized with full counts for *all* registers, `confirmed:true`, `completeToday` according to clock rules, controller-stamped `confirmedAt`, sequence increasing and `attendanceConfirmation` advancing only across consecutive fully closed days. They are projections of the journal, **not new institutional attestations**. Earlier snapshots/record revisions remain in history, with origin metadata in journal (officialSnapshotIds), and no double addition when day is retried.
- An unchanged `(dayKey, normalized request)` retry is **idempotent** (no added records/snapshot/revision); reuse with different data is rejected as `IDEMPOTENCY_CONFLICT`. A correction must explicitly target a previously closed day and supply an expected revision and a new dayKey; append superseding records/closure, never delete history. Reject multi-step gaps, overlapping windows or inconclusive prior sessions. If a corrected day is within already-materialized daily snapshots, regenerate a **new superseding derived snapshot** for the current confirmed-through day from the latest official baseline, keeping older snapshots. For a correction on or before the latest **official** baseline date, do not adjust derived counts automatically: return `REQUIRES_OFFICIAL_RECONCILIATION`. Never subtract from an official baseline or count an old record twice.
- `onConfirmSnapshot` remains supported as **explicit official baseline**. A new official snapshot supersedes the prior calculation baseline, retains earlier snapshots and journal records, marks its ID as official and does not replay records dated on or before the official snapshot. The authoritative `confirmedAt` is always captured by A. If its counts conflict with journal-derived counts, record the discrepancy; do **not** silently edit recorded dispositions. If day closure has unresolved elapsed occurrences, engine should report `ATTENDANCE_UPDATE_NEEDED` rather than advance confirmed attendance.

**Example request:**
```json
{"expectedModelRevision":12,"date":"2026-11-02","dayKey":"day:2026-11-02:draft-a1","marks":[{"occurrenceId":"weekly:lecture-mon:2026-11-02","registerId":"lecture","disposition":"ATTENDED","note":""},{"occurrenceId":"extra:lab-2026-11-02","registerId":"lab","disposition":"MISSED","note":""}],"confirmCompleteDay":true,"confirmNoUnlistedMeetings":true}
```
**Example success (illustrative only, not personal counts):**
```json
{"ok":true,"code":"DAY_CONFIRMED","modelRevision":13,"dayKey":"day:2026-11-02:draft-a1","snapshotId":"semester:snapshot:8","registerTotals":{"lecture":{"attended":38,"held":49},"lab":{"attended":9,"held":12}},"engineStatus":"MEETS_PLANNING_RULES","issues":[]}
```
**Example rejection:**
```json
{"ok":false,"code":"UNRESOLVED_OCCURRENCES","modelRevision":12,"dayKey":null,"snapshotId":null,"registerTotals":null,"engineStatus":"ATTENDANCE_UPDATE_NEEDED","issues":[{"code":"MISSING_MARK","message":"Every elapsed active occurrence must be resolved.","occurrenceId":"weekly:lecture-mon:2026-11-02"}]}
```

## 3. Revised-calendar stage / compare / apply (Codex -> A controller -> C)

Importer **never** calls `onReplaceSetup` for an existing model and never mutates controller/storage. It supplies pure draft extraction, a versioned **proposal** and evidence to A. Proposed interface:

```ts
type CalendarRevisionProposal = {
 proposalVersion:1; proposalId:string; baseModelRevision:number;
 source:{sha256:string;fileName:string;role:'ACADEMIC_CALENDAR';coverage:'COMPLETE'|'PARTIAL'|'UNSUPPORTED';section:string|null;pageRefs:string[]};
 scope:{start:DateKey;end:DateKey;section:string;subgroup:string|null;programmingGroup:string|null};
 changes:CalendarChange[]; unresolved:{code:string;sourceRef:string;message:string}[];
 createdAtUntrusted:string|null;
};
type CalendarChange = {changeId:string;
 kind:'ADD_SESSION'|'EDIT_SESSION'|'CANCEL_SESSION'|'ADD_HOLIDAY'|'REMOVE_HOLIDAY'|'REPLACE_PATTERN'|'UPSERT_EVENT'|'TEACHING_END';
 occurrenceId:string|null; before:object|null; after:object|null;
 evidence:{sourceId:string;page:number|null;excerpt:string;
  basis?:'EXPLICIT_CANCELLATION'|'REVIEWED_OFFICIAL_CORRECTION'|'DIRECT_SOURCE'};
 match:'EXACT_ID'|'REVIEWED_CROSSWALK'|'ADDED'|'AMBIGUOUS';
 affectsConfirmedHistory:boolean};
type ProposeRevisionRequest = {expectedModelRevision:number;proposal:CalendarRevisionProposal};
type ApplyRevisionRequest = {expectedModelRevision:number;proposalId:string;
 acceptedChangeIds:string[]; confirmedSourceCoverage:boolean;
 historicalResolutions:{changeId:string;action:'KEEP_HISTORY'|'EXPLICIT_CORRECTION_REQUIRED';reason:string}[];
 confirmation:true};
type RevisionResult = {ok:boolean;code:string;modelRevision:number;
 appliedChangeIds:string[]; preservedCommitmentIds:string[];
 engineStatus:string|null; issues:{code:string;message:string;changeId?:string}[]};
```

**Codex owns** `prepareCalendarRevision({currentModel,existingSourceRevision,extractedDraft})` and `buildRevisionCandidate({model,proposal,acceptedChangeIds,clock})`: pure, deterministic, no persistence. The proposal must include *all* competing additions/changes/cancellations, provenance/coverage holes, stable-identity crosswalks and reasons. `CANCEL_SESSION` and `REMOVE_HOLIDAY` must carry affirmative `evidence.basis` (`EXPLICIT_CANCELLATION` or `REVIEWED_OFFICIAL_CORRECTION`); a missing extraction row is not affirmative evidence. **A owns** `callbacks.onProposeCalendarRevision(request)` (stores *ephemeral* staged proposal and validates model revision; no model write) and `callbacks.onApplyCalendarRevision(request)` (explicit confirmation, single captured clock, validated atomic model+journal+source metadata write). **C owns** review UI, showing unchanged/added/moved/cancelled rows, provenance, calendar-specific warnings and consequences.

- **Absent extracted rows are NOT automatic cancellations**, including after a changed file or apparent lower page count. `REMOVE_HOLIDAY`/`CANCEL_SESSION` need positive source evidence or confirmed institution-specific reconciliation; unsupported/partial coverage creates unresolved review items. A proposal with remaining `AMBIGUOUS`, unapproved scope, or unreviewed effect blockers cannot apply.
- Revisions to sessions with already-confirmed attendance cannot silently cancel, move, change register/weight, or remap IDs. Preserve historical instance and require an explicit correction policy and resulting reconciliation (or reject); never recreate fabricated attendance. An official new calendar cannot retroactively overwrite the attendance journal.
- A duplicate proposal ID + same digest is idempotent; duplicate ID + altered contents rejected. Stale `baseModelRevision` rejects. The importer must distinguish `REVIEW_REQUIRED`, `PARTIAL`, `UNSUPPORTED`, `UNREADABLE`; do not treat OCR confidence as institution confirmation.
- Atomic commit: clone model and journal; apply all accepted changes or none; validate ID/schedule/historical constraints and engine, capture one transaction clock, commit **one storage envelope** (fail closed on storage errors), then swap in-memory state, clear stale suggestions and re-evaluate **all** retained commitments. A blocked existing commitment is retained and marked invalid, not silently deleted. Post-commit engine status may be `PLAN_BLOCKED` due to retained commitments; this does **not** license dropping commitments, but must be reported.

**Example request:**
```json
{"expectedModelRevision":13,"proposalId":"revision:sha256:abcd","acceptedChangeIds":["change:holiday:2026-11-06"],"confirmedSourceCoverage":true,"historicalResolutions":[],"confirmation":true}
```
**Example result:**
```json
{"ok":true,"code":"REVISION_APPLIED","modelRevision":14,"appliedChangeIds":["change:holiday:2026-11-06"],"preservedCommitmentIds":["semester:commit:8:2026-11-06"],"engineStatus":"PLAN_BLOCKED","issues":[]}
```

## 4. Versioned persistence and migration (A only)

Use the existing **single** localStorage key `semesterspace.v1`; **do not scatter** state across separately written keys. Envelope v2 extends the envelope only, leaving the schema-1 engine model unchanged:

```json
{"schemaVersion":2,"model":{"schemaVersion":1,"revision":14},"release":{"version":1,"attendance":{"version":1,"records":[],"closedDays":[],"officialSnapshotIds":[],"reconciliationIssues":[]},"calendar":{"version":1,"appliedRevisions":[],"sourceRevision":null}}}
```

The `model` fragment above is illustrative and **not a valid standalone model**. On loading historical `{"schemaVersion":1,"model":ModelV1}`, do a pure in-memory migration with empty journal, and mark all existing snapshots as prior official/legacy baselines (no reconstructing fabricated per-session records). Do not write the migration until a real confirmed user change is committed. On loading v2, validate envelope, model via existing engine, record uniqueness, closed-day/record links, bounds and source metadata before trusting; unknown future schema, malformed records, invalid JSON, storage failures => quarantine **without overwriting**. The persisted envelope must be single-written after dry-run serialization and evaluation; failed persistence means **zero in-memory accepted change**. Maintain `storage` exact key and wrap `getItem`/`setItem` exceptions.

Migration is one-way and does not drop old snapshots/commitments. No background migration, automatic source deletion, or silently generated attendance. A owns `src/storage.js`, `src/controller.js`, new `src/release/**` integration code and `tests/integration/release-*.test.mjs`. B/C/Codex should not edit these paths. The existing helper `loadModel` keeps legacy `{model,persistence}` compatibility and adds `release`; `saveModel(storage,model,release?)` remains backward-compatible.

## 5. File ownership and delivery boundary

| Owner | Exact files | May provide | Must not modify |
|---|---|---|---|
| **A** | `src/controller.js`, `src/storage.js`, `src/shared/constants.js` (envelope-only constant if needed), `src/release/integration*.js` (new), `tests/integration/release-*.test.mjs`, `RELEASE_CONTRACT.md`, integration/release reports | Controller callbacks, single-envelope migrations/atomic write, cross-worker adapter, deployment | Engine calculations, importer extraction, C UI |
| **B** | `src/attendance/**` (new), `tests/attendance/**` (new), `docs/ATTENDANCE_DELIVERY.md` | Pure ledger reconciliation, weighted register totals, official-baseline/day-close/correction validation | `src/controller.js`, `src/storage.js`, `src/engine/**`, `src/shared/**`, C and importer paths |
| **C** | `src/ui/**`, `docs/UI_DELIVERY.md`, `tests/ui/**` (if new) | Day review, correction/revision confirmation and failure visibility | Controller/storage/engine/importer paths |
| **Codex** | `src/import/**`, `tests/import/**`, `docs/IMPORT_DELIVERY.md` | Diff proposal, stable crosswalk, provenance/coverage, partial/unsupported handling | Controller/storage/engine/shared/UI paths |
| **D** | independent review evidence/report ONLY | Strict pass/fail and reproductions | production source; merge/deploy |

Existing `src/shared/types.d.ts` is **A-only** if additive typing is strictly required to wire callbacks; coordinate a versioned contract delta before touching it. Every worker should deliver a small focused diff plus actual commands/exits, unexecuted boundaries, and explicit stale-revision behavior. A alone cherry-picks/integrates.

## 6. Release gate / final 90 minutes

1. Clean `npm ci --no-audit --no-fund` (no registry failures), `npm run check`, full `npm test`, `node --test tests/engine/*.test.mjs`, `python3 tests/checker.py`, `npm run build` all genuinely pass; no installed-tool absence counted as assertion failure.
2. Browser served-origin workflow on real installed dependencies: initial documents/OCR, partial coverage, manual completion, attendance closure/failed closure/correction, official baseline, revision proposal/change selection/apply, retention and invalidation of commitments, reload. Negative tests: missing extracted row, ambiguous identity, stale revision, duplicate dayKey, conflicting count and failed write.
3. Check old v1 persisted model migrates without fabricating journal entries; unknown and corrupted envelopes quarantine intact. Verify no double count at snapshot cutovers and historical corrections.
4. D independent integration review. Only after passed gate: deploy and prepare submission. Reserve **last 90 minutes** for verification, deployment and submission (not decorative work). If install/browser gate cannot run, report HOLD and keep SS-INT-002 fallback; do not assert a published working release.

---

## RC-001.1 — Explicit amendment (2026-10-24)

The contract is now **RC-001.1**, extending (not replacing) RC-001. The full dated amendment is `RELEASE_CONTRACT_RC001_1_AMENDMENT.md`, which is normative and must accompany the main contract to B, C, Codex and D. No API shapes, engine schema, persistence schema, storage key or worker file ownership are changed. A additionally owns the single atomicity-expectation update in `tests/integration/controller.test.mjs` and future `src/main.js` adapter wiring only.

Affected owners and precise obligations are set out in the amendment. Its main effects are save-before-swap for **all** controller mutations, append-only journal/verified mark acceptance, linear day-correction chains, idempotent dayKey retries on stale original revision, and conflict protection for repeated calendar proposal IDs. All other RC-001 provisions remain in force.


---

## RC-001.2 — Integrated B attendance amendment (2026-10-24)

This contract is now **RC-001.2**. The normative companion `RELEASE_CONTRACT_RC001_2_AMENDMENT.md` clarifies live B integration, official snapshot reconciliation, persisted-journal validation and dayKey replay targets. It introduces no new request/result field or storage format. **C and D must read this amendment; B and Codex are unaffected except for the explicit historical-identity restriction already in RC-001.**

---

## RC-001.3 presentation bridge amendment (2026-10-24)

Read `RELEASE_CONTRACT_RC001_3_AMENDMENT.md` together with RC-001.1 and RC-001.2 amendments. A exposes the deep-copied transient `state.stagedCalendarRevision` projection to the renderer; no persistence or mutation interface changes. C's UI is merged locally; Codex's file-to-proposal and build candidate are not yet connected. Release remains HOLD.
