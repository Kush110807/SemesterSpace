# SS-INT-002 — UI release candidate

Read CURRENT_STATE.md and docs/UI_INTEGRATION_SS-INT-002.md, then PRODUCT_SPEC.md and CONTRACT.md 1.1.0. SS-INT-001 D approval and B recovery-correction acceptance remain scoped to that baseline. New UI-delta review is pending.

- Existing D chat: attach this full ZIP and paste briefs/D_UI_RELEASE_REVIEW.md. Return findings to A; do not restart proposal/contract review.
- Existing C chat: briefs/C_UI_INTEGRATION_FEEDBACK.md records integration and footer contrast correction; no mandatory patch outstanding.
- A alone merges. New sessions do not inherit files or hosting access. Keep one authoritative repository and existing private Site ID.
- Run npm start (Node >=20), npm run check, npm test, node --test tests/engine/*.test.mjs, python3 tests/checker.py (python on Windows), npm run build. No install/API key required.
- BASELINE.txt identifies packet commit; MANIFEST.sha256 covers packet bytes. tools/manual-qa is optional local-only QA, excluded from normal build/deployment.
- Protect original final four-hour release reserve. Deployed-domain interaction, full device/assistive-technology checks and official submission rules remain unresolved. No feature expansion or engine rewrite.
