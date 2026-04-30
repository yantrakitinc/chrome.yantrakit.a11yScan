# F02 — Multi-viewport scan

## Purpose
Run a single-page scan at each width in `state.viewports` (default [375, 768, 1280]) → diff per-viewport results into shared + viewport-specific violations → render with chip filters.

## Source of truth
[F02-multi-viewport-scan.md](../../legacy/features/F02-multi-viewport-scan.md)

## Acceptance criteria

- [ ] Multi-viewport checkbox enables MV mode; viewports list editable via vp-edit
- [ ] Click Scan Page in MV mode triggers MULTI_VIEWPORT_SCAN
- [ ] Background resizes window to each viewport, scans, restores original width
- [ ] MULTI_VIEWPORT_PROGRESS messages broadcast {currentViewport, totalViewports} per step
- [ ] Per-viewport scan failure isolated — other viewports' results still render
- [ ] Diff classifies violations as shared (in every successful viewport) vs viewportSpecific (subset)
- [ ] mv-filter-chips render: All + one chip per viewport
- [ ] Click chip filters violations to that viewport (or All)
- [ ] viewportSpecific violations show viewport-width badge inline
- [ ] mvViewportFilter resets to null on Clear

## Verification mechanism
`e2e/verify-feature-f02-multi-viewport-scan.ts` — fixture page where the same violation appears at narrow + wide widths but a viewport-only one at 375px; assert diff + chip filter behavior.

## Structural gaps
- Window resize via `chrome.windows.update({width})` is browser-state-dependent — Puppeteer harness drives a single window. Cross-window edge cases NOT verified.
