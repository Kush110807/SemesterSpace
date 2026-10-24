# SemesterSpace — audited implementation handoff, revision 2

**Audit date:** 23 October 2026, India time. This revision supersedes the previous handoff. Product rules are ready for implementation; application correctness, usability and deployment remain to be demonstrated. Read the whole file before starting a role.

## Read this first

This is the agreed baseline for a new team of separate AI chats. The original conversation is not needed. Read this entire file before working. Do not reopen topic selection or add features to make the project sound more impressive. Correct genuine defects and report changes explicitly.

**Status:** product scope selected; implementation and deployment have not been verified in this conversation. Do not claim code, tests, users, institutional policies, sources, or results exist unless you inspect the actual evidence.

**Working name:** SemesterSpace. Previously called WeekToCalendar. Naming availability has not been checked. Descriptive subtitle: “Semester break planning with attendance projections.”

**Builder:** solo first-year MAIT student in Delhi; intermediate Python, beginner–intermediate overall engineering; Windows laptop, 16 GB RAM, no NVIDIA GPU. Human–AI development collaboration. Budget ₹0 additional spend. ChatGPT Plus does not establish API access or credits. Total implementation, testing, deployment, demo, and submission budget: 16–20 hours. Prefer the full 20-hour plan below.

## Product and promise

Help a student arrange useful full teaching days off across the remaining semester, protecting important classes and compulsory events while checking separate attendance registers chronologically.

The student confirms a timetable, academic dates, actual attendance, targets, and preferences. A deterministic planner suggests dates, explains consequences, and rechecks accepted plans after manual updates.

Every recommendation is conditional on the supplied schedule and attending all other projected sessions. A percentage buffer cannot guarantee institutional compliance. This is not college approval, proof of maximum possible holidays, or validated market demand. The chronological floor is our conservative planning rule; do not claim every college checks attendance after each session.

No high-end server or runtime AI is required. Use a browser app with local storage and static hosting. Plain HTML/CSS/JavaScript with ES modules is the default. A small independent Python checker can verify arithmetic fixtures. Avoid framework migration, authentication, backend services, and API costs. If actual code is supplied later, inspect it before choosing changes.

## Inputs and scope boundary

- College, academic year/semester, programme and batch/section identify the applicable setup. College name alone does not identify the timetable.
- Editable recurring weekly timetable, expanded into dated future sessions through a confirmed last teaching day.
- Academic holidays, replacement teaching days, and individually added/edited/cancelled future sessions.
- Separate attendance registers, with positive integer attendance weights per session. Duration never determines weight automatically.
- Actual attended/held counts for all registers, confirmed through one completed day.
- Per-register required attendance and default buffer of 3 percentage points, with overrides.
- Must-attend courses/sessions, separate compulsory events, preferred break dates, and requested number of NEW days off.
- Updates to dates, future sessions, restrictions, and actual counts.

**Required versus preferred attendance — revision-2 correction:** preserve the user's requested preferred-percentage input. R is the user-confirmed institutional requirement; B is the nonnegative buffer, default 3 percentage points; T is an optional personal minimum expressed as an absolute percentage. The base target is max(R,T) when T is supplied, otherwise R. The planning floor is F=max(R,T)+B, or R+B if T is blank. Example: R75+B3 gives F78; T85 raises F to 88; T70 cannot reduce F below 78. Apply the buffer once, above the higher target. Reject R or T outside (0,100], negative B or a resulting floor above 100 rather than clamping. A 100% target needs a zero buffer. Show the computed floor clearly, with T under optional settings. These semantics replace the earlier conflation of requirement and preference. None of these inputs is verified by the college automatically.

**Projection horizon versus search window:** validate against ALL remaining semester sessions, including sessions before and after requested breaks. Let students select an inclusive candidate date range, defaulting to the remaining semester. This is a hard restriction for a revision period: do not fill a pre-exam request with post-exam dates. Preferred dates within that range are a soft ranking preference. Explain blocked/out-of-range preferences. Support checking manually selected dates with exactly the same validator as automatic suggestions.

