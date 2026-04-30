# Flow: Crawl with login page-rule → user authenticates → resume

## Preconditions
- Extension loaded; sidepanel open
- testConfig with pageRules: `[{ pattern: "/login", waitType: "login", description: "Sign in first" }]` applied
- Crawl mode ON; mode=urllist with URLs including `https://x.com/login` then `https://x.com/dashboard`

## Steps

1. Click `#scan-btn`.
   - Expected: START_CRAWL sent; state.crawlPhase=crawling.

2. Crawl reaches `/login`.
   - Expected: matchPageRule matches; CRAWL_WAITING_FOR_USER broadcast.
   - Expected: state.crawlPhase=wait; state.crawlWaitInfo populated.
   - Expected: page-rule wait card renders with URL + waitType + description + 3 buttons.

3. User performs login on the page (out of band).

4. Click `#continue-crawl`.
   - Expected: state.crawlWaitInfo=null; USER_CONTINUE sent.
   - Expected: state.crawlPhase=crawling.
   - Expected: crawl resumes; visits `/dashboard`.

5. Crawl completes.
   - Expected: state.crawlPhase=complete; crawlResults populated for both URLs.
   - Expected: results render in by-page or by-wcag view (toggleable).

## Verification mechanism
`e2e/verify-flow-crawl-login-page-rule.ts` — pending. Requires fixture HTTP server with `/login` and `/dashboard` routes.

## Status
⚠ Unverified by Puppeteer. Integration test in `src/background/__tests__/crawl-engine.test.ts` covers the message flow with mocks.

## Structural gaps
- Real auth credential filling via chrome.scripting.executeScript({func}) NOT directly verifiable (Gap 1). Verified via test that the crawl proceeds after USER_CONTINUE.
