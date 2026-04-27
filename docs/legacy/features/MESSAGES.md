# Message Protocol — Complete Reference

Every message between background, content script, and sidepanel uses a discriminated union type (`iMessage` in `shared/messages.ts`). This document lists every message type — both implemented and planned.

## Direction Legend

- **SP → BG**: Sidepanel sends to Background
- **BG → CS**: Background sends to Content Script
- **CS → BG**: Content Script sends to Background
- **BG → SP**: Background sends to Sidepanel

## Implemented Messages (in `iMessage` union)

These are the messages currently defined in `shared/messages.ts`:

### Scan

| Message | Direction | Payload | Description |
|---|---|---|---|
| `SCAN_REQUEST` | SP → BG | — | User clicked Scan Page |
| `RUN_SCAN` | BG → CS | `{ config: iRemoteConfig }` | Run axe-core with config |
| `SCAN_RESULT` | CS → BG → SP | `iScanResult` | Scan completed |
| `SCAN_ERROR` | CS → BG → SP | `{ message: string }` | Scan failed |
| `SCAN_PROGRESS` | CS → BG → SP | `{ status: string }` | Mid-scan progress |

### Config

| Message | Direction | Payload | Description |
|---|---|---|---|
| `FORCE_CONFIG_UPDATE` | SP → BG | — | Force re-fetch remote config |
| `CONFIG_UPDATED` | BG → SP | `{ version: string }` | Config was updated |

### Observer

| Message | Direction | Payload | Description |
|---|---|---|---|
| `OBSERVER_ENABLE` | SP → BG | — | Turn on Observer Mode |
| `OBSERVER_DISABLE` | SP → BG | — | Turn off Observer Mode |
| `OBSERVER_GET_STATE` | SP → BG | — | Request observer state |
| `OBSERVER_STATE` | BG → SP | `iObserverState` | Current observer state |
| `OBSERVER_UPDATE_SETTINGS` | SP → BG | `Partial<iObserverSettings>` | Update observer settings |
| `OBSERVER_GET_HISTORY` | SP → BG | — | Request history |
| `OBSERVER_HISTORY` | BG → SP | `iObserverScanResult[]` | History entries |
| `OBSERVER_CLEAR_HISTORY` | SP → BG | — | Delete all history |
| `OBSERVER_EXPORT_HISTORY` | SP → BG | — | Export as JSON |
| `OBSERVER_SCAN_COMPLETE` | BG → SP | `{ entry: iObserverScanResult }` | New auto-scan recorded |

## Implemented Messages (in content script, outside `iMessage` union)

These are response types sent by the content script but not formally in the `iMessage` discriminated union:

| Message | Direction | Description |
|---|---|---|
| `ARIA_SCAN_RESULT` | CS → BG → SP | ARIA widget validation results |
| `ENRICHED_CONTEXT_RESULT` | CS → BG → SP | DOM/CSS/framework context per element |
| `FOCUS_GAPS_RESULT` | CS → BG → SP | Focus gap detection results |
| `TAB_ORDER_RESULT` | CS → BG → SP | Tab order sequence results |
| `VIOLATION_BADGE_CLICKED` | CS → SP | User clicked a violation badge on the page |

## Planned Messages (not yet in codebase)

These messages are specified in feature docs but not yet implemented. They must be added to `iMessage` when their features are built.

### Crawl (F03)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `START_CRAWL` | SP → BG | `iCrawlOptions` | Start site crawl |
| `PAUSE_CRAWL` | SP → BG | — | Pause active crawl |
| `RESUME_CRAWL` | SP → BG | — | Resume paused crawl |
| `CANCEL_CRAWL` | SP → BG | — | Cancel crawl |
| `GET_CRAWL_STATE` | SP → BG | — | Request crawl state |
| `CRAWL_PROGRESS` | BG → SP | `iCrawlState` | Per-page progress |
| `CRAWL_WAITING_FOR_USER` | BG → SP | `{ url, waitType, description }` | Page rule triggered |
| `USER_CONTINUE` | SP → BG | — | Continue after page rule |

**Note:** Crawl functionality exists in `background/crawl.ts` but uses direct function calls, not the message protocol. These messages are needed when sidepanel-to-background crawl communication moves to the message system.

### Overlay (F05)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `SHOW_VIOLATION_OVERLAY` | SP → BG → CS | `{ violations }` | Show violation outlines + badges |
| `HIDE_VIOLATION_OVERLAY` | SP → BG → CS | — | Remove violation overlays |
| `SHOW_TAB_ORDER` | SP → BG → CS | — | Show tab order badges + lines |
| `HIDE_TAB_ORDER` | SP → BG → CS | — | Remove tab order overlay |
| `SHOW_FOCUS_GAPS` | SP → BG → CS | — | Show focus gap outlines |
| `HIDE_FOCUS_GAPS` | SP → BG → CS | — | Remove focus gap overlay |
| `HIGHLIGHT_ELEMENT` | SP → BG → CS | `{ selector: string }` | Scroll to + highlight element |

