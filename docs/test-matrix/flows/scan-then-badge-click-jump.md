# Flow: Scan Page → click violation badge on page → side panel jumps to that violation

## Preconditions
- Extension loaded; sidepanel open
- Active tab has multiple violations (≥3 different nodes from any rules)

## Steps

1. Click `#scan-btn`. Wait for results.
2. Click `#toggle-violations` to ON.
   - Expected: SHOW_VIOLATION_OVERLAY sent; numbered badges + outlines render on inspected page.
   - Expected: button has aria-pressed=true + .active class with amber-100 bg.

3. Click violation badge #2 in the inspected page.
   - Expected: VIOLATION_BADGE_CLICKED message sent with payload.index=1 (zero-indexed).
   - Expected: side panel scrolls to violation #2's <details> in the Results sub-tab.
   - Expected: that <details> opens.
   - Expected: side panel row gets .ds-flash-active for 3s.

4. Click violation badge #3.
   - Expected: VIOLATION_BADGE_CLICKED with index=2.
   - Expected: side panel scrolls to violation #3.

5. Verify the indices are correct (NOT all the same — the bug fix in PR #41).

## Verification mechanism
`e2e/verify-flow-scan-then-badge-click-jump.ts` — pending.

## Status
⚠ Unverified by Puppeteer. Unit test in PR #41 covers the closure fix; real-Chrome verification of the panel-side scroll behavior pending.
