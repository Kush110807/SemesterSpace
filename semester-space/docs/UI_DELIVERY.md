# SemesterSpace C — bounded SS-INT-001 UI/UX release-validation delta

**Handoff:** 24 October 2026. **Apply to:** accepted integrated package **SS-INT-001**, source commit `209a519bd260a1fec53ea43b8a43f4a958e9febf` (from original `BASELINE.txt`), **CONTRACT.md 1.1.0**, **PRODUCT_SPEC.md revision 2**, schema version 1. A alone merges. B accepted A's same-day recovery correction; D independently accepted the integrated milestone, as reported in the current C assignment. Neither engine nor controller is altered by this patch.

## Owned paths and exact boundary

| File | Delta |
| --- | --- |
| `src/ui/index.js` | Generated stable initial row IDs and name-based *display* selectors; four-stage setup wizard; plan/calendar-first view after setup; accessible controls, failure evidence and keyboard-focus handling. |
| `src/ui/styles.css` | Restrained 390px/desktop styling; full marker preservation with shorter **visual-only** labels on small screens; minimum 44px action targets; wizard and status styles. |
| `docs/UI_DELIVERY.md` | This evidence and merge note. |

**NO requested or proposed interface change.** `render(state, results, callbacks)` and every `Callbacks` name/payload remain exactly contract 1.1.0. No new dependency, backend, API, college lookup, schema/config/shared/controller/storage/engine changes. No source/roster data are inferred by an AI or network. Original source manifest is a **baseline manifest**, not a post-C-delta manifest; A should regenerate it **after** review/merge, rather than accepting expected UI-path hash mismatches as evidence of tampering.

## Shipped behavior

1. **Stable identities with human-readable selection.** An opaque ID is generated once per unsaved local course, register, weekly-template, extra-session, or compulsory-event row. Its identity is tied to a row instance, *never* a label or render count. Courses, registers and extra meetings are chosen through explicit select controls that display row number and name; two registers named "Lecture" remain separate independent IDs and count maps. A removed row leaves a visibly invalid selected reference; the UI refuses to silently remap it. Existing IDs in persisted model objects are preserved. One-by-one added meetings/events also generate noneditable session-unique IDs rather than requiring manual text entry. Advanced existing-session diagnostics retain IDs for tracing. In **initial setup only**, a linked compulsory event may reference an **extra dated meeting** already entered; recurring instances do not exist until A expands the timetable, so linking to those occurs using the advanced existing-event editor afterward. No bulk edits to initialized recurring patterns are added.
2. **Four short setup steps**: academic identity and applicability; named courses/registers, R/T/B and **both complete counts**; weekly/extra sessions, weights, holidays, replacements and compulsory events; completed-day snapshot and preferences (hard range, K, preferred dates, notes). Back/Check & continue validate the current step with inline `role=alert` correction. The final form validates the same contract fields and calls `onReplaceSetup({model})` exactly once; A's P1 controller captures/overwrites the non-authoritative initial `confirmedAt` Clock-shaped placeholder. No invented historical confirmation time. Unknown attendance counts, requirement R and buffer B start blank, **not zero**; T is optional, B must be explicit even if zero. Mandatory applicability/schedule/snapshot assertions remain explicit; `completeToday` is not presumed.
3. **Plan-primary after setup.** Current engine status, next contextual action, failure consequence, projected register results, suggestion/refresh actions and calendar precede secondary setup/editing disclosures. Manual joint checks, range/K preferences, and updates remain available. Until setup, setup comes first and an empty, unverified calendar is not shown. `PLAN_BLOCKED` explicitly identifies engine-labelled invalid commitments without deleting them; user can navigate months to inspect date facts and all overlapping markers. Failure explanations lead with the consequence; exact event/session IDs, counts, R, F, and combined absences remain under an expanded-on-demand evidence disclosure. No fabricated ratio, floor, or feasibility verdict is computed by UI.
4. **Mobile/focus and save disclosure.** At 390px, calendar marker chips use short **visual** wording, while calendar `aria-label`s retain full names and never drop overlapping markers (holiday + protected/compulsory + invalid + committed + teaching etc.). Stable element keys preserve user edits, cursor/selection, and general button focus across controller/clock rerenders. Wizard transitions focus the new step heading; initial success focuses the primary plan heading; removed rows/uncommit focus a surviving relevant control; demo entry/exit restores an available header control and unfinished personal drafts. Save/QUARANTINED conditions are separately announced via `role=alert`, warning that unsaved changes cannot be relied on after reload. Keyboard controls are native buttons, inputs, selects, details, summaries and checkboxes. No drag-and-drop or cosmetic animation is introduced.
5. **Six engine statuses and data limits retained**: `INVALID_SETUP`, `ATTENDANCE_UPDATE_NEEDED`, `EXISTING_UNRECOVERABLE_SHORTFALL`, `PLAN_BLOCKED`, `CONDITIONAL_RECOVERY`, and `MEETS_PLANNING_RULES`. Runtime `NO_SETUP`, `ENGINE_UNAVAILABLE`, `ERROR` never appear as a passing result. Existing 0/0 -> "Not started", nullable error metadata and invalid requested K behavior remain intact. Structured content is rendered with `textContent`, not innerHTML. Linked events still reference immutable underlying session IDs; snapshot/commitment/persistence rules are owned entirely by A/B.

## Reproduction commands: actually executed in the final working tree

From the unmodified integrated package with **only C-owned files** overlaid:

