# F20 — Accessibility Inspector

## Purpose

Click-to-inspect mode: hover over any element on the page and see its accessibility properties in a floating tooltip. Plus a DevTools sidebar pane showing a11y info for the selected element.

## Dependencies

- F05 (Visual Overlays) — uses same Shadow DOM overlay system

## Behavior

### Activation

"Inspect" button in the extension (location TBD — may be in Keyboard tab or a persistent button).

### Hover tooltip

When Inspect mode is active:
1. Hovering over any element shows a floating tooltip near the cursor.
2. Tooltip content:
   - **Role**: ARIA role or implicit role
   - **Accessible name**: computed name
   - **aria-\* attributes**: all ARIA attributes on this element
   - **tabindex**: value (if present)
   - **Focus state**: whether it's currently focusable
   - **Violations**: any violations on this specific element (from last scan)

3. Tooltip follows cursor, positioned to avoid viewport edges.
4. Tooltip renders in Shadow DOM (same host as overlays).
5. Clicking an element "pins" the tooltip (stays visible until clicked elsewhere).
6. Pressing Escape exits Inspect mode.

### Tooltip positioning algorithm

The tooltip is positioned relative to the hovered element (not the cursor), using the following priority order:

1. **Preferred — above the element**: place the tooltip directly above the element's top edge, horizontally centered on the element.
2. **Fallback 1 — below the element**: if the above position would push the tooltip outside the top viewport edge (i.e., `element.top - tooltipHeight < 0`), place it below the element's bottom edge.
3. **Fallback 2 — right of the element**: if above and below both overflow the viewport vertically, place it to the right of the element's right edge, vertically centered on the element.
4. **Fallback 3 — left of the element**: if right also overflows the viewport's right edge, place it to the left of the element's left edge, vertically centered on the element.

In all cases, after computing the candidate position, clamp the tooltip's final coordinates so that:
- `left >= 8px` and `left + tooltipWidth <= viewportWidth - 8px`
- `top >= 8px` and `top + tooltipHeight <= viewportHeight - 8px`

The 8px margin prevents the tooltip from touching the viewport edge.

### Iframe handling

Inspect mode operates on the **top-level frame only**. Elements inside iframes are not inspectable via hover. Rationale: cross-origin iframes cannot be accessed by the content script, and same-origin iframes add complexity for an initial implementation.

Future enhancement: opt-in support for same-origin iframes via injected content scripts.

### Tooltip styling

The tooltip renders inside the Shadow DOM host. Styling is applied via a `<style>` tag inside the shadow root so it is fully isolated from page styles.

| Property | Value |
|---|---|
| Background | `#1e1e2e` (dark navy) |
| Text color | `#e8e8f0` |
| Border | `1px solid #3a3a5c` |
| Border radius | `6px` |
| Box shadow | `0 4px 16px rgba(0,0,0,0.45)` |
| Padding | `10px 14px` |
| Max width | `320px` |
| Font family | System monospace stack: `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` |
| Font size (labels) | `11px`, uppercase, letter-spacing `0.06em`, color `#8888aa` |
| Font size (values) | `13px` |
| Violation row font size | `12px` |
| Violation row color — critical/serious | `#ff6b6b` |
| Violation row color — moderate | `#ffa94d` |
| Violation row color — minor | `#ffe066` |
| Z-index | `2147483647` (max) |

### Pinned tooltip behavior

- **Clicking an element** while in Inspect mode pins the tooltip for that element. The tooltip stops following the cursor and stays anchored to its last computed position.
- Only **one tooltip can be pinned at a time**. Pinning a new element unpins the previous one.
- **Clicking anywhere outside an element with inspect-mode highlighting** (e.g., clicking an empty area, or clicking the same pinned element again) unpins the tooltip and returns to hover-follow mode.
- The pinned tooltip has a distinct visual treatment: a `2px solid #6c6cff` border (vs. the default `1px solid #3a3a5c`) to communicate its pinned state.
- Pressing **Escape** exits Inspect mode entirely, which also dismisses any pinned tooltip.

### Matching violations to hovered element

Violations from the last scan are stored as an array in extension state, each with a `selector` string (the CSS selector of the violating element, as reported by axe-core).

When an element is hovered:
1. Retrieve the `violations` array from the last scan result in `chrome.storage.local`.
2. For each violation node, attempt `document.querySelector(violation.selector)` and compare the resulting DOM node to the hovered element via `===`.
3. If a match is found, include that violation's `ruleId`, `impact`, and `message` in the tooltip.
4. If `document.querySelector` throws (e.g., malformed selector) or returns `null`, skip that violation silently.
5. If no scan has been run, the Violations section of the tooltip is omitted entirely.

### Interaction with existing overlays

When Inspect mode is active, existing scan overlays (violation badges, highlight boxes from F05) **remain visible**. They are not hidden or suppressed during inspection. The inspector tooltip renders above them via z-index stacking within the Shadow DOM.

The element highlight (the blue outline drawn around the currently hovered element) is drawn as an additional overlay layer, distinct from violation badge overlays, so neither interferes with the other.

### DevTools sidebar pane

Registered via `chrome.devtools.panels.elements.createSidebarPane("A11y Scan")`.

When the user selects an element in the Elements panel:
- The sidebar pane shows the same accessibility info as the hover tooltip.
- Updates automatically when selection changes.
- No activation needed — always available in DevTools.

### Data structures

```typescript
interface iInspectorData {
  selector: string;
  role: string;
  accessibleName: string;
  ariaAttributes: Record<string, string>;
  tabindex: number | null;
  isFocusable: boolean;
  violations: { ruleId: string; impact: string; message: string }[];
}
```

## Acceptance Criteria

1. Inspect mode can be activated and shows hover tooltip.
2. Tooltip shows role, name, ARIA attrs, tabindex, focus state.
3. Tooltip shows violations from last scan (if any).
4. Tooltip follows cursor and avoids viewport edges using the above/below/right/left priority with 8px viewport margin clamping.
5. Tooltip is styled with the specified colors, fonts, max-width, and shadow.
6. Clicking pins the tooltip; only one pin is active at a time; pinned tooltip has a distinct border color.
7. Clicking elsewhere or re-clicking the pinned element unpins it.
8. Escape exits Inspect mode and dismisses any pinned tooltip.
9. Inspect mode operates on the top-level frame only (no iframe traversal).
10. Violations are matched to hovered elements by comparing `document.querySelector(selector) === hoveredNode`.
11. Existing scan overlays remain visible during Inspect mode.
12. DevTools sidebar pane shows a11y info for selected element.
13. Sidebar pane updates when selection changes.
