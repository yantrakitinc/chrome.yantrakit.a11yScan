# F05 — Visual Overlays

## Purpose

Render visual annotations directly on the web page to help users see accessibility issues in context. Three overlay types highlight different aspects of keyboard and ARIA accessibility.

## Who needs it

Developers seeing where violations are on the page, QA verifying tab order, consultants demonstrating issues to clients.

## Dependencies

- F01 (Single Page Scan) — violations to highlight
- F16 (Keyboard Tab) — tab order data

## Behavior

### Overlay types

Three independent toggles in the bottom toolbar, under "Highlight":

1. **Violations** — colored outlines around elements with violations.
2. **Tab** — numbered badges on every focusable element showing keyboard navigation sequence.
3. **Gaps** — dashed outlines on interactive elements that can't be reached by keyboard.

Each can be toggled on/off independently. Multiple can be active simultaneously.

### Rendering

All overlays render inside a **Shadow DOM** container injected into the host page. This isolates overlay styles from the page's CSS.

- Single shadow host element: `<div id="a11y-scan-overlay-host">`.
- Shadow root contains a `<style>` element and overlay elements.
- Z-index: 2147483646 (just below maximum) to stay on top of everything.
- Position: absolute, follows scroll.

### Violation overlay

For each violation node:
- Colored outline around the element based on impact:
  - Critical: red (#ef4444)
  - Serious: orange (#f97316)
  - Moderate: yellow (#eab308)
  - Minor: blue (#3b82f6)
- **Clickable numbered badge** at top-right of element:
  - Dark background with white number
  - Clicking scrolls to the corresponding violation in the side panel
  - Badge has inner glow/shadow for visibility on any background
- Outlines use strong borders (2px solid) with additional box-shadow for contrast against both light and dark page backgrounds.

### Tab order overlay

For each focusable element (in tab order):
- **Numbered badge**: dark indigo background (#1e1b4b), white text, positioned at top-left of element.
  - Positive tabindex elements come first (sorted by tabindex value).
  - Then elements in DOM order.
  - Elements with `tabindex="-1"`: dark gray badge, excluded from sequence numbering.
  - Each badge has a **white border ring** and **drop shadow** for contrast against any page background (light or dark).
- No connecting lines between badges. Navigation sequence is communicated by the badge numbers alone.

### Focus gap overlay

For each interactive element NOT in the tab order:
- **Red dashed outline** (2px dashed #ef4444).
- **Tooltip** showing why it's not focusable:
  - "display: none"
  - "visibility: hidden"
  - "aria-hidden: true"
  - "disabled attribute"
  - "hidden input type"
  - "no tabindex on div/span with click handler"

### Badge positioning

Smart positioning to avoid overlap and stay within viewport:
- Default: above element, slightly offset right.
- If element is less than 40px tall: position above.
- If near top viewport edge: position below.
- If near right viewport edge: shift left.
- Collision avoidance between badges (not yet implemented — future enhancement).

### Cleanup

- `destroyOverlay()` removes the shadow host entirely.
- Per-type remove functions: `removeViolationOverlay()`, `removeTabOrderOverlay()`, `removeFocusGapOverlay()`.
- Overlays are cleaned up when:
  - User toggles the overlay off.
  - User starts a new scan (old overlays removed before new results).
  - User clicks Clear.
  - Page navigates away.

### Visibility contrast

All overlay colors must have high contrast against ANY background (light or dark pages). Techniques:
- Strong solid borders (not semi-transparent).
- Additional box-shadow with contrasting color (e.g., white shadow on colored outline).
- Badge backgrounds are opaque with white text.
- Double-stroke technique for lines (white shadow + colored stroke).

### Data structures

```typescript
interface iOverlayElement {
  selector: string;
  rect: DOMRect;
  type: "violation" | "taborder" | "focusgap";
  index?: number;        // sequential number for badges
  impact?: string;       // violation severity
  reason?: string;       // focus gap reason
}
```

## Acceptance Criteria

1. Violations toggle shows/hides colored outlines on violation elements.
2. Outlines are color-coded by severity (red/orange/yellow/blue).
3. Violation badges are numbered and clickable.
4. Clicking a violation badge scrolls to that violation in the side panel.
5. Tab order toggle shows numbered badges on focusable elements.
6. Tab order badges are numbered in correct keyboard navigation sequence.
7. Tab order badges have a white border ring and drop shadow for visibility on any background. No connecting lines between badges.
8. Focus gap toggle shows red dashed outlines on unreachable elements.
9. Focus gap tooltips explain why each element is unreachable.
10. Overlays render in Shadow DOM, isolated from page styles.
11. Overlays have high z-index and appear above page content.
12. Overlays are visible on both light and dark backgrounds.
13. Multiple overlay types can be active simultaneously.
14. Overlays are removed when Clear is clicked.
15. Overlays are removed when a new scan starts.
16. Overlay toggle buttons in the toolbar use checkbox + label pattern.
17. Each toggle button meets 24px target size.
