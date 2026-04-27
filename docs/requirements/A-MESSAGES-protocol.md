# A — Message Protocol

## Purpose

Exhaustive list of every message type used between sidepanel, background, and content script. Every message is a discriminated union member with a `type` literal and a `payload` (for requests) and a typed response.

## Convention

```typescript
type iMessage =
  | { type: "EXAMPLE_REQUEST"; payload: { foo: string } }
  | { type: "EXAMPLE_RESULT"; payload: { bar: number } }
  | …
```

Every request expects a response. The response either matches a known result type or has shape `{ error: string }`.

## Scan & analyze

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `SCAN_REQUEST` | sidepanel | background | `{ testConfig?: iTestConfig }` | `{ type: "SCAN_RESULT", payload: iScanResult }` or `{ error }` |
| `RUN_SCAN` | background | content script | `{ config: iRemoteConfig, isCrawl?: boolean }` | `{ type: "SCAN_RESULT", payload: iScanResult }` |
| `MULTI_VIEWPORT_SCAN` | sidepanel | background | `{ viewports: number[], testConfig?: iTestConfig }` | `{ type: "MULTI_VIEWPORT_RESULT", payload: iMultiViewportResult }` |
| `MULTI_VIEWPORT_PROGRESS` | background | sidepanel (broadcast) | `{ currentViewport: number, totalViewports: number }` | n/a (broadcast) |
| `ANALYZE_READING_ORDER` | sidepanel | content script | `{ scopeSelector?: string }` | `{ type: "READING_ORDER_RESULT", payload: iScreenReaderElement[] }` |
| `GET_TAB_ORDER` | sidepanel | content script | `{}` | `{ type: "TAB_ORDER_RESULT", payload: iTabOrderElement[] }` |
| `GET_FOCUS_GAPS` | sidepanel | content script | `{}` | `{ type: "FOCUS_GAPS_RESULT", payload: iFocusGap[] }` |
| `GET_FOCUS_INDICATORS` | sidepanel | content script | `{}` | `{ type: "FOCUS_INDICATORS_RESULT", payload: iFocusIndicator[] }` |
| `GET_KEYBOARD_TRAPS` | sidepanel | content script | `{}` | `{ type: "KEYBOARD_TRAPS_RESULT", payload: iKeyboardTrap[] }` |
| `GET_SKIP_LINKS` | sidepanel | content script | `{}` | `{ type: "SKIP_LINKS_RESULT", payload: iSkipLink[] }` |
| `RUN_ARIA_SCAN` | sidepanel | content script | `{}` | `{ type: "ARIA_SCAN_RESULT", payload: iAriaWidget[] }` |
| `COLLECT_ENRICHED_CONTEXT` | sidepanel | content script | `{ violations: iViolation[], options: iEnrichmentOptions }` | `{ type: "ENRICHED_CONTEXT_RESULT", payload: iEnrichedContext[] }` |

## Crawl

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `START_CRAWL` | sidepanel | background | `iCrawlOptions & { testConfig?: iTestConfig }` | `{ success: true }` |
| `PAUSE_CRAWL` | sidepanel | background | `{}` | `{ success: true }` |
| `RESUME_CRAWL` | sidepanel | background | `{}` | `{ success: true }` |
| `CANCEL_CRAWL` | sidepanel | background | `{}` | `{ success: true }` |
| `USER_CONTINUE` | sidepanel | background | `{}` | `{ success: true }` (resume after page rule wait) |
| `CRAWL_PROGRESS` | background | sidepanel (broadcast) | `iCrawlState` | n/a |
| `CRAWL_WAITING_FOR_USER` | background | sidepanel (broadcast) | `{ url: string, waitType: string, description?: string }` | n/a |

## Overlays & highlighting

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `SHOW_VIOLATION_OVERLAY` | sidepanel | content script | `{ violations: iViolation[] }` | `{ success: true }` |
| `HIDE_VIOLATION_OVERLAY` | sidepanel | content script | `{}` | `{ success: true }` |
| `SHOW_TAB_ORDER` | sidepanel | content script | `{}` | `{ success: true }` |
| `HIDE_TAB_ORDER` | sidepanel | content script | `{}` | `{ success: true }` |
| `SHOW_FOCUS_GAPS` | sidepanel | content script | `{}` | `{ success: true }` |
| `HIDE_FOCUS_GAPS` | sidepanel | content script | `{}` | `{ success: true }` |
| `HIGHLIGHT_ELEMENT` | sidepanel | content script | `{ selector: string }` | `{ type: "HIGHLIGHT_RESULT", payload: { found: boolean } }` |
| `CLEAR_HIGHLIGHTS` | sidepanel | content script | `{}` | `{ success: true }` |
| `VIOLATION_BADGE_CLICKED` | content script | sidepanel (broadcast) | `{ violationId: string, nodeIndex: number }` | n/a |

