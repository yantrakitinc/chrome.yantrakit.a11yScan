/**
 * Message protocol between background, content script, and sidepanel.
 * Source of truth: /extension/docs/features/MESSAGES.md
 */

import type {
  iRemoteConfig,
  iScanResult,
  iObserverState,
  iObserverSettings,
  iObserverEntry,
  iCrawlOptions,
  iCrawlState,
  iAriaWidget,
  iEnrichedContext,
  iMockEndpoint,
  iMultiViewportResult,
  iInspectorData,
  iScreenReaderElement,
  iTabOrderElement,
  iFocusGap,
  iFocusIndicator,
  iKeyboardTrap,
  iSkipLink,
  iTestConfig,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════
   Discriminated Union — ALL message types
   ═══════════════════════════════════════════════════════════════════ */

export type iMessage =
  /* ── Scan (F01) ── */
  | { type: "SCAN_REQUEST"; payload?: { testConfig?: iTestConfig } }
  | { type: "RUN_SCAN"; payload: { config: iRemoteConfig; isCrawl?: boolean } }
  | { type: "SCAN_RESULT"; payload: iScanResult }
  | { type: "SCAN_ERROR"; payload: { message: string } }
  | { type: "SCAN_PROGRESS"; payload: { status: string } }

  /* ── Config ── */
  | { type: "FORCE_CONFIG_UPDATE" }
  | { type: "CONFIG_UPDATED"; payload: { version: string } }

  /* ── Observer (F04) ── */
  | { type: "OBSERVER_ENABLE" }
  | { type: "OBSERVER_DISABLE" }
  | { type: "OBSERVER_GET_STATE" }
  | { type: "OBSERVER_STATE"; payload: iObserverState }
  | { type: "OBSERVER_UPDATE_SETTINGS"; payload: Partial<iObserverSettings> }
  | { type: "OBSERVER_GET_HISTORY" }
  | { type: "OBSERVER_HISTORY"; payload: iObserverEntry[] }
  | { type: "OBSERVER_CLEAR_HISTORY" }
  | { type: "OBSERVER_EXPORT_HISTORY" }
  | { type: "OBSERVER_SCAN_COMPLETE"; payload: { entry: iObserverEntry } }

  /* ── Crawl (F03) ── */
  | { type: "START_CRAWL"; payload: iCrawlOptions }
  | { type: "PAUSE_CRAWL" }
  | { type: "RESUME_CRAWL" }
  | { type: "CANCEL_CRAWL" }
  | { type: "GET_CRAWL_STATE" }
  | { type: "CRAWL_PROGRESS"; payload: iCrawlState }
  | { type: "CRAWL_WAITING_FOR_USER"; payload: { url: string; waitType: string; description: string } }
  | { type: "USER_CONTINUE" }

  /* ── Overlay (F05) ── */
  | { type: "SHOW_VIOLATION_OVERLAY"; payload: { violations: iScanResult["violations"] } }
  | { type: "HIDE_VIOLATION_OVERLAY" }
  | { type: "SHOW_TAB_ORDER" }
  | { type: "HIDE_TAB_ORDER" }
  | { type: "SHOW_FOCUS_GAPS" }
  | { type: "HIDE_FOCUS_GAPS" }
  | { type: "HIGHLIGHT_ELEMENT"; payload: { selector: string } }
  | { type: "CLEAR_HIGHLIGHTS" }

  /* ── Movie Mode (F06) ── */
  | { type: "START_MOVIE_MODE" }
  | { type: "PAUSE_MOVIE_MODE" }
  | { type: "RESUME_MOVIE_MODE" }
  | { type: "STOP_MOVIE_MODE" }
  | { type: "SET_MOVIE_SPEED"; payload: { speed: number } }

  /* ── CVD Simulation (F08) ── */
  | { type: "APPLY_CVD_FILTER"; payload: { matrix: number[] | null } }

  /* ── ARIA (F10) ── */
  | { type: "RUN_ARIA_SCAN" }
  | { type: "ARIA_SCAN_RESULT"; payload: iAriaWidget[] }

  /* ── Enrichment (F12) ── */
  | { type: "COLLECT_ENRICHED_CONTEXT"; payload: { selectors: string[] } }
  | { type: "ENRICHED_CONTEXT_RESULT"; payload: Record<string, iEnrichedContext> }

  /* ── Mock API (F14) ── */
  | { type: "ACTIVATE_MOCKS"; payload: { mocks: iMockEndpoint[] } }
  | { type: "DEACTIVATE_MOCKS" }

  /* ── Multi-Viewport (F02) ── */
  | { type: "MULTI_VIEWPORT_SCAN"; payload: { viewports: number[]; testConfig?: iTestConfig } }
  | { type: "MULTI_VIEWPORT_PROGRESS"; payload: { currentViewport: number; totalViewports: number } }
  | { type: "MULTI_VIEWPORT_RESULT"; payload: iMultiViewportResult }

  /* ── Screen Reader (F15) ── */
  | { type: "ANALYZE_READING_ORDER"; payload: { scopeSelector?: string } }
  | { type: "READING_ORDER_RESULT"; payload: iScreenReaderElement[] }

  /* ── Keyboard (F16) ── */
  | { type: "GET_TAB_ORDER" }
  | { type: "TAB_ORDER_RESULT"; payload: iTabOrderElement[] }
  | { type: "GET_FOCUS_GAPS" }
  | { type: "FOCUS_GAPS_RESULT"; payload: iFocusGap[] }
  | { type: "GET_FOCUS_INDICATORS" }
  | { type: "FOCUS_INDICATORS_RESULT"; payload: iFocusIndicator[] }
  | { type: "GET_KEYBOARD_TRAPS" }
  | { type: "KEYBOARD_TRAPS_RESULT"; payload: iKeyboardTrap[] }
  | { type: "GET_SKIP_LINKS" }
  | { type: "SKIP_LINKS_RESULT"; payload: iSkipLink[] }

  /* ── Observer manual log (F04-AC8) ── */
  | { type: "OBSERVER_LOG_ENTRY"; payload: iObserverEntry }

  /* ── Inspector (F20) ── */
  | { type: "ENTER_INSPECT_MODE" }
  | { type: "EXIT_INSPECT_MODE" }
  | { type: "INSPECT_ELEMENT"; payload: iInspectorData }

  /* ── Violation badge click (content → sidepanel) ── */
  | { type: "VIOLATION_BADGE_CLICKED"; payload: { index: number } }

  /* ── Highlight result response (background → sidepanel) ── */
  | { type: "HIGHLIGHT_RESULT"; payload: { found: boolean } }

  /* ── Navigation (F22 context menu) ── */
  | { type: "NAVIGATE"; payload: { target: "settings" | "chatHistory" } }
  | { type: "STATE_CLEARED" }
  | { type: "CONFIRM_CLEAR_ALL" }
  | { type: "CLEAR_ALL_CONFIRMED" };

/** Type-safe message sender */
export function sendMessage(msg: iMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

/** Type-safe message sender to tab */
export function sendTabMessage(tabId: number, msg: iMessage): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, msg);
}
