# FV-01 verified source synchronization

Publication date: 25 October 2026 (Asia/Kolkata). This is source synchronization, not new implementation or deployment.

## Authoritative identity

- Source archive: `SS_FV01_Final_Source.zip`
- Archive SHA-256: `5e46451335fb8e96d2cc9efab21222e9b0630996e69acc5dffed0490937a3acb`
- Release branch: `release/fv01-verified`; target: `main`.
- Repository main inspected at `985ae01a7edf0f27dbc96a1c3abb8bef1a6a7a3c`.
- Parent implementation commit: `95de7e5e65c5e833529c2fe6db0a929c6c6c9f97`, retaining document-import and calendar-revision history including `6a8d0a09abbfa7cefc0b3cf9a8227fcdb190c115`.
- All 199 original archive files are transferred byte-for-byte with the leading `SemesterSpace/` archive directory removed. The application stays in `semester-space/`; the six supplied format references stay in `reference-inputs/`.
- `VERIFIED_SOURCE_FILES.sha256` is the current repository-relative 199-file identity manifest. Run `sha256sum -c docs/release-fv01/VERIFIED_SOURCE_FILES.sha256` at repository root.

## Branch inspection and conflicts

Remote main, feature/document-import, feature/calendar-revision-rc001, fix/rc14-d-01, review/shared-release-baseline and artifact branches were inspected. No newer conflicting application work was found. The parent contains 156 tracked paths, all present in the candidate. Candidate transfer adds 43 paths and changes nine parent paths. Main has 80 paths, all present in the candidate. No tracked path is removed. Review-only branches and their additional evidence remain unchanged in their own history. No branch is force-pushed or merged by this task.

## Metadata and packaging differences

The only additions beyond the verified archive are this `docs/release-fv01/` directory: this note, the 199-file manifest and copies of verification reports/logs from the completed release gate. No existing source, tests, lockfile or documentation bytes are edited during publication. `git diff --cached --check` reports five pre-existing trailing-whitespace lines (four Markdown lines in A_INTEGRATION_REPORT_RC0011.md and src/ui/index.js:527); these are retained to preserve the verified bytes. The Git commit/tree is a new publication identity and is not the archive SHA-256.

Older manifests and integration reports are retained exactly as supplied, including historical HOLD states and old source/commit/schema descriptions. They describe earlier packets, not this release identity or current verification. In particular `SOURCE_PACKAGE_MANIFEST.json`, `PACKAGE_INTEGRITY.sha256`, `BUNDLE_MANIFEST.sha256` and `semester-space/MANIFEST.sha256` are historical. `PACKAGE_INTEGRITY_RC0014_FV01_LOCAL.sha256` covers the original candidate's other 198 files; the new repository-relative manifest covers all 199. This directory is excluded from the original candidate manifests by scope, not because the original checksums were regenerated.

No .git directory, archive, node_modules, generated `src/import/vendor/`, dist, credential, browser profile or temporary QA file is copied into the source branch. Required tracked license, lockfile and local asset-generation scripts are retained. No hosting configuration is invented or changed.

## Verification evidence and running

The copied logs/results describe actual completed verification of the exact archive: clean pinned installation, 70-module syntax check, 274 tests, 26 engine tests, 342 arithmetic cases, production build, real Chromium FV-01 recovery without rereading, selective application, storage rollback and native reload. Browser instrumentation and synthetic-data limitations are described in the gate report. They are not new runs triggered by this source-only publication.

From `semester-space/`, use Node.js 20.16+ and Python 3.10+: `npm ci`, then `npm run check`, `npm test`, `node --test tests/engine/*.test.mjs`, `python3 tests/checker.py`, `npm run build`. Installation/build regenerate self-hosted PDF/OCR assets from the pinned dependencies; retain generated licenses in deployed assets. Serve `dist/` over HTTP/HTTPS. See the unchanged application README for extraction limitations, plus SAFE_DEPLOYMENT_PROCEDURE.md here for the deployment boundary.

Full downloadable browser logs, scripts, screenshots, original candidate and verified build: https://github.com/Kush110807/SemesterSpace/raw/e207412b79a55d86279cd82ae2d93940ea2e2a39/SemesterSpace_FV01_Release_Gate_Handoff.zip
Handoff ZIP SHA-256: `8a56bb833b4730ea8163b16f7ad91513cc5bc6a9620f74f2772a6509016c8ba3`.

Extraction remains partial. Q3 Physics, activity treatment, actual counts, policy, horizon and source applicability remain personal confirmations; synthetic QA supplies none of them. No merge, deployment or Devfolio submission is authorized by this publication.
