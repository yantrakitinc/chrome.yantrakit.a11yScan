# A — Architecture

## Purpose

Defines the three runtime contexts of the extension and their responsibilities. Every feature documents which context owns which logic.

## Contexts

### 1. Sidepanel (UI)

Files: `src/sidepanel/*.ts`, `src/sidepanel/sidepanel.html`, `src/sidepanel/sidepanel.css`

Lifetime: lives only while the side panel is open. Restarted on every open. State that survives a close must be in `chrome.storage.local`.

Responsibilities:
- Render UI
- Handle user input (clicks, keyboard, form changes)
- Maintain in-memory UI state (`state` object)
- Send messages to the background and to content scripts
- Receive broadcast messages from background (CRAWL_PROGRESS, etc.)
- Persist scan state, manual review, test config to `chrome.storage.local`

The sidepanel does NOT:
- Run axe-core
- Touch the page DOM directly (uses `chrome.tabs.sendMessage` to the content script)
- Listen for `chrome.tabs.onUpdated` (background's job)

### 2. Background (Service Worker)

File: `src/background/index.ts`, `src/background/crawl.ts`, `src/background/multi-viewport.ts`, `src/background/observer.ts`

Lifetime: ephemeral. Service worker may sleep when idle. Cannot hold long-running JS state across sleeps reliably — use `chrome.storage.local` or `chrome.storage.session`.

Responsibilities:
- Route messages between sidepanel and content scripts
- Inject content scripts (`chrome.scripting.executeScript`)
- Coordinate Multi-Viewport scans (resize window between scans)
- Coordinate Site Crawl (navigate tabs, collect links)
- Handle context menu actions
- Listen for `chrome.tabs.onUpdated` for Observer mode (when enabled)

Single message router with a `switch (msg.type)` over the `iMessage` union.

### 3. Content Script (Per-tab)

Files: `src/content/*.ts` — bundled into `content.js`

Lifetime: per page load. Re-injected when needed via `chrome.scripting.executeScript`.

Responsibilities:
- Run axe-core on the document
- Compute reading order (Screen Reader)
- Compute tab order (Keyboard)
- Detect ARIA widgets
- Render visual overlays in Shadow DOM
- Animate Movie Mode
- Element highlighting (scroll into view + amber glow)
- Mock fetch/XHR interception
- Apply CVD SVG filter

Receives messages from background or sidepanel, returns results via `sendResponse`.

## State management

### Single `state` object in the sidepanel

ALL transient sidepanel UI state lives in one object exported from `sidepanel.ts`:

```typescript
export const state = {
  // ─── Top-level navigation ───
  topTab: "scan" as "scan" | "sr" | "kb" | "ai",

  // ─── Scan tab ───
  scanPhase: "idle" as "idle" | "scanning" | "results",
  crawlPhase: "idle" as "idle" | "crawling" | "paused" | "wait" | "complete",
  accordionExpanded: true,
  wcagVersion: "2.2" as "2.0" | "2.1" | "2.2",
  wcagLevel: "AA" as "A" | "AA" | "AAA",
  crawl: false,
  movie: false,
  mv: false,
  viewports: [375, 768, 1280] as number[],
  scanSubTab: "results" as "results" | "manual" | "aria",
  lastScanResult: null as iScanResult | null,
  crawlResults: null as Record<string, iScanResult> | null,
  crawlFailed: null as Record<string, string> | null,
  crawlProgress: { pagesVisited: 0, pagesTotal: 0, currentUrl: "" },
  mvProgress: null as { current: number; total: number } | null,
  mvViewportFilter: null as number | null,
  manualReview: {} as Record<string, iManualReviewStatus | null>,
  ariaWidgets: [] as iAriaWidget[],
  testConfig: null as iTestConfig | null,
  configPanelOpen: false,
  viewportEditing: false,
  crawlMode: "follow" as "follow" | "urllist",
  crawlUrlList: [] as string[],
  urlListPanelOpen: false,
  crawlViewMode: "page" as "page" | "wcag",
  observerEntries: [] as iObserverEntry[],
  observerLoaded: false,
  observerFilter: "",

  // ─── Screen Reader tab ───
  srAnalyzed: false,
  srElements: [] as iScreenReaderElement[],
  srScopeSelector: null as string | null,
  srInspectActive: false,
  srPlayState: "idle" as "idle" | "playing" | "paused" | "complete",
  srPlayIndex: 0,
  srSingleSpeakIndex: null as number | null,
  srSelectedRowIndex: null as number | null,

  // ─── Keyboard tab ───
  kbAnalyzed: false,
  kbTabOrder: [] as iTabOrderElement[],
  kbFocusGaps: [] as iFocusGap[],
  kbFocusIndicators: [] as iFocusIndicator[],
  kbKeyboardTraps: [] as iKeyboardTrap[],
  kbSkipLinks: [] as iSkipLink[],
  kbMoviePlayState: "idle" as "idle" | "playing" | "paused" | "complete",
  kbMovieIndex: 0,
  kbSelectedRowIndex: null as number | null,
  kbTabOrderOverlayOn: false,
  kbFocusGapsOverlayOn: false,

  // ─── AI Chat tab ───
  aiHistoryPanelOpen: false,
  aiCurrentMessages: [] as iAiMessage[],
};
```

NO module-level `let` for UI state in any sidepanel file. The only module-level state allowed is:
- Constants (frozen, never mutated)
- Cached references to DOM nodes that survive re-renders (e.g., the Shadow DOM host)
- Timer handles (must be stored to allow cleanup)

### Mutation rule

State is mutated by message handlers and event handlers. After mutation, the affected feature's render function (`renderScanTab`, etc.) is called to update the DOM.

### Persistence

Fields persisted to `chrome.storage.local`:
- `testConfig` → key `a11yscan_test_config`
- `manualReview` → key `manualReview` (per active tab origin scope — see R-MANUAL)
- Observer history → `observer_history` (managed by background)
- Crawl state → `crawlState` (managed by background)

Fields persisted to `chrome.storage.session`:
- `topTab`, `scanSubTab` — to restore across panel re-opens within the same session

Other state is recomputed/refetched on panel open.

## Render strategy

Two render strategies:

### A. Full re-render (only when entering a top-level state change)

Used for: switching top tabs, completing an Analyze, Clear button, after major state transitions.

Implementation: the per-tab `render*Tab()` function generates HTML once and assigns to `panel.innerHTML`.

### B. Targeted DOM update (DEFAULT for everything else)

For UI feedback that does not change the structure of the panel:
- Toggling a row's active class: `row.classList.toggle("ds-row--active", true)`
- Updating a button's label: `button.textContent = "Pause"`
- Updating a progress text: `progressText.textContent = "Playing 5 of 48"`
- Toggling a checkbox: `checkbox.checked = !checkbox.checked`
- Hiding/showing an element: `el.hidden = true`

Rule: NEVER call `renderXxxTab()` for a state change that affects only a few specific elements. Look up those elements by ID/class and update them in place.

The full re-render is reserved for cases where the new state requires a structurally different DOM (e.g., switching from "no results yet" empty state to "results with sub-tabs").

## Event handling

### Delegation, not per-element listeners

For lists with N rows (SR elements, KB tab order, observer entries), event listeners attach to the LIST CONTAINER and check `e.target.closest(".ds-row")` to identify the clicked row. This avoids re-attaching N listeners per render.

```typescript
// Once at panel init:
panel.addEventListener("click", (e) => {
  const row = (e.target as Element).closest<HTMLElement>(".ds-row");
  if (row && panel.contains(row)) {
    handleRowClick(row);
  }
});
```

### Single keyboard handler for tablist

Implemented once on the tablist container. Listens for ArrowLeft/ArrowRight/Home/End and updates `aria-selected` + `tabindex` (roving).

### `<details>` works natively

For accordion sections, use `<details>/<summary>`. The browser handles open/close and keyboard. We add a `toggle` event listener if we need to know about the state change.

## Module structure

```
src/sidepanel/
├── sidepanel.html         — shell, top tabs, footer, modal element
├── sidepanel.css          — design tokens + all primitives
├── sidepanel.ts           — entry: state, init, message router, switchTab, exports state and helpers
├── shared/
│   ├── icons.ts           — icon SVG strings
│   ├── primitives.ts      — html() helpers (button, badge, row, modal, …)
│   ├── escape.ts          — escapeHtml (single implementation)
│   ├── messaging.ts       — typed sendMessage helper
│   └── persistence.ts     — chrome.storage.local helpers
├── scan/
│   ├── scan-tab.ts        — render + listeners
│   ├── scan-results.ts    — render results sub-tabs (results, manual, aria)
│   ├── scan-config.ts     — config modal logic
│   ├── scan-toolbar.ts    — bottom toolbar (export, highlight)
│   └── scan-state.ts      — scan-specific state mutators
├── sr/
│   ├── sr-tab.ts          — render + listeners
│   ├── sr-playback.ts     — play state machine (shared with KB)
│   └── sr-row.ts          — single row render
├── kb/
│   ├── kb-tab.ts
│   ├── kb-row.ts
│   └── kb-overlays.ts     — overlay toggles
├── ai/
│   └── ai-tab.ts          — currently disabled, retained
└── playback/
    └── playback-state.ts  — shared "Idle | Playing | Paused | Complete" machine used by both SR and KB Movie
```

This is a target structure. The implementation may consolidate some of these into single files if separation isn't useful.

## Testing strategy

### Unit tests (vitest)

- Pure functions only: state mutators, validators, escapers, formatters, mappers
- 100% coverage target for `src/shared/`
- DOM-dependent rendering is NOT unit-tested — covered by E2E

### E2E tests (puppeteer)

- One test per visible feature
- Loads the extension in a real Chromium with `--load-extension`
- Drives the UI via `chrome.runtime.sendMessage` and DOM event dispatch
- Asserts on rendered DOM and message responses
- Runs against live demo pages at `a11yscan.yantrakit.com/demo/*`

### Self-audit checklist (per feature)

Before any feature is considered complete:

1. Code matches the requirements doc word-for-word
2. All inputs validated, all outputs typed
3. No JS doing CSS's job (`mouseenter`, `mouseleave`, `focus`, `blur` for visual state)
4. No inline `style` for color/spacing/typography
5. No `setTimeout` without cleanup
6. No event listener stacked on every render
7. Accessibility: keyboard reachable, focus indicator visible, screen reader announces
8. Test config knobs documented and consumed
9. Edge cases handled (empty list, error response, network failure)
10. Unit tests pass
11. E2E tests pass
12. Manual flow trace matches requirements

If any item fails, the feature is NOT complete. Move on only when all 12 pass.
