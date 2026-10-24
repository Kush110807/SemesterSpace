# SS-PREP-002 / contract 1.1.0 — response to D

Product revision 2 is unchanged. This replaces SS-PREP-001 for B/C implementation. The original D report is preserved byte-for-byte in REVIEW_CONTRACT_SS-PREP-001.md. No original uploaded file was edited. A releases the corrected interface; this is not an independent READY verdict or a completed-engine claim.

| Finding | Correction | Evidence boundary |
|---|---|---|
| B1 malformed input | PlanResult revision/clock nullable only if invalid input prevents recovering them; requested K nullable only when invalid/unreadable. Complete INVALID_SETUP/BLOCKED envelopes, no invented clock/K. Controller displays setup correction text for null K. | Five executable schema examples and a controller null-K test; B must test the real engine. |
| B2 snapshot timing | Validate every snapshot's confirmation clock against snapshot date AND evaluation clock. Same-day confirmation must be at/after all recorded attendance session ends with completeToday=true. Later evaluation cannot cure premature confirmation. New snapshot uses the same captured clock as its validation. | Seven direct timestamp/confirmation fixture checks; actual validateModel remains UNRUN. |
| B3 stale final acceptance | Final post-commit model is checked with a captured transaction clock. Acceptance requires a passing final result before ANY state swap/save. Nonpassing result clears batch and reports failure without success text. Ordinary updates can still retain blocked commitments. | Reproduced failing regression against original; passing after fix, plus PLAN_BLOCKED and rollback checks. |
| B4 draft roster mismatch | Draft courses/registers must match existing model by ID and every primitive field; order ignored. Reject mismatch before expansion/write. Preserve existing roster and actual snapshots. Complete new roster belongs to initial onReplaceSetup. | Reproduced failing regression against original; rejection and matched-roster tests now included. |

Also removed the docs ownership ambiguity: A's docs ownership explicitly excludes B/C delivery notes. Public engine method names/callback payloads, six statuses, product rules, file ownership, schemaVersion 1 and storage key remain stable. The nullable invalid-result fields are the intentional interface delta; constants/types/examples/briefs all name 1.1.0.

Commands/evidence: initial B3/B4 targeted command produced 2 failures on the original controller; the same command passed 2 after repair. Final executed results: `npm run check` passed 15 JavaScript modules; `npm test` reported 42 total, 41 pass, 0 fail, 1 engine TODO; `npm run build` completed successfully. These checks do not establish real-engine behavior. EngineUnavailable remains explicit; no fixture is substituted into the live calculation path.

Independent D delta confirmation: pending. Suggested delta request is briefs/D_REVIEW_REQUEST.md (5–10 minutes, four issues only). B/C may implement against A's released SS-PREP-002 in parallel; any surviving interface blocker returns to A before divergence.

## A patch P1 — remaining initial-setup B2 gap

D's SS-PREP-002 delta review marked B1/B3/B4 READY as interface/wiring and found that initial onReplaceSetup still preserved a caller timestamp. Its original report is retained in REVIEW_CONTRACT_SS-PREP-002.md. A independently reproduced the gap with a regression that failed on SS-PREP-002.

P1 captures one initial transaction clock, overwrites the cloned initial snapshot's confirmedAt, validates and evaluates with that same clock, and only then swaps/saves. Snapshot date/counts and caller input are preserved; saved-history loading is not restamped. The existing Model input carries a non-authoritative Clock placeholder; no callback/data-shape change or new snapshot-import policy is introduced. Contract remains 1.1.0; B/C continue their SS-PREP-002 work, returning only owned files.

Executed P1 checks: npm run check passed 15 JS modules; npm test passed 42 tests with 0 failures and 1 engine TODO; npm run build succeeded. These attest scaffold/fixture/controller behavior, not the unfinished real engine. New timestamp-provenance regression passed after failing before the fix. Independent D P1 confirmation remains pending. The patch contains only A-owned files; do not replace a specialist's engine/UI work with the old scaffold.
