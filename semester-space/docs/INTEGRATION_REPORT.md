# SS-INT-001 — A/B/C integration evidence

Contract 1.1.0 and product revision 2 unchanged. Parent: A's P1 controller plus independently accepted initial contract review. Original B/C handoffs are retained; their original baseline test counts and UNRUN notes are historical. This report and CURRENT_STATE describe the merged source.

## Merges and corrections

- Imported all 11 B-owned files exactly, commit 805ad74; no A/C paths copied from B's ZIP. Engine facade now contains all four real exports.
- Imported exactly C's src/ui/index.js, styles.css and UI_DELIVERY.md, commit 41c08b7; current P1/controller/shared schema/tests preserved. Both user-supplied C ZIPs are byte-identical on all three paths; duplicate delivery was not applied twice.
- Replaced the A-owned obsolete EngineUnavailable scaffold test with real-facade demo calculation, subset acceptance and no personal-storage writes.
- Found a new B decision defect: two recovery sessions on the same date caused the floor to be enforced before the recovery SESSION. Reproduced a failing regression with 37/48 ->38/49 ->39/50; A corrected only the two recovery-boundary comparisons to use stable projected session indices. No accepted rule changed. B receives briefs/B_INTEGRATION_FEEDBACK.md for explicit review of the correction.
- Added a real-engine/controller P1 boundary check: initial same-day snapshot rejected at 09:59 before a10:00 session end; accepted at 10:00; false incoming timestamp overwritten; caller date/counts preserved.

## Actual executed checks

Executed on the merged source: `npm run check` 23 JavaScript modules PASS; engine-only 26/26 PASS; independent checker 342/342 PASS; unfiltered `npm test` 70/70 PASS, 0 failures, 0 skips, 0 TODO; `npm run build` PASS. No tests were filtered out. Engine-only suite:26 tests; independent checker:342 public JavaScript decisions versus Python Fraction arithmetic. The checker uses tiny generated subsets and one session per date; A's separate regression covers same-day recovery. No optimality proof is claimed. Full unfiltered suite includes all A/B tests, without skip patterns or TODO placeholders.

## Actual served-origin browser flows

Executed with the merged real app through the managed local preview in desktop Chrome. Synthetic QA inputs were entered through normal controls; no fixtures were substituted for calculation output and no real student data was used.

1. Manual personal-mode setup: QA college/programme/section; R75/B3; snapshot90/100 through23Oct2026; recurring Monday09:00–10:00/weight1 over24Oct–9Nov. Real expansion produced3 stable canonical meetings. Engine showed93/103 and calendar teaching markers.
2. Search requested2 new dates. Real search found26Oct and2Nov; displayed joint projection91/103. Unchecked2Nov and accepted only 26Oct. Exactly one commitment remained; projected92/103; calendar marked26Oct Committed.
3. Confirmed a new same-date snapshot78/100. Actual counts were replaced, not added; commitment remained visible. Engine blocked at78/101=77.23%, R75/F78. Calendar retained Teaching + Committed + Invalid commitment. Reload restored personal data and recalculated the same conflict rather than loading a cached green result.
4. Opened isolated fixed-clock demo. Requested/committed2Nov and3Nov. Added a zero-unit compulsory event linked to existing demo-1 on2Nov. Engine named that event, preserved both commitments, and marked2Nov invalid. Projected103/115 remained unchanged: no extra attendance units were counted.
5. Explicitly uncommitted2Nov, retained3Nov, requested one NEW replacement, got4Nov, and committed it. Demonstrated keyboard Enter on4Nov opening date details while retaining calendar focus. Exiting demo restored the original blocked personal QA commitment and counts.
6. Inspected desktop screenshot and measured viewport/document width1348/1348: no horizontal overflow at that width. This is not a390px/mobile/device accessibility test.

## Remaining gates

Independent D review of the integrated source is pending. B review of A's session-boundary correction is pending. Merged mobile/full keyboard/screen-reader, second-browser-profile, live quota-failure UI, deployed origin/subpath/reload and real-user usability checks remain UNRUN. Adapter storage-failure tests are not a substitute for those browser checks. No public deployment or submission has been made. Official deadline/deliverable/build-period/AI rules and applicable MAIT source data remain unverified. No source/API/contract change is proposed by this milestone.
