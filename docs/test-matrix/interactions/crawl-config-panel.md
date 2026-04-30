# Crawl config panel

Renders inside accordion when state.crawl=true. Mode dropdown + URL list panel + page rules editor.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#crawl-mode` | change (urllist) | scanTabState.crawlMode=urllist; close panel | url-list-open visible | none |
| `#crawl-mode` | change (follow) | scanTabState.crawlMode=follow | startUrl + scope inputs visible | none |
| `#url-list-open` | click | scanTabState.urlListPanelOpen=true | url-paste-area + manual input visible | none |
| `#url-list-done` | click | scanTabState.urlListPanelOpen=false | panel collapses | none |
| `#url-paste-area` | input | accept paste | textarea value | none |
| `#url-paste-add` | click | parsePastedUrls + mergeNewUrlsIntoList | list rows render; textarea cleared if any added | none |
| `#url-file-input` | change | FileReader.readAsText → parseTextFileUrls + merge | list rows render | none |
| `#url-file-input` | change (no file) | no-op | none | none |
| `#url-manual-input` | input | accept URL | input value | none |
| `#url-manual-add` | click (input.checkValidity()) | addManualUrlToList | list row added; input cleared + refocused | none |
| `#url-manual-input` | keydown Enter | same as url-manual-add | same | none |
| `#url-manual-add` | click (invalid URL) | input.reportValidity() | native browser tooltip | none |
| `.url-remove-btn[data-index]` | click | removeUrlAtIndex | list row removed | none |

## Source
- Render: `src/sidepanel/scan-tab/render-crawl-config.ts`
- Handler: `src/sidepanel/scan-tab/handlers/crawl.ts`
- Pure helpers: `src/sidepanel/scan-tab/url-list.ts` (parsing + merging)
