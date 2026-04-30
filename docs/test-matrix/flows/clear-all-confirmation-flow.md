# Flow: Context menu "Clear All" → confirmation bar → confirm → state wiped

## Preconditions
- Extension loaded; sidepanel open
- state.scanPhase=results (scan ran); state.manualReview has entries; state.ariaWidgets populated
- Observer mode toggle ON; observer history has entries

## Steps

1. Right-click on any element in the inspected page → context menu shows "Clear All A11y Scan State".
   - Expected: chrome.contextMenus item registered (background sets it up at extension install).

2. Click "Clear All A11y Scan State".
   - Expected: background sends CONFIRM_CLEAR_ALL to sidepanel.
   - Expected: sidepanel shows confirm-clear-bar (yes/cancel).

3. Click `#confirm-clear-cancel`.
   - Expected: confirm-clear-bar disappears; no state change.

4. Right-click again → Clear All.
   - Expected: confirm-clear-bar shows again.

5. Click `#confirm-clear-yes`.
   - Expected: clearScanResultsSlice runs; STATE_CLEARED sent to background.
   - Expected: state.lastScanResult=null; state.crawlResults=null; state.ariaWidgets=[]; state.ariaScanned=false; state.manualReview={}.
   - Expected: state.violationsOverlayOn=false; state.tabOrderOverlayOn=false; state.focusGapsOverlayOn=false.
   - Expected: HIDE_VIOLATION_OVERLAY + HIDE_TAB_ORDER + HIDE_FOCUS_GAPS + CLEAR_HIGHLIGHTS + DEACTIVATE_MOCKS sent to content.
   - Expected: confirm-clear-bar disappears; panel rerenders to idle.
   - Expected: Observer mode toggle stays ON (Clear does not reset modes).

6. Verify Clear button (in the action area) does the same flow without confirmation when clicked directly.

## Verification mechanism
`e2e/verify-flow-clear-all-confirmation.ts` — pending. context-menu trigger requires custom Puppeteer interaction.

## Status
⚠ Unverified by Puppeteer. Unit tests cover clearScanResultsSlice slice.

## Structural gaps
- Right-click context menu UI itself NOT directly verified (Chrome chrome-internal UI). The harness can verify the message dispatch + state outcome.
