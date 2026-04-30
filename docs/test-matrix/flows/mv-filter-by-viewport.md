# Flow: Multi-viewport scan → filter results by viewport chip

## Preconditions
- Extension loaded; sidepanel open
- Active tab is a fixture with violations that vary by viewport (e.g., touch-target violations only at 375px)
- state.mv=true; state.viewports = [375, 768, 1280]

## Steps

1. Click `#scan-btn`.
   - Expected: MULTI_VIEWPORT_SCAN sent; mvProgress card shows.
   - Expected: 3 MULTI_VIEWPORT_PROGRESS messages broadcast (currentViewport=1..3).

2. Wait for MULTI_VIEWPORT_RESULT.
   - Expected: state.lastMvResult populated; state.scanPhase=results.
   - Expected: state.lastScanResult set via mergeMvResultToScan (shared + viewportSpecific concatenated).

3. Click Results sub-tab (already active by default).
   - Expected: violations rendered. Shared violations render plain. viewport-specific render with viewport-width badge inline.

4. Click `.mv-filter-chip[data-mvfilter="375"]`.
   - Expected: state.mvViewportFilter=375; only 375-only + shared violations visible.
   - Expected: that chip aria-pressed=true; All chip aria-pressed=false.

5. Click `.mv-filter-chip[data-mvfilter="768"]`.
   - Expected: filter switches; 768-applicable violations visible.

6. Click `.mv-filter-chip[data-mvfilter="all"]`.
   - Expected: state.mvViewportFilter=null; all violations visible.

7. Click Clear.
   - Expected: state.mvViewportFilter resets to null.

## Verification mechanism
`e2e/verify-flow-mv-filter-by-viewport.ts` — pending.

## Status
⚠ Unverified by Puppeteer. Unit tests cover diff classification + chip render.

## Structural gaps
- chrome.windows.update({width}) behavior under Puppeteer (single window) — harness uses one window; multi-window edge cases NOT verified.
