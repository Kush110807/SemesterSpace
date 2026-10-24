# Document-first onboarding — authorized scope addendum

Status: specification and inspected reference inputs; **browser import is not implemented**. User requested this scope change after SS-INT-002. Product revision 2 remains authoritative for calculation rules. This addendum supersedes only its exclusion of local timetable/academic-calendar extraction and the initial manual-entry-first flow. Engine contract 1.1.0, model schema 1 and callbacks remain unchanged.

## Experience

1. Select two files from the device: class/batch timetable and college academic calendar. Detect candidate sections and let the student choose; the supplied user's section is Q. Show file/page progress, cancellation and readable failure states.
2. Show extracted timetable and academic dates with source-page previews, editable uncertain entries and a searchable multi-select of extracted **subject families**. Label the protection control "Subjects I must attend": selected families set Course.mustAttend for all their registers. The current engine has hard protection; do not silently introduce a soft preference. Keep theory/practical registers separate. Show subgroup questions only when the source requires them. No internal ID entry.
3. Ask only remaining essential personal/policy inputs: applicable programme/context, per-register actual counts and R/T/B, explicit attendance units, completed-day snapshot and current applicability/date confirmations. A timetable does not establish these. Show the resulting weekly pattern and dated exceptions before final confirmation.
4. Pass the confirmed Model through existing onReplaceSetup. A captures the snapshot clock; real engine expands/validates/evaluates. Show the existing planning calendar and consequences. No document extraction result is a passing attendance verdict.

Local manual correction remains a fallback. File bytes, rendered images and extracted text stay on the device; no paid API, backend, credentials, portal scrape or college discovery. Initial implementation supports the supplied PDFs plus PNG/JPEG, with explicit unsupported/unreadable states rather than a claim of universal document support. No framework migration.

## Scope and safety boundaries

- Target the real supplied files first, using a genuine reusable extraction pipeline; never return fixtures based on filename, SHA or section label. SHA is provenance only.
- Prefer PDF text with geometry for text-native tables; render scanned pages and use local OCR. PDF reading must preserve merged cells and section boundaries. OCR confidence is not semantic correctness or confirmation.
- Extraction always creates a review draft. Missing/ambiguous critical dates, groups, units, subjects or obligations block compilation until explicitly resolved. Never silently repair a year or discard a difficult row.
- Known ambiguity is not a free day. Library/NCC/Sports must be explicitly classified as attendance-bearing, compulsory with zero attendance units, optional or not applicable. Blank cells alone do not establish complete coverage.
- Academic events are not all holidays or compulsory student events. Keep tentative dates and administrative windows distinguishable. Exams never automatically cancel classes. An unspecified date window is not a known examination timetable.
- Whole-day blocking is allowed only after the student explicitly chooses it; an adapter may then encode a confirmed date as 00:00–23:59. Never invent actual examination times from date-only text. Preserve the distinction between actual times and user-selected whole-day protection in the review display.
- Dates outside the confirmed teaching horizon remain reference information unless explicitly included as appropriate calendar records. They must not extend attendance projection or greedy search. Never call an entire end-term/preparatory-leave window compulsory examination days automatically.
- Reupload/extraction is initial-setup only in this milestone. It cannot replace an initialized model, history or commitments. Existing users keep existing manual update controls. Cancel leaves personal state unchanged; late results from an old extraction cannot replace newer work.
- Persist only the confirmed normalized Model through existing storage. Keep raw files/OCR and draft provenance in memory; disclose that unfinished import is lost on reload. No silent sidecar persistence or schema extension.

## Architecture and authority

Prospective import contract0.2.0: docs/import/IMPORT_CONTRACT.md and IMPORT_TYPES.d.ts. Human-audited references: SECTION_Q_EXTRACTION_REFERENCE.json and CALENDAR_FORMAT_REFERENCE.json. Observations: SOURCE_OBSERVATIONS.md and CALENDAR_FORMAT_CORPUS.md. User declared practical Q3 / programming practical Q23. Four added calendar examples are format-test-only, never replacements for active MAIT dates. Import types are separate from engine types; not a proposed seventh PlanStatus. This is parser calibration/regression work, not training the deterministic attendance engine.

Codex owns the bounded implementation branch: src/import/**, src/ui/**, tests/import/**, tools/build.mjs, tools/serve.mjs MIME support if necessary, package.json and a pinned lockfile, necessary self-hosted OCR assets/licenses, docs/IMPORT_DELIVERY.md. Leave src/engine/**, controller.js, storage.js, main.js, src/shared/** and existing tests unchanged. If a concrete incompatibility needs one of those paths changed, report the exact problem to A first; do not silently alter the contract.

One implementation writer per path. A owns integration/publication and shared specifications; D reviews independent results. C may review UX screenshots without competing edits. B is needed only for a concrete engine defect. SS-INT-002 remains the private deployed fallback; this documents-only milestone does not publish a new runtime.

Preserve the original final four-hour release reserve. If document import cannot be completed within remaining time, report the measured gap and keep the working fallback. Do not rebrand file selection or prefilled reference data as completed extraction.
