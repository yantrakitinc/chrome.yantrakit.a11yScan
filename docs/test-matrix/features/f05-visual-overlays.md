# F05 — Visual overlays

## Purpose
Render Shadow-DOM-hosted overlays on the inspected page: numbered badges on violation nodes, tab-order badges on focusable elements, dashed markers on focus-gap interactive elements.

## Source of truth
[F05-visual-overlays.md](../../legacy/features/F05-visual-overlays.md)

## Acceptance criteria

- [ ] SHOW_VIOLATION_OVERLAY message renders one outline + one numbered badge per violation node, color-coded by impact
- [ ] HIDE_VIOLATION_OVERLAY removes overlay (host element stays)
- [ ] Badge click sends VIOLATION_BADGE_CLICKED with the correct per-badge index (NOT the loop's final value — fixed in PR #41)
- [ ] SHOW_TAB_ORDER renders sequential numbered badges on focusable elements in tab order
- [ ] Tab-order numbering respects positive tabindex (ascending) then natural DOM order
- [ ] Tab-order excludes elements with tabindex=-1 + display:none + visibility:hidden
- [ ] SHOW_FOCUS_GAPS renders dashed-red marker + tooltip with reason for each interactive-but-not-focusable element
- [ ] Reasons: tabindex=-1 / display:none / visibility:hidden / disabled
- [ ] Scroll re-renders tab-order + focus-gap overlays (debounced 150ms)
- [ ] All overlays render in a Shadow DOM (no style leakage to host page)
- [ ] destroyOverlay removes the entire shadow host

## Verification mechanism
`e2e/verify-feature-f05-visual-overlays.ts` — fixture page with violations + tab-order + interactive non-focusable; assert badge count, badge text content, marker positions via getBoundingClientRect.

## Structural gaps
- Shadow DOM rendering is verified via querySelector + Shadow root traversal; visual paint correctness verified via screenshot comparison only on selected key frames (not pixel-perfect).
