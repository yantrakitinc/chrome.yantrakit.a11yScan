# F20 — Accessibility inspector

## Purpose
Hover-to-inspect mode + DevTools Elements panel sidebar. Show role, accessible name, ARIA attributes, tabindex, focusability, and matching violations for the inspected element.

## Source of truth
[F20-accessibility-inspector.md](../../legacy/features/F20-accessibility-inspector.md)

## Acceptance criteria

- [ ] enterInspectMode adds mousemove + click + keydown listeners on document
- [ ] Mousemove (when not pinned): document.elementFromPoint → highlight + tooltip
- [ ] Click: pin the current element; show "pinned" border on tooltip; broadcast INSPECT_ELEMENT
- [ ] Click same pinned element again: unpin, remove tooltip
- [ ] Click different element while pinned: re-pin to new element
- [ ] Tooltip placement: try above → below → right → left, clamped to viewport ±8px
- [ ] Tooltip shows: Selector, Role, Accessible Name, ARIA Attributes (only if non-empty), Tabindex, Focusable status, Matching violations from last scan
- [ ] All page-controlled fields (role, accessibleName, ARIA values) HTML-escaped (defends against hostile aria-label content)
- [ ] Escape key exits inspect mode
- [ ] exitInspectMode removes listeners + tooltip + highlight + pinned state
- [ ] DevTools panel: same data shown in Elements sidebar pane on selection-changed
- [ ] DevTools panel Refresh button re-evaluates current $0

## Verification mechanism
`e2e/verify-feature-f20-accessibility-inspector.ts` — hover/click on multiple elements, assert tooltip placement, pin behavior, escape, INSPECT_ELEMENT message.

## Structural gaps
- DevTools panel registration NOT directly verified (Gap 2). Panel HTML rendering IS unit-tested (90% branch).
- Pinning behavior across page navigation NOT tested (pin should reset).
