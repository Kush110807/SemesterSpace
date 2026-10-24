# SemesterSpace contract 1.1.0 — baseline SS-PREP-002, A patch P1

Owner A. PRODUCT_SPEC.md is the complete revision-2 product specification and takes precedence. `src/shared/types.d.ts` gives the exact object shapes and callback payloads; `src/shared/constants.js` the status literals; `src/shared/fixtures.js` runnable inputs and arithmetic expectations. These three shared files and this contract change only through A. No dependencies or backend. Plain browser ES modules; Node >=20 for development/tests, Python >=3.10 for the independent checker. Run `npm start`, `npm test`, `npm run check`, `npm run build`.

A has released this corrected contract after applying D's B1–B4 findings against SS-PREP-001. D's original BLOCKED report is retained in docs/REVIEW_CONTRACT_SS-PREP-001.md; independent confirmation of these deltas is pending, not claimed. D's bounded SS-PREP-002 review marked B1/B3/B4 READY and retained one initial-setup B2 gap; A patch P1 corrects that path. See docs/CONTRACT_FIXES.md. Independent approval of P1 is not claimed. The engine facade initially throws `EngineUnavailable`: the shell must never display a synthetic fixture verdict as a live calculation. This exception is a development transport condition, NOT a seventh engine status. B removes it as each function is implemented. The shell catches unexpected errors and disables acceptance.

## File ownership and transfer

| Owner | Exclusive production paths | Test/docs paths |
|---|---|---|
| A integration | `index.html`, `package.json`, `src/main.js`, `src/controller.js`, `src/storage.js`, `src/shared/**`, `tools/**` | `tests/integration/**`, all root/docs/briefs files EXCEPT B/C delivery notes listed below; `.openai/hosting.json` |
| B engine | `src/engine/**`, including public `index.js` facade | `tests/engine/**`, `tests/checker.py`, `docs/ENGINE_DELIVERY.md` |
| C UI | `src/ui/**` including `index.js`, `styles.css` | `docs/UI_DELIVERY.md` |
| D reviewer | None | Return `REVIEW_CONTRACT.md` or `REVIEW_RELEASE.md` separately; isolated tests only after A assigns |

Use baseline label SS-PREP-002 (exact commit in BASELINE.txt). Every separate chat needs the complete attached ZIP: chats do not share this filesystem. B/C return ONLY owned files or a patch against this baseline, not a whole-project replacement. Include role, contract version, baseline, changed paths, commands/results, limitations, proposed interface changes, next integration action. A backs up/commits current code, inspects diff, copies only owned paths, runs affected checks, updates CURRENT_STATE.md. Do not include node_modules, dist, credentials, runtime state or student data. Only A merges.

## Primitive and model invariants

All data is JSON serializable; no raw BigInt, Date, Map or functions in model/results. Field absence is invalid unless the type explicitly permits null. Stable IDs are nonempty strings, unique within each entity kind; never regenerate session IDs on unrelated changes. Course IDs map registers to courses. Each session references exactly one register; snapshot counts must have exactly one entry for every current register. No silent register deletion or remapping.

Dates: strict valid Gregorian `YYYY-MM-DD`. Times: zero-padded local `HH:mm`, 00:00–23:59, start < end, no overnight sessions. Weekdays: ISO Monday=1 … Sunday=7. Time zone fixed `Asia/Kolkata`. Engine accepts a supplied `{date,time,timeZone}`; never calls Date.now, localStorage or the DOM. A supplies a fresh real clock for every evaluation/acceptance; demo uses FIXED_CLOCK in memory. Date iteration must not use UTC conversions that shift the calendar date. Stable session order: date, start, end, ID ascending. Adjacent time boundaries are not overlaps; two active attendance sessions that overlap are invalid. Event markers can overlap sessions intentionally.

