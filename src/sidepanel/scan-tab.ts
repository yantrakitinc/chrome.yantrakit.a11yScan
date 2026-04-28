/**
 * Scan tab — render orchestrator. Closure state lives in scan-tab/state.ts;
 * pure renderers live in scan-tab/render-*.ts; event listeners live in
 * scan-tab/handlers.ts; reports live in scan-tab/reports.ts. This file
 * binds them together and re-exports the public surface so external
 * callers (sidepanel.ts, tests) can import everything from "./scan-tab".
 *
 * Source of truth: F01, F02, F03, F04, F09, F10, F12, F19.
 */

import { state } from "./sidepanel";
import { sendMessage } from "@shared/messages";
import type { iObserverEntry, iManualReviewStatus } from "@shared/types";

import { scanTabState } from "./scan-tab/state";
import { manualReviewKey } from "./scan-tab/formatting";

import {
  computeActionButtonText,
  renderExpandedToggleHtml,
  renderCollapsedToggleHtml,
  renderModeTogglesHtml,
  renderMvCheckboxHtml,
  renderSubTabsHtml,
} from "./scan-tab/render-header";
import { renderCrawlConfigHtml } from "./scan-tab/render-crawl-config";
import {
  renderScanProgressHtml,
  renderCrawlProgressHtml,
  renderPageRuleWaitHtml,
} from "./scan-tab/render-progress";
import { renderEmptyState } from "./scan-tab/render-empty";
import {
  renderResults,
  renderCrawlResultsHtml,
} from "./scan-tab/render-results";
import { renderManualReviewHtml } from "./scan-tab/render-manual-review";
import { renderAriaResultsHtml } from "./scan-tab/render-aria";
import { renderObserverListInnerHtml } from "./scan-tab/render-observer";
import { renderToolbarContentHtml } from "./scan-tab/render-toolbar";

import { attachScanTabListeners, bindScanTabCallbacks } from "./scan-tab/handlers/index";

// Re-export pure helpers split into their own modules. External callers
// (sidepanel.ts, tests) keep importing them from "./scan-tab".
export {
  addManualUrlToList, removeUrlAtIndex, mergeNewUrlsIntoList,
  parseTextFileUrls, parsePastedUrls,
} from "./scan-tab/url-list";
export { addViewport, removeViewport } from "./scan-tab/viewports";
export {
  severityOrder, manualReviewKey, urlToDomainSlug, formatDateStamp, computeReportSummary,
} from "./scan-tab/formatting";
export {
  clearScanResultsSlice, resetScanStateSlice, buildObserverEntry,
  mergeMvResultToScan, buildStartCrawlPayload,
} from "./scan-tab/state-slices";
export { buildJsonReportFrom, buildHtmlReportFrom } from "./scan-tab/reports";
export {
  computeActionButtonText, renderExpandedToggleHtml, renderCollapsedToggleHtml,
  renderModeTogglesHtml, renderMvCheckboxHtml, renderSubTabsHtml,
} from "./scan-tab/render-header";
export { renderCrawlConfigHtml, renderUrlListPanelHtml } from "./scan-tab/render-crawl-config";
export {
  renderScanProgressHtml, renderCrawlProgressHtml, renderPageRuleWaitHtml,
} from "./scan-tab/render-progress";
export { renderEmptyState } from "./scan-tab/render-empty";
export {
  renderResults, renderViolation, renderCrawlResultsHtml,
} from "./scan-tab/render-results";
export { renderManualReviewHtml } from "./scan-tab/render-manual-review";
export { renderAriaResultsHtml, renderAriaWidget } from "./scan-tab/render-aria";
export { renderObserverListInnerHtml } from "./scan-tab/render-observer";
export { renderToolbarContentHtml } from "./scan-tab/render-toolbar";

/* ═══════════════════════════════════════════════════════════════════
   Manual review per-page persistence (R-MANUAL)
   ═══════════════════════════════════════════════════════════════════ */

/** Load saved manual review for the given URL, or {} if none saved. */
function loadManualReviewFor(url: string): void {
  const key = manualReviewKey(url);
  if (!key) { state.manualReview = {}; return; }
  chrome.storage.local.get(key, (result) => {
    const stored = result?.[key] as Record<string, iManualReviewStatus> | undefined;
    state.manualReview = stored && typeof stored === "object" ? stored : {};
    renderScanTab();
  });
}

/** Persist current manual review state for the given URL. */
function saveManualReviewFor(url: string): void {
  const key = manualReviewKey(url);
  if (!key) return;
  chrome.storage.local.set({ [key]: state.manualReview });
}

/* ═══════════════════════════════════════════════════════════════════
   Action button label
   ═══════════════════════════════════════════════════════════════════ */

