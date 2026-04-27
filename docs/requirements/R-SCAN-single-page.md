# R-SCAN — Single Page Scan + Results

## Purpose

The default mode of the extension. User clicks "Scan Page" → axe-core runs on the active tab → results display grouped by WCAG criterion with severity colors and per-violation drill-down.

## Top of panel — accordion

Always present. Two states: expanded (default) and collapsed.

### Expanded

```
WCAG  [2.2 ▾] [AA ▾] [⊕ Inspect not in this tab — see SR]  [⚙ settings] [Reset]  [▲ collapse]
[ Crawl ] [ Observe (SOON) ] [ Movie ]
☐ Multi-Viewport
[ Scan Page ]                                          [Clear (after results)]
```

Top row of accordion (the "expanded toggle"):
- **WCAG** label
- WCAG version `<select>` (2.2 / 2.1 / 2.0)
- WCAG level `<select>` (AA / A / AAA)
- Settings (⚙) button — opens config modal (R-CONFIG)
- "Config loaded" badge — shown only when `state.testConfig !== null`
- Reset button — clears all mode toggles AND test config
- Collapse button (▲) — collapses the accordion to the compact toggle

Mode buttons row (inside accordion body):
- **Crawl** — `class="ds-btn ds-btn--md"` mode toggle. `aria-pressed` reflects `state.crawl`.
- **Observe (SOON)** — permanently `disabled`. Same SOON badge pattern as AI Chat tab.
- **Movie** — mode toggle. `aria-pressed` reflects `state.movie`. (Movie mode here means: animate Movie Mode after each scan completes.)

Multi-Viewport checkbox row:
- A native `<input type="checkbox" id="mv-check">` inside a `<label>` with text "Multi-Viewport".
- When checked, a viewport editor appears below.

Action area (always visible at bottom of accordion):
- **Scan Page** primary CTA. Text changes based on state:
  - Default: "Scan Page"
  - Crawl mode: "Start Crawl"
  - Multi-Viewport mode: "Scan All Viewports"
  - During scanning: disabled
- **Clear** secondary destructive — only shown when `state.scanPhase === "results"` or `state.crawlPhase === "complete" | "paused"`.

### Collapsed

```
WCAG 2.2 AA · [Crawl] [Movie] [Multi-Viewport]               [▼ expand]
[ Scan Page ]                                          [Clear]
```

A compact single line showing WCAG version+level + active mode pills + expand button. The action area (Scan / Clear) remains visible below.

The accordion is collapsed by default during scan/crawl progress, expanded when idle or showing results.

### Accordion toggle behavior

