# F22 — Clear All

## Purpose
Clear button + context-menu "Clear All" command wipes scan/crawl/MV cached results, manual review state, ARIA widgets, and toggles overlays off.

## Source of truth
[F22-context-menu.md](../../legacy/features/F22-context-menu.md)

## Acceptance criteria

- [ ] Clear button visible when scanPhase=results OR crawlPhase ∈ {paused, wait, complete}
- [ ] Click Clear → clearScanResultsSlice → state reset (lastScanResult=null, crawlResults=null, ariaWidgets=[], ariaScanned=false, manualReview={}, overlay flags=false)
- [ ] Sends HIDE_VIOLATION_OVERLAY + HIDE_TAB_ORDER + HIDE_FOCUS_GAPS + CLEAR_HIGHLIGHTS to content script
- [ ] Sends DEACTIVATE_MOCKS to content script
- [ ] Re-renders panel into idle state
- [ ] Clear does NOT reset mode toggles (crawl/observer/movie/mv) — that's Reset's job
- [ ] Clear does NOT clear testConfig — that's Reset's job
- [ ] Context menu "Clear All" sends CONFIRM_CLEAR_ALL → confirm-clear-bar shows yes/cancel
- [ ] confirm-clear-yes triggers same flow as Clear button + sends STATE_CLEARED to background

## Verification mechanism
`e2e/verify-feature-f22-clear-all.ts` — scan, set manual review, mark ariaScanned, click Clear, assert all state wiped. Then enable observer mode + verify Clear does NOT reset observer.

## Structural gaps
- Context-menu integration uses chrome.contextMenus API; harness can verify the message but not the menu UI itself.