function getActionButtonText(): string {
  return computeActionButtonText({
    crawlPhase: state.crawlPhase,
    scanPhase: state.scanPhase,
    observer: state.observer,
    crawl: state.crawl,
    mv: state.mv,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Per-sub-tab scroll memory
   ═══════════════════════════════════════════════════════════════════ */

const scanScrollMemory: Record<string, number> = {};
let lastRenderedSubTab: string | null = null;

/* ═══════════════════════════════════════════════════════════════════
   Main render
   ═══════════════════════════════════════════════════════════════════ */

export function renderScanTab(): void {
  const panel = document.getElementById("panel-scan");
  if (!panel) return;

  // Save scroll for whichever sub-tab was last rendered (the DOM still shows
  // that tab's content at this moment). Restore for the now-active sub-tab.
  const prevScrollEl = document.getElementById("scan-content");
  if (prevScrollEl && lastRenderedSubTab) {
    scanScrollMemory[lastRenderedSubTab] = prevScrollEl.scrollTop;
  }

  const busy = state.scanPhase === "scanning" || state.crawlPhase === "crawling" || state.crawlPhase === "wait";
  const showClear = state.crawlPhase === "paused" || state.crawlPhase === "wait" || state.crawlPhase === "complete" || state.scanPhase === "results";
  const showSubTabs = state.scanPhase === "results" || ["paused", "wait", "complete"].includes(state.crawlPhase);
  const showToolbar = state.scanPhase === "results" || ["crawling", "paused", "wait", "complete"].includes(state.crawlPhase);
  const btnText = getActionButtonText();

  panel.innerHTML = `
    <div class="accordion-wrapper">
      ${state.accordionExpanded ? `
        <div class="accordion-toggle" role="group" aria-label="Scan settings">
          <span style="font-size:11px;font-weight:700;color:var(--ds-amber-800)">WCAG</span>
          ${renderExpandedToggle(busy)}
        </div>
      ` : `
        <button type="button" class="accordion-toggle" id="accordion-toggle" aria-expanded="false" aria-controls="accordion-body" aria-label="Expand scan settings">
          <span style="font-size:11px;font-weight:700;color:var(--ds-amber-800)">WCAG</span>
          ${renderCollapsedToggle()}
        </button>
      `}
      <div class="accordion-body ${state.accordionExpanded ? "" : "collapsed"}" id="accordion-body" ${state.accordionExpanded ? "" : "hidden"}>
        <div class="accordion-body-inner">
          <div class="accordion-content">
            ${renderModeToggles(busy)}
            ${renderMvCheckbox(busy)}
            ${state.crawl ? renderCrawlConfig(busy) : ""}
          </div>
        </div>
      </div>
      <div class="action-area">
        <button id="scan-btn" ${busy ? "disabled" : ""}>${btnText}</button>
        ${showClear ? '<button id="clear-btn">Clear</button>' : ""}
      </div>
    </div>

    ${state.scanPhase === "scanning" ? renderScanProgress() : ""}
    ${(state.crawlPhase === "crawling" || state.crawlPhase === "paused") ? renderCrawlProgress() : ""}
    ${state.crawlPhase === "wait" ? renderPageRuleWait() : ""}
    ${showSubTabs ? renderSubTabs() : ""}

    <div id="scan-content" ${
      state.scanSubTab && showSubTabs
        ? `role="tabpanel" aria-labelledby="subtab-${state.scanSubTab}"`
        : `role="region" aria-label="Scan results"`
    } aria-live="polite" class="f-1" style="overflow-y:auto;min-height:0">
      ${renderContent()}
    </div>

    ${showToolbar ? renderToolbar() : ""}
  `;

  // Restore scroll for the now-active sub-tab.
  const nextScrollEl = document.getElementById("scan-content");
  if (nextScrollEl && state.scanSubTab) {
    const remembered = scanScrollMemory[state.scanSubTab];
    if (remembered) nextScrollEl.scrollTop = remembered;
  }
  lastRenderedSubTab = state.scanSubTab || null;

  attachScanTabListeners();
}

/* ═══════════════════════════════════════════════════════════════════
   Closure-bound renderer wrappers — read scanTabState + state, delegate
   to the pure *Html renderers.
   ═══════════════════════════════════════════════════════════════════ */

function renderExpandedToggle(busy: boolean): string {
  return renderExpandedToggleHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    hasTestConfig: !!state.testConfig,
    configPanelOpen: scanTabState.configPanelOpen,
    busy,
  });
}

function renderCollapsedToggle(): string {
  return renderCollapsedToggleHtml({
    crawl: state.crawl,
    observer: state.observer,
    movie: state.movie,
    mv: state.mv,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
  });
}

function renderModeToggles(busy: boolean): string {
  return renderModeTogglesHtml({ crawl: state.crawl, movie: state.movie, busy });
}

function renderMvCheckbox(busy: boolean): string {
  return renderMvCheckboxHtml({
    mv: state.mv,
    viewports: state.viewports,
    viewportEditing: scanTabState.viewportEditing,
    busy,
  });
}

function renderCrawlConfig(busy: boolean): string {
  return renderCrawlConfigHtml({
    crawlMode: scanTabState.crawlMode,
    urlListPanelOpen: scanTabState.urlListPanelOpen,
    urlList: scanTabState.crawlUrlList,
    busy,
  });
}

function renderScanProgress(): string {
  return renderScanProgressHtml({
    mv: state.mv,
    mvProgress: state.mvProgress,
    viewports: state.viewports,
  });
}

function renderCrawlProgress(): string {
  return renderCrawlProgressHtml(state.crawlProgress, state.crawlPhase);
}

function renderPageRuleWait(): string {
  return renderPageRuleWaitHtml(state.crawlWaitInfo);
}

function renderSubTabs(): string {
  return renderSubTabsHtml({ observer: state.observer, activeSubTab: state.scanSubTab });
}

function renderContent(): string {
  if (state.scanPhase === "idle" && state.crawlPhase === "idle") {
    return renderEmptyState();
  }
  if (state.scanPhase === "scanning") {
    // Show partial results if available (F01-AC7: results render as soon as they arrive)
    if (state.lastScanResult) return renderResults(state.lastScanResult, state.lastMvResult, state.mvViewportFilter);
    return '<div class="scan-pane"><div style="font-size:11px;color:var(--ds-zinc-500);font-weight:600;display:flex;align-items:center;gap:6px"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5" stroke="var(--ds-zinc-300)" stroke-width="2"/><path d="M12 7a5 5 0 00-5-5" stroke="var(--ds-amber-500)" stroke-width="2" stroke-linecap="round"/></svg>Analyzing page…</div></div>';
  }

  // Sub-tab content routing
  switch (state.scanSubTab) {
    case "results":
      // Crawl results take precedence over single-page results (F03-AC13)
      if (state.crawlResults && Object.keys(state.crawlResults).length > 0) {
        return renderCrawlResults();
      }
      if (state.lastScanResult) return renderResults(state.lastScanResult, state.lastMvResult, state.mvViewportFilter);
      return "";
    case "manual":
      return renderManualReview();
    case "aria":
      return renderAriaResults();
    case "observe":
      return renderObserveHistory();
    default:
      return "";
  }
}

function renderCrawlResults(): string {
  return renderCrawlResultsHtml(state.crawlResults!, state.crawlFailed ?? {}, scanTabState.crawlViewMode);
}

function renderManualReview(): string {
  return renderManualReviewHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    pageElements: state.lastScanResult?.pageElements ?? null,
    manualReview: state.manualReview,
  });
}

