# Crawl progress + page-rule wait

Renders during crawlPhase ∈ {crawling, paused, wait}.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| Progress bar | render (crawling/paused) | show pagesVisited / pagesTotal + currentUrl | bar fills proportionally | none |
| `#pause-crawl` | click | PAUSE_CRAWL | resume button replaces pause | PAUSE_CRAWL |
| `#resume-crawl` | click (paused state) | RESUME_CRAWL | pause button replaces resume | RESUME_CRAWL |
| `#cancel-crawl` | click | crawlPhase=idle; CANCEL_CRAWL | progress card disappears | CANCEL_CRAWL |
| `#cancel-scan` | click (during single-page scan) | scanPhase=idle | scan-progress card disappears | none (state-only) |
| `#continue-crawl` | click (wait state) | clear waitInfo + USER_CONTINUE | wait card closes; crawl resumes | USER_CONTINUE |
| `#scan-then-continue` | click (wait state) | SCAN_REQUEST → set lastScanResult + scanSubTab=results, then USER_CONTINUE | wait card closes; results render | SCAN_REQUEST + USER_CONTINUE |
| `#cancel-wait` | click (wait state) | clear waitInfo + CANCEL_CRAWL | wait card closes; crawl ends | CANCEL_CRAWL |

## Source
- Render: `src/sidepanel/scan-tab/render-progress.ts` (renderCrawlProgressHtml + renderPageRuleWaitHtml + renderScanProgressHtml)
- Handler: `src/sidepanel/scan-tab/handlers/crawl.ts`

## Notes
- crawlPhase listener (CRAWL_PROGRESS message) drives the rerender; reduceCrawlProgress slice is pure + tested.
- Wait state shows the matched URL + rule type (login/interaction/deferred-content) + description.
