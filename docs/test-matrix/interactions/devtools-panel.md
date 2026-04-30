# DevTools panel sidebar

Elements panel sidebar pane shown when DevTools is open and an element is selected.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Panel render (`$0` selected) | DevTools onSelectionChanged | chrome.devtools.inspectedWindow.eval gets data | panel shows selector + role + name + ARIA + tabindex + focusability + violations | none |
| Panel render (no `$0`) | initial open | data.error="No element selected." | error message shown | none |
| Panel render (eval throws / null result) | catch path | data.error="Could not inspect element." | error in red | none |
| Selector row | render | shows DOM selector | per element | none |
| Role row | render | shows role attribute or tag name | per element | none |
| Accessible Name row | render | aria-label OR title OR textContent (truncated 80 chars) | per element | none |
| ARIA Attributes block | render (any aria-* present) | one row per attr=value | per element | none |
| ARIA Attributes block | render (none) | block hidden | — | none |
| Tabindex row | render | shows tabindex value or "—" if null | per element | none |
| Keyboard row | render | "Focusable" (green) or "Not focusable" (red) | per element | none |
| Violations section | render (matching violations exist) | one row per match with rule + impact + message | per element | none |
| Violations section | render (no matches) | "No violations found for this element." | green text | none |
| `#btn-refresh` | click | re-call loadData() | re-evaluates $0 | none |

## Source
- Module: `src/devtools/panel.ts`
- HTML scaffold: `src/devtools/panel.html`
- Registration: `src/devtools/devtools.ts` (NOT directly verifiable — Gap 2 in structural-gaps.md)

## Notes
- Reads violations from `window.__a11yScanViolations` set by content script's setLastScanViolations.
- Auto-loads on initial open + re-loads on chrome.devtools.panels.elements.onSelectionChanged.
