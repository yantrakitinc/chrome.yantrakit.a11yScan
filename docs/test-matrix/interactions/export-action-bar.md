# Export action bar

Renders below results: 4 export buttons (JSON, HTML, PDF, Copy).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#export-json` | click (results exist) | download JSON report | browser download | URL.createObjectURL |
| `#export-json` | click (no results, no crawl results) | no-op (early return on hasExportableData) | none | none |
| `#export-html` | click (lastScanResult exists) | download standalone HTML report | browser download | URL.createObjectURL |
| `#export-html` | click (no scan result) | no-op (early return) | none | none |
| `#export-pdf` | click (lastScanResult, popup allowed) | open print window + setTimeout(print, 500) | new window | window.open |
| `#export-pdf` | click (popup blocked) | flip text to "Popup blocked" for 3s | button text changes | none |
| `#export-pdf` | click (no scan result) | no-op | none | none |
| `#export-copy` | click (results exist, clipboard ok) | navigator.clipboard.writeText(JSON) → "Copied!" 2s | text flips to "Copied!" | none |
| `#export-copy` | click (clipboard fails) | text flips to "Copy failed" 2s | button text changes | none |
| `#export-copy` | click (no exportable data) | no-op | none | none |

## Source
- Render: `src/sidepanel/scan-tab/render-toolbar.ts` (export-action-bar block)
- Handler: `src/sidepanel/scan-tab/handlers/export.ts`
- Builders: `src/sidepanel/scan-tab/reports.ts` (buildJsonReportFrom + buildHtmlReportFrom)

## Notes
- HTML report is fully self-contained (CSS embedded) for offline viewing.
- JSON includes: scan, manualReview, ariaWidgets, tabOrder, focusGaps, viewportAnalysis (if MV ran), crawlResults (if crawl ran).
