# DIAMOND-001 OMR-01 — corrected engineering handoff to Chat A

Candidate `88d606ea940be945fa55124671c1a8deb57c7b04` · tree `1efa8ec205d125ac3fac9d934e99cfdccceff872` · branch `engineering/diamond-001-t1`.
Previous verified candidate `1c4f14d2a8d246afde392f1917d8a8e1faf297a5`; authorized base `4233158b6225bb5b1c11a11e53182a38b6f02942`; FV-01 executable lineage `a2b963407b967d6729037719fef5b92ff1e77ea0`.

**For A handback; F must independently review changed storage/tests. D retains independent final verification authority. This is not integration or release acceptance.** No push, main commit, merge, deployment, migration or release occurred.

## Bounded correction

Only `semester-space/src/storage.js` changed in production this pass: remember envelope2 only after existing P0–P7 checks pass, then reject undefined/omitted release at entry to P8 as FAILED/CANDIDATE_INVALID, CORE_INVALID, exact path /release. No candidate access, extra disk read, empty-release reconstruction, history merge, restamp or write occurs. The complete incremental delta is four files: storage, two bounded test files, one short OMR-01 implementation note. Controller/types/UI, completed IR-01–IR-04, all accepted contracts and authorized baseline documentation are retained byte-for-byte. Dependencies/lockfile, engine/ledger/importer/constants, schema/key, hosting/build-source and other production files are unchanged relative to the prior candidate. Across base→new the original four-file production scope is retained.

Actual storage SHA-256: `c9e3afacef8341dbb15d8efeb56fd76be007b32d04ca42d985ad3d24abd5fce8`. Full tracked identities/Git blobs are in identity.json; exact scope and unchanged-file checks are in scope-verification.json. Both patches were applied to isolated indexes and reproduce the exact new tree. Bundle ref and commit chain are local and verified; no remote availability is claimed.

## Genuine before and after

The supplied unmodified five-case acceptance file was executed on the verified unsafe prior source: **3 PASS / 2 FAIL, exit1**. S31/S32 observed SAVE_OK, one read/one write, destructive history loss. Raw logs remain in before/. This is genuine pre-fix evidence, not an inverted assertion pretending to pass.

The included test was integrated by adapting imports only; its fixture/test/assertion body is byte-identical. Final five-case acceptance: **5/5 PASS**. S31 preserves applied revisions, reviewed source/crosswalk, opaque linked values and sourceHistory. S32 uses actual evaluateDayClose output, retaining confirmed record, complete closed day, reconciliation issue, original official snapshot IDs and derived snapshot. Both reject with the exact required tuple/path, one read/zero writes, unchanged bytes and valid SAVED reload with the original full model/release.

The **24 additional controls** cover omission collisions at invalid expectation, read exception, missing expected state, malformed JSON/version/core/release, future version, unknown fixed-record rewrite, EXPECTED_EMPTY and ID/revision conflicts. Earlier results win. Empty/nonempty envelope2 × matching/omitted expectation × valid/hostile candidate rejects uniformly; candidate getter invocation remains zero after descriptor evidence encoding. Input/candidate/state/bytes and complete ledger/source histories are preserved. Absent-store/legacy omission and explicit full-release optional-expectation controls pass; explicit null remains invalid. First-party saves remain unchanged and explicit.

Exact S31/S32 before/after log lines, tuples, preserved full release values/digests, immutable fixture programs, compatibility bindings and precedence/getter evidence are in final/OMR-01-bindings.json and final/variant-bindings.json. Declarative recipes use descriptors and never invoke suspect getters/toJSON hooks.

## Fresh final-candidate verification

Clean npm ci, syntax, full suite **540/540**, focused **266/266**, original storage **162/162**, legacy controller **19/19**, engine **26/26**, independent Fraction arithmetic **342 cases**, production build, coverage reproduction and additional actual-controller **71 variants** all completed exit0. No skipped cases. Counts come from actual discovery/logs. All results were regenerated for this commit; no old PASS is transferred.

