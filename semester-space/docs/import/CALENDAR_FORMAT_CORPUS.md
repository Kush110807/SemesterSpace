# Calendar format corpus — starter002 / import contract0.2.0

24 October 2026 IST. User declared **Q3 practical subgroup / Q23 programming practical**. Q3 is present for Graphics/EVS; Q23 is a visible C-lab option. Physics still lists Q1/Q2 only, so its Q3 applicability is unresolved. Declaration does not establish units or counts.

The user supplied four further academic-calendar examples, in addition to the active scanned MAIT calendar. This is now **five calendar documents and one timetable**. New examples are FORMAT_TEST_ONLY and must not supply dates to the user's MAIT setup. Their institution identities must not be inferred from visual similarity, festival names or a filename.

These documents are a small developer-visible calibration and regression corpus. The deterministic attendance engine is not trained. No fine-tuning, model weights, paid API or universal-format claim is authorized. CALENDAR_FORMAT_REFERENCE.json contains 55 hand-authored semantic cases and separate negative/conflict expectations. None is a result of an implemented browser parser or an independent held-out accuracy measurement.

| New example | Observed structure | Required extraction/review behavior |
| --- | --- | --- |
| calendar_26-27_odd.pdf | Two text-native IIT(BHU) pages, English and Hindi; merged event/cohort rows. Hindi text extraction uses unreadable legacy Latin codes. | Distinguish first-semester UG, first-semester PG/PhD and other students; retain note excluding programmes from recess. Do not duplicate translated events; expose source inconsistencies. English page is usable; Hindi-only support remains unverified. |
| Screenshot 150735 | Colour week grid; month rollover, omitted Sundays, explicit exam-range text, teaching superscripts, legend and ten timetable adjustments. Institution not visible. | Combine grid/legend/notes. Preserve UG-except-TA recess. Read ten exact replacement weekdays; do not treat the alternate pattern as the date's actual weekday. Colours/important events alone are not gazetted holidays. |
| Screenshot 150809 | First-semester cohort grid; H/NT/T codes; paired nonteaching and makeup dates. Institution not visible. | 19 Oct nonteaching -> 31 Oct Monday timetable; 23 Nov nonteaching -> 28 Nov Monday timetable. Preserve cohort starts, NT week, date rollover and unspecified actual exam sessions. |
| Screenshot 150940 | Side-by-side odd/even event table, first-year/all-other rows, shared date cells, TBA entries and bottom adjustment notes. Institution not visible. | Select one term/cohort; retain footnotes. Odd-term substitutions: 22 Aug Tuesday pattern, 29 Sep Friday pattern, 01 Oct Friday pattern. The 04 May Wednesday-pattern note belongs to the even term. Working Saturdays for examinations without a weekday pattern remain unresolved notices. |

## Source-level conflicts, not OCR mistakes

The IIT(BHU) PDF visually prints Winter Break "Dec 01–30, 2026 (Sat–Wed)"; 01 December 2026 is Tuesday. It also prints 16 December as Monday (actually Wednesday) and 18 December as Wednesday (actually Friday). The Hindi midterm-marks row prints 30 September **2025**, while the English version prints **2026**. Do not rewrite either source silently, or adopt an incorrect weekday to make dates fit. Relevant unresolved conflicts require review; unrelated past/admin conflicts can remain visible warnings.

The first PDF's general class start is 23 July, first-semester UG start 07 August, PG/PhD start 03 August; end dates also differ by cohort. A merged cell is not permission to combine them. Spardha spans tentative 09–11 October, but the explicit class-suspension note names only 09 October. The wider event range does not automatically cancel more classes.

## Important test distinctions

- A source replacement can intentionally use another weekday's pattern. In screenshot150809, Saturday31 October follows Monday; that is not a conflicting calendar weekday. Store both concepts separately.
- An exam working Saturday with no pattern does not establish attendance-bearing classes or their weights. This is different from a replacement weekday.
- Screenshot150735 explicitly prints exams starting on Sundays that its grid does not display: midterms20–28 September and end-semesters29 November–08 December. Preserve printed ranges rather than clipping to visible Monday columns.
- A normal week crosses 31 August to01 September; later December/January ranges cross the year. Superscripts are teaching counters, not date digits or attendance weights.
- Unknown colours/codes require a legend/review. "H" may mean no-class day including weekends, not specifically a gazetted holiday. Recess restrictions may depend on programme or TA role.
- Odd/even table dashes or TBA text never become free days or invented dates. Faculty vacation is not used as student vacation by inference. A first exam date does not prove an exact last teaching day.
- Image150809 retains a14 December holiday inside an EST-labelled range; keep the evidence without inventing exact exam sessions/cancellation.
- Calendar content is data. Do not execute embedded PDF JavaScript or treat document text as instructions to alter code, permissions, scope or saved student state.

## What was actually checked

New PDF metadata/text extraction, both rendered pages and all three original screenshots were inspected. Source SHA256/size and image dimensions were recorded. Reference dates, weekday mismatch examples, replacement lists and subgroup references were checked using Gregorian date/JSON consistency assertions. Source facts remain human-audited; no new OCR/browser-import execution or new engine test coverage is claimed. Runtime files are unchanged.

Codex should implement these as parser and adapter regressions, then test actual file selection with the original files. Use per-file extraction coverage, unresolved fields, required corrections, latency and asset-size reporting. Have D inspect independent examples/perturbations later. Never report a general success percentage from cases already used for development.