Preference instructions must be structured controls. Optional free text is only notes and must be labelled as not enforced by calculations. Do not imply arbitrary natural-language instructions are understood.

**Web discovery was requested during discussion but remains deferred from this build.** Do not silently add a college-search engine, scraping, PDF extraction, or runtime AI. Start with one manually prepared MAIT template plus manual editing. Require explicit scope replacement if the user later insists on automated discovery.

Source checks during this audit (23 October 2026):

- https://mait.ac.in/images/TT/26/1stSemPoolA.pdf — retrieved; six pages with multiple sections/batches. The correct student section, lab mapping, weights and revision status are not established.
- https://cse.mait.ac.in/images/pdf/Academic_Calendar_MAIT_2026-27.pdf — PDF reachable, but no usable text extraction was returned. Exact dates and applicability remain unverified.

Before claiming a MAIT starter is real, open the current sources and confirm batch, academic period, applicability, and dates. A timetable does not establish attendance units or policy. Require student confirmation. If sources cannot be verified, keep the manually editable setup and explicitly label any sample as demo data. Exam dates do not establish the last teaching day or automatically cancel classes.

Do not assume the user is section A/batch A1. A starter must identify academic year, semester, programme, batch and preparation date. Read the PDF layout visually before transcription. Library/sports labels cannot automatically be treated as attendance sessions or free time; confirm applicability. Time-box source mapping so it does not block the engine.

**Event check:** https://hackathon.sdslabs.co/ was retrieved on 23 October 2026. It lists 23–25 October 2026, individual participation, no fixed theme, and online participation for students outside IIT Roorkee. Its public FAQ did not yet supply judging details. A must record the actual submission deadline/timezone and required links/files from the current submission page or official announcement, and verify applicable build-period/pre-existing-code and AI-assistance rules. These details remain unverified here. Do not guess a midnight deadline, invent a rubric, or add sponsor integrations without a confirmed requirement. Do not contact organisers without explicit user instruction.

## Frozen calculation rules

### Actual versus projected attendance

1. A snapshot has a local end-of-day date S and complete attended/held counts for EVERY register, all referring to that same completed day. Require explicit confirmation. Unknown counts are not zero.
2. Use college-local dates/times; the MAIT MVP uses Asia/Kolkata. Keep calendar dates as YYYY-MM-DD without UTC shifts. Inject current date/time into engine calls for reproducible tests. S cannot be after the current local date. A snapshot through today is allowed only after all recorded attendance sessions today have ended and the user confirms that today’s attendance is complete with no further meetings. This is a completed-teaching-day snapshot, not partial intraday logging; tomorrow is then the first projected date.
3. Project after S through teaching end. If an active attendance session after S has already STARTED, require updated completed-day counts before new recommendations or commitments. Never credit that elapsed gap as attended. Before today's first class/event, today can be a candidate if all elapsed teaching days are accounted for. A started compulsory event blocks a full day off today without adding attendance counts.
4. Once a teaching session starts, the completed-day model blocks new current recommendations until the corresponding completed-teaching-day snapshot can be supplied. This may be later that same evening; there is no need to wait for midnight. Existing plans stay visible as stale. Explain this limitation; do not silently invent intraday attendance. Across a confirmed nonteaching gap, unchanged counts are valid after confirmation that no unlisted classes occurred.
5. New confirmed snapshots supersede the baseline rather than adding counts to it. Retain older snapshots read-only. Same-date corrections use confirmation order, not date alone. Reject regression to an older baseline date. Corrections need no separate ledger.
6. Plans never update actual counts. Elapsed commitments covered by the new snapshot become reference records and are excluded from future absence simulation.
7. Recheck freshness on opening, before suggestions/acceptance and on returning to the tab. Matching model revision alone does not keep yesterday's result current. Demo mode must use an isolated, visibly labelled fixed clock; real planning uses the actual current local date/time.