Numbers: counts, weights, revisions, snapshot sequences, K and basis points are safe integers. Counts >=0, attended<=held, weight>=1, K>=0; cumulative projected counts <= Number.MAX_SAFE_INTEGER (check before adding). No coercion of empty strings, null, missing values, NaN, infinity or fractions into valid counts. Required/personal basis points in [1,10000]; personal null means blank; buffer>=0. `F=max(requiredBps,personalMinBps??requiredBps)+bufferBps` must be <=10000. Default buffer is 300. 1 bp=0.01 percentage point. Reject excess decimal precision before converting form percentages. No clamp. R75,T85,B3 -> F88; R75,T70,B3 -> F78.

Use exact `BigInt(attended)*10000n >= BigInt(floorBps)*BigInt(held)` internally, or documented safe bounds. Exact checks precede display rounding. `Ratio.percentage` is a two-decimal percentage string without `%`, null for 0/0. Render null as “Not started.” A 0/0 baseline is neutral; the first missed session fails. Displayed `78.00` is never an arithmetic input.

`Model.revision` increments once per accepted relevant transaction (including preferences/K/commitments); stored `schemaVersion=1` governs load. `context.applicabilityConfirmed` and `schedule.confirmed` must be true for real calculations. Synthetic fixtures explicitly identify themselves. No verified MAIT template is supplied. Do not infer a student's section, attendance weights or policy from college name. Notes are not enforced.

## Schedule initialization and later edits

`expandSchedule(draft)` is called ONCE at initialization. `ScheduleDraft.schedule.initialized=false`; generated result is installed as canonical `model.sessions`, then initialized=true. Weekly template ID + ORIGINAL occurrence date yields `weekly:<templateId>:<YYYY-MM-DD>`; a replacement occurrence uses the replacement date. Generated rows have origin=weekly/templateId; explicitly added rows have origin=extra/templateId=null. IDs persist through moves/cancellations. Duplicate generated/extra/override IDs or unknown override targets fail.

For each day in inclusive [startDate,teachingEnd]: pick the confirmed replacement weekday instead of actual weekday if present; otherwise actual weekday. A holiday suppresses recurring rows unless that date is explicitly in holidayTeachingDates. A replacement on a holiday also requires this explicit teaching confirmation. Add explicit extraSessions exactly once and apply overrides by stable ID; an active moved/extra class on a holiday requires confirmation for its destination. An ambiguous replacement, overlap, duplicate, unconfirmed conflict or broken reference yields `{ok:false,issues:[...],sessions:[]}`, never a partially successful schedule. Holidays remain labels even with confirmed teaching. There is no daily duration-to-weight inference. All weights are explicit.

After initialization, canonical sessions alone drive projections. Weekly templates are retained as reference; do not call expandSchedule after count/preference edits. Edit/add/move/cancel individual future sessions. C uses callbacks, not bulk timetable regeneration. Historical/session rows needed to validate today's completed-day snapshot must remain available. A shorter teaching end does not delete rows or commitment records: sessions beyond the new horizon remain reference-only, and uncovered future commitments outside the horizon block new plans.

Events are always compulsory. Independent event: sessionId=null, date/start/end all supplied. Linked event: sessionId points to a stable session, date/start/end MUST all be null. Its effective date/time/cancellation derive from that session. Event.cancelled=true disables it; a cancelled linked session disables its event marker. A move/cancellation then follows without a second state update. An independent event never moves/cancels automatically. Linked events add zero attendance units; the session is counted once. A protected session or mustAttend course blocks a full-day break; cancelled sessions do not. Independent events do not cancel scheduled teaching.

## Snapshot, clock and commitments

