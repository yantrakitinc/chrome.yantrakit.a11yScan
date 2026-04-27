# R-INSPECT, R-CTX — Inspector + Context Menu

## R-INSPECT — Inspector mode (Screen Reader scope picker)

### Purpose

Let the user pick a specific element on the page to scope the Screen Reader reading order to.

### Activation

User clicks the Inspect button (⊕ crosshair icon) in the Screen Reader tab top row.

### Behavior

1. Sidepanel sends `ENTER_INSPECT_MODE` to content script.
2. Content script attaches a hover overlay:
   - As cursor moves, the element under the cursor gets a blue dashed outline (2px dashed `#3b82f6`).
   - A small label tooltip near the cursor shows the element's tag + ID + classes.
3. On click on the page:
   - Compute a stable selector for the element (prefer ID, fall back to nth-of-type chain).
   - Broadcast `INSPECT_ELEMENT_PICKED { selector, tag, role, name }`.
   - Send `EXIT_INSPECT_MODE` (sidepanel will request exit too — idempotent).
4. Sidepanel receives the broadcast → sets `state.srScopeSelector` → triggers a scoped `ANALYZE_READING_ORDER`.

### Visual feedback

- Cursor changes to crosshair while in inspect mode.
- The blue outline follows the hovered element using `getBoundingClientRect()` + a fixed-position overlay div.
- Escape key in inspect mode: exits without picking. Sidepanel listens for the keypress and sends `EXIT_INSPECT_MODE`.

### Cleanup

- `EXIT_INSPECT_MODE` removes the hover handler, the outline div, and the cursor style.
- Always called when SR tab is left or the side panel closes.

### Test cases

E2E:
1. Click Inspect → button shows pressed state, cursor on page becomes crosshair, hover shows blue outline.
2. Hover over a `<nav>` → outline around it.
3. Click the `<nav>` → sidepanel scopes the SR list to that nav. Scope indicator appears.
4. Press Escape during inspect mode → exits without picking.
5. Click Clear in SR tab during inspect mode → exits cleanly.

## R-CTX — Context Menu

### Purpose

Right-click context menu items added by the extension.

### Items

1. "Open A11y Scan" — opens the side panel on the active tab.
2. "Scan this page" — opens side panel + triggers Scan Page automatically.
3. "Inspect for screen reader" — opens side panel, switches to SR tab, enters inspect mode.

### Implementation

Background `chrome.contextMenus.create()` on extension install. `chrome.contextMenus.onClicked` handler routes to the appropriate action.

### Test cases

E2E (limited — Puppeteer's native context menu support is restricted, so these are best verified manually):
1. Right-click on a page → A11y Scan items appear.
2. Click "Scan this page" → side panel opens, scan starts.