### Registers, weights, and floors

- Enforce each independently checked register separately, such as Physics lectures and Physics practicals. Surplus in one cannot rescue another.
- For weight u: attended adds u to both attended and held; absent adds u only to held; cancelled adds neither.
- A meeting marked once is one atomic weighted session. Separately marked periods must be separate sessions. Process sessions in a stable chronological order.
- Reject negative, fractional, non-finite, unsafe/out-of-range counts; attended > held; invalid weights; broken register references; and ambiguous applicable schedule conflicts.
- Planning floor F follows the R/B/T rule above: max(R,T)+B, with optional T. Require F in (0%,100%]. Distinguish a shortfall below requirement R from one below planning floor F only. The latter is a planning-margin shortage, not automatically an institutional violation.
- Store percentage precision explicitly, e.g. at most two decimal percentage places as basis points. Compare exactly: 10000 × attended >= floorBps × held. Use BigInt internally or validated bounds that make every product safe; do not put raw BigInt into JSON local storage. Round only for display.
- 0/0 displays “Not started,” not shortage or 100%. First attended session gives 100%; first missed session gives 0%. Never accept a first missed session through vacuous 0/0 arithmetic. A register with no held or scheduled sessions has no percentage to project.
- Validate the snapshot and check the floor after each future session. A final semester ratio alone is insufficient.

### Existing shortfalls

Calculate an attend-all baseline first. For each register initially below its planning floor:

1. Find its earliest projected recovery by attending all its future sessions.
2. Require attendance at every session of that register through and including its recovery session; then preserve the floor after every subsequent session.
3. A full-day break before recovery can pass only when it contains no session of that recovering register and meets all other rules.
4. Label the overall result “Conditional plan with existing recovery required,” rather than claiming the floor was met throughout.
5. If attend-all cannot recover by the confirmed teaching end, explain the pre-existing shortfall, pause automatic suggestions, and do not label the overall plan feasible.
6. At a 100% floor, any existing absence makes exact recovery impossible through additional attendance alone. Handle without division by zero.

### Protected sessions, events, and exceptions

- A must-attend course protects all associated sessions; individual sessions may also be protected.
- A separate compulsory event blocks a full day off even with zero attendance units. It does not cancel classes or change counts.
- An attendance-bearing compulsory practical has one attendance session plus its protected flag or a restriction linked by stable session ID. Count units once. A linked restriction follows the session move/cancellation atomically; independent events require their own explicit edit/cancellation.
- Cancelled protected classes no longer block a date, unless a separate active compulsory event remains.
- A break means missing EVERY active attendance session on that local date. No partial-day planning.
- A date with no attendance sessions cannot count as an additional teaching day off. It is genuinely free only if it also has no compulsory event. Do not assume weekends are free.
- Replacement days substitute a specified weekday pattern; do not duplicate schedules. Resolve holiday/replacement/extra-class conflicts explicitly into one concrete day schedule. An extra class on a holiday requires confirmation that teaching occurs; never silently drop it. Keep the holiday label if relevant but calculate availability from active obligations. Adjacent sessions ending and starting at the same time are not overlaps.
- Validate attendance-session overlaps. Separate compulsory markers may intentionally refer to the same practical session; do not reject that representation as a duplicate class.

## Suggestion algorithm and explanations

Requested integer K is the number of NEW suggestions beyond existing commitments. K=0 can validate the existing plan without adding dates; reject negative/noninteger K.

