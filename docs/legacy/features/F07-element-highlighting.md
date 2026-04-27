# F07 — Element Highlighting

## Purpose

Click any violation element in the side panel results → the element is scrolled into view on the page and highlighted with a temporary visual indicator.

## Dependencies

- F01 (Single Page Scan) — provides violation nodes with selectors

## Behavior

1. User clicks "Highlight" button on a violation element in the side panel.
2. Side panel sends `HIGHLIGHT_ELEMENT` message to content script with the CSS selector.
3. Content script finds the element using `document.querySelector(selector)`.
4. If found:
   - Scrolls element into view: `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
   - Applies 3-second amber glow via CSS animation:
     - `outline: 3px solid #f59e0b`
     - `box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.5)`
     - Pulsing animation for 3 seconds.
   - After 3 seconds, removes the highlight styles.
5. If not found (element removed from DOM, or selector stale):
   - Show brief message in side panel: "Element not found on page. It may have been removed."

### Hidden elements

If the element has `display: none` or `visibility: hidden`:
- Scroll to its nearest visible ancestor.
- Show message: "Element is hidden. Highlighted its nearest visible parent."

### Elements in scrollable containers

If the element is inside a scrollable container (not the main viewport):
- Scroll both the container AND the viewport to bring the element into view.

## Acceptance Criteria

1. Clicking "Highlight" scrolls to the element on the page.
2. Element gets a 3-second amber glow animation.
3. Highlight auto-removes after 3 seconds.
4. Works for elements in scrollable containers.
5. Shows fallback message if element is not found.
6. Shows fallback for hidden elements (highlights parent).
7. "Highlight" button meets 24px minimum target size.
