# Accordion header (WCAG settings)

Collapsible header above the scan button. When expanded: WCAG dropdowns + mode toggles + MV checkbox + crawl-config (if Crawl mode on).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#accordion-toggle` | click (collapsed state only) | expand the accordion | accordion-body visible, accordion-toggle becomes div | none |
| `#collapse-btn` | click (expanded state only) | collapse the accordion | accordion-body hidden, accordion-toggle becomes button | none |
| `#wcag-version` | change | update state.wcagVersion | dropdown value | none |
| `#wcag-level` | change | update state.wcagLevel | dropdown value | none |
| `.mode-btn[data-mode='crawl']` | click | toggle state.crawl | aria-pressed flips, button color | none |
| `.mode-btn[data-mode='movie']` | click | toggle state.movie | aria-pressed flips, button color, persist movie_enabled | chrome.storage.local.set |
| `.mode-btn.mode-observe` | click | (DISABLED — coming soon) | disabled appearance, no action | none |
| `#mv-check` | change | toggle state.mv (if false, set viewportEditing=false) | checkbox checked state | none |
| `#vp-edit` | click | scanTabState.viewportEditing=true | rerender shows vp-input + vp-add + vp-remove + vp-done | none |
| `#vp-done` | click | scanTabState.viewportEditing=false | rerender hides editor controls | none |
| `#vp-add` | click | append default viewport (320 if not present, else next gap) | new viewport row | none |
| `.vp-input` | change | replace viewport at index; min 320; dedupe + sort | row value updated | none |
| `.vp-remove[data-index]` | click | remove viewport at index | row removed | none |
| `#settings-btn` | click | open config dialog (F13) | dialog opens | (focus restoration) |
| `#reset-btn` | click | reset modes + viewports + WCAG + clear testConfig | accordion repaints to defaults | chrome.storage.local.remove |

## Source
- Render: `src/sidepanel/scan-tab/render-header.ts`
- Handler: `src/sidepanel/scan-tab/handlers/header.ts`
- Settings/Reset handler: `src/sidepanel/scan-tab/handlers/scan-button.ts`
