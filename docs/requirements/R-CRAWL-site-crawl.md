# R-CRAWL — Site Crawl

## Purpose

Crawl multiple pages of a site, scanning each. Two modes:

1. **Follow all links** — depth-first link discovery within a scope
2. **URL list** — explicit list of URLs to scan

NO maxPages cap. Crawl runs until all discovered/listed URLs are scanned.

## Activation

User clicks the **Crawl** mode button in the Scan accordion. `state.crawl = true; aria-pressed="true"`.

When `state.crawl === true`, the accordion shows additional controls below the mode buttons:

```
Crawl mode    [Follow all links ▾]
              ↳ scope: (auto = current origin)
              ↳ click "Start Crawl" to begin from current page

OR

Crawl mode    [URL list ▾]
              [URL list panel: paste textarea, manual add input, "Done" button]
              [✕ url1] [✕ url2] [✕ url3]
              [Done]
```

## Crawl mode dropdown

```html
<select id="crawl-mode" aria-label="Crawl mode">
  <option value="follow">Follow all links</option>
  <option value="urllist">URL list</option>
</select>
```

Two options ONLY. No "Sitemap URL" option (sitemaps are pasted into the URL list textarea — the parser auto-detects sitemap XML).

State: `state.crawlMode: "follow" | "urllist"`.

## Follow mode

The "scope" is auto-derived from the active tab's origin. Optionally overridable via test config `crawl.scope`.

When user clicks "Start Crawl":
- Background gets the active tab's URL as the start URL.
- Crawl engine adds it to a queue.
- Loop: pop URL → navigate tab → wait for load → inject content script → run scan → collect links matching scope → push new links → repeat.

## URL list mode

When `state.crawlMode === "urllist"`:
- URL list panel button "Open URL list" → expands a panel with:
  - A `<textarea aria-label="Paste URLs or sitemap XML">` for bulk paste
  - "Add" button → parses URLs (auto-detects sitemap XML and extracts `<loc>` URLs)
  - "Upload .txt" file input — accepts a plain text file with one URL per line
  - A `<input type="url" aria-label="Add URL to crawl list">` for adding one URL at a time
  - List of currently added URLs, each with a × remove button
  - Done button to close the panel

State: `state.crawlUrlList: string[]`.

When user clicks "Start Crawl":
- Background queues exactly these URLs.
- Loop: pop URL → navigate → scan → next.

## Crawl progress UI

Replaces the action area while `crawlPhase === "crawling" | "paused"`:

```
[⏸ Pause] [✕ Cancel]    5 / 50    /docs/page-3
[==========----------]
```

- Pause / Resume toggles `crawlPhase`. Sends `PAUSE_CRAWL` / `RESUME_CRAWL`.
- Cancel sends `CANCEL_CRAWL`. Returns to `idle` phase.
- Progress text: "X / Y" pages where Y is total queue length (Follow mode) or `crawlUrlList.length` (URL List mode).
- Current URL display: the path portion of `crawlState.currentUrl`.

The progress region uses `role="status" aria-live="polite"` for updates.

## Page rule wait UI

When `crawlPhase === "wait"`:

```
⚠ Page rule triggered
[ Continue ] [ Scan page, then continue ] [ Cancel ]
```

(See R-RULES.) The crawl engine sets `crawlPhase = "wait"` when it hits a URL matching a page rule pattern.

## Pre-crawl authentication (when `auth` in test config)

Before processing the queue, the crawl engine:

1. Navigates the active tab to `auth.loginUrl`.
2. Waits for page load.
3. Injects content script that:
   - Fills `auth.usernameSelector` with `auth.username`
   - Fills `auth.passwordSelector` with `auth.password`
   - Clicks `auth.submitSelector`
4. Waits for navigation to complete after login.
5. Begins the crawl with the now-authenticated session.

If login fails (selectors not found, navigation timeout): crawl aborts with an error in `crawlState.failed["auth"]`.

## Gated URLs

When `auth.gatedUrls` is configured: after each scan, check if the scanned URL matches a gated pattern. If so, set `result.authRequired = true` on that scan result. The result UI shows an amber badge on those rows.

If a "non-gated" URL unexpectedly redirects to a different origin or to the loginUrl, the engine flags `result.authWarning = true`. Result UI shows a warning.

## Crawl engine internals

`crawlOptions: iCrawlOptions & { testConfig?: iTestConfig }` is set on `START_CRAWL`.

The engine uses a stack (LIFO) for depth-first order. URLs visited are tracked in a Set to avoid revisits.

For each scan during crawl:
1. Get fresh remote `config` via `getConfig()`.
2. Apply `testConfig` overrides (wcag, rules) — same logic as single page scan.
3. If `testConfig.mocks.length > 0`: send `ACTIVATE_MOCKS` to content script before scan.
4. Send `RUN_SCAN { config, isCrawl: true }`.

## Results display

After `crawlPhase === "complete"`, results sub-tab shows two view modes:

```
[By page] [By WCAG]
```

### By page

A `<details>` per crawled page. Summary: page URL + status (✓ passed / ✗ N issues). Body: violations grouped by criterion.

### By WCAG

Each criterion is a `<details>`. Body: list of pages where the criterion was violated, with selectors.

## Pause-on-navigate behavior

If the user manually navigates the tab during a crawl (e.g., types a URL), the crawl pauses automatically. `crawlPhase = "paused"`. Resume returns control.

## State

```typescript
state.crawlPhase: "idle" | "crawling" | "paused" | "wait" | "complete"
state.crawlMode: "follow" | "urllist"
state.crawlUrlList: string[]
state.crawlProgress: { pagesVisited: number; pagesTotal: number; currentUrl: string }
state.crawlResults: Record<string, iScanResult> | null
state.crawlFailed: Record<string, string> | null
state.crawlViewMode: "page" | "wcag"
```

## Test config consumption

| Field | Effect |
|---|---|
| `crawl.mode` | Override `state.crawlMode` |
| `crawl.scope` | Override Follow scope (URL prefix) |
| `crawl.urlList` | Auto-populate `state.crawlUrlList` |
| `pageRules[]` | List of pause rules — see R-RULES |
| `auth.*` | Pre-crawl login flow |
| `auth.gatedUrls` | Tag scanned URLs as auth-required |
| `timing.pageLoadTimeout` | Per-page navigation timeout (default 30000) |
| `timing.delayBetweenPages` | Pause between pages (default 1000) |
| `wcag.*` / `rules.*` | Applied per-scan during crawl |
| `mocks[]` | Activated for each crawl page scan |

## Test cases

### E2E

1. Click Crawl button → mode active. Crawl mode dropdown appears with two options.
2. Click "Start Crawl" with default Follow mode → background crawls the demo crawl-hub. Progress shows "X / Y".
3. Click ⏸ Pause → crawl pauses. Click ▶ Resume → continues.
4. Click ✕ Cancel → crawl ends, returns to idle.
5. Switch to URL list mode → URL list panel becomes accessible.
6. Paste sitemap XML into the textarea, click Add → URLs extracted and added.
7. Click Start Crawl with URL list → only those URLs scanned.
8. Crawl with page rule pattern → pauses at matching URL, shows wait UI. Continue resumes.
9. Crawl with auth config → login happens first, then crawl proceeds with authenticated pages.
10. With gatedUrls config: scanned admin URL has `authRequired: true` flag in result.
11. Switch view to "By WCAG" after crawl → results regroup.
