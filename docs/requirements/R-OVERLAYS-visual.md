# R-OVERLAYS — Visual Page Overlays

## Purpose

Render visual annotations on the host page so users can see accessibility issues in context. Three overlays:

1. Violation overlay — colored outlines + numbered badges on violation elements
2. Tab order overlay — numbered badges on focusable elements (no connecting lines)
3. Focus gaps overlay — red dashed outlines on interactive elements that can't receive keyboard focus

## Implementation: Shadow DOM

A single shadow host `<div id="a11y-scan-overlay-host">` is appended to `document.body`. All overlay elements live in its shadow root. This isolates overlay styles from the host page's CSS.

The shadow host has `style="all: initial; position: absolute; top: 0; left: 0; pointer-events: none; z-index: 2147483646;"`. Pointer events pass through except on interactive badges (which set `pointer-events: auto` on themselves).

The shadow root contains a `<style>` element with the overlay-specific CSS, then per-overlay `<div>` containers (`#violation-overlay`, `#tab-order-overlay`, `#focus-gap-overlay`).

## Overlay 1: Violation overlay

For each violation node:
- A 2px solid outline outside the element, color by impact:
  - critical: `--ds-red-700`
  - serious: `#f97316`
  - moderate: `#eab308`
  - minor: `#3b82f6`
- A numbered badge at the top-right corner of the element:
  - Dark background (`--ds-indigo-900`)
  - White bold number (sequential 1, 2, 3…)
  - 22×22px, border-radius 50%
  - White outer ring (3px outline) for contrast on any background
  - `pointer-events: auto`
  - On click: sends `VIOLATION_BADGE_CLICKED { violationId, nodeIndex }` to sidepanel; sidepanel scrolls to that violation in the results list

Outline + box-shadow combo for visibility on any background:
```css
.violation-outline {
  outline: 2px solid var(--ds-red-700);
  outline-offset: 0;
  box-shadow: 0 0 0 1px white;
}
```

## Overlay 2: Tab Order overlay

For each focusable element (in tab order):
- A circular numbered badge at the top-left corner of the element
- 24×24px circle, dark indigo background (`--ds-indigo-900`), white text
- Bold number, font-size 11px
- White inner border (2px) for contrast
- Drop shadow (`0 2px 6px rgba(0,0,0,0.5)`) for visibility on any background
- `pointer-events: none` (decorative, not interactive)

NO connecting lines between badges. (Removed by user request — confused users more than helped.)

Tab order computation (in content script):
1. Query `document.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')` filtered by visibility.
2. Sort: positive `tabindex` first (by value), then DOM order.
3. Skip elements with `tabindex="-1"` and `disabled` and `[aria-hidden="true"]` ancestors.

## Overlay 3: Focus Gaps overlay

For each "focus gap" (interactive element NOT in the tab order):
- 2px dashed red outline (`--ds-red-700`)
- A small "GAP" label badge at the top-left
- Tooltip on hover (via `<title>` element on the badge) explaining why: "div with onclick but no tabindex", "aria-hidden ancestor", etc.
- `pointer-events: auto` on the badge for tooltip to work

Detection (in content script):
- Elements with `role="button"`, `role="link"`, `role="checkbox"`, etc. that lack `tabindex="0"` and are not natively focusable
- Elements with click handlers (best-effort detection: events listed via `getEventListeners` not available outside DevTools, so we look at `onclick` attribute and inline event handlers)
- Elements visually styled like buttons (cursor: pointer + click target) but with `tabindex="-1"` or no tabindex on a non-focusable element

## Scroll & resize recalculation

A single throttled handler on `window` for `scroll` and `resize`:

```javascript
let scrollRecalcTimer: number | null = null;
function onPageReflow() {
  if (scrollRecalcTimer) return;
  scrollRecalcTimer = requestAnimationFrame(() => {
    scrollRecalcTimer = null;
    if (overlayState.violations) showViolationOverlay(overlayState.lastViolations);
    if (overlayState.tabOrder) showTabOrderOverlay();
    if (overlayState.focusGaps) showFocusGapOverlay();
  });
}
window.addEventListener("scroll", onPageReflow, { passive: true });
window.addEventListener("resize", onPageReflow);
```

(Module-level `overlayState` in the content script is permitted because the content script lives per-page and is reinjected; this state does not need to live in `state` since sidepanel does not share runtime memory with content scripts.)

## Hide / cleanup

- `hideViolationOverlay()` removes `#violation-overlay` children but keeps the shadow host.
- `hideTabOrderOverlay()` and `hideFocusGapOverlay()` similarly.
- `destroyOverlay()` removes the entire shadow host. Called when extension unloads (no clean signal, so this is best-effort).
- The scroll/resize listener stays attached for the lifetime of the page (does no work when no overlay is active).

## Side panel toggles

The Violations toggle is in the Scan tab toolbar. Tab Order and Focus Gaps toggles are in the Keyboard tab toolbar.

## Test config consumption

This feature does NOT consume test config.

## Accessibility

- The overlays are decorative for sighted users; they do not announce to screen readers (the visible badges have `aria-hidden="true"` since the same information is already in the side panel rows).
- Violation overlay numbered badges are interactive — they have `aria-label="Violation {N}: {rule id}"` and respond to keyboard activation. They are part of the page, not the panel, so the user must Tab to them on the page to use them.

## Test cases

### E2E

1. Toggle Violations on after scan → page elements with violations get colored outlines + numbered badges.
2. Click a violation badge on the page → side panel scrolls to that violation in the Results sub-tab.
3. Toggle Tab Order on → page focusable elements get numbered badges.
4. Verify the badges have white border ring and drop shadow (visible on dark page backgrounds).
5. NO connecting lines between tab order badges.
6. Toggle Focus Gaps on → page elements with click handlers but no keyboard access get red dashed outlines.
7. Scroll the page → badges follow their elements (recalculation works).
8. Resize the window → badges follow.
9. Toggle off → overlays removed cleanly.
10. Run scan again → previous overlays cleared before new results render.

### Unit

1. `getFocusableElements()` returns expected elements in tab order.
2. Sorts positive tabindex before DOM-order elements.
3. Skips `tabindex="-1"`, `disabled`, `aria-hidden` ancestors.