1. Validate inputs and the attend-all baseline, then evaluate all current future commitments together. Preserve invalid commitments and pause new suggestions until the user resolves them.
2. Candidate dates are unique active teaching dates inside the hard search range and valid future horizon, not already committed, with no must-attend session or compulsory event. Reject duplicate selections and dates outside the supplied horizon.
3. Rank lexicographically: preferred dates first; then adjacency to existing days off/selected breaks; then resulting continuous-break length; then fewer attendance units missed; then earlier date.
4. Existing days off means dates genuinely free under the supplied schedule. A compulsory event on a weekend/holiday interrupts a continuous break. Derive this from dates and restrictions, not weekday names. Bound break-length calculation to the known remaining-semester calendar; do not count unmodelled post-semester days.
5. Test each candidate by simulating all commitments, accepted suggestions, and the candidate together over the remaining semester.
6. Accept only if the applicable recovery, floor, and protection rules pass. Re-rank remaining untested candidates after acceptance. Skip rejected candidates and continue. Under an unchanged model, adding absences cannot repair an attendance failure; rejected candidates need not be retried in that search.
7. Terminate when K suggestions are accepted or candidates are exhausted. This is a greedy suggestion algorithm without backtracking or optimality claims.
8. Say “Found X days using this search; requested K.” Do not say only X days are possible. Suggestions become commitments only through explicit acceptance and current-model revalidation.

For a failure, show the first failing session, register, exact attended/held counts, displayed percentage and planning floor. Include selected absence dates affecting that register up to the failure, labelled “Combined absences included in this calculation.” Do not claim they form a minimum causal set or arbitrarily blame one date. Distinguish existing shortage, proposed-plan breach, and compulsory-event conflict.

Always expose that other future sessions are assumed attended, inputs may change, and the calculation is a projection. Keep explanations concise and useful.

## Update and commitment lifecycle

- Every relevant model, preference, search-window, K or commitment change clears unaccepted suggestions. Version the model; acceptance must match the revision AND pass current-time freshness checks.
- The entire displayed suggestion set must pass jointly. Allow selecting a subset and accepting it in one atomic action: revalidate the complete resulting commitment set, commit all selected dates or none, then clear the old batch. Regenerate for further additions. Manual selections use the same path.
- Recheck commitments after relevant updates, including cancellations that remove expected attended units before a later absence. Preserve dates and explain conflicts. Never silently move/remove/replace them.
- If several dates only fail jointly, mark a combined PLAN conflict and the relevant dates; do not falsely label each individually impossible or identify an arbitrary culprit.
- Replacement requires explicit uncommit and a fresh request, evaluated with remaining commitments.
- If all classes on a committed date are cancelled and no compulsory event remains, preserve it as “Already off — no teaching day used.” Exclude it from additional teaching days off; do not automatically replace it. An independent compulsory event still conflicts.
- A revised teaching end leaving a future commitment outside the horizon marks it “Outside supplied schedule — review required”; do not silently ignore it. A commitment covered by a newer actual snapshot is historical only.
- Keep snapshots, projected sessions, suggestions and commitments distinct. Stable session IDs preserve linked events and overrides. Do not regenerate IDs on unrelated changes or silently delete registers with counts/references.

### Shared result statuses

A must define a finite status vocabulary with these meanings: invalid setup; attendance update needed; existing unrecoverable shortfall; plan blocked; conditional recovery plan; meets planning rules. A conditional recovery plan is distinct from being above target throughout. An empty candidate set/no remaining teaching dates is a separate explanatory result, not an invented proof of optimality. First-failure explanations identify the register, exact counts, R and F, session and relevant combined absences. Protection conflicts name the event/session.

## Minimum interface

Three simple views or sections:

1. Setup: context/template, schedule and confirmed teaching dates, registers/weights, snapshot, thresholds/buffer, and exceptions. Make units and source confirmation understandable.
2. Plan: protected classes/events, hard candidate date range, preferred dates, K, manual date checking, suggestions, explicit acceptance, and per-register consequences.
3. Update/review: future meeting edits, compulsory-event changes, new snapshot, commitments and invalidation explanations.

Keep a plain monthly calendar with previous/next navigation and clickable date details. Distinguish holidays, suggested breaks, committed breaks, invalid commitments, and compulsory events. Multiple markers must remain visible; never hide an invalid commitment behind another status. Use text/labels as well as colour. No drag-and-drop. Support mobile width, keyboard operation, labelled forms, and empty/error states.

