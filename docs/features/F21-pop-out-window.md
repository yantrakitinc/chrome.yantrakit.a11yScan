# F21 — Pop-out Window

## Purpose

Expand the panel beyond the Chrome side panel's limited width. Gives users more room to review results, especially for complex crawl reports.

## Dependencies

- F18 (Panel Layout) — layout must adapt to wider widths

## Behavior

### Button

Pop-out button in the header. Icon: overlapping windows (similar to Redux DevTools pop-out).

When the panel is expanded, the icon changes to a return/collapse icon (inward-pointing arrows or a minimize-window icon) to communicate that clicking will restore the original width. The button's `aria-label` also toggles: `"Expand panel"` in the default state, `"Collapse panel"` in the expanded state.

### Current implementation

Panel expands to screen width up to a maximum width of **1200px**. If the screen width is less than 1200px, the panel expands to 100% of the screen width. The default (collapsed) width follows Chrome's side panel default (~360px).

The expansion is applied by calling `chrome.sidePanel.setOptions({ width: targetWidth })` where `targetWidth = Math.min(window.screen.width, 1200)`.

### Restoring default width

Clicking the collapse button calls `chrome.sidePanel.setOptions({ width: 360 })` to return to the default side panel width.

### Page overlays when panel width changes

When the side panel width changes, the inspected page's viewport narrows or widens accordingly (Chrome reflows the page). Existing scan overlays (violation badges, highlight boxes from F05) are **not re-drawn automatically** on a width change. The overlay positions are recalculated on the next user-triggered scan. If overlays are currently visible, they may appear misaligned after a width change; this is a known limitation and will be addressed in a future enhancement.

### State preservation

All panel state is preserved across expand/collapse:
- **Scan results** — active scan data remains in memory and is not re-fetched.
- **Tab selection** — the currently active tab (Scan, Keyboard, AI Chat, etc.) does not change.
- **Accordion state** — any open/closed accordion sections remain in their current state.
- **Scroll position** — scroll position within the active tab is preserved.
- **Test config** — any unsaved test configuration form values are preserved.

State is held in the panel's React state / Zustand store and is not affected by the `chrome.sidePanel.setOptions` call, which only changes the panel's displayed width.

### Future enhancement (deferred)

Full pop-out to a separate browser window. The results and state transfer to the new window. A "return" button brings them back to the side panel.

### Responsive behavior

When panel is wider than 360px:
- Content can use the extra space (wider violation rows, less truncation).
- Layout doesn't change structure — same vertical layout, just wider.
- No horizontal layout changes (no sidebar, no two-column).

## Acceptance Criteria

1. Pop-out button is in the header.
2. Clicking it expands the panel width to `Math.min(screen.width, 1200)` px via `chrome.sidePanel.setOptions`.
3. Panel content adapts to wider width (less truncation).
4. Button icon changes from pop-out icon to return/collapse icon when expanded.
5. `aria-label` toggles between `"Expand panel"` and `"Collapse panel"`.
6. Clicking collapse restores the panel to 360px.
7. Scan results, active tab, accordion state, scroll position, and test config are all preserved across expand/collapse.
8. Button meets 24px target size.
