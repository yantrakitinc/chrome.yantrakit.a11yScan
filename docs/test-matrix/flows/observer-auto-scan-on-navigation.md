# Flow: Observer mode auto-scans on navigation

## Preconditions
- Extension loaded; sidepanel open
- Active tab on Page A
- Observer mode toggle is OFF; observer history empty

## Steps

1. Click Observer mode-btn to enable.
   - Expected: state.observer=true; aria-pressed=true; OBSERVER_ENABLE sent.
   - Expected: persisted in chrome.storage.local.

2. Wait for any in-flight settling.

3. Navigate active tab to Page B (different URL).
   - Expected: tabs.onUpdated fires status=complete on Page B.
   - Expected: background runs SCAN_REQUEST against Page B.
   - Expected: SCAN_RESULT logged to observer history with source="auto", URL=Page B URL, viewport bucket per current width.

4. Navigate active tab to Page C.
   - Expected: same auto-scan flow → entry #2 in history.

5. Click Observer sub-tab (`#subtab-observe`).
   - Expected: OBSERVER_GET_HISTORY sent.
   - Expected: rendered list shows 2 entries, sorted timestamp-desc (Page C first, Page B second).

6. Type "B" in `#observer-domain-filter`.
   - Expected: targeted DOM update narrows visible rows; only Page B row visible.
   - Expected: input KEEPS focus (no full re-render).

7. Click `#clear-observer`.
   - Expected: OBSERVER_CLEAR_HISTORY sent; rerender empty state.

## Verification mechanism
`e2e/verify-flow-observer-auto-scan-on-navigation.ts` — pending.

## Status
⚠ Unverified by Puppeteer.
