# Manual sub-tab

Per-WCAG-criterion manual review with Pass / Fail / N/A toggle buttons.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Manual review row | render | show criterion + 3 buttons | per-criterion row | none |
| `.manual-btn[data-id][data-status='pass']` | click | toggle pass; 2nd click clears | button highlighted (or null) | persist via chrome.storage.local |
| `.manual-btn[data-status='fail']` | click | toggle fail; 2nd click clears | button highlighted | persist |
| `.manual-btn[data-status='na']` | click | toggle N/A; 2nd click clears | button highlighted | persist |
| Pass + click Fail | click | flip pass→fail | fail highlighted, pass cleared | persist |
| Storage key | per scan-page-URL | manualReview_<url-slug> | — | chrome.storage.local |

## Source
- Render: `src/sidepanel/scan-tab/render-manual-review.ts`
- Handler: `src/sidepanel/scan-tab/handlers/results-actions.ts` (manual-btn block)
- Persistence: `src/sidepanel/scan-tab.ts` (loadManualReviewFor / saveManualReviewFor)

## Notes
- Each scan URL has its own manualReview record. Re-scanning the same URL restores prior state.
- State included in JSON / HTML / PDF export reports.
