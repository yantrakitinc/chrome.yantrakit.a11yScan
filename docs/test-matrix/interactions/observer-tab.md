# Observer sub-tab

Renders observer history (auto + manual scans). Sub-tab only visible when state.observer=true.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Observer list row | render | show URL + title + timestamp + violation count + viewport bucket + source badge | per-entry row | none |
| `#observer-domain-filter` | input | targeted DOM update narrows visible rows | rows hide/show; INPUT KEEPS FOCUS | none |
| `#clear-observer` | click | confirm? then OBSERVER_CLEAR_HISTORY | rerenders empty | OBSERVER_CLEAR_HISTORY |
| `#export-observer` | click | OBSERVER_EXPORT_HISTORY → download JSON | URL.createObjectURL fired | OBSERVER_EXPORT_HISTORY |
| Empty state | render (no entries) | "No observer scans yet" | centered gray text | none |

## Source
- Render: `src/sidepanel/scan-tab/render-observer.ts` (renderObserverListInnerHtml)
- Handler: `src/sidepanel/scan-tab/handlers/observer.ts`

## Notes
- Filter input MUST use targeted DOM update (innerHTML on observer-list-content), NOT full rerender, otherwise focus is lost mid-keystroke.
- Filter state persists in scanTabState.observerFilter (in-memory, not chrome.storage).
- Observer history persisted in chrome.storage.local under OBSERVER_STORAGE_KEYS.history (background-side).
