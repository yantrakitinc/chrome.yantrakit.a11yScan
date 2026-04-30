# Flow: Scan Page on a page with no ARIA widgets → distinct post-scan empty state

## Preconditions
- Extension loaded; sidepanel open
- Active tab is a plain HTML page with NO ARIA widgets

## Steps

1. (Optional) Click `#subtab-aria` BEFORE scanning.
   - Expected: pre-scan empty state with `#run-aria-scan` button + text "No ARIA widgets scanned yet".

2. Click `#scan-btn`.
   - Expected: scan completes; state.scanPhase=results.

3. Background ARIA scan completes with widgets=[].
   - Expected: state.ariaWidgets=[]; state.ariaScanned=true.

4. Click `#subtab-aria`.
   - Expected: post-scan zero-result state.
   - Expected: text reads "No ARIA widgets detected on this page" (NOT "scanned yet").
   - Expected: NO `#run-aria-scan` button visible.
   - Expected: text color green-700 (not gray-500).

## Verification mechanism
`e2e/verify-aria-empty-page-state.ts` (PR #102) — exists and passes.

## Status
✅ Verified 2026-04-29 via real-Chrome Puppeteer. Bug found + fixed in PR #102.

## Why this flow exists
Issue #99 + #101: the user reported the ARIA tab looked unchanged after Scan Page. Root cause was that `renderAriaResultsHtml([])` collapsed two distinct states (pre-scan empty vs. post-scan zero-result) into one branch.