### Movie Mode (F06)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `START_MOVIE_MODE` | SP → BG → CS | — | Begin animated walkthrough |
| `PAUSE_MOVIE_MODE` | SP → BG → CS | — | Pause movie |
| `RESUME_MOVIE_MODE` | SP → BG → CS | — | Resume movie |
| `STOP_MOVIE_MODE` | SP → BG → CS | — | Stop movie |
| `SET_MOVIE_SPEED` | SP → BG → CS | `{ speed: 0.5 \| 1 \| 2 \| 4 }` | Change speed |

### CVD (F08)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `APPLY_CVD_FILTER` | SP → BG → CS | `{ matrix: number[] \| null }` | Apply color matrix filter |

### Screen Reader (F15)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `ANALYZE_READING_ORDER` | SP → BG → CS | `{ scopeSelector?: string }` | Analyze DOM reading order |
| `READING_ORDER_RESULT` | CS → BG → SP | `iScreenReaderElement[]` | Ordered element list |

### Enrichment (F12)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `COLLECT_ENRICHED_CONTEXT` | SP → BG → CS | `{ selectors: string[] }` | Gather context per element |

### Mock (F14)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `ACTIVATE_MOCKS` | SP → BG → CS | `{ mocks: iMockEndpoint[] }` | Inject API mocks |

### Multi-Viewport (F02)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `MULTI_VIEWPORT_SCAN` | SP → BG | `{ viewports: number[] }` | Start MV scan |
| `MULTI_VIEWPORT_PROGRESS` | BG → SP | `{ currentViewport, totalViewports }` | Per-viewport progress |
| `MULTI_VIEWPORT_RESULT` | BG → SP | `iMultiViewportResult` | Combined results |

### Inspector (F20)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `ENTER_INSPECT_MODE` | SP → BG → CS | — | Activate hover inspection |
| `EXIT_INSPECT_MODE` | SP → BG → CS | — | Deactivate inspection |
| `INSPECT_ELEMENT` | CS → BG → SP | `iInspectorData` | Data for hovered element |

### Context Menu Navigation (F22)

| Message | Direction | Payload | Description |
|---|---|---|---|
| `{ action: "navigate", target: "settings" }` | BG → SP | — | Navigate to settings |
| `{ action: "navigate", target: "chatHistory" }` | BG → SP | — | Navigate to chat history |
| `{ action: "stateCleared" }` | BG → SP | — | All data was cleared |

## Storage Keys (verified against codebase)

| Key | Used by | Purpose |
|---|---|---|
| `observer_state` | `background/observer.ts` | `iObserverState` |
| `observer_history` | `background/observer.ts` | `iObserverScanResult[]` |
| `crawlState` | `background/crawl.ts` | Crawl progress state |
| `a11yscan_config` | `shared/config.ts` | Cached remote config |
| `a11yscan_config_timestamp` | `shared/config.ts` | Config cache timestamp |
| `chatHistory` | (planned, F17) | AI chat conversations |
| `manualReviewState` | (planned, F09) | Manual review Pass/Fail/N/A state |

## Constants (verified against codebase)

| Constant | Value | Source |
|---|---|---|
| `SITE_URL` | `https://a11yscan.yantrakit.com` | `shared/config.ts` |
| `CACHE_MAX_AGE_MS` | `86400000` (24 hours) | `shared/config.ts` |
| Default WCAG version | `2.2` | `shared/config.ts` |
| Default WCAG level | `AA` | `shared/config.ts` |

## Message Flow Examples

### Single page scan
```
SP → BG: SCAN_REQUEST
BG → CS: RUN_SCAN { config: { wcagVersion: "2.2", wcagLevel: "AA", ... } }
CS → BG: SCAN_RESULT { url, violations, passes, ... }
BG → SP: SCAN_RESULT (forwarded with WCAG mapping applied)
```

### Observer auto-scan
```
[User navigates to new page]
BG detects tabs.onUpdated status='complete'
BG checks: crawl running? No. URL scannable? Yes. Throttled? No. Domain allowed? Yes.
BG → CS: RUN_SCAN { config }
CS → BG: SCAN_RESULT { ... }
BG stores in chrome.storage.local['observer_history']
BG → SP: OBSERVER_SCAN_COMPLETE { entry }
```
