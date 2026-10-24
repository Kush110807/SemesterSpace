# Corrected source package for D independent review

This is a packaging/documentation correction. The tested runtime, lockfile, asset-generation scripts, tests, reference inputs and browser/corpus evidence remain unchanged.

## Exact source identities

- Investigation base: `feb40999bdc59fc7ef41eb55e24665a690985fa6`.
- Independently tested implementation feature commit: `044252287a3bebb7c2199076f52c531b5c2c90bb`.
- Repository intake before implementation: `985ae01a7edf0f27dbc96a1c3abb8bef1a6a7a3c`.
- The exact metadata-only packaging commit is recorded as `package_source_commit` in the external `D_REVIEW_PACKAGE.json` beside the downloadable ZIP. This is deliberately separate from the tested implementation SHA. A file cannot record the SHA of its own containing commit without a circular dependency.

`SOURCE_PACKAGE_MANIFEST.json` is now a tracked source file and is included in both the repository archive and the corrected review ZIP. It binds this package to the exact base and tested feature SHAs above. Do not interpret `feature_commit` as the hash of a later metadata-only packaging commit.

## Current integrity versus historical checksums

Use **`PACKAGE_INTEGRITY.sha256`** for the current review payload. From the extracted project root:

```sh
sha256sum -c PACKAGE_INTEGRITY.sha256
```

It lists every source-package payload file except the integrity manifest itself. The external `SemesterSpace-D-review-source.zip.sha256` covers the entire ZIP, including the integrity manifest. Verify the downloaded ZIP from the directory containing both files:

```sh
sha256sum -c SemesterSpace-D-review-source.zip.sha256
```

On Windows, `Get-FileHash .\SemesterSpace-D-review-source.zip -Algorithm SHA256` can be compared with the sidecar value. The ZIP's bytes differ from GitHub's automatically generated branch ZIP; use the checksum only for the **named corrected ZIP provided beside that sidecar**, not for a separately generated archive. The file-level integrity manifest remains useful for either archive of the same packaging source commit.

`BUNDLE_MANIFEST.sha256` and `semester-space/MANIFEST.sha256` contain **historical starter-packet checksums**. Their original hash entries are preserved, with explicit historical comment headers. They reference older file bytes and an absent hosting file. They are not intended to pass against this feature source and must not be substituted for the current integrity manifest. BASELINE.txt and older reports likewise describe historical source/review states.

The external `D_REVIEW_PACKAGE.json` identifies the archive name, byte length, ZIP SHA-256, exact `package_source_commit`, exact tested implementation/base commits, and the packaging-only preservation check. It is kept outside the ZIP to avoid self-referential archive hashes. The checksum detects byte differences; it is not a digital signature or an independent semantic correctness proof.

## Why the hosting file is absent

The historical manifests list `semester-space/.openai/hosting.json`, but that file is absent at both the repository intake commit and the tested feature commit. It was not supplied in this repository checkout. The precise earlier omission cause is not established. A historical checksum cannot recover its contents or establish current hosting state.

No hosting file, hosting identity or hosting configuration was created, recreated, removed or changed during this correction. Local dependency installation, development serving, tests and the static build do not require that deployment-specific file. No private-site replacement, merge or deployment was performed. SS-INT-002 remains the fallback.

## Review contents and preserved limitations

The complete source payload includes the lockfile, asset-generation scripts/licenses, all tests, original reference documents, before/after findings, browser/corpus evidence, README and handoffs. It excludes `.git`, node_modules, generated vendor assets and dist. Follow `semester-space/README.md`; `npm ci` regenerates local PDF/OCR assets.

The independently reported checks are preserved as evidence: **108 full-suite tests, 26 engine tests, 342 arithmetic cases, syntax and build pass**. Packaging validation compares implementation files byte-for-byte with the tested feature commit and verifies the current manifest and ZIP. It does not claim a new browser session or independent rerun of those runtime checks for a documentation-only correction.

Calendar extraction is still partial. Manual coverage declarations remain human assertions; software cannot detect every omitted event. Dense grids, some cohort/dual-term/footnote interpretation, and legacy Hindi encoding retain the documented limitations. Q3 Physics remains unresolved. Read `semester-space/docs/CALENDAR_COVERAGE_REVIEW.md` for all four investigated cases, repairs, evidence and unrun checks. No release-readiness claim or additional spending is introduced.
