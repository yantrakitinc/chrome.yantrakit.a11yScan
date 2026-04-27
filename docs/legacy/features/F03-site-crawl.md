# F03 — Site Crawl

## Purpose

Automatically scan every reachable page on a website. Traverses the site page by page, scanning each for accessibility violations, and aggregates results into a site-wide report.

## Who needs it

Auditors generating full-site reports, QA verifying entire applications, developers checking all routes.

## Dependencies

- F01 (Single Page Scan) — scan engine for each page
- F02 (Multi-Viewport Scan) — optional, applies per page when MV is on

## Behavior

### Crawl modes

Two crawl modes, selected via dropdown in the accordion form:

1. **Follow** — depth-first traversal from the starting page.
   - Collects all `<a href>` links on each page.
   - Stays within the same origin.
   - Respects `rel="nofollow"` (skips those links).
   - Configurable scope (URL prefix) and max pages.

2. **URL List** — curated list of specific URLs to scan.
   - Three ways to populate the list:
     1. **Paste sitemap URL** → fetches the XML, parses `<loc>` elements, displays URLs in a modal.
     2. **Upload sitemap file** → parses the XML file, same result.
     3. **Add URLs manually** → one at a time via input field.
   - Each URL in the list has an **Omit/Include** toggle (doesn't remove, just skips).
   - Extra URLs can be added that aren't in the sitemap.
   - Crawl visits non-omitted URLs in list order.

### URL List Modal

Opens when user clicks "Set up URL list" or "N of M URLs — Edit list" button.

**Layout** (top to bottom):
1. Header: "URL List" + close button (×)
2. Sitemap import section:
   - Input field: placeholder "https://example.com/sitemap.xml"
   - **Load** button (fetches URL, parses XML)
   - "Or upload a sitemap file" link (opens file picker, accepts .xml)
3. Manual add section:
   - Input field: placeholder "https://example.com/page"
   - **Add** button
4. Summary bar: "X of Y URLs will be scanned" (shown when list has items)
5. URL list (scrollable): each row has the URL in a **read-only text input** (so the user can scroll horizontally to see the full URL — plain text truncates and becomes unreadable at 360px) + Omit/Include toggle button
6. Footer: **Done** button (full width)

**Sitemap parsing**: Uses `DOMParser` to parse XML. Extracts all `<loc>` elements. Handles sitemap index files (recursive fetch). Returns array of URL strings.

### Crawl process

1. User clicks "**Start Crawl**" button.
2. Phase transitions: Crawl Idle → Crawling.
3. Accordion auto-collapses.
4. Progress bar appears with: `pageCount/maxPages · currentUrl`.
5. Pause and Cancel buttons appear next to progress bar.

For each page:
1. Navigate the tab to the URL.
2. Wait for page load (onUpdated status='complete').
3. Inject content script if needed.
4. Run scan (respecting WCAG version/level and optional MV).
5. Store per-page results.
6. Update progress bar.
7. If page rules match: transition to Wait phase (see below).
8. Otherwise: advance to next URL.

### Depth-first algorithm (Follow mode)

```
stack = [startUrl]
visited = Set()

while stack.length > 0 && visited.size < maxPages:
    url = stack.pop()
    if url in visited: continue
    visited.add(url)
    navigate(url)
    scan(url)
    links = collectSameOriginLinks()
    for link in links.reverse():  // reverse to maintain natural order in stack
        if link not in visited:
            stack.push(link)
```

### Page rules

Configurable URL patterns that trigger a pause during crawl. Three wait types:

1. **login** — page requires authentication. User logs in manually, then continues.
2. **interaction** — page needs user interaction (accept cookies, dismiss modal).
3. **deferred-content** — page loads content lazily, user waits for it to appear.

**Wait phase UI**:
- Warning banner: "⚠ [waitType] — [url]"
- Three buttons:
  - **Continue** — resume crawl from this page
  - **Scan page, then continue** — scan the current page first, then continue crawl
  - **Cancel** — stop the crawl entirely

### Pause/Resume

- **Pause**: clicking ⏸ transitions from Crawling → Paused.
  - Current page scan completes (doesn't interrupt mid-scan).
  - All controls re-enable (user can change modes, WCAG settings, browse manually).
  - If Observer is on: auto-scans resume (user owns navigation while paused).
- **Resume**: clicking ▶ transitions from Paused → Crawling.
  - Controls disable again.
  - Crawl continues from where it left off.

### Crawl results display

Results appear in the Results sub-tab with a toggle: **By page** / **By WCAG**.

**By page**:
- Each URL is a `<details>` element.
- Summary: URL (monospace) + violation count + pass count.
- Expanded: that page's full violation list (same ViolationRow component as F01).
- If MV is on: viewport filter chips inside each page's expanded details.
- Status indicators per page:
  - `done` — scan complete, shows violations/passes
  - `active` — currently scanning (pulsing "scanning…" text)
  - `wait` — paused for page rule ("waiting" badge)
  - `pending` — not yet scanned (dimmed, "pending" text)

**By WCAG**:
- Violations grouped by WCAG criterion across all pages.
- Each criterion expandable → shows which pages + elements.
- Same ViolationRow component.

The "By page / By WCAG" toggle is visible in ALL crawl phases (crawling, paused, wait, complete) — not only when complete.

### State persistence

Crawl state is stored in `chrome.storage.local` so it survives:
- Side panel close/reopen
- Browser restart (crawl is cancelled but results are preserved)

### Authentication

Pre-crawl login flow (from test config):
1. Navigate to `loginUrl`.
2. Fill `usernameSelector` with `username`.
3. Fill `passwordSelector` with `password`.
4. Click `submitSelector`.
5. Wait for navigation to complete.
6. Begin crawl with authenticated session.

### Error handling per page

| Error | Behavior |
|---|---|
| Page load timeout | Mark page as "failed", continue to next |
| Non-200 status | Mark page as "failed", continue to next |
| Redirect to different origin | Mark page as "redirected", skip |
| Content script injection fails | Mark page as "failed", continue to next |
| axe-core timeout | Store partial results, mark as "partial", continue |

### Data structures

```typescript
interface iCrawlOptions {
  mode: "follow" | "urllist";
  timeout: number;         // page load timeout ms, default: 30000
  scanTimeout: number;     // axe-core timeout ms, default: 30000
  delay: number;           // ms between pages, default: 1000
  scope: string;           // URL prefix to stay within (Follow mode)
  urlList: string[];       // URLs to scan (URL List mode)
  pageRules: iPageRule[];
  auth?: iCrawlAuth;
}
// No maxPages — crawl runs until all discovered/listed URLs are scanned.
// Scope is controlled by providing specific URLs (URL list) or a crawl scope prefix (Follow mode).

interface iPageRule {
  pattern: string;        // URL substring or regex
  waitType: "login" | "interaction" | "deferred-content";
  description: string;    // shown in the wait UI
}

interface iCrawlAuth {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
  gatedUrls?: {
    mode: "none" | "list" | "prefix" | "regex";
    patterns: string[];
  };
}

interface iCrawlState {
  status: "idle" | "crawling" | "paused" | "wait" | "complete";
  startedAt: string;
  pagesVisited: number;
  pagesTotal: number;     // maxPages or urlList.length
  currentUrl: string;
  results: Record<string, iScanResult>;  // url → result
  failed: Record<string, string>;        // url → error message
  queue: string[];        // remaining URLs
  visited: string[];      // completed URLs in order
}
```

## Acceptance Criteria

1. "Start Crawl" button appears when Crawl mode is on and crawl is idle.
2. Crawl mode dropdown offers "Follow all links" and "URL list".
3. URL list mode shows "Set up URL list" button that opens modal.
4. URL modal has sitemap load, file upload, manual add, omit/include toggles, and done button.
5. Sitemap XML is parsed correctly (extracts all `<loc>` URLs).
6. Starting crawl transitions to Crawling phase with progress bar.
7. Progress bar shows page count and current URL.
8. Pause button stops the crawl after current page finishes.
9. Resume button continues from where crawl left off.
10. Cancel button stops crawl and returns to Idle.
11. Page rules trigger Wait phase with warning banner.
12. Wait phase shows Continue, "Scan page then continue", and Cancel buttons.
13. "By page / By WCAG" toggle works in all crawl phases.
14. Each crawl page row shows correct status (done/active/wait/pending).
15. Done pages are expandable with full violation details.
16. MV viewport filter appears inside each page's details when MV is on.
17. Controls re-enable during Paused phase.
18. Controls disable during Crawling and Wait phases.
19. Crawl state persists when side panel is closed and reopened.
20. Failed pages are marked but don't stop the crawl.
21. All crawl UI fits within 360px.