```bash
node --check src/ui/index.js
npm run check
npm test
node --test tests/engine/*.test.mjs
python3 tests/checker.py       # on Windows: python tests/checker.py
npm run build
npm start                      # server starts; sandbox browser-origin navigation is blocked
```

| Evidence | Actual result |
| --- | --- |
| `node --check src/ui/index.js` | **PASS** |
| `npm run check` | **PASS**, 23 JS modules syntax-checked |
| `npm test` | **PASS**, **70/70**, 0 failures/skips/TODO |
| `node --test tests/engine/*.test.mjs` | **PASS**, **26/26** |
| `python3 tests/checker.py` | **PASS**, **342** independent Fraction-based tiny cases; not an optimality proof |
| `npm run build` | **PASS**, static build; not deployment validation |
| Integrated **headless Chromium 390px isolated document**, loading exact C UI + actual A controller/B engine modules via browser Blob imports | **PASS**, real input → `onReplaceSetup` → expanded schedule → real `READY` engine result → 31-date calendar → suggestion → selected-subset commit → new completed-day snapshot → `PLAN_BLOCKED` + `INVALID_COMMITMENT` (existing commitment retained) → new controller instance reloaded from the same in-memory storage map. This is real controller/engine execution with an **isolated test document and simulated reload**, **NOT served-origin/native browser reload**. |
| Isolated real Chromium **fixed-clock demo** with same A/B/C modules | **PASS**, synthetic linked event creation, single future-session move and effective compulsory marker, event title replacement without ID change, suggestion, acceptance, uncommit with focus recovery, exit restores personal identity and state |
| Isolated 390px browser DOM harness | **PASS**, wizard per-step errors, missing counts/requirements rejection, identical display names remain distinct, stable refs after rename, no silent remap on unsaved-row removal, extra-event link payload, P1 placeholder shape, draft retention across mode transitions, screen-reader names exposed by labels/ARIA, quota-failure `role=alert`, combined holiday/event/invalid/teaching/committed marker visibility (synthetic overlap fixture), re-rendered focus, mobile document-width check |
| Chromium **1440px** desktop screenshot | **CAPTURED** from same isolated A/B/C module browser test, no claimed physical-device proof |
| Native served-origin navigation | **BLOCKED/UNRUN**: Chromium returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` at `http://127.0.0.1:5173/`; also blocked `file:///...` navigation. Local `npm start` reported server start, but this is not origin-level functional evidence. |
| Physical touchscreen/device, NVDA/VoiceOver, deployed domain, native reload/real quota behavior across origin | **UNRUN**; harness `role`/`aria-label` assertions and in-memory reload do not substitute for assistive-technology, origin or persistent-storage testing. |

**Browser test separation:** `browser_check.py` and `integrated_browser.py` were run as temporary verification scripts **outside C-owned production paths** and are **not included** in the merge package. The tests validate actual modules injected into a headless Chromium document. The accepted source's independent A/D check record is not treated as proof of newly edited UI paths. Screenshots are rendered evidence, not user-testing metrics.

## Screenshot evidence

- `SemesterSpace_C_Setup_Mobile_390.png`: guided Step 4 setup, 390px.
- `SemesterSpace_C_Invalid_Mobile_390.png`: live engine `PLAN_BLOCKED`, invalid commitment in November at 390px.
- `SemesterSpace_C_Integrated_Desktop_1440.png`: 1440px planning-first layout, actual engine status and secondary setup disclosure.

These three PNGs are separate handoff artifacts, not source changes.

## Known limitations / release gate

- **No production-origin validation** in this environment, native browser reload, storage quota manipulation under a real origin, keyboard test on physical equipment, or screen reader run. A should conduct a short human Tab/Shift+Tab/Enter/Space traversal, phone viewport/device check, same-origin reload and storage-denied/quota smoke test after merging. Check color/contrast with automated tools or human audit before public release; this bounded pass has no formal WCAG audit.
- Some users may need to inspect register ordinal/course and advanced stable IDs when duplicate human labels exist. That is intentional; duplicate labels are **never merged** or guessed. A linked event initially references only an explicitly added extra session; selecting an expanded recurring session remains an advanced one-by-one action after initialization.
- The CSS intentionally uses ordinary native disclosure and compact marker labels, not elaborate animation, charts, a full component library, or "Apple-level" parity. No application-wide restructuring is authorized.
- The original contract's real policy applicability and any college timetable/exam claims still require independent human verification. This UI is not institutional approval.
- A owns deployment/submission, merge, final QA, and the protected final four-hour release reserve. C recommends **no further UI feature scope** before those checks.

## Short merge instruction for Chat A

> Apply the C-owned SS-INT-001 delta only (`src/ui/index.js`, `src/ui/styles.css`, `docs/UI_DELIVERY.md`) onto A's accepted integrated source. Baseline `209a519bd260a1fec53ea43b8a43f4a958e9febf`, contract 1.1.0. **No interface/schema changes proposed.** Rerun the full five commands listed above. Browser harness passed a real A/B/C module flow including snapshot invalidation, reload-through-new-controller, and fixed-clock demo linked-event/uncommit/isolation; however `127.0.0.1` and `file://` navigation were sandbox-blocked. Please perform served-origin/native reload, mobile keyboard and storage-error smoke checks yourself and regenerate any source manifest only after merging. Do not reset A/B code or consume the protected 4h deployment reserve on further polish.