Latest snapshot = greatest sequence, including same-date corrections. Sequence strictly increases; date cannot regress. New snapshots replace the baseline counts, not add to them. Keep older snapshots unchanged. A confirms complete counts for EVERY register through one completed local date S. Validate EVERY stored snapshot against its own confirmation time, not merely against the date of a later evaluation. `confirmedAt` must be a valid Asia/Kolkata clock, `confirmedAt.date >= S`, and its local date/time must be <= the injected evaluation clock. If `confirmedAt.date === S`, require `completeToday === true`, confirmation time >= the end of EVERY active recorded attendance session on S, and explicit user confirmation that no further meetings remain. Equality at the final session end is allowed. If confirmation is on a later date, completeToday can be false, but a snapshot dated after its confirmation is always invalid. A snapshot prematurely confirmed before its last session remains INVALID_SETUP on later days; time passing cannot cure it. Invalid confirmation metadata makes the model invalid even if that snapshot is older than the current baseline. Initial data must retain the recorded meetings needed for these checks. Unknown schedules cannot justify completion. A creates confirmedAt from the same captured transaction clock passed to engine validation; callbacks cannot choose or edit the stored timestamp. Initial onReplaceSetup({model}) retains the existing Model input shape: snapshots[0].confirmedAt is only a non-authoritative Clock-shaped placeholder that A ALWAYS overwrites. A captures one transaction clock, stamps the initial snapshot, and passes that SAME clock to validateModel and evaluatePlan before swapping/saving. Preserve the submitted snapshot date/counts and explicit completion flags; the engine must still reject an incomplete same-day snapshot. Stored-state loading is not initial setup and must not restamp historical snapshots.

If ANY active attendance session after S has started by clock (including equality), return ATTENDANCE_UPDATE_NEEDED before simulating; do not assume it attended. A started independent compulsory event blocks selecting today but adds no attendance units and alone does not require new counts. Today's selection is permitted only before every attendance session/event starts and after confirmation that elapsed nonteaching gaps contain no unlisted classes. `attendanceConfirmation={throughDate,noUnlistedClasses:true}` attests this gap; throughDate must not be in the future. When no teaching occurred in an elapsed gap, require confirmation through the current clock date, or at least the last completed elapsed day if today's first obligations have not begun. A new snapshot resets this confirmation to its date; UI can confirm a gap separately. A snapshot through today covers today without an additional gap confirmation.

Projection processes EVERY active session with S<date<=teachingEnd, including outside the candidate window. Future dates after clock are not credited as actual counts. Commitments with date<=S are historical and excluded from simulated absence. Every remaining commitment is included together, including ones outside a newly narrowed search window. A future commitment outside [schedule.startDate,teachingEnd] yields PLAN_BLOCKED and an OUTSIDE_HORIZON marker, not silent omission. Duplicate commitments/selections are invalid.

Existing shortfalls: first evaluate attend-all separately per register. For an initially low register, find the earliest session reaching F, require ALL its meetings through that session, then check F after every later meeting. 37/48 -> 38/49 still low ->39/50 recovered at second meeting. An unrelated-register date can pass before recovery. A missing recovery meeting is a RECOVERY failure even if eventually recoverable later. An existing absence at F100 is unrecoverable. No recovery by end yields EXISTING_UNRECOVERABLE_SHORTFALL; automatic search pauses. Conditional recovery remains CONDITIONAL_RECOVERY even when simulated later ratios reach F. Distinguish R shortage from F-only margin shortage.

## Exact engine exports (synchronous, pure, nonmutating)

All expected invalid input returns issues/results, not throws. Every issue has `{code,path,message}`; `path` is a JSON-style field path, code a stable uppercase identifier. B documents additions in ENGINE_DELIVERY.md and A coordinates them; C displays message text, never branches on arbitrary English. Undefined malformed caller data must produce INVALID_SETUP rather than an uncaught error. Unexpected implementation exceptions reach A's ERROR runtime guard. No method mutates its input.

