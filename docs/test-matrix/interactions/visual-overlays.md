# Visual overlays (page-side)

Three overlay types rendered in a Shadow DOM in the inspected page.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Violation overlay | SHOW_VIOLATION_OVERLAY received | render outline + numbered badge per violation node | impact-colored outline + badge | none |
| Violation overlay | HIDE_VIOLATION_OVERLAY received | remove violation-overlay container | container gone (host stays) | none |
| Violation badge `<div>{n}</div>` | click | send VIOLATION_BADGE_CLICKED with per-badge index (NOT loop's final value — bug fix #41) | none | VIOLATION_BADGE_CLICKED |
| Violation node selector doesn't match | iterate | skip silently (continue) | no badge for that node | none |
| Violation node 0×0 rect | iterate | skip (continue) | no badge for that node | none |
| Tab-order overlay | SHOW_TAB_ORDER received | render numbered badges for focusable elements in tab order | indigo-900 badges with index 1..N | none |
| Tab-order overlay | HIDE_TAB_ORDER received | remove tab-order-overlay container | container gone | none |
| Focus-gap overlay | SHOW_FOCUS_GAPS received | render dashed-red marker + tooltip per interactive-but-not-focusable element | red dashed border + dark tooltip | none |
| Focus-gap overlay | HIDE_FOCUS_GAPS received | remove focus-gap-overlay container | container gone | none |
| Focus-gap reason: tabindex=-1 | iterate | tooltip "tabindex=\"-1\" blocks keyboard access" | per element | none |
| Focus-gap reason: display:none | iterate | tooltip "display:none — not in tab order" | per element | none |
| Focus-gap reason: visibility:hidden | iterate | tooltip "visibility:hidden — not in tab order" | per element | none |
| Focus-gap reason: disabled | iterate | tooltip "disabled attribute" | per element | none |
| document scroll | scroll event (debounced 150ms) | rebuild tab-order + focus-gap overlays | overlays repositioned | none |
| destroyOverlay() | external call | remove the entire shadow host | shadow host gone | none |

## Source
- Module: `src/content/overlay.ts`
- Shadow host id: `a11y-scan-overlay-host`

## Notes
- All overlays use `position:absolute` with `top: rect.top + window.scrollY` so they survive scroll without recalc (debounce on scroll just refreshes for layout-shift cases).
