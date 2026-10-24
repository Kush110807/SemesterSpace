# Served UI QA — synthetic data only

Opt-in QA entry using actual engine/controller/UI modules and separately prefixed native localStorage. Excluded from normal builds/deployment; no mocked calculations.

After npm run build, copy this directory to dist/qa. In managed Sites start the supported preview daemon and open /qa/mobile.html on its returned origin. With a local static server serving dist, use that server's /qa/mobile.html. Iframe CSS viewport is 390px; native scrollbar may reduce client width to 375px. /qa/index.html is full-width.

Use invented academic identity/counts. Complete setup, suggest two dates, deselect one, accept subset, reconfirm lower counts and use Reload QA page. Storage prefix semesterspace-ui-release-qa: separates this model from the production key.

Fill writes synthetic filler until actual QuotaExceededError. Save a much longer note to exercise FAILED. Always click Free synthetic quota filler afterward; it removes only filler, retaining the QA model. Save again to check recovery. Never test on an origin holding important unsaved work. A used only the isolated preview.

Run npm run build again before packaging to remove dist/qa. Verify no qa/ entries in deployment archive. This is not physical-device, screen-reader, deployed-domain or browser storage-denial evidence.