One labelled demo dataset should let judges reach the flow quickly. Isolate it from personal state, preferably in memory with a fixed demo clock and an obvious exit. “Try demo” must not overwrite the user's setup. Do not ship fixture-backed fake calculation paths.

Persist serializable state with a schema version; validate it when loaded. Catch unavailable, full or corrupt local storage and disclose saving failure. Never silently reset real data to demo values or report “saved” before success. Recompute results on reload rather than trusting cached green indicators. Render user text as text, not executable HTML. Local storage is the persistence boundary: no cross-device sync, recovery or backup promise. A complex migration system and multi-tab collaboration are excluded.

## Explicit exclusions

Runtime AI/API access; automatic college discovery/scraping/OCR; portal integration; login/backend; daily attendance logging; calendar export/sync; partial-day absences; medical leave/condonation policy; maximum-holiday optimisation; automatic movement of commitments; bulk recurring-timetable versioning after initial setup; arbitrary natural-language instruction execution.

After initialization, handle changes by individual future meeting additions, moves, edits, or cancellations. Keep this limitation visible rather than pretending bulk recurring edits work.

## Essential evidence and tests

Tests should exercise decisions, not merely repeat the implementation. Include:

- Combined absences: 79/100 at a 78% floor; two future one-unit sessions. Missing either one and attending the other passes; missing both gives 79/102 and fails.
- Chronology: 40/50 at 78%; miss two units before later recovery gives 40/52 and fails even if semester-end attendance recovers.
- Existing shortage, unrelated-register day off, earliest recovery, and no further absence before recovery in that register.
- Recovery fixture: 37/48 at F78; attending once gives 38/49=77.5510%, twice gives 39/50=78%, so both recovery meetings must be attended.
- Unrecoverable shortage; exact 100% with an existing absence; 0/0 and first outcomes.
- Personal target: R75+B3/T85 gives F88; T70 gives F78; the buffer is applied once above the higher target. Distinguish R shortfall from F-only shortfall.
- Separate lecture/practical registers; weighted sessions; cancellation changing a later recommendation.
- Exact boundary: 39/50 passes F78; 77999/100000=77.999% fails even if displayed as 78.00%. Test invalid/missing inputs and cumulative safe arithmetic limits.
- Snapshot supersession, unchanged historical snapshots, stale elapsed gaps, elapsed commitments excluded from future simulation.
- Must-attend restrictions; zero-unit compulsory events; attendance-bearing compulsory practical counted once.
- Holiday/replacement handling, genuine nonteaching days, and compulsory events interrupting apparent long breaks.
- Search skips a failing candidate; K excludes commitments; finite termination; no maximum claim.
- Relevant edits clear suggestions; stale batches cannot be accepted; commitments remain visible and require explicit replacement.
- Full-semester validation beyond the candidate window; hard pre-exam window never yields post-exam dates.
- Local-midnight/current-session boundary, returning to an old tab, same-date snapshot correction, stale-clock acceptance, and atomic acceptance of a selected subset.
- Linked practical move/cancellation; extra class on holiday resolved explicitly; committed date becoming already off or falling outside revised teaching end.
- Calendar markers, date consequences, reload/local storage, mobile/keyboard use and a separate browser profile. Include save-failure messaging, invalid loaded state and demo isolation.

An independent Python checker and tiny exhaustive subset cases may verify feasibility decisions. Do not copy the engine implementation verbatim into the checker. This does not prove greedy optimality. Record actual commands/results; unavailable checks are UNRUN, not passed. The arithmetic fixtures above were checked during the document audit; no application tests have run yet.

## Separate-chat workflow — early integration, small deliveries