All twelve established served production-build workflows completed their assertions: both import drivers, corpus characterization, T1, five original FV-01 workflows, additional manual/ambiguous-source UI, stage retention/revocation and post-write acknowledgment controls. Connected/native/write-failure FV-01 drivers ran sequentially on one native persistent profile. A new browser process reopened it without reseeding. T1 separately records equal native bytes and no reseed. Browser response module hashes match this build, including changed storage. Dirty-base, clock recovery, read/write/serializer faults, staging/busy recovery, manual/PDF/OCR intake, keyboard/focus and 320px controls are retained. Exact commands, exits, tool versions, report JSON pointers, program/fixture digests, screenshots/traces and build manifest are included. No required browser gate is UNRUN/blocked here.

The corpus command is extraction characterization: unmatched reference cases and limitations remain in the actual report; exit0 does not prove complete OCR meaning/accuracy. The A historical probe script embeds old candidate metadata strings; its new command root/subject identity is separately bound by commands.tsv, identity.json and runtime module hashes. Its legacy B4 mock observation is an invalid-preimage characterization, not the current full-suite regression assertion.

## Known failures and limits

**DIAMOND-SA-001 remains OPEN P1.** Its exact observing harness exits0 because the forgery is accepted: KNOWN_BASELINE_FAILURE, never anti-forgery PASS. T2-LINK remains the separate P2 EFFECT_OUT_OF_SCOPE defect. No repairs were attempted. The existing D001-H4-03d complete indirect source-authority proof remains UNRUN; no new broad source-safety claim follows from successful UI tests.

Missing/unrecognized save acknowledgment injection occurs AFTER one real successful write: memory rejects the invalid acknowledgment, actual newer bytes remain and no compensating save occurs. Those controls do not establish zero-write storage fences or durable receipts. No multi-tab/CAS/ABA/power-loss/migration guarantee is added. F/A/D decisions, physical devices, assistive technology and other browsers are not established by producer runs.

## Contents, integrity and replay

source.zip is complete tracked source/tests/docs; build.zip is the exact tested static build with prepared local PDF/OCR assets and licenses; base-to-new.patch and 1c4f14d-to-new.patch are full-index binary patches; branch.bundle contains the dedicated local branch with the authorized base prerequisite. evidence.zip contains raw final and genuine pre-fix logs, commands/exits, complete declarative runtime bindings, source/build/lockfile identities, unchanged accepted contract/authorization packet, current A/F correction package, prior A IR-01–IR-04 package, replay programs and fixture inputs. Profiles, dependencies and credentials are excluded. SHA256SUMS.txt checks all outer components; EVIDENCE_SHA256.txt checks every evidence member except itself. ARTIFACTS.json provides sizes and digests.

Check out the bundle with the pinned base available, or apply the base patch to that base (the incremental patch applies to exact 1c4f14d). From semester-space: npm ci; npm run check; npm test; node --test tests/engine/*.test.mjs; python3 tests/checker.py; npm run build. To reproduce the original unmodified external five cases set SS_CANDIDATE_ROOT to the semester-space directory; the integrated test uses relative imports and needs no environment variable.

Serve the dist absolute path with unchanged tools/serve.mjs makeServer at http://127.0.0.1:5174. Replay final/commands.tsv with paths adjusted to your checkout/evidence directory. External FV-01 drivers take SS_CANDIDATE_ROOT as repository root; the unmodified supplied F-S31/S32 file takes the semester-space directory. T1 takes DIAMOND_EVIDENCE_DIR; others use SS_EVIDENCE_DIR. Create output directories; copy QA seed/synthetic PDFs to the shared FV-01 output directory; run connected-browser → native-and-negative → calendar-write-failure sequentially there, with no reseeding between reopen steps. run-browser.sh/run-aux.sh and replay driver sources are supplied. Fresh synthetic profiles are used initially, then retained only for the native close/reopen sequence.

The local static server used installed /usr/bin/chromium; environment versions are recorded. No source/bundle substitution or reset to FV-01 occurred. No main rollback is needed: isolate/hold this candidate if review fails; never overwrite newer stored state with stale data. Stop at this A handback. F review and D final verification remain independent and pending.
