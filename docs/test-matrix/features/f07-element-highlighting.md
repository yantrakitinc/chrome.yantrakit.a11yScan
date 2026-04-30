# F07 — Element highlighting

## Purpose
Click any "Highlight" button in the side panel → outline the corresponding DOM element on the inspected page with a yellow pulsing border + scrollIntoView. Used across Results / Manual / ARIA / SR / KB tabs.

## Source of truth
[F07-element-highlighting.md](../../legacy/features/F07-element-highlighting.md)

## Acceptance criteria

- [ ] HIGHLIGHT_ELEMENT message with selector → content script outlines matched element
- [ ] Highlight uses Shadow DOM overlay (does not modify host page styles)
- [ ] CLEAR_HIGHLIGHTS message removes the outline
- [ ] HIGHLIGHT_RESULT response carries `found: boolean`
- [ ] When `found === false`, sidepanel shows a "Element not found on page" toast for 3s
- [ ] Side panel row gets .ds-flash-active for 3s on highlight (visual link page↔panel)
- [ ] Stacked clicks reset the .ds-flash-active timer on the same row
- [ ] Highlight selector targets exactly the violation node (not the parent or a sibling)
- [ ] Works for selectors with CSS.escape characters (e.g., `#user.email`)

## Verification mechanism
`e2e/verify-feature-f07-element-highlighting.ts` — fixture with multiple clickable rows; click each Highlight; assert (a) overlay appears in inspected page, (b) row gets .ds-flash-active, (c) overlay disappears on next click or CLEAR_HIGHLIGHTS.

## Structural gaps
- scrollIntoView smooth-behavior is best-effort; Puppeteer can't guarantee the smooth-scroll completed.