Clicking the WCAG/mode area expands. Clicking the collapse button collapses. The accordion-toggle is a `<button>` when collapsed, a `<div role="group">` when expanded (because expanded contains other buttons/selects which can't be nested in a button).

## Scan flow

1. User clicks "Scan Page".
2. `state.scanPhase = "scanning"`. `state.accordionExpanded = false`. Render scan progress bar.
3. Send `SCAN_REQUEST` with `testConfig: state.testConfig`.
4. Background applies test config overrides to remote config (wcag, rules), injects content script, sends `RUN_SCAN` to content script.
5. Content script runs axe-core, returns `iScanResult`.
6. Sidepanel receives `SCAN_RESULT`, sets `state.lastScanResult`, `state.scanPhase = "results"`, `state.scanSubTab = "results"`. Renders results.

If scan fails: shows error toast + state returns to idle.

## Scan progress bar

While `scanPhase === "scanning"`:

```
analyzing page…                                              [✕]
[==============------]
```

A `.ds-progress` element with `role="status" aria-live="polite"`. Cancel button sends `CANCEL_SCAN` (currently no-op as scan is fast; reserved for future).

## Crawl progress bar

While `crawlPhase === "crawling" | "paused"`:

```
[⏸ pause] [✕ cancel] 5 / 50 · /docs/page-3
[==========----------]
```

Buttons:
- ⏸ Pause / ▶ Resume (toggles based on phase)
- ✕ Cancel

## Page rule wait UI

While `crawlPhase === "wait"`:

```
⚠ Page rule triggered
[ Continue ] [ Scan page, then continue ] [ Cancel ]
```

A yellow-tinted alert region with three buttons. (See R-RULES.)

## Sub-tabs (after results land)

```
[Results] [Manual] [ARIA]
```

Three buttons with proper `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` / roving tabindex. Arrow key navigation between sub-tabs (same pattern as top tabs).

When sub-tab changes, only the content area below changes. The accordion and toolbar do not re-render.

## Results sub-tab content

Grouped by WCAG criterion. For each criterion with violations:

```
[▼] 4.1.2  4.1.2 — Learn more ↗     critical    1
    button:nth-child(5)                          [Highlight]
    Fix: ensure buttons have discernible text…
    [▼] (collapsible — for additional nodes if multiple)
```

Each criterion is a `<details class="ds-disclosure ds-disclosure--severity-{impact}">`. Open/close affordance via custom chevron (no native marker).

Inside the body:
- Learn more link to https://a11yscan.yantrakit.com/wcag/{criterion}
- For each violation node:
  - `selector` (monospace, ellipsis)
  - `[Highlight]` button → sends `HIGHLIGHT_ELEMENT`
  - `failureSummary` text in red
  - Hidden `[Chat about it →]` button (`display: none`) — code preserved for when AI Chat is enabled

## Crawl results display

Two view modes: by page, by WCAG.

```
[By page] [By WCAG]
```

A segmented control toggles between `state.crawlViewMode = "page" | "wcag"`.

### By Page mode

Each crawled page is a `<details>` with the page URL as summary, violations grouped by criterion inside.

### By WCAG mode

Each criterion is a `<details>` with violations from all crawled pages aggregated.

## Manual sub-tab content

(See R-MANUAL.)

## ARIA sub-tab content

(See R-ARIA.)

## Toolbar (bottom of Scan tab when results exist)

```
Export    [JSON] [HTML] [PDF] [Copy]
Highlight [☐ Violations]
```

Two-row toolbar. Toggling Violations shows/hides the violation overlay on the page. (See R-OVERLAYS, R-EXPORT.)

NOT on Scan tab anymore: Tab order overlay, Focus gaps overlay (those moved to Keyboard tab). Movie Mode controls (those moved to Keyboard tab Tab Order section).

## State: scanPhase

| Value | Description |
|---|---|
| `idle` | Default. No scan in progress. May or may not have results from a previous scan. |
| `scanning` | A scan is running. UI shows progress bar. |
| `results` | A scan has completed. UI shows results sub-tabs. Set after `SCAN_RESULT` received. |

Transitions: `idle → scanning → results → (user clicks Clear) → idle`.

## State: crawlPhase

| Value | Description |
|---|---|
| `idle` | Default. |
| `crawling` | Crawl is running, processing pages. |
| `paused` | User has paused the crawl. |
| `wait` | Crawl hit a page rule and is waiting for user. |
| `complete` | Crawl finished. Results are in `state.crawlResults`. |

## Test config consumption

| Field | Effect |
|---|---|
| `wcag.version` / `wcag.level` | Override the default WCAG version/level for THIS scan. |
| `rules.include` | Run ONLY these axe-core rules (whitelist). |
| `rules.exclude` | Disable these axe-core rules (blacklist). |
| `enrichment.*` | Used by Export only — not the scan itself. |

## Test cases

### E2E

1. Click Scan Page on a demo page → SCAN_RESULT received with violations and passes.
2. Results render with WCAG criterion grouping (e.g., "1.1.1", "4.1.2") and severity colors (red for critical, orange for serious).
3. Click a violation row → expands; shows nodes with selectors, failure summaries, Highlight buttons.
4. Click Highlight on a violation node → page element glows for 3s.
5. Click Clear → results clear, return to "Click Scan Page" empty state. Accordion expanded.
6. Toggle Multi-Viewport → checkbox checked, viewport editor appears with default 375/768/1280.
7. Toggle Crawl → mode button pressed. Crawl mode dropdown appears below.
8. Toggle Movie → mode button pressed. (Movie Mode plays after scan completes — implementation detail.)
9. With test config `wcag: { version: "2.1", level: "AAA" }`, Scan Page runs against 2.1 AAA — violations match that rule set.
10. With test config `rules: { include: ["image-alt"] }`, Scan Page returns ONLY `image-alt` violations.
11. Click ⚙ settings → config modal opens. (See R-CONFIG.)
12. Reset button → clears all mode toggles and test config; "Config loaded" badge disappears.
13. During scanning, the action button is disabled. Clear button is hidden.
14. Sub-tabs (Results, Manual, ARIA) are present after results land. Arrow key nav between them works.

### Unit

1. State transition: `idle → scanning → results` on `SCAN_RESULT` arrival.
2. State transition: `results → idle` on Clear button click.
3. Accordion auto-collapse: `state.accordionExpanded = false` when scan starts.
4. Action button text: "Scan Page" when default, "Start Crawl" when `crawl=true`, "Scan All Viewports" when `mv=true`.
