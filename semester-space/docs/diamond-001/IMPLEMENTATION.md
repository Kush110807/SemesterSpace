# DIAMOND-001 engineering candidate — independent review required

Authority: supplied B1 0.2.2, corrected B2 0.2.3 and retained command/clock clauses; owner authorized engineering only. Base 4233158b6225bb5b1c11a11e53182a38b6f02942; executable parent a2b963407b967d6729037719fef5b92ff1e77ea0. No merge, remote push, deployment or release.

Only controller.js, storage.js, shared/types.d.ts and ui/index.js production files change. Dependencies, key, schemas, engine, ledger, importer, main, CSS and build/hosting remain unchanged. Three documentation-only baseline files remain byte-identical.

Storage executes expectation/read/version/profile/core/closed-record/identity/candidate/roundtrip/write fences in order. Candidate admission uses descriptors and a frozen detached tree. The exact serialized envelope is compared structurally before its single write. The structural validation ceiling is never persisted or used as an attestation. Legacy source spelling and opaque source values are preserved. This remains optimistic single-read/single-write Web Storage, not CAS, ABA protection, cross-tab serialization or crash durability. No compensating writes.

The event callback now requires manual-event/1's exact seven request properties and seven event properties. Event equality is exact and order-independent. Stale context precedes captured clock checks and no-op. Historical old/new targets and canonical linked identities are checked before source restrictions. Loaded trace-free events are not assumed local. Private acknowledged-CREATE witnesses expire on accepted non-T1 mutations, model/mode replacement and reopen. Source bindings and ambiguous datasets outrank witnesses. Personal acceptance follows SAVE_OK only; demo acceptance is memory-only. No-change performs no storage access. Failed/rejected actions preserve accepted data, stages and batches; they may change diagnostics.

The UI retains a reviewed model/revision per event draft until explicit discard/review or successful submission. CREATE ID is stable through rejection. No ownership checkbox or historical override exists. Outcome notices disclose source/history/clock/save restrictions and witness lifetime.

## Replay

From semester-space: npm ci; npm run check; npm test; node --test tests/engine/*.test.mjs; python3 tests/checker.py; npm run build.

Focused tests: node --test tests/diamond-001/*.test.mjs. These use actual engine/controller/storage/ledger/revision modules and record full synthetic before/after state and stored bytes.

Serve dist with the existing makeServer exported by tools/serve.mjs, supplying the absolute dist directory, on a dedicated port. Run SS_ORIGIN=http://127.0.0.1:5174 DIAMOND_EVIDENCE_DIR=/tmp/diamond-browser node tests/diamond-001/browser.mjs --run. DevTools observes the actual main.js app; no source/module/HTTP replacement. Native Storage and serializer fault injections are explicitly restored. Profiles are temporary synthetic data and excluded from archives. Browser clocks are instrumented and reported.

The original FV-01 browser archive is available at the pinned URL in docs/release-fv01/SOURCE_SYNC.md. Its SHA256 is 8a56bb833b4730ea8163b16f7ad91513cc5bc6a9620f74f2772a6509016c8ba3. Extract/check its manifest. Run drivers with SS_CANDIDATE_ROOT pointing to the candidate root, SS_ORIGIN to served dist, SS_EVIDENCE_DIR to a fresh external directory containing its qa-seed.json and three synthetic PDFs. Run connected-browser.mjs, native-and-negative.mjs and calendar-write-failure.mjs sequentially: they share a native profile. initial-browser.mjs and fv01-gate-browser.mjs have separate profiles. No reseed occurs on native reopen. No historical result is a new candidate result.

The additional import-browser.mjs is a bounded copy of tests/import/browser.mjs with workspace navigation added (calendar after import, setup before snapshot, calendar after snapshot/reload). Its assertions are retained unchanged, including a known invalid raw-string exclusion: it rejects the legitimate release attendance key reconciliationIssues. It is a diagnosed failing driver, not a passing import gate; the recovered original FV-01 initial driver is independently executed.

## Finite issue for A

The unchanged test `D B4: matching roster initializes without replacing actual counts or roster` at tests/integration/controller.test.mjs uses an injected always-success validator to load persisted `schedule.initialized=false`, then expects initialization to save. The real frozen model validator rejects that stored state as UNINITIALIZED_SCHEDULE. Required B2 P5 now rejects before writing, leaving the old model unchanged, so the old assertion fails. Do not relax P5 or weaken that regression to manufacture green output. A must decide the authorized fixture/expectation resolution. The full-suite gate is FAIL until resolved; D must independently review this conflict. This is not a missing environment dependency.

## Route inventory and scope limits

Only onUpsertEvent and the single reviewSection event-form adapter provide direct manual upserts. The old {event} route rejects; no delete/edit alias is added. Initial setup can contain events under its retained initialization guards. onApplyCalendarRevision remains the independent reviewed-calendar route; onEditSession may affect linked event targets and onSetTeachingEnd affects the horizon. Their source-authority limitations are not repaired by T1. Uncommit removes commitments, not events. No runtime test export or fifth production helper is introduced.

DIAMOND-SA-001 remains OPEN P1: the exact supplied forged-stage replay is accepted on baseline and candidate. A passing assertion that observes acceptance is KNOWN_BASELINE_FAILURE for the safety gate. T2-LINK remains the separate P2 EFFECT_OUT_OF_SCOPE limitation. No source-authenticity, indirect-source protection, integration acceptance or release acceptance is claimed.

Rollback: hold/discard this isolated branch/build only after preserving evidence. Main and deployed code were untouched. Never restore stale browser bytes over newer accepted state. A receives the candidate/evidence and routes it to D; this producer cannot grant integration or release approval.
