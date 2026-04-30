# Top tabs

ARIA tablist: 4 top-level tabs (Scan / Screen Reader / Keyboard / AI Chat).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#tab-scan` | click | activate Scan panel | aria-selected=true, .active class | none |
| `#tab-sr` | click | activate Screen Reader panel | aria-selected=true, .active class | none |
| `#tab-kb` | click | activate Keyboard panel | aria-selected=true, .active class | none |
| `#tab-ai` | click | activate AI Chat panel | aria-selected=true, .active class | none |
| `#tab-ai` | click (when AI unavailable) | tooltip "Coming soon" | disabled appearance, aria-disabled=true | none |
| top tab | keydown ArrowRight | move focus to next tab | next tab focused + activated | none |
| top tab | keydown ArrowLeft | move focus to previous tab | previous tab focused + activated | none |
| top tab | keydown Home | move focus to first tab | first tab focused + activated | none |
| top tab | keydown End | move focus to last tab | last tab focused + activated | none |
| any tab | tab activate | hide other panels (set hidden=true) | only active panel visible | none |
| any tab | tab activate | rerender corresponding tab content | tab content fresh | none |

## Source
- HTML: `src/sidepanel/sidepanel.html`
- Handler: `src/sidepanel/sidepanel.ts` (switchTab function)