Use four separate chats, but only B and C are substantial parallel implementation roles. A is a hands-on integrator; D is a bounded reviewer, not another competing architect. A role label does not establish model superiority: judge delivered code and evidence. The chats do not automatically share memory, files or repository access. Do not launch hidden subagents merely because this document describes separate user-operated chats.

### A — Integration lead, the new primary chat

Own the specification, shared schema, controller/state, storage, integration, deployment and submission readiness. Inspect actual code/tool access first. Establish one canonical Git repository if usable; otherwise use numbered complete ZIP snapshots. Do not assume a repository, Node, Python, hosting access or commands exist without checking. Choose one lightweight run/test route and keep it stable.

First delivery: runnable project skeleton, CONTRACT.md, serializable schema, exact engine/view interfaces and statuses, tiny executable passing/failing fixtures, file ownership, run/test commands and bounded B/C task briefs. Cap preparation plus the initial D review at roughly one hour. No repeated full-proposal rewrite.

The contract must cover stable IDs; course/register mapping; R/B/T; college-local clock; dates/snapshots; sessions/overrides; linked/independent events; commitments; candidate range/preferences/K; schema version/model revision. Functions equivalent to validateModel, expandSchedule, evaluatePlan and suggestPlan must have exact input/output/error shapes. A defines render(state, results, callbacks) or its equivalent with exact callback payloads. Pure engine functions do not access storage or mutate actual counts. Result structures distinguish overall plan status from per-date markers.

Only A changes the shared contract, with versioned fixtures and coordinated dependent changes. Product behavior in this handoff cannot be silently overridden by a technical interface. Routine corrections within scope need no new approval. Later explicit user decisions take priority and must be recorded.

### B — Planning-engine specialist

Own pure session generation, model validation, baseline/recovery, combined evaluation, greedy suggestions and engine tests. Deliver the smallest correct validator slice early, then complete the rest incrementally. No UI/storage implementation. Flag needed interface changes to A before diverging. Return actual files or patches, run commands, real check results and known limitations.

### C — UI/UX and frontend specialist

Own view modules, forms, monthly calendar, explanations and styles. Use the contract's fixtures while the real engine arrives. Deliver a clickable calendar/result view early. Do not invent a second attendance calculator, silently change schemas or independently mutate application state. Use A's callbacks. Return code, actual mobile/keyboard checks or explicit UNRUN limitations, and integration instructions. Deliver working components, not just design advice or a separate application.

### D — Independent reviewer, two checkpoints

First review A's contract/fixtures for blocking inconsistencies before B/C implement substantial code; time-box to about 15 minutes. Check interfaces, expected arithmetic and the important product rules. Return READY or BLOCKED with specific fixes; no speculative redesign.

Later review the actual integrated app. Reproduce decision errors, stale state, persistence problems and UI failures. Distinguish blocking defects from optional polish, and actual executed tests from reasoning. Send fixes through A; do not concurrently edit production files unless explicitly assigned ownership. B/C can repair their modules, but A merges the result and reruns affected checks.

### File ownership

| Owner | Default responsibility (A fixes filenames once) |
|---|---|
| A | index entry, app/controller, storage/state, shared contract/fixtures, run configuration, integration checks and release docs |
| B | engine modules, engine tests and independent numeric checker |
| C | view/render modules, form/calendar components and CSS |
| D | review findings/reproduction cases; isolated test files only when assigned |

No two chats edit the same production file concurrently. Never overwrite the current app with a specialist's stale whole-project ZIP. For Git use branches/worktrees only if available and understood; otherwise transfer assigned files against a named baseline. Protect current working code before merging.

## Working schedule — 20-hour target

