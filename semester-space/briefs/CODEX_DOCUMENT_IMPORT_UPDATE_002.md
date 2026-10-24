# Continue existing Codex work — document-import starter002

Do not restart or overwrite implementation. This update supersedes only starter001's import specification/reference data. Engine1.1.0, schema1, existing callbacks and owned-path boundaries remain.

User declared Section Q, practical Q3, programming lab Q23. Update declared choices and use Q23 for the C-lab alternative; do not assume Q3 physics, because the source lists Q1/Q2 only. Keep it unresolved for review.

Read DOCUMENT_IMPORT_ADDENDUM.md, prospective import contract0.2.0/types, CALENDAR_FORMAT_CORPUS.md, CALENDAR_FORMAT_REFERENCE.json and updated Section Q reference. Four added calendars are FORMAT_TEST_ONLY, alongside the original active MAIT calendar. They exercise digital/bilingual PDF, colour/legend week grid, cohort/nonteaching/makeup grid and dual-term table with footnotes. They are parser calibration/regression cases, not training the attendance engine or independent held-out validation.

If supplied the update ZIP, its semester-space directory contains only A-owned specification/reference deltas; no runtime files. Review UPDATE_FROM_STARTER_001.patch against parent source6a4066b0801445672c9afb10902c9aae388ca125. Apply compatible documentation/reference changes while preserving current code/commits; resolve conflicts explicitly, never replace the whole project with the older source baseline. Additional original examples are in reference-inputs. If supplied the full starter002 ZIP, use it only for a fresh workspace; existing work should consume the update ZIP.

Add tests/extraction support for source institution/year/term/cohort isolation; replacement weekdays in legends/footnotes; paired nonteaching originals/makeup dates; working Saturdays with unknown patterns; colour ambiguity; source year/weekday conflicts; bilingual duplicates/encoding failures. A replacement weekday is not the date's actual weekday. Examples from other/unknown institutions must not modify MAIT setup. No broad accuracy claims from five seen calendars.

Keep the first delivery genuine extraction -> editable draft. Report coverage, corrections, latency and UNRUN per file, then connect the confirmed draft to existing onReplaceSetup and planning flow. Return only owned changes and an updated handoff. A merges/deploys; D independently reviews. No engine rewrite, paid API, runtime external CDN or extra unrelated feature work.
