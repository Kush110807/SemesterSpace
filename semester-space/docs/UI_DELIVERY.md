# SemesterSpace — C final bounded UI correction and refinement

**Disposition:** C-only patch for A to integrate; **NOT** merged, deployed, independently release-approved or proven in a connected served browser. The source is the attached `SemesterSpace_UI_Source_Resent(1).zip` (SHA-256 `241f1f4c1be8d4a5e8ba796c93445bd9fd6283a20dfdd2c37460ae4a318ca7a9`). The attached handoff ZIP describes the A-integrated, C-connected RC-001.4 candidate and prior reproduced async staging race.

**Important upstream delta:** During this task A reported Codex RC14-D-01 repaired at commit `95de7e5`, enabling the importer to accept explicitly reviewed legacy `{sha256,fileName}`. That newer importer source was **not** part of the attached archive. C did **not** alter the supplied old importer. This patch passes legacy metadata through unchanged only after required review; A must apply the patch to its newer authoritative source and rerun actual importer/connected tests. In the attached older importer, direct legacy comparison still returns `SOURCE_METADATA_REVIEW` and can block staging. This is an integration dependency, not an invitation to bypass the review.

## Exact modified paths (all C-owned)

1. `src/ui/revision-review.js`: invalidates pending stage completions on source/review/revision changes; independently authorizes only the exact locally reviewed stage; disables apply immediately after edit; preserves user draft after failure; passes the original legacy metadata unchanged through review gate; makes revoked consent checkbox visibly clear without requiring redraw.
2. `src/ui/release.js`: extra synchronous apply-click authorization guard, concise freshness descriptions and attendance hierarchy. A's callbacks/results and persistence unchanged.
3. `src/ui/index.js`: concise app identity, four-screen navigation before status, deterministic marker priority, legible multi-status calendar day grid, mobile marker count.
4. `src/ui/styles.css`: slate/navy identity, indigo actions, off-white canvas, compact header, full-width calendar, responsive attendance rows, accessible focus and reduced-motion styling; semantic safety states remain labeled.
5. `tests/ui/revision-rc0014-browser-fixture.py`: removes unsafe expectation that discarding a new review reauthorizes a previously staged proposal.
6. `tests/ui/browser-fixture.py`: strengthens keyboard traversal assertion to tolerate the focus cycle passing via BODY while requiring reachability of a real input/button/control.
7. `tests/ui/legacy-rc14-d01-browser-fixture.py` (new): verifies valid legacy metadata is not used before explicit review, reaches preparation unchanged after review, and then stages via exact callback without implicit apply.
8. `docs/UI_DELIVERY.md`: this delivery, evidence and risks.

**Pre-existing tests used without modification:** `tests/ui/staging-race-browser-fixture.py` (delayed source replacement, cancellation/discard, model-revision change, review edit), `tests/ui/workspace-views-fixture.py`, `tests/ui/release-requests.test.mjs`. The complete diff is limited to the eight paths above. No `src/controller.js`, storage, engine, attendance, importer, shared types, integration test, dependency, schema or clock code changed.

## P0: async staging authorization

A's `state.stagedCalendarRevision` is transient controller state, never a local review authorization. C records the selected `File` instance, reviewed-proposal instance, local monotonically advancing `generation`, `model.revision` and matching `proposalId` at staging. A success is accepted for UI application **only** when those still match. Any new file, reviewed field/evidence/coverage edit, extraction cancellation, discarded review or observed model-revision change revokes authorization. The apply action checks again synchronously, not only during rendering. Older A transient data can remain available for audit but its apply control is disabled. Review fields remain editable after rejected callbacks and aborted reads.

## Legacy metadata (RC14-D-01 additive requirement)

When an original source has no version-1 crosswalk (including valid legacy `{sha256,fileName}`), the editor requires `review.legacySourceReviewed=true`, a substantive `legacySourceNote`, reviewed pages, scope, applicability, coverage, and a separate final approval **before** `prepareCalendarRevision`. The exact stored `state.release.calendar.sourceRevision` is passed through without converting legacy records to null or fabricating links. A/B/Codex still decide validity. Missing rows are never auto-cancellations; cancellation/removal needs affirmative source evidence. No institutional Physics group, academic policy, activity interpretation, counts or teaching horizon is inferred.

## P1: design system and navigation

