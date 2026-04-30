# Flow: Inspector pin element A → hover B → click B → re-pin to B

## Preconditions
- Extension loaded; sidepanel open
- Active tab has at least 2 distinct interactive elements (e.g., a button and a link)
- SR top tab activated

## Steps

1. Click `#sr-inspect`.
   - Expected: ENTER_INSPECT_MODE sent; pinned=false.

2. Hover over element A (e.g., a button).
   - Expected: tooltip renders with role/name for A.

3. Click on element A.
   - Expected: pinned=true; pinnedElement=A; tooltip border turns indigo (`2px solid #6c6cff`); tooltip pointer-events=auto.
   - Expected: INSPECT_ELEMENT broadcast with iInspectorData for A.

4. Hover over element B (a different element).
   - Expected: tooltip stays on A's data (because pinned).
   - Expected: highlight stays on A.

5. Click on element B.
   - Expected: pinned remains true; pinnedElement transitions to B.
   - Expected: tooltip updates to B's data; border still indigo (still pinned).
   - Expected: INSPECT_ELEMENT broadcast with iInspectorData for B.

6. Click on element B AGAIN (same as currently pinned).
   - Expected: pinned=false; tooltip removed; highlight removed.

7. Press Escape.
   - Expected: exitInspectMode runs; listeners detached; tooltip already gone (no double-detach error).

## Verification mechanism
`e2e/verify-flow-inspector-pin-then-re-pin.ts`.

## Status
⚠ Unverified by Puppeteer until PR #128 lands.

## Structural gaps
- Pin click via Puppeteer mouse is racy (already documented for sr-scope-set-from-inspect). This flow uses the same dispatchEvent technique; the unit suite at `src/content/__tests__/inspector.test.ts` exhaustively covers the pin/unpin/re-pin state machine.
