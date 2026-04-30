# Flow: Scan Page → ARIA tab auto-populates

## Preconditions
- Extension loaded; sidepanel open
- Active tab is a page WITH ARIA widgets (tablist + dialog + checkbox)
- state.scanPhase=idle; state.ariaWidgets=[]; state.ariaScanned=false

## Steps

1. Click `#scan-btn`.
   - Expected: state.scanPhase=scanning; SCAN_REQUEST sent; scan-progress card shows.
   - Expected: state.ariaScanned reset to false at start.

2. Wait for SCAN_RESULT.
   - Expected: state.lastScanResult populated; state.scanPhase=results.
   - Expected: Sub-tabs render (Results / Manual / ARIA).

3. Background ARIA scan completes.
   - Expected: RUN_ARIA_SCAN response → state.ariaWidgets populated; state.ariaScanned=true.
   - Expected: rerender() fires; ARIA tab body refreshes.

4. Click `#subtab-aria`.
   - Expected: ARIA sub-tab activates; state.scanSubTab=aria.
   - Expected: Each detected widget renders as <details>; failing widgets open by default.

5. Verify rendered HTML.
   - Expected: NO "No ARIA widgets scanned yet" text.
   - Expected: NO `#run-aria-scan` button.
   - Expected: At least 3 `<details>` elements present (tablist + dialog + checkbox).

## Verification mechanism
`e2e/verify-aria-tab-populated-after-scan.ts` (PR #102) — exists and passes.

## Status
✅ Verified 2026-04-29 via real-Chrome Puppeteer.
