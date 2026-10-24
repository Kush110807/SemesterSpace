# D independent review — corrected source download

Download **[SemesterSpace-D-review-source.zip](SemesterSpace-D-review-source.zip?raw=true)**, its **[SHA-256 sidecar](SemesterSpace-D-review-source.zip.sha256)** and **[external package manifest](D_REVIEW_PACKAGE.json)**. These are the exact ZIP bytes for the checksum below; GitHub's automatically generated branch ZIP is a different archive.

- Base: `feb40999bdc59fc7ef41eb55e24665a690985fa6`
- Tested feature implementation: `044252287a3bebb7c2199076f52c531b5c2c90bb`
- Metadata-only package source: `16fe844f56c98f8b1d529a250dac3a7d67a6c3c9`
- ZIP SHA-256: `e78c6b36eba6ce9cca71646232d9d125f353ea854d3a31e5e97152ccf3c7e10d`

After downloading the ZIP and sidecar into one folder, run `sha256sum -c SemesterSpace-D-review-source.zip.sha256`. Extract the ZIP, enter `SemesterSpace`, then run `sha256sum -c PACKAGE_INTEGRITY.sha256`. The complete source includes SOURCE_PACKAGE_MANIFEST.json, pinned lockfile, asset-generation scripts/licenses, tests, browser/corpus evidence and handoff. Generated dependencies, vendor assets and dist are excluded.

The artifact branch contains delivery files only. The source is from `feature/document-import` at the package source commit above. No runtime, hosting configuration, default-branch merge or deployment was changed. Read the bundled D_REVIEW_PACKAGE.md for historical manifests and the hosting file that was already absent at repository intake. Extraction limitations and SS-INT-002 fallback remain unchanged.