1. `validateModel(model, clock) -> {ok:boolean,issues:Issue[]}`. Structural, references, bounds, schedule conflicts, confirmations and snapshot validation. A stale elapsed session is structurally valid; evaluatePlan returns the freshness status. Returns no silently normalized model.
2. `expandSchedule(draft:ScheduleDraft) -> {ok,issues,sessions:Session[]}`. Validate draft, generate deterministically as above. No clock or storage. Returns all-or-none rows.
3. `evaluatePlan(model, {additionalDates:DateKey[],clock:Clock}) -> PlanResult`. Includes stored future commitments plus new dates. New dates must be unique, not already committed, active teaching dates, inside candidate range AND projection horizon, with no protection/event. An existing commitment which becomes genuinely free is preserved as ALREADY_OFF, not rejected for having no teaching. Every selected date misses all active attendance units that day. Invalid/missing/duplicate selections fail explicitly; do not deduplicate quietly. Manual dates and automatic candidate trials call this same function.
4. `suggestPlan(model,{clock}) -> SearchResult`. First evaluate commitments with additionalDates=[]. If nonpassing, return batch=null, search.outcome=BLOCKED, found=0. K=0 validates commitments without new dates and returns COMPLETE/batch=null. Otherwise select eligible new teaching dates inside the hard range. Lexicographic ranking: preferred first, larger adjacency count (0/1/2 immediate neighbours genuinely free or already selected/committed), longer resulting contiguous break, fewer attendance units missed, earlier date. Break length bounded to known remaining calendar dates [max(S+1,clock.date,startDate),teachingEnd]; a compulsory event interrupts free days. Re-rank remaining untested dates after each acceptance. Skip rejected candidates permanently, never backtrack. Stop at K or exhaustion. Trial entire accumulated selection with evaluatePlan. A batch's ENTIRE dates array and evaluation must pass jointly. Rejections retain actual evaluation. Preferred dates outside range/horizon, nonteaching or blocked produce preferenceWarnings. No candidates -> NO_CANDIDATES; some candidates exhausted short of K -> EXHAUSTED. This is not a proof of maximum days.

SearchResult.evaluation is the final joint evaluation of commitments plus accepted suggestions (the same as batch.evaluation when a batch exists); with no suggestions it is the commitments-only evaluation. A passing result with zero requested/found days does not create an empty acceptance batch.

## Malformed-input result convention (B1)

Engine entry points must inspect raw arguments before destructuring; undefined/null/malformed model, request or clock must not throw. Keep the six statuses and EVERY result field. For INVALID_SETUP only, `PlanResult.modelRevision` is null when a valid nonnegative safe-integer revision cannot be recovered; otherwise preserve that revision even if another model field is invalid. `evaluatedAt` is null when the supplied clock is missing or invalid (including impossible dates, invalid times or another timezone); otherwise preserve the validated injected clock. Never invent a timestamp, revision0 or sentinel date. For other statuses both fields are non-null. A passing SuggestionBatch always has non-null valid revision/clock in both the batch and its evaluation.

`SearchResult.search.requested` is null only if K cannot be recovered as a nonnegative safe integer; a valid K remains visible even if some other input is invalid. Invalid setup returns batch=null, found=0, considered=0, outcome=BLOCKED, empty rejection/preference-warning arrays and the INVALID_SETUP evaluation. Safe empty arrays and firstFailure=null are allowed in the invalid PlanResult. Issues still supply code/path/message; UI displays them instead of claiming a search ran or interpolating `null` into dates/K. Null evaluation (no calculation) remains distinct from an INVALID_SETUP evaluation object.

`makeInvalidInputCases()` supplies missing-model/clock, invalid-clock/K/revision inputs and complete representative expected envelopes. Issue messages in the examples are illustrative; B can give a more specific issue list while preserving metadata/status/envelope semantics. `makeSnapshotTimingCases()` covers B2 confirmation boundaries; B must run them against real validateModel once implemented. A's fixture-schema/timestamp checks do not establish real-engine validation.

## Results, failure precedence and markers

| PlanResult.status | Meaning |
|---|---|
| INVALID_SETUP | Input/schema/clock/snapshot values or unresolved schedule invalid |
| ATTENDANCE_UPDATE_NEEDED | Actual counts/elapsed gap confirmation not current; no recommendation or acceptance |
| EXISTING_UNRECOVERABLE_SHORTFALL | Attend-all cannot restore one or more initial floors by teaching end |
| PLAN_BLOCKED | Proposed/current combined plan violates attendance, recovery, range or protection rules |
| CONDITIONAL_RECOVERY | Plan passes under required attend-all recovery, starting below F |
| MEETS_PLANNING_RULES | Plan passes supplied rules without an initial recovery shortfall |

Apply the above precedence top to bottom. Within a blocked plan: selection/horizon/protection failures are explained directly; first attendance failure uses stable chronological session order. `issues` can retain multiple distinct setup/protection defects. `firstFailure=null` for non-plan failures unless an unrecoverable register can supply meaningful RECOVERY evidence. Never manufacture a future failing session for an initial unrecoverable shortage. Protection names its event/session. Attendance failure includes register, exact attended/held, displayed percentage, R, F, session, date, sorted combinedAbsenceDates affecting that register through failure. This list is NOT a minimum causal set.