| Token | Value | Intended use |
|---|---|---|
| Navy / identity | `#18243d` | headings, high-contrast labels |
| Indigo / primary | `#304bbd` (`#263b96` hover) | primary actions, selected dates, navigation |
| Canvas | `#f6f7fb` | quiet off-white background |
| White / surface | `#ffffff` | important working surfaces |
| Text secondary | `#53617a` | helper text, secondary metadata |
| Border | `#dfe4ed` | dividers and subtle boundaries |
| Positive | `#17644b` / `#e8f5ee` | confirmed/success (with text icon/label) |
| Warning | `#835315` / `#fff5df` | unknown/coverage/uncertain status |
| Danger | `#a32942` / `#fff0f2` | invalidated/blocked/error states |
| Focus | `#365cd1` | 3px visible keyboard outline |

System-font stack only, no external icons, images, fonts or animations. Predominant corner radius 9–13px, subtle shadow, >=44px main touch controls; media breakpoints refine calendar markers and attendance selection at 390px. Month controls remain visible; multiple semantic calendar markers remain represented and are exposed in the date's accessible name and selected-day details. Technical evidence and raw JSON remain under disclosures as needed; no hidden safety outcomes. Reduced-motion preference turns transitions off. **Automated WCAG AA audit, physical device and screen-reader evaluation remain unrun; token choices alone are not WCAG certification.**

## Actually executed checks (the exact C working tree)

| Command | Result | Scope |
|---|---|---|
| `npm run check` | **PASS, 58 JS modules** | syntax; not runtime integration |
| `node --test tests/ui/release-requests.test.mjs` | **PASS, 3/3** | exact UI request payloads |
| `node --test tests/integration/*.test.mjs tests/attendance/*.test.mjs tests/import/revision.test.mjs tests/import/link-effects.test.mjs tests/import/coverage.test.mjs tests/ui/release-requests.test.mjs` | **PASS, 211/211** | installed-dependency-independent integration/attendance/import regression subset on **supplied older importer** |
| `node --test tests/engine/*.test.mjs` | **PASS, 26/26** | unchanged engine |
| `python3 tests/checker.py` | **PASS, 342/342** | independent arithmetic checker |
| `python3 tests/ui/staging-race-browser-fixture.py` | **PASS, 6 fixture messages** | inline Chromium mock-A delayed stage; no live persistence |
| `python3 tests/ui/legacy-rc14-d01-browser-fixture.py` | **PASS, 3 fixture messages** | reviewed metadata identity, staged callback; mock importer |
| `python3 tests/ui/revision-rc0014-browser-fixture.py` | **PASS, 7 fixture messages** | local review, attempted rejection, cancellation and mobile |
| `python3 tests/ui/browser-fixture.py` | **PASS, 5 fixture messages** | attendance, blocked ambiguous revision, focus |
| `python3 tests/ui/workspace-views-fixture.py` | **PASS, 5 fixture messages** | onboarding plus four screens, desktop/390px |
| `npm test` | **237 passed, 2 module-load failures (239 total)** | absent `pdfjs-dist` in `tests/import/draft.test.mjs` and `layouts.test.mjs`; cannot call full suite passed |
| `npm run build` | **FAIL** missing `node_modules/pdfjs-dist/build/pdf.min.mjs` | no build success claimed |
| `npm ci --offline --no-audit --no-fund --ignore-scripts` | **FAIL ENOTCACHED** for `zlibjs-0.3.1.tgz` | pinned dependencies unavailable in this runtime |

The browser checks use **synthetic inline Chromium fixtures** with mocked importer and controller responses. They do not prove actual file decoding, atomic storage, authoritative clocks or native reload. Real served-origin connected workflow, official import corpus/OCR, after-install build, localStorage native reload and D independent release approval remain **UNRUN**.

## Screenshot evidence

The separately bundled labelled **BEFORE** and **AFTER** captures provide 1440px and 390px comparisons for onboarding, today's attendance, calendar, calendar updates and setup/history. All use synthetic fixtures, shown in a banner. Additional review/compare and mobile-state fixtures document source confirmation and failed-save feedback. Screenshots are not proof of connected RC14-D01 integration.

## Required A integration checks

1. Apply the eight C paths against A's **latest** authoritative source containing Codex commit `95de7e5`. Verify no importer/shared/interface changes from C.
2. Confirm real imported `prepareCalendarRevision` receives the original reviewed `{sha256,fileName}` unchanged, produces appropriate comparison and does not bypass source/historical controls.
3. Reproduce stale asynchronous stage response using the actual controller when file is replaced, review edited or model revision changes. A transient proposal may exist but cannot become actionable; exact selected changes must be preserved after failure.
4. Clean install, full 239-case suite, build, native PDF/OCR → review → stage → selective apply → reload; test failed storage and stale revisions. Keep the release gate HOLD until this and D independent review pass.

**No merge, deployment or final release approval.**
