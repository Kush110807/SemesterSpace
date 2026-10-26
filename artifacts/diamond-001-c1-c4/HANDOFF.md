# DIAMOND-001 corrected engineering candidate — C1–C4

For Chat A's correction decision and independent Chat D review. This handoff does not claim integration or release acceptance.

- Branch: `engineering/diamond-001-t1`
- New candidate: `1c4f14d2a8d246afde392f1917d8a8e1faf297a5`
- Tree: `b83cb213e2e13c40e32702cddf8e1ceac43bf329`
- Previous candidate: `ad0b4934466c6d29f54282b192024ccf83e5dc96`
- Authorized base: `4233158b6225bb5b1c11a11e53182a38b6f02942`
- FV-01 executable parent: `a2b963407b967d6729037719fef5b92ff1e77ea0`

All four finite corrections are implemented. IR-01 adds the missing empty-crosswalk attribution restriction in controller ownership classification, including witnessed local B. Earlier stale, clock, no-op, history and reference precedence and resolvable mixed-model controls remain exercised. IR-02 captures and compares the count-preserving initialization candidate while asserting real P5 rejection of invalid persisted preimages, plus real-engine empty-store success. IR-03 uses structural fixed-location envelope checks with positive legitimate-prose/journal/opaque-value and negative transient-data controls. Both import browser drivers also use the actual unchanged UI's Discard selection button; cancellation assertions remain. IR-04 retains the malformed release.version fixture while placing the future attendance version separately and binds all six release variants to exact P4 paths, one read, zero writes and retained bytes.

Only controller.js changed in production since ad0b493 (two added lines). storage.js, shared/types.d.ts and ui/index.js are byte-identical to ad0b493. Across the full authorized base→new diff, production changes remain within the original four paths. All other changes are bounded tests and implementation documentation. Baseline documentation, package/lockfile, engine, ledger, importer, main, CSS, build and hosting files are unchanged. Accepted B1 0.2.2 and B2 0.2.3 contract files and both supplied package manifests verify unchanged. Both supplied patches reproduce the exact new tree in isolated indexes. Main remains at the pinned base.

## Actual results

Clean npm ci, syntax check, npm test **511/511**, focused DIAMOND tests **237/237**, engine **26/26**, independent Fraction arithmetic **342 cases**, build, named legacy import-browser, import-corpus and reproduce-coverage commands all exited 0. The additional controller driver passed 71 variants. No skipped tests. Exact commands and exit codes are in evidence `final/commands.tsv`; versions and source/build hashes are included.

Twelve served production-build browser workflows completed their assertions: T1, both import drivers, corpus characterization, five retained FV-01 drivers, additional manual/ambiguity UI, stage retention/revocation and post-write acknowledgment faults. The FV-01 connected/native/failure drivers ran sequentially with the same native persistent profile; close/reopen used a new browser process without reseeding. T1 independently records equal retained bytes and no reseed. Browser response-body hashes match the tested static build. Dirty-base draft, source/history/clock failures, read/write/lossy serializer faults, 320px layout, keyboard/focus, demo, clock recovery and staging recovery evidence are included.

The corpus command characterizes extraction; its unmatched reference cases and limitations are retained. A command exit0 does not imply complete parsing accuracy. The unchanged original A probe script still embeds old candidate metadata strings; its final execution's actual SS_CANDIDATE_ROOT and subject identity are bound by commands.tsv/identity.json and current module hashes. Original pre-correction probe exit1 and new probe exit0 are both included. Historical mock B4 fields in that probe are observations of the invalid-preimage behavior, not the obsolete full-suite success assertion. The corrected full-suite regression passes.

## Safety failures and limits

**DIAMOND-SA-001 remains OPEN P1.** The exact supplied forged-stage reproduction still accepts the forgery. Its observer exits0 by detecting the defect: source-safety baseline remains **KNOWN_BASELINE_FAILURE**, not PASS. T2-LINK remains a separate P2 EFFECT_OUT_OF_SCOPE defect. No source-authorization repair, migration, provenance, receipts or serialization mechanism was introduced.

Missing/unrecognized save acknowledgment injection runs AFTER one real successful write: accepted memory rejects the acknowledgment, newer stored bytes remain and no compensating save occurs. These are post-write acknowledgment tests, not zero-write storage fences or durable receipts. Complete indirect source-authority proof D001-H4-03d remains UNRUN and outside this correction. Independent A/D acceptance, other browsers/devices/assistive technology and concurrency/power-loss guarantees remain unestablished.

Preserved diagnostic failures include stale test button selectors from before the final bounded test fix and a T2 output-directory ENOENT (rerun after creating the output directory succeeded). commands.tsv retains that failed attempt. Final *.exit files describe completed final runs. No failed run is relabeled PASS. The default Playwright browser download is absent; all actual served flows use installed /usr/bin/chromium, identified in tool-versions.txt.

## Artifacts and review

- source.zip: complete tracked candidate source/tests/docs, no dependencies or profiles.
- base-to-new.patch and ad0-to-new.patch: full-index binary reproducible diffs; both verified to produce the candidate tree.
- branch.bundle: local branch commits, pinned base prerequisite; git bundle verify passed.
- build.zip: exact tested static production build, including prepared local PDF/OCR assets and licenses.
- evidence.zip: final raw logs, exit codes, state/bytes/write evidence, 418 declarative runtime variant bindings, exact report pointers, test/fault recipe digests, 111 review-row mappings, browser screenshots/traces, source/build/lockfile identities, A review package and original accepted contract/authorization packet, before-probe, honest diagnostic failures and replay programs. Profiles and credentials excluded.

Group rows do not default to PASS. Exact variant/test/log or report-pointer bindings identify what executed; group completeness is a review judgment. Runtime descriptor recipes encode getters/hooks without invoking them. Program hashes resolve against the included source or replay drivers, completing fixture/options/fault definitions. Suspect-hook tests retain their zero-invocation assertions. M1 delimiter selfcheck excludes M10/M11/M12; S27b release variants bind all six exact failures.

Verify SHA256SUMS.txt, then EVIDENCE_SHA256.txt inside evidence.zip. Inspect RESULTS.json, identity.json, scope-verification.json, final/acceptance-matrix.json, final/variant-bindings.json and final/browser-bindings.json. Review both diffs and new initialization/structural/attribution controls against the unchanged contracts. Then independently replay on this commit.

From semester-space: npm ci; npm run check; npm test; node --test tests/engine/*.test.mjs; python3 tests/checker.py; npm run build. All executed successfully here. Serve dist at http://127.0.0.1:5174 via unchanged tools/serve.mjs makeServer(distAbsolutePath), then replay browser commands from commands.tsv. Replay drivers accept SS_CANDIDATE_ROOT, SS_ORIGIN, SS_EVIDENCE_DIR (T1 uses DIAMOND_EVIDENCE_DIR); change those absolute workspace paths to your checkout/output. Create output directories first. Original FV-01 connected-browser → native-and-negative → calendar-write-failure must share one output/profile directory and run in that order. Driver fixture programs/PDFs and run scripts are included. No profile reseeding between native reopen steps.

Stop at A/D handback. No main push/commit, merge, deployment, migration, GitHub Release or public/native release. A separate artifact download branch may carry this immutable ZIP for transport only; that is not engineering acceptance. Main needs no rollback; keep the isolated branch/build on hold pending review. Do not restore stale browser data over newer accepted bytes.
