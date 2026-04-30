# F18 — Panel layout

## Purpose
Top-level side panel layout: header (brand + CVD dropdown), top tabs (Scan / Screen Reader / Keyboard / AI Chat), accordion (WCAG settings), action area (scan button + clear), tab content panels, footer.

## Source of truth
[F18-panel-layout.md](../../legacy/features/F18-panel-layout.md)

## Acceptance criteria

- [ ] Top tabs render: Scan / Screen Reader / Keyboard / AI Chat
- [ ] AI Chat shows "SOON" badge + "Coming soon" tooltip when Chrome AI unavailable
- [ ] Click top tab switches: aria-selected toggles, hidden attr on panels, .active class on tab
- [ ] Arrow Left/Right + Home/End navigate between tabs (ARIA tablist pattern)
- [ ] Accordion collapsed by default during scanning; expanded by default in idle
- [ ] accordion-toggle (button) expands; collapse-btn collapses
- [ ] WCAG version + level dropdowns render in expanded mode
- [ ] Mode toggle buttons (Crawl / Observer / Movie / Multi-Viewport) render in expanded mode
- [ ] Footer renders A11y Scan brand + beta badge + Feedback link
- [ ] Confirm-clear-bar (yes/cancel) shows during F22 confirmation flow
- [ ] Settings (gear) button opens config dialog (F13)
- [ ] Reset button (R-MV) restores defaults

## Verification mechanism
`e2e/verify-feature-f18-panel-layout.ts` — open sidepanel, verify each tab + accordion state + footer link presence + keyboard nav between top tabs.

## Structural gaps
- None — fully UI-renderable in real Chrome via Puppeteer.
