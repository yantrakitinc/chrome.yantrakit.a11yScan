# Flow: Click multiple Highlight buttons in sequence → flash timer resets per click

## Preconditions
- Extension loaded; sidepanel open
- Scan completed; ≥2 violations rendered with .highlight-btn rows

## Steps

1. Click first `.highlight-btn`.
   - Expected: HIGHLIGHT_ELEMENT message sent.
   - Expected: that row gets `.ds-flash-active` class.
   - Expected: 3-second timer starts.

2. Within 1 second, click the SAME `.highlight-btn` again.
   - Expected: existing timer is cleared; new timer starts.
   - Expected: row stays `.ds-flash-active` (no flicker, no class drop).

3. Click a DIFFERENT `.highlight-btn` (a sibling row).
   - Expected: HIGHLIGHT_ELEMENT message dispatched for new selector.
   - Expected: new row gets `.ds-flash-active`.
   - Expected: previous row may keep its class until its timer expires (concurrent flashes allowed) — verify class state is independent per row.

4. Wait 3.5 seconds.
   - Expected: all `.ds-flash-active` classes have cleared.

## Verification mechanism
`e2e/verify-flow-multi-highlight-flash-timer-reset.ts`.

## Status
⚠ Unverified by Puppeteer until PR #128 lands.
