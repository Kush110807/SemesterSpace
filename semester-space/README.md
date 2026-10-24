# SemesterSpace

Semester break planning with attendance projections. **SS-INT-002 UI release candidate. SS-INT-001 is independently accepted; the new UI delta awaits review.**

## Run locally

Unzip the project, open a terminal in `semester-space`, and run:

```sh
node --version
npm start
```

Use Node 20 or newer. Open http://127.0.0.1:5173. No `npm install`, API key or paid service is needed. Windows PowerShell supports the same commands. Do not open index.html through file:// because ES modules require HTTP. Stop with Ctrl+C. An occupied port can be changed using the PORT environment variable.

```sh
npm run check
npm test
npm run build
```

The static build goes to dist/. Imports are relative. `.openai/hosting.json` retains the existing private Site identity and static directory. Private Site: https://semesterspace-nimi-ssint001.nimii-11.chatgpt.site . Publication of later candidates is reported separately. No public audience change or submission is implied. Keep QA pages out of production builds.

## What currently works

B's real deterministic engine and C's UI are integrated with A's P1 controller. Manual setup expands a confirmed recurring schedule; real inputs drive whole-semester attendance checks, greedy suggestions, date details and selected-subset atomic acceptance. Actual snapshots, meeting/event updates, invalid commitments and browser-local persistence are connected. The fixed-clock synthetic demo remains separate from personal state. There is no runtime AI or API key.

A executed the connected desktop flow, including changing counts, preserved commitment invalidation, reload, linked compulsory events without double-counting, explicit replacement and keyboard calendar selection. A also corrected a same-day recovery session-boundary defect found after B's delivery. See docs/INTEGRATION_REPORT.md for exact evidence and limits, and CURRENT_STATE.md for current source identity. The original specialist handoffs describe their earlier baseline checks; they are not current merged-state assertions.

B accepted A's recovery correction and D accepted SS-INT-001. The later C UI delta has served-origin, native-reload, 390px, bounded keyboard and actual quota-failure evidence in docs/UI_INTEGRATION_SS-INT-002.md. Independent new-UI review, comprehensive accessibility and deployed-domain interaction remain pending. Full required behavior remains in PRODUCT_SPEC.md.

## Calculation boundaries

Each attendance register is independent and weights are explicit attendance units, never inferred from class duration. F=max(required R, optional personal T)+buffer B; default B=3 percentage points. Floors are checked exactly after every projected session over the remaining semester. Existing deficits require all applicable sessions through earliest recovery. The greedy date search has no maximum-day guarantee. Every recommendation assumes attendance at all other projected sessions and depends on supplied dates/counts. This is not college approval; chronological floors are this planner's conservative rule.

The synthetic data is not a MAIT timetable or verified policy. No applicable MAIT section/template, attendance-unit policy or last teaching date is established. College web discovery, OCR, portals, runtime AI, authentication, backend, partial days and recurring timetable versioning after setup are excluded.

## Data and development

Real data stays in this browser's localStorage. No server submission, synchronization or backup is promised. Demo state stays in memory and is discarded on exit/reload. Invalid/corrupt storage is left untouched with a warning; failed saves retain memory changes and disclose failure. Computed verdicts are never loaded as authoritative cached results.

Development is human-directed and AI-assisted across separately operated chats. The initial contract/P1 checkpoint is independently accepted; the B engine and C UI deliveries are merged. SS-INT-001 review is accepted; new-UI independent review and real-user usability remain pending. Event deadline/deliverables/build-period/AI rules remain unresolved; see docs/EVENT_REQUIREMENTS.md. Do not include real student attendance in public demos/screenshots without permission.