## Movie Mode

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `START_MOVIE_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `PAUSE_MOVIE_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `RESUME_MOVIE_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `STOP_MOVIE_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `SET_MOVIE_SPEED` | sidepanel | content script | `{ speed: number }` | `{ success: true }` |
| `MOVIE_MODE_STEP` | content script | sidepanel (broadcast) | `{ index: number, total: number }` | n/a |
| `MOVIE_MODE_COMPLETE` | content script | sidepanel (broadcast) | `{}` | n/a |

## Inspector

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `ENTER_INSPECT_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `EXIT_INSPECT_MODE` | sidepanel | content script | `{}` | `{ success: true }` |
| `INSPECT_ELEMENT_PICKED` | content script | sidepanel (broadcast) | `iInspectorData` | n/a |

## Mocks

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `ACTIVATE_MOCKS` | sidepanel/background | content script | `{ mocks: iMockEndpoint[] }` | `{ success: true }` |
| `DEACTIVATE_MOCKS` | sidepanel/background | content script | `{}` | `{ success: true }` |

## CVD

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `APPLY_CVD` | sidepanel | content script | `{ type: "" \| "protanopia" \| "deuteranopia" \| ... }` | `{ success: true }` |

## Observer (Coming Soon — code present but UI hidden)

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `OBSERVER_ENABLE` | sidepanel | background | `{}` | `{ type: "OBSERVER_STATE", payload: iObserverState }` |
| `OBSERVER_DISABLE` | sidepanel | background | `{}` | `{ type: "OBSERVER_STATE", payload: iObserverState }` |
| `OBSERVER_GET_STATE` | sidepanel | background | `{}` | `{ type: "OBSERVER_STATE", payload: iObserverState }` |
| `OBSERVER_GET_HISTORY` | sidepanel | background | `{}` | `{ type: "OBSERVER_HISTORY", payload: iObserverEntry[] }` |
| `OBSERVER_CLEAR_HISTORY` | sidepanel | background | `{}` | `{ success: true }` |
| `OBSERVER_EXPORT_HISTORY` | sidepanel | background | `{}` | `{ type: "OBSERVER_HISTORY", payload: iObserverEntry[] }` |
| `OBSERVER_LOG_ENTRY` | sidepanel | background | `{ payload: iObserverEntry }` | `{ success: true }` |
| `OBSERVER_UPDATE_SETTINGS` | sidepanel | background | `Partial<iObserverSettings>` | `{ type: "OBSERVER_STATE", payload: iObserverState }` |
| `OBSERVER_SCAN_COMPLETE` | background | sidepanel (broadcast) | `{ entry: iObserverEntry }` | n/a |

## State management

| Type | Sent by | Handled by | Payload | Response |
|---|---|---|---|---|
| `CONFIRM_CLEAR_ALL` | sidepanel | sidepanel (in-panel UI flow) | `{}` | n/a (handled in-panel) |
| `CLEAR_ALL_CONFIRMED` | sidepanel | background | `{}` | `{ type: "STATE_CLEARED" }` |
| `STATE_CLEARED` | background | sidepanel (broadcast) | `{}` | n/a |

## Error contract

Any handler that fails sends back `{ error: "<descriptive message>" }`. Sidepanel checks `if ("error" in response)` before treating the response as a successful result.

## Rules

1. Every message type appears EXACTLY ONCE in the discriminated union (`iMessage` in `src/shared/messages.ts`).
2. Every payload is a typed object — no untyped `any`.
3. Async response: handler returns `true` from the listener to indicate it will respond async; otherwise sync.
4. Broadcasts (one-way messages with no expected response) should still be in the union but their "response" is documented as n/a.
5. Sidepanel handlers MUST tolerate broadcasts arriving in any order (e.g., a CRAWL_PROGRESS arriving after the user has navigated away).