PlanResult always contains all fields in types.d.ts. For invalid input safe empty arrays are allowed. Registers contain initial/final actual projected counts, R/F, initial shortage classification and baseline recovery. `dates` cover the known remaining local calendar plus historical/outside-horizon commitments needed for display. A PLAN-level joint failure marks relevant COMMITTED dates INVALID_COMMITMENT with conflictScope=PLAN and a combined explanation, not “each date individually impossible.” Dates unaffected by the failed register must not be blamed. `absenceUnits` count missed active units per register, cancelled rows excluded. Overlapping markers remain visible. SUGGESTED is A's overlay from the active batch; it never changes committed state. SELECTED is trial additionalDates.

Assumptions in every meaningful result: future non-break sessions assumed attended; projection conditional on supplied schedule/counts; chronological F is this planner's conservative rule, not verified college policy. UI distinguishes saving and engine runtime from these six statuses. Null evaluation is “not calculated,” never success. Search text: “Found X days using this search; requested K.” Empty candidate outcomes are explanations, not extra plan verdicts.

## View/controller boundary

C exports exactly `render(state,results,callbacks)` from src/ui/index.js, mounting inside #app. It may import types/constants and pure display helpers; never imports engine, storage or controller. A supplies cloned snapshots; C does not mutate state, model or callback payload after sending it. Use local DOM/form state to preserve editing drafts. All calculations and global mutations use callbacks. Render text with textContent or escaped templates; never interpolate user text as executable HTML. Render accepts null model/results and engine-unavailable state. All callbacks are synchronous void and report success/failure through the next render/notice, not guessed button messages.

Exact payloads are in types.d.ts. The key actions are:

| Callback | Responsibility |
|---|---|
| onEnterDemo / onExitDemo | Preserve personal state, fixed-clock in-memory demo, explicit exit, no demo writes |
| onReplaceSetup({model}) | Initial confirmed setup only; A overwrites the initial confirmedAt placeholder using one captured validation/evaluation clock; date/counts preserved; cannot replace existing snapshots/commitments |
| onInitializeSchedule({draft}) | Initialize once ONLY if draft courses/registers exactly match existing roster by stable ID and every field value (row/property order ignored); reject mismatches before expansion/write; snapshots untouched |
| onSetPreferences(Preferences) | Set range/preferred/K/notes; increment revision and clear batch |
| onSetThreshold({registerId,requiredBps,personalMinBps,bufferBps}) | Update R/T/B for one register; recompute F only in engine |
| onSetCourseProtection({courseId,mustAttend}) | Protect course sessions |
| onConfirmSnapshot({date,counts,confirmed,completeToday}) | A appends full new snapshot with generated ID/sequence/current confirmedAt; never modifies previous snapshots |
| onConfirmGap({throughDate,noUnlistedClasses}) | Explicit no-unlisted-classes confirmation; never bypasses a started session |
| onSetTeachingEnd({date,confirmed}) | Keep out-of-horizon commitments and re-evaluate |
| onAddSession / onEditSession | Individual future-session edits; preserve ID and linked event; holiday teaching confirmation required |
| onUpsertEvent({event}) | Add/edit/cancel compulsory independent/linked events, never add attendance counts |
| onUncommit({commitmentId}) | Explicit removal only; requires a fresh request for replacement |
| onSetManualDates({dates}) / onCheckManual | Select unique new dates; same evaluatePlan; passing check creates acceptance batch |
| onSuggest() | Call real suggestPlan, store passing batch only |
| onAccept({dates,modelRevision}) | Nonempty unique subset of currently held batch; entire combined set freshly revalidated; commit ALL or NONE, increment once, clear old batch |
| onSelectDate({date}) / onSetMonth({month}) | Display only; do not increment revision |
| onRefresh() | Fresh clock; re-evaluate current model/batch on open, focus, visibility return, minute timer, before actions |

