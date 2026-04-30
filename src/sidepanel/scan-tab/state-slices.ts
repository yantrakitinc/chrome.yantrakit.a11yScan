/**
 * Pure state-transition helpers for Clear / Reset / observer logging /
 * MV-merge / START_CRAWL payload. No DOM, no chrome APIs — every function
 * takes its inputs as parameters and returns a new state slice.
 */

import type { iScanResult, iAriaWidget, iObserverEntry, iTestConfig, iMultiViewportResult, iViolation, iPageRule, iCrawlAuth } from "@shared/types";
import type { iScanPhase, iCrawlPhase } from "../sidepanel";
import { getViewportBucket } from "@shared/utils";

/**
 * Reset state slice on the Clear button. Wipes scan + crawl + MV cached
 * results, manual-review marks, ARIA widgets, and toggles overlays off.
 * Does NOT reset mode toggles or WCAG settings (that's Reset's job).
 *
 * Source of truth: F22 Clear All — clears every result-bearing slice.
 */
export function clearScanResultsSlice(prev: {
  scanPhase: iScanPhase;
  crawlPhase: iCrawlPhase;
  lastScanResult: iScanResult | null;
  lastMvResult: iMultiViewportResult | null;
  mvViewportFilter: number | null;
  mvProgress: { current: number; total: number } | null;
  crawlResults: Record<string, iScanResult> | null;
  crawlFailed: Record<string, string> | null;
  crawlWaitInfo: { url: string; waitType: string; description: string } | null;
  accordionExpanded: boolean;
  scanSubTab: "results" | "manual" | "aria" | "observe";
  ariaWidgets: iAriaWidget[];
  ariaScanned: boolean;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  violationsOverlayOn: boolean;
  tabOrderOverlayOn: boolean;
  focusGapsOverlayOn: boolean;
}): typeof prev {
  return {
    ...prev,
    scanPhase: "idle",
    crawlPhase: "idle",
    lastScanResult: null,
    lastMvResult: null,
    mvViewportFilter: null,
    mvProgress: null,
    crawlResults: null,
    crawlFailed: null,
    crawlWaitInfo: null,
    accordionExpanded: true,
    scanSubTab: "results",
    ariaWidgets: [],
    ariaScanned: false,
    manualReview: {},
    violationsOverlayOn: false,
    tabOrderOverlayOn: false,
    focusGapsOverlayOn: false,
  };
}

/**
 * Reset state slice on the Reset button. Restores all toggle modes to off,
 * default viewports [375, 768, 1280], default WCAG 2.2 AA, and clears
 * testConfig. Caller must also handle the chrome.storage.local.remove
 * side effect.
 *
 * Source of truth: R-MV "Reset restores defaults" + F13-AC7 "Reset also
 * clears test config".
 */
export function resetScanStateSlice(prev: {
  crawl: boolean; observer: boolean; movie: boolean; mv: boolean;
  viewports: number[]; wcagVersion: string; wcagLevel: string;
  testConfig: iTestConfig | null;
}): typeof prev {
  return {
    ...prev,
    crawl: false,
    observer: false,
    movie: false,
    mv: false,
    viewports: [375, 768, 1280],
    wcagVersion: "2.2",
    wcagLevel: "AA",
    testConfig: null,
  };
}

/**
 * Build an observer history entry from a manual scan result + the active
 * tab + viewport breakpoints. `id` and `timestamp` are passed in so tests
 * can pin the values; production passes uuid() / isoNow().
 *
 * Used by F04-AC8 ("manual scans logged to observer when Observer is on").
 */
export function buildObserverEntry(s: {
  id: string;
  timestamp: string;
  scanResult: iScanResult;
  tab: { url?: string; title?: string; width?: number };
  viewports: number[];
}): iObserverEntry {
  const viewportWidth = s.tab.width ?? 1280;
  return {
    id: s.id,
    url: s.tab.url || "",
    title: s.tab.title || "",
    timestamp: s.timestamp,
    source: "manual",
    violations: s.scanResult.violations,
    passes: s.scanResult.passes,
    violationCount: s.scanResult.violations.reduce((sum, v) => sum + v.nodes.length, 0),
    viewportBucket: getViewportBucket(viewportWidth, s.viewports),
  };
}

/**
 * Merge a multi-viewport scan result into a single iScanResult that the
 * results renderer can consume. Uses the first viewport's metadata
 * (url/timestamp/etc.) and concatenates `shared + viewportSpecific`
 * violations. Returns null if perViewport is empty.
 *
 * Used after MULTI_VIEWPORT_SCAN to populate state.lastScanResult so the
 * existing single-page Results UI works.
 */
export function mergeMvResultToScan(mv: iMultiViewportResult): iScanResult | null {
  const firstKey = Object.keys(mv.perViewport)[0];
  if (!firstKey) return null;
  const first = mv.perViewport[parseInt(firstKey)];
  return {
    ...first,
    violations: [...mv.shared, ...mv.viewportSpecific] as iViolation[],
  };
}

/**
 * Build the START_CRAWL message payload from sidepanel state. The
 * testConfig (when present) takes precedence over the manual UI controls
 * for every field, per F13-AC4.
 */
export function buildStartCrawlPayload(s: {
  testConfig: iTestConfig | null;
  crawlMode: "follow" | "urllist";
  crawlUrlList: string[];
}): {
  mode: "follow" | "urllist";
  timeout: number;
  delay: number;
  scope: string;
  urlList: string[];
  pageRules: iPageRule[];
  auth: iCrawlAuth | undefined;
  testConfig: iTestConfig | undefined;
} {
  const tc = s.testConfig;
  return {
    mode: tc?.crawl?.mode ?? s.crawlMode,
    timeout: tc?.timing?.pageLoadTimeout ?? 30000,
    delay: tc?.timing?.delayBetweenPages ?? 1000,
    scope: tc?.crawl?.scope ?? "",
    urlList: s.crawlMode === "urllist" ? [...s.crawlUrlList] : (tc?.crawl?.urlList ?? []),
    pageRules: tc?.pageRules ?? [],
    auth: tc?.auth ?? undefined,
    testConfig: tc ?? undefined,
  };
}