function renderAriaResults(): string {
  return renderAriaResultsHtml(state.ariaWidgets);
}

/** Reset observer cache so next render re-fetches from storage */
export function invalidateObserverCache(): void {
  scanTabState.observerLoaded = false;
}

function renderObserveHistory(): string {
  if (!scanTabState.observerLoaded) {
    scanTabState.observerLoaded = true;
    sendMessage({ type: "OBSERVER_GET_HISTORY" }).then((result) => {
      if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
        scanTabState.observerEntries = (result as { payload: iObserverEntry[] }).payload;
        // Targeted update: refresh only the list, not the whole scan tab,
        // so the filter input keeps focus mid-typing.
        const listEl = document.getElementById("observer-list-content");
        if (listEl) listEl.innerHTML = renderObserverListInnerHtml(scanTabState.observerEntries, scanTabState.observerFilter);
        else renderScanTab();
      }
    });
  }
  return `
    <div class="scan-pane">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="observer-domain-filter" type="search" placeholder="Filter by domain…" aria-label="Filter by domain" value="${scanTabState.observerFilter}" class="f-1" style="font-size:11px;padding:6px 8px;border:1px solid var(--ds-zinc-300);border-radius:4px;min-width:0">
        <button id="clear-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);border:1px solid var(--ds-red-200);border-radius:4px;padding:4px 10px;background:none">Clear</button>
        <button id="export-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);border:1px solid var(--ds-amber-300);border-radius:4px;padding:4px 10px;background:none">Export</button>
      </div>
      <div id="observer-list-content">${renderObserverListInnerHtml(scanTabState.observerEntries, scanTabState.observerFilter)}</div>
    </div>
  `;
}

function renderToolbar(): string {
  return `<div class="toolbar">${renderToolbarContentHtml({
    hasSinglePageScan: !!state.lastScanResult,
    violationsOverlayOn: state.violationsOverlayOn,
  })}</div>`;
}

// Wire handler callbacks once at module load. Breaks the otherwise-circular
// dependency between scan-tab.ts and scan-tab/handlers.ts (handlers needs
// to call renderScanTab + the manual-review storage helpers, but we don't
// want to import scan-tab.ts from within handlers.ts).
bindScanTabCallbacks({
  rerender: renderScanTab,
  loadManualReview: loadManualReviewFor,
  saveManualReview: saveManualReviewFor,
});