Acceptance MUST validate both batch revision and current clock freshness. Matching revision alone is insufficient. Preflight the selected subset with every current commitment. Then construct the exact post-commit model (all selected dates, revision incremented once), capture a fresh transaction clock, and validate/evaluate that model using the SAME captured clock. Require a passing FINAL evaluation before swapping state or writing storage. If the clock crosses a session-start boundary after preflight, a nonpassing final evaluation aborts ALL proposed commits/writes and cannot emit a success notice. Ordinary model edits may retain blocked existing commitments; this stricter final-pass gate applies specifically to acceptance. Failed acceptance changes no commitments/revision and clears invalid batch. A relevant model change clears unaccepted suggestions and manual checking result. Existing blocked commitments stay visible. `manualDates` is a local UI selection; it is never persistence or actual attendance.

## Persistence and source identity

A stores only `{schemaVersion:1,model}` at key semesterspace.v1. No computed verdicts/batches are persisted. Restore validates the envelope then real validateModel and recomputes; corrupt/unavailable/invalid storage is quarantined with a visible warning and left untouched, never replaced by demo. Save status changes to SAVED only after setItem succeeds. Failure retains in-memory state and says it was not saved. Demo does not write this key; exiting restores personal state. No sync/backup/recovery promise. Automatic multi-tab collaboration is excluded.

SS-PREP-001 remains the archived original baseline; SS-PREP-002 supersedes it for implementation. BASELINE.txt records source commit; package manifest records hashes of all transported files. B/C name baseline and contract on every delivery. For later increments A issues SS-INT-002, etc., with changed interfaces highlighted. Cross-chat files only move by user attachments or an explicitly shared repository; never claim automatic synchronization.

## Fixtures and minimum first slices

Executable inputs: makeCombinedModel(), makeRecoveryModel(), makeDemoModel(), FIXED_CLOCK, ARITHMETIC_CASES, makeInvalidInputCases(), makeSnapshotTimingCases(). Fixtures are read-only shared assets, not live response substitutes.

| Input | Expected decision/evidence |
|---|---|
| combined, no new dates | MEETS_PLANNING_RULES, final81/102: both future sessions attended |
| combined, ['2026-11-02'] or ['2026-11-03'] | MEETS_PLANNING_RULES, final80/102 |
| combined, both dates | PLAN_BLOCKED, firstFailure s2,79/102,F7800,R7500, combined two dates |
| recovery, no dates | CONDITIONAL_RECOVERY, lecture recovery s2,39/50; practical12/12 |
| recovery, ['2026-11-02'] | PLAN_BLOCKED, recovery session s1 missed |
| recovery, ['2026-11-03'] | CONDITIONAL_RECOVERY, lecture39/50, practical11/12; before lecture recovery on11-04 |
| combined with practical protected/linked event | PLAN_BLOCKED when its date is selected; units counted once |
| combined, clock at11-02 09:00 | ATTENDANCE_UPDATE_NEEDED, s1 already started |
| R7500,T8500,B300 / T7000 | F8800 / F7800 |
| floor10000,initial9/10 | EXISTING_UNRECOVERABLE_SHORTFALL |
| initially0/0,first missed/attended | PLAN_BLOCKED0/1 / MEETS_PLANNING_RULES1/1 |
| 77999/100000,F7800 | existing below F despite display77.999% ->78.00; no scheduled recovery means unrecoverable |

B first delivery: validateModel + evaluatePlan with combined attendance, freshness, recovery and protected/events; export all four methods, leaving unfinished methods explicit EngineUnavailable. Run actual engine tests against the public facade. C first delivery: clickable monthly calendar, result/error rendering, actual counts input and callbacks with the same fixture shapes. A then checks changed counts -> changed REAL engine result -> calendar; a stub or mocked result does not meet hour-four gate.

Full required decision matrix is PRODUCT_SPEC.md “Essential evidence and tests.” Track completion in docs/TEST_MATRIX.md. Independent Python checks do not attest JS engine correctness until both run on the same named cases. D's first review is time-boxed to ~15 minutes: interface blockers and fixture arithmetic only. Do not restart proposal review or demand redesign.
