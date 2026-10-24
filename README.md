# SemesterSpace

**Plan breaks without risking attendance.**

[Live demo](https://semesterspace.netlify.app/) · [Application documentation](semester-space/README.md) · [Final verification evidence](docs/release-fv01/FINAL_FV01_RELEASE_GATE.md)

SemesterSpace is a local, browser-based college attendance and break planner, prepared for Syntax Error 2026 on Devfolio.

## What it does

- Evaluates proposed full-day breaks against course-wise attendance requirements, separate registers, compulsory obligations and protected subjects.
- Imports timetables and academic calendars using device-local PDF extraction/OCR, with editable drafts, source evidence and mandatory manual coverage review. Manual setup remains available.
- Records daily attendance and corrections, reconciles official snapshots and retains planning history.
- Compares revised calendars and stages reviewable proposals for selective, atomic application and recalculation. Missing extraction does not imply deletion.
- Explains blocked dates and retains invalidated commitments for review.

## Run locally

Use Node.js **20.16+** and Python **3.10+** for the independent checker.

```sh
git clone https://github.com/Kush110807/SemesterSpace.git
cd SemesterSpace/semester-space
npm ci
npm start
```

Open the served HTTP origin (default port 5173). Installation prepares pinned, self-hosted PDF/OCR assets and licenses. No API key or paid processing service is needed. To produce static hosting output, run `npm run build`; output is `semester-space/dist/`. This README update does not run a build or deploy anything.

## Verification and limitations

The FV-01 gate passed clean installation, syntax, **274 full-suite tests**, **26 engine tests**, **342 independent arithmetic cases**, production build and real served-origin Chromium workflows. D returned **ACCEPT WITH LIMITATIONS**, as reported by the owner. The verified release was merged at `a2b963407b967d6729037719fef5b92ff1e77ea0`; later documentation-only changes do not alter its runtime. Full commands and limitations are in the linked verification evidence.

Extraction is partial and cannot detect every omitted event. Every imported input requires human review; unknown information is not a free day. Attendance counts, policy, teaching horizon and group applicability require confirmation; Q3 Physics mapping remains unresolved. Suggestions are not official institutional approval or a guarantee of maximum holidays. Data is stored in this browser’s localStorage, without cloud backup; multi-tab serializability, physical-device and broader accessibility/browser coverage are not established.

Technology: JavaScript, HTML, CSS, Node.js, PDF.js, Tesseract.js, Playwright and Python; owner-reported hosting on Netlify.

## Source, references and notices

The application lives in `semester-space/`. `docs/release-fv01/` contains release provenance and completed verification reports. Older manifests, review packets and HOLD reports are retained as historical evidence, not current release-status statements.

Dependencies and bundled OCR data retain their upstream license notices; local asset preparation copies the required notices. Institutional PDFs/images in `reference-inputs/` are extraction-development references, not active calendars for every user and not a claim of institutional endorsement. No repository-wide open-source license has been selected; making source public does not itself grant an open-source license or establish redistribution rights for third-party documents.
