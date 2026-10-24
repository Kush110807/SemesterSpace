# D-IMP-01 independent review package

Download **SemesterSpace-D-IMP-01-source.zip** using its Raw / Download button. This is a complete source archive, not a pasted diff. Download its `.sha256` sidecar and verify with `sha256sum -c SemesterSpace-D-IMP-01-source.zip.sha256`. Do not compare that checksum to GitHub’s automatic branch ZIP.

`D_REVIEW_PACKAGE.json` gives exact base, tested repair and metadata-only packaging commit SHAs, ZIP bytes/SHA-256 and actual package verification results. `D-IMP-01.patch` is the isolated binary-capable repair commit diff against the base. After extracting the ZIP, run `sha256sum -c PACKAGE_INTEGRITY.sha256` from `SemesterSpace/`. Follow `semester-space/README.md` for clean installation and local asset generation.

The current handoff is `semester-space/docs/D_IMP_01_REPAIR.md`, with D’s exact before reproduction and extended before/after results, actual browser/corpus evidence and remaining extraction limitations. Checks pass: 136 full tests, 26 engine tests, 342 arithmetic cases, syntax, build, served browser. All five corpus inputs decoded; semantic extraction is partial and requires manual completion. Q3 Physics remains unresolved. Engine/controller/storage/shared schema and original unit tests preserved. No merge or deployment; ₹0 additional spend.

This artifact branch contains delivery files only. Implementation source is on `feature/document-import`; exact commits are in the external JSON. Older artifact commits retain prior packages for history.
