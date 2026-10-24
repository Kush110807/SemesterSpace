# Supplied inputs — Section Q, 24 October 2026 IST

These are observations of uploaded copies, not online verification that the college still uses them. User explicitly selected **Section Q**; the user subsequently declared practical Q3 and programming practical Q23. Q3 physics mapping is still not shown.

| Input | Observed structure | SHA256 |
| --- | --- | --- |
| 1stSemPoolB.pdf | 4 text-native PDF pages; sections O/P, Q/R, S/T, U/V. Q is page 2 upper table, R lower. | 4f98eac317c7a761aaa9cb3f1823e9e289cf35c40bb7f46c3d083780af17440a |
| Academic Calendar (Odd Semester 2026-2027).pdf | 8 scanned PDF pages; pdftotext returned no text. Notice p1; activities p2–6; important notes p7; 9 gazetted holidays p8. | e0c4d59bf25ac307b49064c7fbf3d373e860bfff2572299e5e726eb0a5e20e0e |

## Timetable reference

Seven subject families: Applied Physics-I, Programming in C, Environmental Studies, Communication Skills, System Modelling Techniques-I, Manufacturing Process, Engineering Graphics-I. Name normalization is a reviewed alias proposal, not a merge of attendance registers. Candidate registers: six theory + Physics/C/EVS/Graphics practical = ten, subject to student confirmation.

| Day | Theory periods, source time slots | Practical blocks |
| --- | --- | --- |
| Monday | Communication Skills 15:20–16:10 and 16:10–17:00 | Engineering Graphics 13:40–15:20; labels Q1/Q2/Q3 |
| Tuesday | EVS 11:30–12:20; Physics 12:20–13:10; Communication 13:40–14:30; Modelling 14:30–15:20; Manufacturing 15:20–16:10; C 16:10–17:00 | None shown |
| Wednesday | Manufacturing 11:30–12:20; Modelling 12:20–13:10; Physics 15:20–16:10 | EVS 09:50–11:30 Q1/Q2/Q3; C 13:40–15:20 with Q12/Q23 alternatives |
| Thursday | C 10:40–11:30; Physics 11:30–12:20; EVS 12:20–13:10; Manufacturing 15:20–16:10 | Physics 13:40–15:20, labels Q1/Q2 only |
| Friday | EVS 13:40–14:30; Modelling 14:30–15:20; C 15:20–16:10 | None shown |

18 theory period entries; four merged lab blocks. A merged 100-minute lab is not automatically two attendance units. Q12/Q23 staff rows are alternatives requiring interpretation; never count them as two simultaneous labs. Q3 physics applicability is not supplied. Engineering Graphics/EVS also show subgroup-specific staff/rooms.

Other occupied slots: Library Monday 10:40–11:30 and Friday 12:20–13:10; NCC/NSS/Sports Monday 11:30–13:10, Tuesday 09:50–11:30 and Thursday 09:50–10:40. Treatment is unknown. Lunch 13:10–13:40 is labelled separately. Do not convert Library/NCC into free periods or attendance units by guessing.

## Academic dates

- P2 header/row13: general teaching/continuous-evaluation period 03 August–06 December 2026. P2 row19: first-year orientation 17 August. P7 note3 explicitly permits first-year induction/class revisions due to admission schedule. Neither proves Section Q's actual class start/effective timetable date.
- P5 row72: teaching period ends Sunday 06 December; last ordinary working day Friday 04 December, except notified sessional/examination work. P5 row66: practical/sessionals window 30 November–05 December, actual schedule to be notified. Keep these distinct and ask applicability/exception confirmation.
- P3 row36: Sessional-I 21–26 September, **tentative**. P4 row50: Sessional-II 27–31 October, **tentative**. P5 row73: end-term/preparatory leave 07 December–03 January, detailed schedule to be issued. These are not exact confirmed exam sessions.
- P6 row84: winter vacation 04–17 January 2027. Outside the odd-semester teaching horizon; not extra planner break days.
- P8 holidays: 15 Aug, 26 Aug, 04 Sep, 02 Oct, 20 Oct, **26 Oct**, 08 Nov, **24 Nov**, 25 Dec 2026. Keep dates as uploaded, without assuming they are the latest notices. Holidays outside the teaching horizon do not extend it.
- P1/P7: ordinarily Monday–Friday; weekends may host notified examinations/compensatory work. P7 says subsequent university notices supersede this calendar; annual activity windows may receive separate dates. No exact replacement weekday notice is supplied.

## Actual preparation checks and limitations

pdfinfo, pdftotext, PDF page rendering and pdfplumber table inspection executed. Calendar pages inspected visually; Q inspected as text, image and table geometry. Local Tesseract CLI OCR executed on all eight rendered calendar pages. OCR was imperfect: page8 trial read Janmashtami as **04.09.2028**, whereas the visually checked source says **04.09.2026**. The raw OCR trial is retained beside the structured reference as a negative-test input. Its year and weekday conflict must be flagged, not silently fixed. This CLI evidence does not establish browser Tesseract.js performance or accuracy.

Two malformed intermediate PNGs were detected by image decoding, rerendered individually and successfully decoded before visual use. No damaged rendering is treated as source evidence.

No browser uploader/parser, generic document handling, completed user schedule, actual counts, attendance weight policy, final first-year start, latest revision or Q3 physics mapping has been verified. The JSON is a human-audited partial reference of planner-relevant facts, not a completed importer or an exhaustive list of all administrative activity rows. Do not hardcode it as extraction output.

## Local browser implementation route

Use PDF.js text items/geometry and rendering, then a locally hosted browser OCR worker for scanned pages. PDF.js documents getTextContent and rendering: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html . Tesseract.js does not accept PDFs directly; its FAQ describes PDF rendering before OCR: https://github.com/naptha/tesseract.js/blob/master/docs/faq.md . Its local-installation guide describes worker/core/language paths: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md . Recheck versions/APIs when implementing; do not copy old example version numbers as current pins.

Bundle worker, WASM and English language assets with licenses and pinned versions/hashes. No CDN dependency in the deployed import path. Measure actual first-load size, extraction duration and peak practical behavior on the available browser; no performance claims from this document inspection.

Additional calendar formats and user group declaration are recorded in CALENDAR_FORMAT_CORPUS.md / CALENDAR_FORMAT_REFERENCE.json. Their dates are format-test-only; the active MAIT calendar remains this original scanned file.
