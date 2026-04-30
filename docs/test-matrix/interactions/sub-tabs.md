# Sub-tabs (Scan tab)

ARIA tablist nested in the Scan panel: Results / Manual / ARIA / (Observe when observer mode on).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#subtab-results` | click | activate Results sub-tab | aria-selected=true, .active | none |
| `#subtab-manual` | click | activate Manual sub-tab | aria-selected=true, .active | none |
| `#subtab-aria` | click | activate ARIA sub-tab | aria-selected=true, .active | none |
| `#subtab-observe` | click (only when state.observer) | activate Observe sub-tab | aria-selected=true, .active | OBSERVER_GET_HISTORY |
| sub-tab | keydown ArrowRight | move + activate next sub-tab | focus + active swap | none |
| sub-tab | keydown ArrowLeft | move + activate previous sub-tab | focus + active swap | none |
| sub-tab | keydown Home | activate first | focus + active swap | none |
| sub-tab | keydown End | activate last | focus + active swap | none |
| any sub-tab | activate | rerender #scan-content with corresponding pure renderer | content swapped | none |

## Source
- Render: `src/sidepanel/scan-tab/render-header.ts` (renderSubTabsHtml)
- Handler: `src/sidepanel/scan-tab/handlers/header.ts` (sub-tab nav block)

## Notes
- Per-sub-tab scroll memory in `scanScrollMemory` Record — when switching tabs, save current tab's scrollTop, restore for the new tab.
- Sub-tabs only render when scanPhase=results OR crawlPhase ∈ {paused, wait, complete}.
