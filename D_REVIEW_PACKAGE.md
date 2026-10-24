# D-IMP-01 source package for independent review

Exact repair base: `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`.
Exact tested feature repair: `9486866f1d8f50d584dc8481d516fefbbe0b638e`.
The external `D_REVIEW_PACKAGE.json` records the exact metadata-only package source commit and external ZIP SHA-256. The package includes the tracked `SOURCE_PACKAGE_MANIFEST.json` identifying base and tested feature commits. A commit cannot embed its own final hash; package identity is consequently external.

Read [the repair handoff](semester-space/docs/D_IMP_01_REPAIR.md) for D’s unchanged reproduction, before/after evidence, effective-link validation, source-specific reconciliation, actual commands and limitations. The isolated `D-IMP-01.patch` beside the ZIP contains the complete binary-capable repair commit diff against the base. The source ZIP includes the entire project, implementation, pinned lockfile, asset-generation scripts, all tests, reference inputs, evidence and updated handoffs. node_modules, generated vendor assets, dist and Git internals are excluded. Follow `semester-space/README.md` for installation and local asset preparation.

Actual checks: clean install, 52 syntax modules, 136 full tests (108 unchanged plus 28 regressions), 26 engine tests, 342 arithmetic cases, build and served-browser connected flow passed. Five calendar corpus inputs decoded with partial semantic extraction; they are not evidence of complete calendar interpretation. Physical-device and screen-reader checks were not run. See the handoff for exact distinctions between actual UI and controlled browser module API checks and the initial browser test-data failure.

## Current integrity and historical checksums

From the extracted project root:

```sh
sha256sum -c PACKAGE_INTEGRITY.sha256
```

This current manifest covers every payload file except itself. The external ZIP sidecar covers the complete named ZIP, including that manifest. From the directory holding the downloaded ZIP and sidecar:

```sh
sha256sum -c SemesterSpace-D-IMP-01-source.zip.sha256
```

On Windows, compare `Get-FileHash .\SemesterSpace-D-IMP-01-source.zip -Algorithm SHA256` with the sidecar. This checksum applies to the named ZIP provided with the sidecar, not GitHub’s separately generated branch archive. External package metadata also records the patch SHA-256. Checksums verify bytes; they are not signatures or independent correctness proof.

`BUNDLE_MANIFEST.sha256` and `semester-space/MANIFEST.sha256` are explicitly labelled historical packet checksums. Original entries remain for provenance and must not be substituted for the current manifest. Earlier reports retain their historical results.

## Absent hosting file and preserved limits

Historical manifests refer to `semester-space/.openai/hosting.json`, absent at repository intake and both the earlier tested feature and this repair. The precise earlier omission cause is not established. A historical checksum cannot recover its contents or establish current hosting state. No hosting configuration was created, reconstructed, removed or changed; local install/tests/build do not require it.

Engine, controller, storage, main entry point, shared schema/contracts and original unit tests remain unchanged against the repair base. Reader/parser and extraction limitations are preserved. Software cannot detect every omitted event; human reconciliation and manual coverage are assertions, not proof of completeness. Q3 Physics remains unresolved. SS-INT-002 remains the fallback. No default-branch merge or deployment; additional spend ₹0.