| Elapsed hours | Work | Required evidence |
|---|---|---|
| 0–0.75 | A checks actual environment and event requirements, prepares skeleton/contract/fixtures and briefs. | Runnable skeleton and exact ownership. |
| 0.75–1 | D checks contract blockers; A resolves them. | One usable interface version. |
| 1–4 | B proves combined validator/recovery; C builds minimal calendar/results; A wires REAL inputs to REAL engine output. | First integrated calculation by hour four; changing counts changes the displayed outcome. |
| 4–8 | B finishes sessions/exceptions/suggestions; C adds setup/forms; A integrates small deliveries and storage. | Setup → suggestion → inspect → commit. Check static-host path assumptions early with an authorised preview/deployment. |
| 8–12 | A integrates manual updates, linked events, stale batches and commitment invalidation; B/C fix owned modules. | Complete connected demo with real calculations. |
| 12–16 | D audits current code; A owns fixes; bounded classmate usability task if possible. | Release candidate; no known blocking defect; actual evidence recorded. |
| 16–18 | Protected regression/arithmetic/browser/mobile/reload checks and deployed smoke test. | Evidence against the release version. |
| 18–20 | Protected README, demo, screenshots/links and submission. | Working deliverables and honest claims. |

This allocation includes the user's coordination/transfer time. Separate chats do not make those tasks free or guarantee simultaneous execution. If the client cannot run tasks concurrently, preserve the milestones sequentially and cut cosmetic work. Do not wait until hour eight to discover interface incompatibility.

At hour four, if the real calculation is not integrated, pause expansion and repair the contract/core. At hour eight, if real inputs cannot generate suggestions, stop cosmetic work. At hour twelve, prioritise unfinished mandatory behavior and record delivery risk. If only sixteen hours are available, implementation must finish within twelve; this is a stretch, not a guaranteed compression. Always retain the final four hours for delivery.

Cut extra presets, charts, elaborate history presentation, animation and decorative polish first. Keep the plain calendar, automatic suggestions, combined validation, manual updates and commitment invalidation. Do not call the MVP complete by quietly dropping mandatory behavior. If scope genuinely cannot fit, disclose the gap or make an explicit user-agreed scope change. Correctness fixes remain permitted after feature freeze.

## Completion gates, usability and submission

1. Manual/confirmed setup works without demo data, including all actual counts, weights, dates and targets.
2. Full-semester projection and hard candidate range work; manual selections and suggestions share one validator.
3. The actual UI calls the actual engine. Selected dates are evaluated jointly and accepted atomically.
4. Edits and time progression invalidate stale results; commitments are preserved and correctly rechecked; actual history is not changed by planning.
5. Calendar markers/explanations are legible on mobile and keyboard-usable; demo state is isolated.
6. Local storage/reload work or failure is clearly disclosed. No persisted fake success or false backup promise.
7. Meaningful decision tests and the connected demo have recorded results. Unrun checks remain visible limitations.
8. README covers setup/run/test/deploy, source applicability, chronological/recovery rules, greedy limits, future-attendance assumptions, local-only persistence and AI-assisted development accurately.
9. Required submission fields, exact deadline/timezone, demo/link formats and applicable rules are checked from official inputs. Prepare a submission margin rather than uploading at the last minute.

Use the same source version for tests, deployment and demo. Check relative imports/base paths, assets, reload and mobile on the deployed origin. A deploy command succeeding does not establish that the website works. Publish only where authorised; no paid service/API is required. Do not expose actual student attendance in public screenshots without permission.

Demo: use a labelled synthetic dataset; request two revision days within a pre-exam range → inspect and commit → mark an EXISTING practical compulsory on one committed date without changing units → show the invalid commitment preserved → explicitly uncommit it → request one replacement validated with the remaining commitment → accept. This isolates protection behavior. A separate test covers adding a genuinely new attendance-bearing class.

Ask a classmate to confirm/enter a schedule, obtain a break and interpret an invalidation explanation. Record setup time, errors and whether they understand other sessions are assumed attended. A small task test can improve usability; it cannot establish market demand or winning potential. Do not invent impact statistics.

## Prompts to start the four new chats

### A — attach this file

