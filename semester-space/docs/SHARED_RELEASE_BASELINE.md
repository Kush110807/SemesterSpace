# Shared release baseline verification and interface handoff

Starting source: the user-attached repaired ZIP, used as the sole baseline. It was extracted into `/workspace/ss-shared-release-baseline/SemesterSpace`, separate from the previous working installation. No earlier source changes were substituted.

- Base: `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`.
- D-IMP-01 repair: `9486866f1d8f50d584dc8481d516fefbbe0b638e`.
- Package source: `2eb474f955b76eec4476f9f1c473455ade32a29b`.
- Exact attachment SHA-256: `fb9b86db42bfc2d738ca8326b3cc063fcf1271879b9121eb877aee798a51bed2` (9,041,106 bytes).
- ZIP CRC passed; 134/134 current manifest entries matched; all 135 archive files matched the package-source Git tree byte-for-byte.

The attached independent recheck is retained as review evidence. Its disposition accepts D-IMP-01 only. Its missing dependencies prevented independent installed/full-browser verification; that limitation is not rewritten by this worker’s observations. This worker’s fresh checks below are separate evidence, not A’s independent integration verification or D’s expanded approval.

## Verification from the attached source

Node 24.19.0, Python 3.12.14; no paid API or external document-processing service. Logs are in `tests/import/evidence/shared-release-baseline/`.

| Actual command from the extracted application directory | Result |
| --- | --- |
| `npm --cache /tmp/ss-npm-cache ci --no-audit --no-fund` | Passed; 21 packages; 39 local PDF/OCR assets generated. |
| `npm run check` | Passed; 52 syntax-checked modules after asset preparation. |
| `npm test` | Passed; 136 tests; no failures/skips/TODOs. |
| `node --test tests/engine/*.test.mjs` | Passed; 26 tests. |
| `python3 tests/checker.py` | Passed; 342 arithmetic cases. |
| `npm run build` | Passed. |
| `SS_ORIGIN=http://127.0.0.1:5186 SS_EVIDENCE_DIR=/tmp/ss-release-browser npm run test:import-browser` | Passed; actual upload/OCR, correction UI, save/planning, subset acceptance, count-driven invalidation, native reload, keyboard and 390px emulation; no page errors or external requests. |
| `PORT=5186 npm start` | Local HTTP origin serving the separately extracted attachment. |
| `SS_ORIGIN=http://127.0.0.1:5186 SS_EVIDENCE_DIR=/tmp/ss-release-corpus npm run test:import-corpus` | All five supplied calendars decoded; semantic extraction remains partial. |

The corpus report is a fresh execution against actual source file bytes. Reference expectations were used for comparison only. It retains unsupported/missed meanings, not a claim of confirmed calendar coverage. Format-only institutions were not merged into active MAIT data.

Fresh corpus measurements (candidate date/kind matches are reference checks, not accuracy scores):

| Input | Candidates | Dated | Reference matches | Unmatched |
| --- | --- | --- | --- | --- |
| Academic_Calendar_Odd_Semester_2026-2027.pdf | 120 | 73 | 15 | 3 |
| IIT_BHU_calendar_26-27_odd.pdf | 48 | 37 | 7 | 5 |
| calendar_grid_colour_150735.png | 5 | 5 | 0 | 16 |
| calendar_grid_cohort_150809.png | 6 | 6 | 2 | 8 |
| calendar_dual_term_150940.png | 57 | 47 | 8 | 9 |

The browser uses a synthetic 24 October 2026 20:00 IST clock. Actual document upload and correction UI were exercised. Controlled omission/link attacks also ran through served-browser module imports; these are API cases rather than click-through source attacks. Synthetic counts, subgroup choices, activity treatments and dates in the harness are QA inputs only. Physical devices, screen-reader and deployed-origin checks remain unrun. A’s independent integration verification remains outstanding. The original payload checksums were rechecked after install/test/build and remained valid.

## Shared interface blockers before new release implementation

The user now authorizes daily tracking and revised-calendar comparison, superseding the old milestone’s exclusion of calendar revision work. The baseline still contains only the initial-import contract. No new A interface handoff or release-specific ownership map is present in the attachment or repository. This worker requested those from the user; the following are concrete compatibility gaps, not a request to reconfirm the authorized release scope.

1. **Durable daily tracking:** `onConfirmSnapshot` already persists complete cumulative per-register counts through one completed day, restamps confirmation with A’s transaction clock and retains snapshots. There is no session/day attendance ledger type, persistence contract or callback. A must specify whether the new daily UI uses existing completed-day snapshots or a ledger, which component aggregates entries, and the correction/idempotency contract. Intraday marks cannot be treated as authoritative completed-day snapshots or silently credited to projected attendance.
2. **Revision comparison input and identity:** `compileConfirmedImport` produces a new initial Model, not an update proposal; `onReplaceSetup` correctly refuses an existing Model. Saved source labels do not distinguish document-derived restrictions from manual events/overrides or retain the reviewed calendar source/effect mapping. A must supply the revision draft/proposal types, prior-source provenance available to the importer, stable identity and ambiguity rules, and division of ownership for manual edits versus document changes. Missing/replaced source rows cannot automatically mean removal of a real obligation.
3. **Atomic confirmation and recalculation:** there is no callback for a confirmed batch of calendar changes. Existing independent event/session updates cannot substitute for an atomic revision acceptance. A must define the revision-checked acceptance payload/result, history and past-date boundaries, preservation of snapshots/counts/policies/protection/manual edits/session links, persistence failure semantics and retention of invalid commitments. The unchanged public engine must evaluate the candidate before one state transition; stale proposals and partial updates must not be accepted.
4. **Ownership:** A should assign importer/comparison, UI and daily-tracking paths to workers before concurrent edits. This worker’s existing import/parser/UI boundaries are known; controller/storage/shared-schema changes require A’s interface implementation rather than independent divergence.

These are interface requirements, not new approved signatures or a schema migration. No substitute interface has been invented and no runtime changes are included in this report branch. Existing manual setup, exact attendance arithmetic, separate registers, authoritative snapshot timing, atomic plan acceptance and retained invalid commitments remain untouched.

## Scope status and limitations

Existing document-first initial import and break planning are present in the baseline. Daily session tracking and automatic calendar revision comparison/confirmation are **not implemented or verified by this handoff**. Existing snapshot updates do not establish a new daily ledger. Targeted format improvements remain pending bounded implementation; baseline corpus gaps are measured rather than relabelled as supported.

Personal context is Q / Q3 / programming Q23. Physics mapping, activity treatment, counts, policy and teaching horizon remain unconfirmed. Browser fixture selections are synthetic QA only, never personal confirmations. Manual source coverage and source-specific reconciliation remain human assertions; software cannot detect every omitted event.

No merge, integration into A’s branch or deployment was performed. Additional spend ₹0. The exact D-reviewed ZIP and existing manifests were not modified or repackaged. Root manifests remain the identity/integrity records for that frozen ZIP; new report files on this separate review branch are supplemental evidence and are not claimed to be covered by its historical checksum set. A alone integrates and deploys.
