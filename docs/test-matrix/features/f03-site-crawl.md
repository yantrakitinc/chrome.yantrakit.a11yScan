# F03 — Site crawl

## Purpose
Crawl mode scans multiple URLs of a site: follow-mode (start URL + same-origin link discovery) or url-list mode (paste/upload list of URLs).

## Source of truth
[F03-site-crawl.md](../../legacy/features/F03-site-crawl.md)

## Acceptance criteria

- [ ] Crawl mode toggle reveals crawl-config-panel
- [ ] crawl-mode dropdown switches between follow / urllist
- [ ] In urllist mode: paste-area + manual-add + file-upload populate crawlUrlList
- [ ] In follow mode: scope + startUrl define traversal boundary
- [ ] Click Scan Page → START_CRAWL message; state.crawlPhase=crawling
- [ ] CRAWL_PROGRESS messages update crawlProgress (pagesVisited / pagesTotal / currentUrl)
- [ ] pause-crawl / resume-crawl / cancel-crawl buttons send PAUSE_CRAWL / RESUME_CRAWL / CANCEL_CRAWL
- [ ] Page rules pause crawl on matching URLs (login/interaction/deferred-content); CRAWL_WAITING_FOR_USER fires
- [ ] User clicks continue-crawl or scan-then-continue or cancel-wait
- [ ] Auth credentials filled in via chrome.scripting.executeScript when configured
- [ ] On complete: crawlResults + crawlFailed populated; results rendered as crawl-results-by-page or by-wcag toggle
- [ ] Each page row links to its scan results

## Verification mechanism
`e2e/verify-feature-f03-site-crawl.ts` — local HTTP server serving 3 same-origin pages with cross-links; verify follow mode discovers all; verify urllist mode crawls only listed; verify pause/resume.

## Structural gaps
- `chrome.scripting.executeScript({func})` bodies for link collection + auth filling NOT directly verifiable (Gap 1 in structural-gaps.md). Verified via output (queue length, scan completion) only.
- Auth login flow tested with synthetic form fields; real third-party SSO NOT verified.