You are the hands-on integration lead for SemesterSpace. Read this audited handoff fully as the product baseline. No implementation is verified yet. Establish actual tool/workspace access, a runnable skeleton, CONTRACT.md with exact data/engine/view interfaces, executable fixtures, statuses, file ownership and commands. Prepare bounded B/C briefs and a short D contract-review request. Keep initial preparation/review within roughly one hour, then integrate small deliveries toward a real input-to-engine-to-calendar result by hour four. Own merges, CURRENT_STATE.md, tests, deployment and submission readiness. Use the 20-hour plan with four hours protected for delivery. Fix genuine blockers without reopening brainstorming or adding deferred features. Never assume chats share files or that tests/deployment ran.

### B — attach this file, current contract and assigned baseline

You are SemesterSpace's planning-engine specialist. Read the audited handoff and contract. Deliver the smallest correct combined-validator/recovery slice first for early integration, then session generation, exceptions and deterministic greedy suggestions. Follow R/B/T semantics, the injected clock, full-semester validation and hard candidate search range exactly. Implement only assigned engine files and meaningful tests. Return files/patch against the stated baseline, commands, real test outcomes and limitations. Do not add UI/storage/backend, change interfaces independently or promise optimality. Flag contradictions to A before diverging.

### C — attach this file, current contract and assigned baseline

You are SemesterSpace's UI/UX and frontend specialist. Read the audited handoff and exact view/controller contract. Deliver a minimal calendar/result view early, then usable setup, preferences, acceptance and update/review controls. Use contract fixtures temporarily and identify replacement by the real engine. Do not recalculate attendance separately or mutate state outside agreed callbacks. Prioritise understandable inputs/consequences, mobile layout, keyboard usability, multiple markers and demo isolation. Return assigned files/patch, integration notes, checks actually performed and limitations. Do not build a separate app or alter the shared contract independently.

### D — initial checkpoint: attach handoff and A's contract/fixtures

Perform a time-boxed pre-implementation review of SemesterSpace's contract against this audited handoff. Identify only blocking omissions, contradictions or interface incompatibilities, especially R/B/T, snapshot/current-time handling, recovery, whole-semester validation versus candidate range, linked events and stale acceptance. Check fixture arithmetic. Return READY or BLOCKED with precise fixes and distinguish executed checks from reasoning. Do not redesign the product, add features or demand speculative architecture.

### D — later checkpoint: reuse D with current code, contract and CURRENT_STATE.md

Review the actual integrated SemesterSpace release candidate against the audited handoff. Inspect source and execute available checks. Exercise the connected demo and adversarial cases for joint absences, recovery, clock boundaries, stale acceptance, linked events, cancellations, snapshots, committed dates and persistence. Check mobile/keyboard/reload behavior where tools permit. Report reproducible blocking defects separately from optional polish, with actual commands/results. Mark unavailable checks UNRUN. Coordinate bounded repairs through A; do not add features or rewrite the architecture.

## Required transfer note and current-state record

Each delivery states: role/task; contract version; baseline commit or ZIP name; changed paths; how to run; checks executed/results; unresolved issues; proposed interface change if any; next integration action. Return actual source or a patch, not screenshots/prose alone. Do not transfer secrets. Only A merges and updates the integrated baseline.

A maintains concise CURRENT_STATE.md: accepted contract version, current source identity, implemented flow, actual test evidence, known defects, time remaining and next task. Attach it with current source for reviews. Keep status maintenance lightweight.

## Revision-2 audit conclusion

This audit corrected missing preferred-attendance semantics and a hard revision-date range, stale-clock and acceptance behavior, linked compulsory sessions, changed commitments, local persistence/demo handling, and late integration/review. Existing recovery, weighted registers, exact arithmetic, semester planning, manual updates and exclusions were preserved.

No unresolved product-rule contradiction was identified after these clarifications. The document is ready to implement and to translate into a small reviewed interface contract. This is not proof that no future correction will be needed or that the workflow is uniquely best. Remaining uncertainties—actual build effort, source applicability, current submission rules and usability—require implementation or external verification, not more proposal polishing.
