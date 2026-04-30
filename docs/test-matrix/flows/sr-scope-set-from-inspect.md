# Flow: SR tab → Inspect → pick element on page → SR rebuilds scoped to that element

## Preconditions
- Extension loaded; sidepanel open
- Active tab on a page with multiple containers (header / nav / main / footer)
- SR tab activated; srState.elements may or may not be populated

## Steps

1. Click `#tab-sr` to activate SR top tab.
2. Click `#sr-inspect`.
   - Expected: srState.inspectActive=true; ENTER_INSPECT_MODE sent.
   - Expected: aria-pressed=true on sr-inspect button.

3. On the inspected page, hover over the `<nav>` element.
   - Expected: yellow outline + tooltip with role=navigation.

4. Click on the `<nav>` element.
   - Expected: tooltip border turns indigo (pinned).
   - Expected: INSPECT_ELEMENT broadcast with iInspectorData.
   - Expected: side panel's INSPECT_ELEMENT listener calls setScopeFromInspect("<selector for nav>").
   - Expected: srState.scopeSelector = the selector; srState.inspectActive=false; sr-inspect aria-pressed=false.
   - Expected: scope banner renders in SR panel (showing scoped selector).

5. Click `#sr-analyze` (or it auto-runs).
   - Expected: ANALYZE_READING_ORDER sent with payload.scopeSelector.
   - Expected: response only includes elements within the nav.
   - Expected: rows render scoped.

6. Click `#sr-clear-scope`.
   - Expected: srState.scopeSelector=null; ANALYZE_READING_ORDER (no scope) re-fired.
   - Expected: full-page rows render again.

## Verification mechanism
`e2e/verify-flow-sr-scope-set-from-inspect.ts` — pending.

## Status
⚠ Unverified by Puppeteer.
