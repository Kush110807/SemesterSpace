# SemesterSpace

For D’s corrected review package, exact commit identities, current checksums and the absent historical hosting file, read [D_REVIEW_PACKAGE.md](../D_REVIEW_PACKAGE.md) and [SOURCE_PACKAGE_MANIFEST.json](../SOURCE_PACKAGE_MANIFEST.json). The legacy `MANIFEST.sha256` files are historical, not current integrity checks.

Semester break planning with separate attendance registers. This feature branch adds device-local document extraction and **explicit manual calendar completion** to the SS-INT-002 baseline. Extraction is partial; an extracted candidate list is not confirmed calendar coverage. SS-INT-002 remains the fallback. Independent review of its UI delta and this import change is still pending. No deployment is implied.

## Install and run

Use Node.js **20.16 or newer** (a compatible Node 20 release is needed by PDF.js) and Python **3.10 or newer** for the independent arithmetic checker. From the application directory, `semester-space`:

```sh
node --version
python3 --version
npm ci
npm start
```

The server uses port 5173 by default. Use a browser over HTTP, not `file://`, because the app uses ES modules and local workers. Stop with Ctrl+C. HOST and PORT can select another listening address/port. No API key, paid service, backend or runtime CDN is required; additional spend is ₹0.

`npm ci` installs the exact lockfile and runs `prepare:assets`. It copies pinned PDF.js/Tesseract workers, standard fonts, CPU/WASM variants and English language data into generated `src/import/vendor/`, including licenses and a SHA-256 inventory. If installed packages are already present but generated assets are missing, run:

```sh
npm run prepare:assets
```

`npm run build` also prepares these assets and recreates `dist/`. Keep personal files out of generated output directories. `node_modules/`, generated vendor assets and `dist/` are excluded from the source package; regenerate them after unpacking. Registry access is needed for installation. Uploaded document processing then takes place in the browser, with self-hosted assets and no external document-processing requests. The complete generated asset tree is about 48 MiB; that is retained size, not a first-load transfer or RAM measurement.

## Import and manual fallback

1. Select the student's timetable and academic calendar. Section Q, practical Q3 and programming Q23 are editable declarations; they do not establish Q3's Physics mapping.
2. Compare extracted candidates against the original page previews, including footnotes, legends and cohort conditions. Correct dates, groups, aliases and sessions; add missing calendar entries. A page-view checkbox records viewing only.
3. Resolve source candidates explicitly: link their corrected planner entries, or explain and confirm why they have no applicable effect. Changing a category to information-only or deleting a candidate is not resolution.
4. Confirm actual counts, units, R/T/B, applicable cohort and teaching horizon. For **every calendar page**, complete separate manual declarations for exams/compulsory obligations, substitutions/working days, and holidays/nonteaching dates. Link applicable entered rows, or explicitly explain that none apply to this scope. Confirm after finishing edits; changed rows, sources, scope or dates require confirmation again.
5. Save only after validation succeeds. The existing controller expands the schedule, stamps the completed-day snapshot and runs the preserved attendance engine. The planner visibly identifies imported calendar coverage as manually confirmed from partial extraction.

Software cannot detect every omitted event or verify the truth of a human declaration. Readable OCR is not semantic interpretation. If you cannot complete an unsupported page reliably, leave it unresolved and use the existing **“Or enter setup manually”** wizard with verified inputs. Unknown information is not evidence of a free day. Import is initial-setup-only; existing users keep their update/history controls. Automated calendar-revision reconciliation is outside this milestone.

## Supported formats and limits

The local decoder accepts PDF, PNG and JPEG bytes: up to 15 MB per file, 20 pages per PDF, and 40 megapixels per decoded image. It prefers PDF text with geometry and uses local English OCR for scans/images. Wrong types, unsupported/unreadable input and missing assets produce visible errors. These limits do not establish that every PDF or image layout is understood.

The supplied Q timetable has usable geometry. The scanned MAIT calendar needs OCR and manual corrections. Dense colour/week grids, some merged/cohort/dual-term rows, incomplete legends and calendar footnotes remain only partially interpreted. Hindi legacy glyph encoding is flagged; automatic Hindi translation/reconciliation is not supported. The other institutions' calendars are development examples, never additions to the student's active MAIT calendar. Annotated expectations verify results in tests and are not runtime extraction answers.

Calendar exams do not automatically cancel classes. Whole-window protection is a deliberate user choice, not an extracted exam timetable. Timetable substitutions require an explicit weekday pattern; an examination working Saturday does not establish ordinary classes. Library/NCC/Sports treatment, attendance units, actual counts, policy and teaching dates require confirmation. Q3 Physics remains unresolved until the student establishes its mapping.

## Verification

```sh
npm run check
npm test
node --test tests/engine/*.test.mjs
python3 tests/checker.py
npm run build
```

For served-browser and corpus checks, start `npm start` first, then run:

```sh
npm run test:import-browser
npm run test:import-corpus
node tests/import/reproduce-coverage.mjs --run
```

The browser scripts use system Chromium at `/usr/bin/chromium`; set SS_CHROMIUM to an existing executable on another system. Set SS_ORIGIN when using a port other than 5173. Evidence is generated under `/tmp/ss-browser-evidence` by default; SS_EVIDENCE_DIR can change it. Browser checks use explicit synthetic data and a documented fixed browser clock; actual PDF uploads, local OCR, controller, engine and native storage are exercised. They are not physical-device or complete accessibility evidence.

See [the current coverage investigation and handoff](docs/CALENDAR_COVERAGE_REVIEW.md), [the original import delivery](docs/IMPORT_DELIVERY.md), and the reports under `tests/import/evidence/` for exact results and unrun checks. The old CURRENT_STATE.md describes the supplied baseline, not subsequent feature-branch approval.

## Calculation and data boundaries

The deterministic engine, exact chronological attendance arithmetic, separate registers, snapshot provenance, commitment preservation and atomic final acceptance guard remain authoritative. F=max(R,T)+B, with optional T and explicit attendance units; duration never determines weight. Greedy suggestions are not a maximum-day guarantee, and every recommendation assumes attendance at all other projected sessions. This is not institutional approval.

Files, OCR, previews, unfinished drafts and coverage review records remain in memory and are lost on reload. Only the confirmed normalized schema-1 Model is saved through existing browser-local storage. Its existing source-label field discloses manually confirmed import provenance; there is no new shared schema or storage format. Synthetic demo state remains isolated. No server submission, synchronization, backup, real-student verification, default-branch merge or replacement of the existing private site is part of this work.
