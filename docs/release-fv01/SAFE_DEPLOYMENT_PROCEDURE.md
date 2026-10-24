# Safe deployment procedure — approval required

## Verified output

Deployable directory: the attached candidate's `semester-space/dist/` produced by the successful pinned install/build. Ready-to-upload archive: **`SS_FV01_VERIFIED_DIST.zip`**, included in this handoff. It contains **index.html at archive root plus src/** (72 static files), including all 39 prepared local PDF/OCR assets. It excludes node_modules, tests, reference documents and QA/browser profiles.

Exact source ZIP SHA-256: `5e46451335fb8e96d2cc9efab21222e9b0630996e69acc5dffed0490937a3acb`.
Exact build ZIP SHA-256: `c9551a363210fc2fb627266730d70f8a8d615c8f3b4eb9a820d6b38904b92e6b`.
The separately included BUILD_INTEGRITY.sha256 covers the deployed file contents. From the extracted static-site directory, run `sha256sum -c /path/to/BUILD_INTEGRITY.sha256`.

## Procedure for A after explicit owner approval

1. Keep this source/build frozen and verify their checksums. Use the included verified build, or reproduce from the exact source with the pinned lockfile and compare BUILD_INTEGRITY.sha256. Preserve existing release/SS-INT-002 fallback. Do not substitute an older feature branch.
2. Confirm the authorized hosting account/project and target origin with the owner. Historical hosting IDs in source reports are historical; do not invent missing hosting configuration or blindly reuse identities. Use the existing authorized zero-additional-spend static hosting service.
3. Stage the verified dist contents on an owner-controlled **HTTPS** preview first. index.html must be at the site root. Retain src and all worker/WASM/language/font/license files unchanged. Serve .js/.mjs as JavaScript, .wasm as application/wasm and .gz as application/gzip with the original bytes. Avoid double decompression or HTML fallback responses for missing assets. Check CSP permits the local module workers/WASM and preview images used by the app. No external CDN or document-processing backend is required.
4. Run the source-specific smoke flow on that actual origin using an isolated synthetic browser profile: PDF upload/extraction, explicit review, delayed stage/edit/recovery, selection/apply, write-failure rollback, close/reopen and retained commitments. Verify all local assets load and no uploaded document bytes leave the browser. Device clocks must be correct for real use.
5. Before updating an existing origin, let the owner securely back up its current `semesterspace.v1` data and preserve the previous site build. Keep real records out of reports/repos. localStorage is origin-specific: a new origin does not automatically receive old data. The v1→v2 envelope migration is one-way; after new confirmed writes, an old build may quarantine newer data. Do not clear storage, blindly restore older counts or downgrade journals as a rollback workaround. Preserve newer bytes and use a compatible/reviewed recovery path if necessary.
6. After successful preview and explicit release approval, A may publish the complete static release atomically using the authorized platform. Avoid mixed old/new JS/worker assets and stale caches. Verify production HTTPS, file MIME behavior and the same bounded smoke checks. Retain rollback artifacts and record the exact deployed build hash/target/time.
7. Devfolio submission/publication is a separate action requiring explicit user approval and verified deadline/required fields. This procedure does not perform it.

No deployment, merge or Devfolio submission was performed during this verification. Artifact-only handoff delivery is not a production deployment. Single-tab use remains the verified boundary; concurrent-tab optimistic storage checks are not a serializable compare-and-swap guarantee. Personal timetable/groups, activity treatment, counts/policy/horizon still require real user confirmation.
