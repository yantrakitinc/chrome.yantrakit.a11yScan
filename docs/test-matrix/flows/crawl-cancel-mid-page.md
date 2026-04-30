# Flow: Cancel a crawl mid-page → state resets cleanly

## Preconditions
- Extension loaded; sidepanel open
- Crawl mode ON; mode=urllist with ≥2 URLs (one slow, one normal)

## Steps

1. Click `#scan-btn` (= "Start Crawl"). Crawl begins.
   - Expected: state.crawlPhase="crawling"; crawl-progress card with #pause-crawl + #cancel-crawl renders.

2. Crawl is processing the first URL. Click `#cancel-crawl` while still on the first page.
   - Expected: state.crawlPhase="idle"; CANCEL_CRAWL message dispatched to background.
   - Expected: state.accordionExpanded=true; accordion re-expanded.
   - Expected: #pause-crawl and #cancel-crawl removed from DOM.
   - Expected: scan-btn label reverts to "Start Crawl".
   - Expected: no leftover progress bar.
   - Expected: subsequent SCAN_RESULT or CRAWL_PROGRESS messages from the in-flight crawl are ignored / harmless (no leaked render).

3. Click `#scan-btn` again to re-start.
   - Expected: a fresh crawl starts cleanly (no stale progress).

## Verification mechanism
`e2e/verify-flow-crawl-cancel-mid-page.ts`.

## Status
⚠ Unverified by Puppeteer until PR #128 lands.
