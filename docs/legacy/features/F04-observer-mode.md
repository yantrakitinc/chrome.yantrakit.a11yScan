# F04 — Observer Mode

## Purpose

Passively scan every page the user navigates to, building a local history of accessibility results over time. No manual trigger needed — just browse normally and Observer captures everything.

## Who needs it

QA engineers exploring an app, auditors getting a broad overview, developers monitoring as they work.

## Dependencies

- F01 (Single Page Scan) — scan engine for each page
- F02 (Multi-Viewport Scan) — optional, breakpoint bucket tagging

## Behavior

### Activation

Toggled via the "Observe" mode button in the accordion form. Toggle is an independent checkbox — can be combined with any other mode.

**No consent modal.** Inline help text in the empty state explains that Observer Mode scans as you browse and all data stays local on your computer.

### Auto-scanning

When Observer is on and the user navigates to a new page:
1. `tabs.onUpdated` fires with `status === 'complete'`.
2. Background script checks: is the URL scannable? (not `chrome://`, `file://`, `data:`, etc.)
3. Background script checks: is a crawl actively running? If yes, **suppress** the auto-scan (crawl owns navigation).
4. Background script checks: was this URL scanned within `throttleSeconds`? If yes, skip.
5. Background script checks: does this URL pass domain filters? If no, skip.
6. If all checks pass: run a scan (same as F01) and record the result in observer history.

### Manual scanning during Observer

The action button says "**Scan This Page**" when Observer is on. Clicking it:
1. Runs a manual scan of the current page.
2. Result appears in the Results sub-tab (same as F01).
3. Result is ALSO recorded in Observer history with `source: "manual"`.

### Observer + Crawl interaction

| Crawl phase | Observer auto-scans | Manual "Scan This Page" |
|---|---|---|
| Crawl idle | Active | Available |
| Crawl running | **Suppressed** (crawl owns nav) | Hidden (button shows "Crawling…") |
| Crawl paused | **Active** (user owns nav) | Available |
| Crawl complete | Active | Available |

Crawl results do NOT go into Observer history. Only manual scans and auto-scans do.

### Observer + Multi-Viewport

When both are active, auto-scans are NOT multi-viewport (no window resize during passive browsing). Instead, the current window width is categorized into a **breakpoint bucket** based on configured viewports.

Example with viewports [375, 768, 1280]:
- Window at 412px → bucket "376–768px"
- Window at 1440px → bucket "≥1281px"

Observer history entries are tagged with their bucket. Viewport chips in the Observe tab filter by bucket.

### Settings

Accessible via the gear icon in the accordion:

| Setting | Type | Default | Description |
|---|---|---|---|
| includeDomains | string[] | `["*"]` | Domains to scan. Wildcard `*` = all. |
| excludeDomains | string[] | `[]` | Domains to skip. Takes priority over include. |
| throttleSeconds | number | 30 | Minimum seconds between rescans of same URL. |
| maxHistoryEntries | number | 500 | Hard cap. Oldest entries deleted when exceeded. |

**Domain matching**: supports exact match (`example.com`), wildcard prefix (`*.example.com`), or full wildcard (`*`).

### Observe sub-tab

Only shown when Observer is on (per PHASE_MODE_CHART.md Chart 5).

**Layout** (top to bottom):
1. **Filter input**: `<input type="search">` with placeholder "Filter by domain…"
2. **Export button**: exports history as JSON
3. **History list**: each entry is a `<details>` element, most recent first
   - Summary: timestamp (HH:MM:SS) + page title + violation count
   - Expanded: full URL + full timestamp (YYYY-MM-DD HH:MM:SS) + violation details

### Data structures

```typescript
interface iObserverEntry {
  id: string;                // unique ID (UUID)
  url: string;
  title: string;             // document.title
  timestamp: string;         // ISO 8601
  source: "auto" | "manual";
  violations: iViolation[];
  passes: iPass[];
  violationCount: number;    // total nodes across all violations
  viewportBucket?: string;   // when MV is on, e.g. "376–768px"
}

interface iObserverSettings {
  includeDomains: string[];
  excludeDomains: string[];
  throttleSeconds: number;
  maxHistoryEntries: number;
}

interface iObserverState {
  enabled: boolean;
  settings: iObserverSettings;
}
```

### Storage

- State: `chrome.storage.local['observer_state']`
- History: `chrome.storage.local['observer_history']` (array of `iObserverEntry`)
- All data stays on-device. Nothing is sent to any server.

## Acceptance Criteria

1. Observer toggle turns auto-scanning on/off.
2. Navigating to a new page triggers an auto-scan when Observer is on.
3. Auto-scans are suppressed during active crawl (crawling phase).
4. Auto-scans resume when crawl is paused or complete.
5. Throttle prevents rescanning the same URL within throttleSeconds.
6. Domain filters correctly include/exclude URLs.
7. Action button says "Scan This Page" when Observer is on.
8. Manual scans appear in both Results sub-tab and Observe sub-tab.
9. Observe sub-tab only appears when Observer is on.
10. History entries show timestamp, title, URL, and violation count.
11. History entries are ordered most-recent-first.
12. Domain filter input filters the history list.
13. Export button exports history as JSON.
14. Max history cap removes oldest entries when exceeded.
15. Observer state persists across side panel close/reopen.
16. MV + Observer tags entries with breakpoint bucket.
17. No consent modal — inline help text instead.
18. All Observer UI fits within 360px.
