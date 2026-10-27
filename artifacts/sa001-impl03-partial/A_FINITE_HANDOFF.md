# SA-C1-IMPL-03 — finite acceptance-input contradiction

Status: HOLD, incomplete isolated implementation; not SA acceptance or security closure.

The original accepted F fixture `contract/F_AMENDED_0_1_4/fixtures/E2_B2_OPAQUE_HISTORY.json` has schemaVersion=2 and release.version=2 (without provenance). Its SHA-256 is `af0413e53a3ea5f4b2145d0948f9cedcd13898ddb00da7d2ba00aa34b444ccf7`. The file matches its original F manifest and the D-accepted archive exactly.

Active oracle F-SA-02a points directly at that fixture with no mutations, requires P11/SAVED/SAVE_OK, and describes a supported release1. Frozen B2 0.2.3/OMR and F's old/new table require P4/FAILED/UNSUPPORTED_PERSISTED_VERSION/VERSION at `/release/version` for envelope2/release2. Both unchanged accepted T1 storage and the partial SA legacy writer produce that refusal with one read, zero writes, zero hostile candidate getter calls, unchanged bytes. This is not an artifact hash mismatch or a request to weaken B2.

A must disposition this exact fixture/oracle mismatch. No input/oracle/accepted contract was edited. Do not repair adjacent rows by inference. Continue implementation only under a controlling finite disposition; no renewed owner authorization is requested.

## Active inputs, unchanged precedence

- Original SA-C1 archive: `3c249e8acaf4d888f7c121b25baafef89196ed5616b48b95f579b10f8e86ff46`.
- D-accepted assembly: `564dd204ebb26b6a0463a52c10019037f3fb8faf14e2a82472fcdd861229605b`.
- IMPL01 archive: `4da5accf4ecff588fa7981b2b12ad64fc76224a888df3a4f18bb32c7095ef10a`.
- IMPL01 corrected active oracle: `b1f162fffe47dd9fd2d3cbadb3c984ce96dc7e22991c04be57328b1aef77fa90`.
- IMPL01 corrected active register: `81543d6acef0a9cd3bea3067140711066aa1c5cb78f670a93be5b220bcf66346`.
- IMPL02 reassembled original: `d787e2eed73dabec84d07217718e1cb0089fa225d2c247dd59b0a5d80f503585`.
- IMPL02 active interface: `485c5581245ebae226e1c87c76d1d03ade2622468ed78840d290b73b95797449`.

IMPL01 changes only the two previously dispositioned physical-byte leaves and register mirrors. IMPL02 changes trusted epoch/bootstrap wiring, no oracle row. Original inputs remain historical immutable inputs, never labeled byte-identical to their active overlays.

## Partial work and actual limits

Continued existing d664c6e checkpoint on the existing branch/worktree. Four production paths changed in this continuation: storage, controller, authority and main. Added one-use trusted factory bootstrap, instance epoch handoff, private host, closed raw-source rejection adapters, draft context classifier/receipts/commit/reload/permit integration and measured main composition. Existing legacy writer remains unchanged. UI/types and remaining authority/storage semantics are unfinished. The old UI document flow has not been replaced, and this checkpoint must not be treated as a usable or complete SA implementation.

Actual final bounded checks: syntax exit0; 289 unit checks pass (90 codecs,191 B2/OMR,8 epoch-oriented units), no skipped/todo. The eight unit names do not establish full EP01–08: actual-new-payload lifetime/privacy/miswire/source replay assertions remain incomplete. Updated static ABI audit is artifact/interface checking only. Original static gap finding remains in prior immutable checkpoint evidence.

Real Chromium PDF diagnostics observed INITIAL_IMPORT and two independent holiday revision acceptance through actual unchanged extractors/compiler/preparer/builder and the candidate authority/controller/context. Diagnostic wrappers captured internal outputs in isolated test instances; these are not complete production-build/browser/UI/native-reopen or positive-recipe gates. No OCR/capacity/final browser acceptance claimed.

Initial storage oracle diagnostic:107 rows matched checked storage assertions,24 failed,21 unrun. These are not107 complete SA passes: phase/memory/reload/authority/full history populations have not all been bound. Failures include harness recipe defects, unresolved implementation behavior and the independently reproduced F-SA-02a input contradiction. Original full register is retained; no gold was changed. F-SA-26-commit-throw/F-SA-27a actual changed-write/reload cases remain UNRUN. No earlier PASS transferred to this checkpoint.

Full final npm ci/test/engine/ledger/arithmetic/build, all152 runtime cases, complete AUTH/SEM/nine positives, retained12 workflows, native persistent-profile reopen, fault recovery and capacity remain UNRUN/incomplete. UX03/04 remain UNRUN: owner reports no available human tester. E/F/D independent candidate review and A disposition remain pending. No tested build artifact exists for this incomplete checkpoint.

SA-001 remains OPEN P1. T2-LINK remains separate OPEN P2; Open Interval and B objectives remain separate. No GitHub write, push, CI, merge, accepted T1/main/integration modification, migration, activation, deployment or release.
