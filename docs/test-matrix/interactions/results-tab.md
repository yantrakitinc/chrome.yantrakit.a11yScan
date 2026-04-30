# Results sub-tab

Renders single-page scan violations + passes + incomplete (or merged MV results, or crawl results aggregated).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `details.severity-{critical,serious,moderate,minor}` | click summary | expand/collapse violation row | <details open> toggles | none |
| `.highlight-btn[data-selector]` | click | highlight on inspected page + flash row | row gets .ds-flash-active for 3s | HIGHLIGHT_ELEMENT |
| `.explain-btn[data-rule][data-description]` | click | switch to AI tab + pre-fill chat | AI tab activated, input populated | (none direct; uses switchTab) |
| `.severity-{level}` row | render | impact-color border-left + bg | dynamic per violation impact | none |
| pass section <details> | click summary | expand passes list | <details open> | none |
| WCAG criterion link | click | open https://a11yscan.yantrakit.com/wcag/<criterion> in new tab | new tab opens (target=_blank) | none |
| MV viewport-filter chip `.mv-filter-chip[data-mvfilter]` | click "all" | clear filter (mvViewportFilter=null) | All chip aria-pressed=true | none |
| MV viewport-filter chip `.mv-filter-chip[data-mvfilter=N]` | click | filter to viewport N | that chip aria-pressed=true; results filtered | none |
| crawl-results-by-page `<details>` per URL | click summary | expand that page's results | <details open> | none |
| `#crawl-view-page` | click | crawlViewMode=page | aria-pressed=true | none |
| `#crawl-view-wcag` | click | crawlViewMode=wcag (group by WCAG criterion across pages) | aria-pressed=true | none |

## Source
- Render: `src/sidepanel/scan-tab/render-results.ts`
- Handler: `src/sidepanel/scan-tab/handlers/results-actions.ts`, `crawl.ts` (for view toggle)
