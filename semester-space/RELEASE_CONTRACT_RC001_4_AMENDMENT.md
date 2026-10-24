# SemesterSpace release contract amendment RC-001.4 — import revision integration

Date: 24 October 2026. **Scope:** additive integration of Codex-owned importer revision producer into the authoritative RC-001.3 A+B+C tree. Read after RC-001, RC-001.1, RC-001.2 and RC-001.3. **No change** to engine Model schema 1, release-envelope schema 2, six engine statuses, canonical occurrence IDs, B's attendance journal, authoritative clock, or atomicity rule.

## Ownership and activation

- **Codex:** `src/import/**`, `tests/import/**`, `docs/IMPORT_DELIVERY.md`. Two commits `d1a62c4…` and `6a8d0a0…`, derived from the D-accepted package. Export `extractCalendarRevision`, `prepareCalendarRevision`, `buildRevisionCandidate`, and manual source reconciliation helpers unchanged. Pure candidate building is mandatory, not a controller storage operation.
- **A:** `src/main.js` injects `revision` into the controller. `src/controller.js` validates the returned source patch and performs the same single-envelope save-before-swap commit. `src/storage.js` validates persisted provenance and migrates earlier metadata read-only until the next acceptance. A owns `tests/integration/rc0014-importer-real.test.mjs` and integration test updates.
- **C:** `src/ui/**` only. The current revision file input remains **selected locally / not processed**, even though Codex extraction now exists; C must connect extraction and a full editable review draft to the unchanged `onProposeCalendarRevision` and `onApplyCalendarRevision` callbacks. A's `state.stagedCalendarRevision` is a transient deep copy. C must not auto-confirm source applicability, old missing rows, ambiguity, cancellations, historical rescheduling or coverage.
- **D:** read-only independent audit of the exact RC-001.4 candidate and real connected workflow. No release approval is inferred from a synthetic test.

## Persisted sourceRevision schema, version 1

Within the unchanged v2 envelope, `release.calendar.sourceRevision` may still be `null` or a legacy `{sha256,fileName}`. New successful revision acceptance writes:

```json
{
 "version":1,
 "sha256":"64-hex-source-sha-from-reviewed-proposal",
 "fileName":"approved-calendar.pdf",
 "source":{"id":"calendar:...","sha256":"...","fileName":"approved-calendar.pdf","role":"ACADEMIC_CALENDAR","coverage":"PARTIAL","section":"Q","pageRefs":[]},
 "scope":{"start":"2026-10-24","end":"2026-12-31","section":"Q","subgroup":"Q3","programmingGroup":"Q23"},
 "links":[{"sourceRef":"change:stable-uuid","changeId":"change:stable-uuid","kind":"ADD_HOLIDAY","targetId":"2026-11-02","value":{"date":"2026-11-02","label":"Reviewed nonteaching day"},"evidence":{"sourceId":"calendar:...","page":1,"excerpt":"Relevant source text","basis":"DIRECT_SOURCE"},"sourceSha256":"..."}],
 "sourceHistory":[{"sha256":"previous-source-sha","fileName":"previous.pdf"}]
}
```

The example is schema illustration, not an actual personal calendar or source confirmation.

**Validation:** A requires candidate `sourceRevisionPatch.version=1`, exact reviewed source/scope, exactly one matching link per accepted change ID, no foreign/unselected link, unchanged canonical target identity, and evidence/value equality. Persisted v1 crosswalks must contain unique nonblank `sourceRef`, `kind`, `targetId`, per-link source hash and page/excerpt evidence. Corrupted data quarantines the saved envelope without writing it. Old filename/hash metadata remains loadable and is converted only upon a separately reviewed application.

**Merge:** accepted links replace only the previous link for the same `(kind,targetId)`; other links are retained. Previously retained links keep the old file SHA, even when the new source is different. `sourceHistory` retains the prior source identity; `appliedRevisions` is append-only. The code never infers missing extracted rows as deletion. No claim that all content of a PARTIAL source was adopted, even when a subset is applied.

**Atomicity:** `buildRevisionCandidate` cannot stamp a revision or write storage. A checks unchanged model identity, snapshots, confirmed attendance, recorded/started occurrences, commitments and history; validates the next model and release together; evaluates retained commitments; writes one version-2 envelope with optimistic revision; only on success swaps memory and clears staging/suggestions. Failure leaves model, journal, source links and commitments unchanged. A's transaction clock is captured once and solely by A. **Limit:** a single `localStorage` write is atomic as one key, but the optimistic revision read/check is not a true cross-tab compare-and-swap; simultaneous-tab concurrency requires separate validation and is not claimed safe here.

## File-upload and review contract boundary for C

1. A browser-native File supplies bytes to `extractCalendarRevision({academicCalendar:{fileName,bytes},section,signal,onProgress})`, with device-local processing and cancellation/error states. Never assume a selected file has been processed.
2. Show `draft.pages`, `draft.issues`, applicable scope and every `review.effects`, `review.exclusions`, `review.missing`, original source/target links, competing alternatives and source coverage. Keep unknown and unsupported interpretations blocked; no auto-confirm. Initial import remains separate from revisions.
3. **Only after explicit review**, call `prepareCalendarRevision({currentModel:state.model,existingSourceRevision:state.release.calendar.sourceRevision,extractedDraft})`. If prior metadata is missing or legacy, require `legacySourceReviewed` and a reason instead of inventing old links. Show `comparison` and unresolved items.
4. Stage only its returned `proposal` using A's existing `{expectedModelRevision,proposal}` callback. A exposes the frozen proposal as `state.stagedCalendarRevision`. The normal explicit `ApplyRevisionRequest` stays unchanged. A's apply enforces reviewed evidence and creates the durable crosswalk.

This amendment **does not** add an implicit document-upload or automatic user-confirmation callback. C must implement the above display/interaction in its owned UI files; until then the current file selector may remain disabled or explicitly nonfunctional.

## Known non-release boundaries

The imported parser recovers some additional annotated date/kind matches but remains PARTIAL for MAIT orientation/sessional I and several grids/cohort/legacy Hindi cases. Actual Q3 Physics, activities, attendance counts/policy, teaching horizon and source applicability remain unconfirmed. Build, complete installed suite, full connected revision browser workflow, physical accessibility and production deployment require separate evidence. **Release gate: HOLD.**
