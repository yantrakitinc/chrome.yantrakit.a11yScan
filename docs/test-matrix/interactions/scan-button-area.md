# Scan button area

Action area below accordion: scan-btn + clear-btn (when results exist).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#scan-btn` | click (idle, !crawl, !mv) | start single-page scan; scanPhase=scanning | button disabled; scan-progress card shows | SCAN_REQUEST |
| `#scan-btn` | click (idle, mv=true) | start multi-viewport scan | mv-progress card shows | MULTI_VIEWPORT_SCAN |
| `#scan-btn` | click (idle, crawl=true) | START_CRAWL; crawlPhase=crawling | crawl-progress card shows | START_CRAWL |
| `#scan-btn` | click (results phase) | re-scan | scanPhase=scanning, accordion stays open | SCAN_REQUEST or MULTI_VIEWPORT_SCAN |
| `#scan-btn` | scanning state | disabled | aria-disabled, opacity 0.4 | none |
| `#clear-btn` | click (results or paused/wait/complete) | clearScanResultsSlice | panel rerenders to idle empty state | HIDE_VIOLATION_OVERLAY + HIDE_TAB_ORDER + HIDE_FOCUS_GAPS + CLEAR_HIGHLIGHTS + DEACTIVATE_MOCKS |

## Source
- Render: `src/sidepanel/scan-tab.ts` (action-area block)
- Handler: `src/sidepanel/scan-tab/handlers/scan-button.ts`

## Notes
- Button text varies via `computeActionButtonText(state)` based on phase + mode flags.
- Clear button only renders when there's something to clear (per F19 phase-mode-system).
