# SS-INT-002 — C UI integration and A release checks

24 October 2026 IST. Contract 1.1.0, schema 1, product revision 2 unchanged. This report supersedes pending-work statements in older milestone documents without extending their review approvals.

## Source boundary

Parent hosted source: `246827a1c01d32b043f3e081ffcfee28ec9b8ad8`; its runtime matched accepted SS-INT-001 (`209a519bd260a1fec53ea43b8a43f4a958e9febf`). C's ZIP contained exactly `src/ui/index.js`, `src/ui/styles.css`, `docs/UI_DELIVERY.md`. The separately supplied handoff was read in full.

Imported SHA256: JavaScript `eb1f85c87c7d358c17d571f9929f5c77b8dbbb880484e5d0a98666c2d6973993`; CSS before A correction `5c7b2927cad5acf7eb58e1519ce86513379cce0197ea4fddaf2d3bb8cdccff97`; handoff `2510934f282c5438b8bfe5398ab2644074c297ddbc5bdb43ecead98508ba88d0`.

A retained C's JavaScript unchanged. Rendered-color inspection found footer #64817b on #f3f6f5 at 3.89:1; A appended only footer color #536d67, giving 5.15:1. Feedback: briefs/C_UI_INTEGRATION_FEEDBACK.md. No callback, schema, engine rule, dependency or server changed. All non-UI runtime bytes match the reviewed parent.

## Executed checks

| Check | A result |
| --- | --- |
| Syntax | PASS, 23 JS modules |
| Full unfiltered suite | PASS, 70 tests, 0 failures/skips/TODO |
| Engine suite | PASS, 26/26 |
| Python Fraction/public-engine checker | PASS, 342/342; no greedy-optimality proof |
| Static build | PASS |
| Scope / whitespace | Non-UI runtime unchanged; git diff --check PASS |

## Actual browser observations

Managed Chrome loaded the production entry at http://terminal.local:4173/. An old saved synthetic setup loaded without migration; its 78/100 baseline, 26 October commitment and exact 78/101 conflict were retained. Native page reload recalculated the conflict. Enter on Recheck retained button focus. This tests the production entry at the preview origin, not the deployed domain.

Fresh setup and quota testing used a labelled **served QA entry**, exact production UI/controller/engine modules and native localStorage through a prefix adapter. No calculation results were mocked; the clock was real. A 390px iframe provided actual CSS media-query behavior, client/scroll width 375/375 due to a 15px scrollbar. This was not physical-device emulation. Reproduction: tools/manual-qa; normal builds exclude it.

1. Enter on incomplete wizard steps raised alerts; missing actual counts were rejected. Academic, timetable and complete-day assertions were explicitly checked. Unknown counts did not become zero.
2. Created one course and two distinct registers both named Lecture, each R75/B3, actual 90/100 through 23 October. Monday patterns 09:00–10:00 and 11:00–12:00 over 24 October–9 November expanded to six meetings. Engine showed 93/103 per register. Setup success focused the plan heading.
3. Search returned 26 October and 2 November. Unchecked 2 November; accepted only 26 October. Exactly one corresponding uncommit control existed, none for 2 November; each projection became 92/103. Actual counts remained unchanged.
4. Reconfirmed the same completed-day snapshot with register 1 at 78/100, register 2 at 90/100. Commitment survived: PLAN_BLOCKED, first-register failure 78/101, projections 80/103 and 92/103. Native iframe navigation/reload retained independent counts and recomputed the conflict. Accessible calendar name retained Teaching, Committed and Invalid commitment.
5. Enter opened date details and retained focus. Tab from Recheck reached Previous month; Shift+Tab returned. Space opened a native setup disclosure. Wizard transitions focused the active step. This is bounded keyboard evidence, not complete accessibility certification.
6. Filled synthetic QA-prefixed storage to actual QuotaExceededError (636 coarse 8192-character blocks plus tail fill). Increasing notes and saving displayed FAILED, explaining memory-only changes and reload risk. Removed only synthetic filler; saving returned SAVED. Production-key and real student data were not removed. Browser storage-denial settings were not exercised.
7. In fixed-clock demo, suggested/committed two dates, added event linked to demo-1, observed Teaching + Compulsory + Committed + Invalid on 2 November, explicitly uncommitted it and verified focus returned to commitments. Exit restored personal QA counts and invalid commitment. Demo did not replace personal storage.

Desktop evidence: docs/evidence/UI_RELEASE_DESKTOP.jpg, actual served production entry in labelled synthetic demo. Targeted contrast samples covered intro, muted copy, hints, eyebrow and calendar markers; footer was the identified failure and corrected. This is not a comprehensive WCAG audit.

## Disposition and remaining gates

No unresolved functional blocker was reproduced in exercised flows. SS-INT-002 remains a UI release candidate pending D's delta review. SS-INT-001 B/D approvals do not automatically approve the new UI files. Manual input/policy assumptions, greedy search, assumed future attendance and local-only storage boundaries remain.

Deployed-domain interactive smoke, physical phone, NVDA/VoiceOver, comprehensive accessibility, second browser profile, browser storage-denial settings and real-user usability remain UNRUN. Official submission requirements remain unverified. Native private deployment success establishes publication only, not submission or public-release approval.
