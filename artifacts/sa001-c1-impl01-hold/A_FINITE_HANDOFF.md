# HOLD — EXACT GATE

## SA-C1-IMPL-01: two contradictory post-write physical-byte expectations

Owner authorization A-SA-C1/2026-10-27-r1 is explicitly granted and accepted. This is not an authorization refusal or a reopening of C1/C2/C3 research. It is the assignment's explicit stop for contradictory required acceptance outcomes discovered before production edits.

Active oracle: contract/F_AMENDED_0_1_4/F011_EXACT_TEST_VARIANTS_0_1_3_PROPOSED.json in accepted A-SA-CLOSURE/2026-10-27-r2 (original archive SHA 564dd204ebb26b6a0463a52c10019037f3fb8faf14e2a82472fcdd861229605b).

| Exact case | Mutation | Frozen physical-byte expectation |
|---|---|---|
| F-SA-26-commit-throw, /variants/55/expected/persistedByteDisposition | setItemCommitsThenThrows | UNCHANGED |
| F-SA-27a, /variants/56/expected/persistedByteDisposition | afterSaveAckThrows | UNCHANGED |

The same oracle's counter_scope explicitly says: “Conforming setItem throw: 1 invocation/unchanged bytes; commit-then-throw: 1 invocation/changed bytes/uncertain ACK.” The normative F011 machine-oracle document defines UNCHANGED as exact before/after raw-string equality; its first-match check6 explicitly allows changed physical bytes after synthetic commit-then-throw and forbids a compensating write or second save/replay. Integrated persistence contract and D's accepted report preserve that distinction. The rows' UNCERTAIN result tuples, unchanged accepted memory and one-read/one-write counts are coherent; the two physical-byte fields conflict with those requirements.

For a genuine changed source acceptance, the required new model revision and appended receipt produce different bytes. The “valid source/result could be identical” exception cannot avoid that difference in these controller cases. Once a fault performs the real write before throwing, returning UNKNOWN/UNCERTAIN cannot roll storage back. Satisfying raw-byte UNCHANGED would require avoiding the prescribed fault/write, restoring stale bytes with a prohibited second write, silently weakening the expected outcome, or misreporting evidence. None was done.

## Concrete diagnostic and limits

storage-fault-repro.mjs ran with pinned installed Playwright and genuine /usr/bin/chromium 154.0.8037.57 at fresh localhost origin http://127.0.0.1:5197 using a disposable context and synthetic strings only. Both faults actually invoke native localStorage.setItem. Each attempt records one getItem and one setItem; a separate explicitly counted diagnostic read inspects the result. Both show CHANGED physical bytes, UNCHANGED accepted-memory value, and zero compensating writes. Raw stdout/stderr/exit, observation JSON and native trace are included.

This is a native-storage negative primitive reproduction, NOT an implemented SA controller/source-authority positive or execution of the two oracle stage cases. No mock receipt, decoder or authority was used. All152 SA vectors and other candidate producer/independent gates remain UNRUN; no old PASS or primitive observation is transferred as a candidate result.

## Verified preflight and preservation

Outer16, accepted191, E23, F-base10, F-amended78 and E-R2 38 manifest entries verify. Original accepted archive, D report and accepted original specialist E/F archive hashes match. E81 definitions exactly embed in F116, which exactly embed in load119. Authentic bundle SHA/verify, actual baseline commit/tree, git fsck and all33 baseline source/lockfile Git-object hashes pass. Baseline is authentic88d606ea940be945fa55124671c1a8deb57c7b04/tree1efa8ec205d125ac3fac9d934e99cfdccceff872, never an artifact delivery branch or reconstructed source identity.

Existing refs and all six pre-existing worktrees' HEAD/branch/status/tracked file bytes/modes match before/after/final inventories. No applicable AGENTS.md was found. Hooks are inactive sample hooks; no hook disabled. SA target branch/path were absent and remain absent. No baseline functional suite was rerun. No source, tests, contracts, main/T1/integration or lockfile changes, candidate commit, push, CI dispatch, public upload, merge, migration, deployment or release occurred.

## Exact finite issue for A

Please disposition these two persistedByteDisposition expectations against the already specified post-write uncertainty semantics. If CHANGED physical bytes is intended for the two forced-commit fault recipes, supply that bounded oracle clarification/correction while retaining unchanged accepted memory, UNCERTAIN tuples, one read/one attempted write, revoked capabilities, explicit reload and no compensation. If another interpretation is intended, state the required observable behavior explicitly. The input oracle was not edited. No new schema/status/production path is proposed and no broad contract research restart is requested.

The owner's approval remains recorded. After A resolves this finite acceptance conflict, the isolated implementation can begin from the same authentic unchanged baseline under the existing nine-path authorization. No passing SA candidate is delivered here. SA-001 remains OPEN P1, T2-LINK separate OPEN P2; Open Interval and mathematical objectives remain separate.
