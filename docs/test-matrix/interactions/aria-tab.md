# ARIA sub-tab

Renders detected ARIA widgets with per-check pass/fail.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Pre-scan empty state | render (widgets=[], !ariaScanned) | show "No ARIA widgets scanned yet" + Scan button | gray text + amber CTA button | none |
| Post-scan zero-result | render (widgets=[], ariaScanned) | show "No ARIA widgets detected on this page" | green text, no button | none |
| `#run-aria-scan` | click (pre-scan empty state only) | manual ARIA scan | result populates state.ariaWidgets, ariaScanned=true | RUN_ARIA_SCAN |
| Failing widget `<details>` | render | open by default | red border + bg | none |
| Passing widget `<details>` | render | collapsed by default | green border + bg | none |
| Widget summary | click | expand/collapse | <details open> toggles | none |
| `.aria-highlight[data-selector]` | click | highlight widget on inspected page | overlay shows + flash details for 3s | HIGHLIGHT_ELEMENT |
| Widget role badge | render | role-colored pill | per-role color | none |
| Per-check failure rows | render (!c.pass) | red text + red left border | per-check | none |
| Per-check pass rows | render (c.pass) | green text + green left border | per-check | none |

## Source
- Render: `src/sidepanel/scan-tab/render-aria.ts`
- Handler: `src/sidepanel/scan-tab/handlers/results-actions.ts` (run-aria-scan + aria-highlight)
- Auto-scan after Scan Page: `src/sidepanel/scan-tab/handlers/scan-button.ts`

## Notes
- Bug fix in PR #102: 3-state empty rendering distinguishes pre-scan from post-scan zero-result.
