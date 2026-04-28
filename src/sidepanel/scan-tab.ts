/**
 * Scan tab rendering — accordion, action button, results, sub-tabs, toolbar.
 * Source of truth: F01, F02, F03, F04, F09, F10, F12, F19
 */

import { state, updateTabDisabledStates, switchTab, TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } from "./sidepanel";
import { getTabOrder, getFocusGaps } from "./kb-tab";
import { openAiChatWithContext } from "./ai-tab";
import { sendMessage } from "@shared/messages";
import type { iScanResult, iAriaWidget, iManualReviewStatus, iObserverEntry, iTestConfig } from "@shared/types";
import { getManualReviewCriteria, getWcagUrl } from "@shared/wcag-mapping";
import { uuid, isoNow, escHtml } from "@shared/utils";
import { validateTestConfig } from "@shared/validate-test-config";

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

// Local imports for inline call sites in this file.
import {
  addManualUrlToList,
  removeUrlAtIndex,
  mergeNewUrlsIntoList,
  parseTextFileUrls,
  parsePastedUrls,
} from "./scan-tab/url-list";
import { addViewport, removeViewport } from "./scan-tab/viewports";
import {
  severityOrder,
  manualReviewKey,
  urlToDomainSlug,
  formatDateStamp,
  computeReportSummary,
} from "./scan-tab/formatting";
import {
  clearScanResultsSlice,
  resetScanStateSlice,
  buildObserverEntry,
  mergeMvResultToScan,
  buildStartCrawlPayload,
} from "./scan-tab/state-slices";
import { buildJsonReportFrom, buildHtmlReportFrom } from "./scan-tab/reports";
import {
  computeActionButtonText,
  renderExpandedToggleHtml,
  renderCollapsedToggleHtml,
  renderModeTogglesHtml,
  renderMvCheckboxHtml,
  renderSubTabsHtml,
} from "./scan-tab/render-header";
import { renderCrawlConfigHtml, renderUrlListPanelHtml } from "./scan-tab/render-crawl-config";
import {
  renderScanProgressHtml,
  renderCrawlProgressHtml,
  renderPageRuleWaitHtml,
} from "./scan-tab/render-progress";
import { renderEmptyState } from "./scan-tab/render-empty";
import {
  renderResults,
  renderViolation,
  renderCrawlResultsHtml,
} from "./scan-tab/render-results";
import { renderManualReviewHtml } from "./scan-tab/render-manual-review";
import { renderAriaResultsHtml } from "./scan-tab/render-aria";
import { renderObserverListInnerHtml } from "./scan-tab/render-observer";
import { renderToolbarContentHtml } from "./scan-tab/render-toolbar";

/** Tracks whether the config panel (F13) is currently expanded */
let configPanelOpen = false;

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

/** Tracks whether the viewport editor (F02) is currently open */
let viewportEditing = false;

/** URL list for urllist crawl mode (F03-AC3) */
let crawlUrlList: string[] = [];

/** Whether the URL list inline panel is open */
let urlListPanelOpen = false;

/** Crawl results view toggle: "page" or "wcag" (F03-AC13) */
let crawlViewMode: "page" | "wcag" = "page";

/** Currently selected crawl mode dropdown value (F03-AC2) */
let _crawlMode: "follow" | "urllist" = "follow";

/**
 * Returns the action button text for every mode × phase combination.
 * Source of truth: F19 Chart 1.
 */
function getActionButtonText(): string {
  return computeActionButtonText({
    crawlPhase: state.crawlPhase,
    scanPhase: state.scanPhase,
    observer: state.observer,
    crawl: state.crawl,
    mv: state.mv,
  });
}


/** Per-sub-tab scroll positions so re-renders don't yank the user back to top. */
const scanScrollMemory: Record<string, number> = {};
/** Tracks which sub-tab was last rendered so we attribute scroll to the correct
   key — state.scanSubTab is updated BEFORE renderScanTab() runs on tab switch. */
let lastRenderedSubTab: string | null = null;

/** Render the entire Scan tab content */
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

  // Button text (F19 Chart 1 — full lookup table)
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

  // Attach event listeners
  attachScanTabListeners();
}

function renderExpandedToggle(busy: boolean): string {
  return renderExpandedToggleHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    hasTestConfig: !!state.testConfig,
    configPanelOpen,
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
    viewportEditing,
    busy,
  });
}


function renderCrawlConfig(busy: boolean): string {
  return renderCrawlConfigHtml({
    crawlMode: _crawlMode,
    urlListPanelOpen,
    urlList: crawlUrlList,
    busy,
  });
}


function renderUrlListPanel(): string {
  return renderUrlListPanelHtml(crawlUrlList);
}


/* ═══════════════════════════════════════════════════════════════════
   Test Configuration Panel (F13)
   ═══════════════════════════════════════════════════════════════════ */

let dialogReturnFocus: HTMLElement | null = null;

function openConfigDialog(): void {
  const dialog = document.getElementById("config-dialog") as HTMLDialogElement | null;
  const content = document.getElementById("config-dialog-content");
  if (!dialog || !content) return;
  // Save focus to restore after dialog closes
  dialogReturnFocus = (document.activeElement as HTMLElement) || null;

  const configJson = state.testConfig ? JSON.stringify(state.testConfig, null, 2) : "";
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2 id="config-dialog-title" style="margin:0;font-size:12px;font-weight:800;color:var(--ds-zinc-800);text-transform:uppercase;letter-spacing:0.05em">Test Configuration</h2>
      <button id="config-close-btn" aria-label="Close" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:var(--ds-zinc-500);border-radius:4px">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
    </div>
    <a href="https://a11yscan.yantrakit.com/tools/test-config-builder" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:var(--ds-indigo-700);text-decoration:none">Open Builder ↗</a>
    <textarea id="config-textarea" aria-label="Paste config JSON here" placeholder='Paste JSON config here, e.g. { "wcag": { "version": "2.1", "level": "AA" } }' class="font-mono" style="width:100%;box-sizing:border-box;font-size:11px;padding:8px;border:1px solid ${state.testConfig ? "var(--ds-amber-300)" : "var(--ds-zinc-300)"};border-radius:4px;resize:vertical;min-height:100px;background:#fff;color:var(--ds-zinc-800);line-height:1.5">${escHtml(configJson)}</textarea>
    <div id="config-error" role="alert" aria-live="polite" style="font-size:11px;color:var(--ds-red-700);display:none"></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <button id="config-apply-btn" class="f-1 cur-pointer min-h-24" style="padding:8px;font-size:12px;font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Apply</button>
      <label id="config-upload-label" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:4px;display:flex;align-items:center">
        Upload .json
        <input type="file" id="config-file-input" accept=".json,application/json" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-label="Upload JSON config file">
      </label>
      ${state.testConfig ? '<button id="config-clear-btn" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:4px">Clear Config</button>' : ""}
    </div>
  `;

  dialog.showModal();
  // Focus textarea instead of the first link
  const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
  if (textarea) textarea.focus();
  attachConfigDialogListeners(dialog);
}

let configDialogGlobalListenersAttached = false;
function attachConfigDialogListeners(dialog: HTMLDialogElement): void {
  // Close button — re-rendered each open so this listener attaches to a fresh element each time
  document.getElementById("config-close-btn")?.addEventListener("click", () => {
    dialog.close();
  });

  // Backdrop + close listeners attach ONCE at first open (avoid stacking across opens)
  if (!configDialogGlobalListenersAttached) {
    configDialogGlobalListenersAttached = true;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      configPanelOpen = false;
      renderScanTab();
      if (dialogReturnFocus && document.contains(dialogReturnFocus)) {
        dialogReturnFocus.focus();
      } else {
        document.getElementById("settings-btn")?.focus();
      }
      dialogReturnFocus = null;
    });
  }

  // Apply (F13-AC1, AC3, AC4, AC5)
  document.getElementById("config-apply-btn")?.addEventListener("click", () => {
    const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
    const errorEl = document.getElementById("config-error") as HTMLElement | null;
    if (!textarea || !errorEl) return;

    const text = textarea.value.trim();
    if (!text) {
      errorEl.textContent = "Paste JSON config or upload a .json file first.";
      errorEl.style.display = "block";
      return;
    }

    try {
      const config = validateTestConfig(text);
      state.testConfig = config;
      // Sync state.viewports to testConfig.viewports when supplied so the MV
      // chips reflect the config-supplied list (R-MV AC8).
      if (config.viewports && config.viewports.length > 0) {
        state.viewports = [...config.viewports].sort((a, b) => a - b);
      }
      chrome.storage.local.set({
        [TEST_CONFIG_STORAGE_KEY]: config,
        [TEST_CONFIG_TIMESTAMP_KEY]: new Date().toISOString(),
      });
      errorEl.style.display = "none";
      dialog.close();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      errorEl.style.display = "block";
      // Return focus to the textarea so the user can fix the JSON without
      // having to re-click into the input. role=alert + aria-live on the
      // error region announces the message.
      textarea.focus();
    }
  });

  // File upload (F13-AC2)
  document.getElementById("config-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = typeof reader.result === "string" ? reader.result : "";
      }
    };
    reader.readAsText(file);
    input.value = "";
  });

  // Clear Config (F13-AC7)
  document.getElementById("config-clear-btn")?.addEventListener("click", () => {
    state.testConfig = null;
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    dialog.close();
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
    if (state.lastScanResult) return renderResults(state.lastScanResult);
    return '<div class="scan-pane"><div style="font-size:11px;color:var(--ds-zinc-500);font-weight:600;display:flex;align-items:center;gap:6px"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5" stroke="var(--ds-zinc-300)" stroke-width="2"/><path d="M12 7a5 5 0 00-5-5" stroke="var(--ds-amber-500)" stroke-width="2" stroke-linecap="round"/></svg>Analyzing page\u2026</div></div>';
  }

  // Sub-tab content routing
  switch (state.scanSubTab) {
    case "results":
      // Crawl results take precedence over single-page results when present (F03-AC13)
      if (state.crawlResults && Object.keys(state.crawlResults).length > 0) {
        return renderCrawlResults();
      }
      if (state.lastScanResult) return renderResults(state.lastScanResult);
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


/* ═══════════════════════════════════════════════════════════════════
   Crawl Results Display (F03-AC13–AC16)
   ═══════════════════════════════════════════════════════════════════ */

function renderCrawlResults(): string {
  return renderCrawlResultsHtml(state.crawlResults!, state.crawlFailed ?? {}, crawlViewMode);
}




/* ═══════════════════════════════════════════════════════════════════
   Manual Review (F09)
   ═══════════════════════════════════════════════════════════════════ */

function renderManualReview(): string {
  return renderManualReviewHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    pageElements: state.lastScanResult?.pageElements ?? null,
    manualReview: state.manualReview,
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ARIA Validation (F10)
   ═══════════════════════════════════════════════════════════════════ */

function renderAriaResults(): string {
  return renderAriaResultsHtml(state.ariaWidgets);
}



/* ═══════════════════════════════════════════════════════════════════
   Observer History (F04)
   ═══════════════════════════════════════════════════════════════════ */

let observerEntries: iObserverEntry[] = [];
let observerLoaded = false;

/** Reset observer cache so next render re-fetches from storage */
export function invalidateObserverCache(): void {
  observerLoaded = false;
}
let observerFilter = "";

function renderObserveHistory(): string {
  // Fetch entries if not loaded yet
  if (!observerLoaded) {
    observerLoaded = true;
    sendMessage({ type: "OBSERVER_GET_HISTORY" }).then((result) => {
      if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
        observerEntries = (result as { payload: iObserverEntry[] }).payload;
        // Targeted update: refresh only the list, not the whole scan tab,
        // so the filter input keeps focus mid-typing.
        const listEl = document.getElementById("observer-list-content");
        if (listEl) listEl.innerHTML = renderObserverListInner();
        else renderScanTab();
      }
    });
  }

  return `
    <div class="scan-pane">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="observer-domain-filter" type="search" placeholder="Filter by domain\u2026" aria-label="Filter by domain" value="${observerFilter}" class="f-1" style="font-size:11px;padding:6px 8px;border:1px solid var(--ds-zinc-300);border-radius:4px;min-width:0">
        <button id="clear-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);border:1px solid var(--ds-red-200);border-radius:4px;padding:4px 10px;background:none">Clear</button>
        <button id="export-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);border:1px solid var(--ds-amber-300);border-radius:4px;padding:4px 10px;background:none">Export</button>
      </div>
      <div id="observer-list-content">${renderObserverListInner()}</div>
    </div>
  `;
}

function renderObserverListInner(): string {
  return renderObserverListInnerHtml(observerEntries, observerFilter);
}


function renderToolbar(): string {
  return `<div class="toolbar">${renderToolbarContent()}</div>`;
}

function renderToolbarContent(): string {
  return renderToolbarContentHtml({
    hasSinglePageScan: !!state.lastScanResult,
    violationsOverlayOn: state.violationsOverlayOn,
  });
}


/**
 * Sort key for impact severity: critical(0) → serious(1) → moderate(2) →
 * minor(3) → unknown(4). Used to order violations highest-severity-first
 * in render output. Pure; exported for tests.
 */
// Pure helpers (severityOrder, manualReviewKey, addManualUrlToList,
// removeUrlAtIndex, mergeNewUrlsIntoList, parseTextFileUrls, parsePastedUrls,
// addViewport, removeViewport, clearScanResultsSlice, resetScanStateSlice,
// buildObserverEntry, mergeMvResultToScan, buildStartCrawlPayload) moved to
// ./scan-tab/{url-list, viewports, formatting, state-slices}.ts.


/* ═══════════════════════════════════════════════════════════════════
   Event Listeners
   ═══════════════════════════════════════════════════════════════════ */

function attachScanTabListeners(): void {
  // Accordion toggle
  document.getElementById("accordion-toggle")?.addEventListener("click", () => {
    if (!state.accordionExpanded) {
      state.accordionExpanded = true;
      renderScanTab();
      // Move focus to the now-visible Collapse button so keyboard users don't
      // lose context when the accordion-toggle button disappears mid-render.
      document.getElementById("collapse-btn")?.focus();
    }
  });
  document.getElementById("collapse-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.accordionExpanded = false;
    renderScanTab();
    // Mirror: focus the now-visible Expand toggle.
    document.getElementById("accordion-toggle")?.focus();
  });

  // Mode toggles
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "crawl") state.crawl = !state.crawl;
      else if (mode === "observer") {
        state.observer = !state.observer;
        sendMessage(state.observer ? { type: "OBSERVER_ENABLE" } : { type: "OBSERVER_DISABLE" });
        if (state.observer) {
          // Reset observer fetch state so history is re-loaded
          observerLoaded = false;
        }
      }
      else if (mode === "movie") {
        state.movie = !state.movie;
        chrome.storage.local.set({ movie_enabled: state.movie });
      }
      renderScanTab();
    });
  });

  // MV checkbox
  document.getElementById("mv-check")?.addEventListener("change", () => {
    state.mv = !state.mv;
    if (!state.mv) viewportEditing = false;
    renderScanTab();
  });

  // Viewport editor — edit link
  document.getElementById("vp-edit")?.addEventListener("click", () => {
    viewportEditing = true;
    renderScanTab();
  });

  // Viewport editor — done button
  document.getElementById("vp-done")?.addEventListener("click", () => {
    viewportEditing = false;
    renderScanTab();
  });

  // Viewport editor — add button
  document.getElementById("vp-add")?.addEventListener("click", () => {
    state.viewports = addViewport(state.viewports);
    renderScanTab();
  });

  // Viewport editor — remove buttons
  document.querySelectorAll<HTMLButtonElement>(".vp-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      state.viewports = removeViewport(state.viewports, idx);
      renderScanTab();
    });
  });

  // Viewport editor — input changes
  document.querySelectorAll<HTMLInputElement>(".vp-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.index ?? "0");
      let val = parseInt(input.value) || 320;
      if (val < 320) val = 320;
      const updated = [...state.viewports];
      updated[idx] = val;
      // Dedupe and sort
      const unique = [...new Set(updated)].sort((a, b) => a - b);
      state.viewports = unique;
      renderScanTab();
    });
  });

  // WCAG dropdowns update state (F01-AC19)
  document.getElementById("wcag-version")?.addEventListener("change", (e) => {
    state.wcagVersion = (e.target as HTMLSelectElement).value;
  });
  document.getElementById("wcag-level")?.addEventListener("change", (e) => {
    state.wcagLevel = (e.target as HTMLSelectElement).value;
  });

  // Sub-tab switching (F01-AC17) — click + ARIA tablist arrow keys
  const subTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".sub-tab"));
  subTabs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab as typeof state.scanSubTab;
      if (subtab) {
        state.scanSubTab = subtab;
        renderScanTab();
      }
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const next = e.key === "ArrowRight" ? (i + 1) % subTabs.length
          : e.key === "ArrowLeft" ? (i - 1 + subTabs.length) % subTabs.length
          : e.key === "Home" ? 0
          : subTabs.length - 1;
        const target = subTabs[next];
        const subtab = target.dataset.subtab as typeof state.scanSubTab;
        if (subtab) {
          state.scanSubTab = subtab;
          renderScanTab();
          // Restore focus on the now-rendered tab
          document.getElementById(`subtab-${subtab}`)?.focus();
        }
      }
    });
  });

  // Scan button
  document.getElementById("scan-btn")?.addEventListener("click", async () => {
    if (state.crawl && state.crawlPhase === "idle") {
      state.crawlPhase = "crawling";
      state.accordionExpanded = false;
      // Crawl navigates to new pages; any overlay from a prior scan is gone.
      // Reset the toggle state so the toolbar/checkboxes match reality.
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      updateTabDisabledStates();
      renderScanTab();
      await sendMessage({ type: "START_CRAWL", payload: buildStartCrawlPayload({
        testConfig: state.testConfig,
        crawlMode: _crawlMode,
        crawlUrlList,
      }) });
    } else {
      const wasResults = state.scanPhase === "results";
      state.scanPhase = "scanning";
      if (!wasResults) { state.accordionExpanded = false; }
      // Remove old overlays and highlights before new scan (F05-AC15).
      // Reset the corresponding state flags so the toolbar/checkbox toggles
      // reflect what's actually on the page after the new scan completes.
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      updateTabDisabledStates();
      renderScanTab();
      try {
        // Multi-Viewport scan (F02) or standard scan (F01); pass testConfig if active (F13-AC4)
        const result = state.mv
          ? await sendMessage({ type: "MULTI_VIEWPORT_SCAN", payload: { viewports: state.testConfig?.viewports ?? state.viewports, testConfig: state.testConfig ?? undefined } })
          : await sendMessage({ type: "SCAN_REQUEST", payload: { testConfig: state.testConfig ?? undefined } });
        const resType = (result as { type: string })?.type;
        if (resType === "SCAN_RESULT") {
          state.lastScanResult = (result as { payload: iScanResult }).payload;
          state.scanPhase = "results";
          // Restore manual review for this URL — or reset to {} if none saved (R-MANUAL)
          loadManualReviewFor(state.lastScanResult.url);
        } else if (resType === "MULTI_VIEWPORT_RESULT") {
          // MV scan: store full result and build merged view from shared + all viewport-specific violations
          const mvResult = (result as { payload: import("@shared/types").iMultiViewportResult }).payload;
          state.lastMvResult = mvResult;
          state.mvViewportFilter = null;
          state.mvProgress = null;
          const merged = mergeMvResultToScan(mvResult);
          if (merged) state.lastScanResult = merged;
          state.scanPhase = "results";
        } else if (resType === "SCAN_ERROR") {
          state.scanPhase = "idle";
          showError((result as { payload: { message: string } }).payload.message);
        } else {
          state.scanPhase = "idle";
          showError("Scan returned unexpected response: " + JSON.stringify(result));
        }
        if (state.scanPhase === "results") {
          // F04-AC8: Log manual scan to observer history when observer is on
          if (state.observer && state.lastScanResult) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const tab = tabs[0];
              const entry = buildObserverEntry({
                id: uuid(),
                timestamp: isoNow(),
                scanResult: state.lastScanResult!,
                tab: tab ? { url: tab.url, title: tab.title, width: (tab as { width?: number }).width } : {},
                viewports: state.viewports,
              });
              sendMessage({ type: "OBSERVER_LOG_ENTRY", payload: entry });
              observerLoaded = false;
            });
          }
          // Auto-play Movie Mode after scan (F06-AC5).
          // Speed comes from testConfig.timing.movieSpeed only — no UI dropdown
          // (per R-KB-keyboard.md). Defaults to 1 if unset.
          if (state.movie) {
            const speed = state.testConfig?.timing?.movieSpeed ?? 1;
            sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
            sendMessage({ type: "START_MOVIE_MODE" });
          }
          // Also run ARIA scan in background
          sendMessage({ type: "RUN_ARIA_SCAN" }).then((ariaResult) => {
            if (ariaResult && (ariaResult as { type: string }).type === "ARIA_SCAN_RESULT") {
              state.ariaWidgets = (ariaResult as { payload: iAriaWidget[] }).payload;
            }
          }).catch(() => { /* ARIA scan failed silently */ });
        }
      } catch (err) {
        console.error("[A11y Scan] Scan failed:", err);
        state.scanPhase = "idle";
        showError(String(err));
      }
      updateTabDisabledStates();
      renderScanTab();
    }
  });

  // Clear
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    Object.assign(state, clearScanResultsSlice(state));
    updateTabDisabledStates();
    renderScanTab();
    // Remove all overlays and highlights
    sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    sendMessage({ type: "HIDE_TAB_ORDER" });
    sendMessage({ type: "HIDE_FOCUS_GAPS" });
    sendMessage({ type: "CLEAR_HIGHLIGHTS" });
    sendMessage({ type: "DEACTIVATE_MOCKS" });
  });

  // Settings / Test Config modal (F13)
  document.getElementById("settings-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    configPanelOpen = true;
    // Update aria-expanded directly — no re-render before opening the dialog,
    // and we don't want the button to flicker. The dialog 'close' listener
    // sets it back via renderScanTab.
    (e.currentTarget as HTMLElement).setAttribute("aria-expanded", "true");
    openConfigDialog();
  });

  // Reset
  document.getElementById("reset-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    Object.assign(state, resetScanStateSlice(state));
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    configPanelOpen = false;
    renderScanTab();
  });

  // Highlight buttons
  // MV viewport filter chips (F02-AC11)
  document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.mvfilter;
      state.mvViewportFilter = val === "all" || val === undefined ? null : parseInt(val);
      renderScanTab();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".highlight-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Flash the closest containing violation/criterion card so the user
      // can see which panel item is being highlighted on the page.
      flashActiveItem(btn.closest("details") || btn.closest(".violation-card") || btn.parentElement);
    });
  });

  // Explain Further buttons
  document.querySelectorAll<HTMLButtonElement>(".explain-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ruleId = btn.dataset.rule || "";
      const description = btn.dataset.description || "";
      switchTab("ai");
      // Defer until after renderAiChatTab() has run
      setTimeout(() => {
        openAiChatWithContext(ruleId, description);
      }, 0);
    });
  });

  // Crawl mode select (F03-AC2)
  document.getElementById("crawl-mode")?.addEventListener("change", (e) => {
    _crawlMode = (e.target as HTMLSelectElement).value as "follow" | "urllist";
    urlListPanelOpen = false;
    renderScanTab();
  });

  // URL list panel open/close (F03-AC3)
  document.getElementById("url-list-open")?.addEventListener("click", () => {
    urlListPanelOpen = !urlListPanelOpen;
    renderScanTab();
  });

  document.getElementById("url-list-done")?.addEventListener("click", () => {
    urlListPanelOpen = false;
    renderScanTab();
  });

  // URL paste-area add (sitemap XML or plain URLs) (F03-AC5)
  document.getElementById("url-paste-add")?.addEventListener("click", () => {
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement | null;
    if (!ta) return;
    const newUrls = parsePastedUrls(ta.value);
    if (newUrls.length === 0) return;
    const { list, added } = mergeNewUrlsIntoList(crawlUrlList, newUrls);
    crawlUrlList.length = 0;
    crawlUrlList.push(...list);
    // Only clear the textarea if we actually pulled URLs out of it. If nothing
    // was usable (typo'd XML, blank lines), leave the input so the user can fix.
    if (added > 0) ta.value = "";
    renderScanTab();
  });

  // URL file upload (.txt) (F03-AC4)
  document.getElementById("url-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { list } = mergeNewUrlsIntoList(crawlUrlList, parseTextFileUrls(text));
      crawlUrlList.length = 0;
      crawlUrlList.push(...list);
      renderScanTab();
    };
    reader.readAsText(file);
    input.value = "";
  });

  // URL manual add (F03-AC4)
  const addManualUrl = () => {
    const input = document.getElementById("url-manual-input") as HTMLInputElement | null;
    if (!input) return;
    const url = input.value.trim();
    // Use the browser's built-in URL validation (input type="url"). reportValidity
    // surfaces the native error tooltip when the URL is malformed.
    if (!url || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    if (!crawlUrlList.includes(url)) {
      crawlUrlList.push(url);
      input.value = "";
      renderScanTab();
      // Refocus the now-rendered input so the user can keep adding URLs
      document.getElementById("url-manual-input")?.focus();
    }
  };
  document.getElementById("url-manual-add")?.addEventListener("click", addManualUrl);
  document.getElementById("url-manual-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualUrl();
    }
  });

  // URL remove buttons (F03-AC4)
  document.querySelectorAll<HTMLButtonElement>(".url-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      const { list } = removeUrlAtIndex(crawlUrlList, idx);
      crawlUrlList.length = 0;
      crawlUrlList.push(...list);
      renderScanTab();
    });
  });

  // Crawl results view toggle (F03-AC13)
  document.getElementById("crawl-view-page")?.addEventListener("click", () => {
    crawlViewMode = "page";
    renderScanTab();
  });
  document.getElementById("crawl-view-wcag")?.addEventListener("click", () => {
    crawlViewMode = "wcag";
    renderScanTab();
  });

  // Crawl controls
  document.getElementById("pause-crawl")?.addEventListener("click", () => sendMessage({ type: "PAUSE_CRAWL" }));
  document.getElementById("resume-crawl")?.addEventListener("click", () => sendMessage({ type: "RESUME_CRAWL" }));
  document.getElementById("cancel-crawl")?.addEventListener("click", () => {
    state.crawlPhase = "idle";
    state.accordionExpanded = true;
    sendMessage({ type: "CANCEL_CRAWL" });
    updateTabDisabledStates();
    renderScanTab();
  });
  document.getElementById("cancel-scan")?.addEventListener("click", () => {
    state.scanPhase = "idle";
    updateTabDisabledStates();
    renderScanTab();
  });
  document.getElementById("continue-crawl")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
  });
  document.getElementById("scan-then-continue")?.addEventListener("click", async () => {
    // Scan the current page first, then continue crawl
    const result = await sendMessage({ type: "SCAN_REQUEST" });
    if (result && (result as { type: string }).type === "SCAN_RESULT") {
      state.lastScanResult = (result as { payload: iScanResult }).payload;
      state.scanSubTab = "results";
    }
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
    renderScanTab();
  });
  document.getElementById("cancel-wait")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "CANCEL_CRAWL" });
  });

  // Violation overlay toggle — state-tracked so the button reflects reality
  // across re-renders (manual review marks, sub-tab switches, etc.)
  document.getElementById("toggle-violations")?.addEventListener("click", () => {
    state.violationsOverlayOn = !state.violationsOverlayOn;
    const btn = document.getElementById("toggle-violations") as HTMLButtonElement;
    btn.setAttribute("aria-pressed", String(state.violationsOverlayOn));
    btn.classList.toggle("active", state.violationsOverlayOn);
    if (state.violationsOverlayOn && state.lastScanResult) {
      sendMessage({ type: "SHOW_VIOLATION_OVERLAY", payload: { violations: state.lastScanResult.violations } });
    } else {
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    }
  });

  // Manual review buttons (F09)
  document.querySelectorAll<HTMLButtonElement>(".manual-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      const newStatus = btn.dataset.status as iManualReviewStatus;
      // Toggle: click same button again → deselect
      state.manualReview[id] = state.manualReview[id] === newStatus ? null : newStatus;
      // Persist per-page (R-MANUAL) so reload restores the same status
      if (state.lastScanResult?.url) saveManualReviewFor(state.lastScanResult.url);
      renderScanTab();
    });
  });

  // ARIA scan button (F10)
  document.getElementById("run-aria-scan")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "RUN_ARIA_SCAN" });
    if (result && (result as { type: string }).type === "ARIA_SCAN_RESULT") {
      state.ariaWidgets = (result as { payload: iAriaWidget[] }).payload;
      renderScanTab();
    }
  });

  // ARIA highlight buttons
  document.querySelectorAll<HTMLButtonElement>(".aria-highlight").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      flashActiveItem(btn.closest("details"));
    });
  });

  // Export buttons. Accept either a single-page scan or crawl results — both
  // produce a valid iJsonReport (single-page populates top-level violations,
  // crawl-only populates report.crawl with per-page detail).
  const hasExportableData = (): boolean =>
    !!state.lastScanResult || !!(state.crawlResults && Object.keys(state.crawlResults).length > 0);

  document.getElementById("export-json")?.addEventListener("click", () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.json`);
  });
  document.getElementById("export-html")?.addEventListener("click", () => {
    // HTML/PDF reports render a single-page violation list — crawl-only data
    // would require a different layout, so for now require a single-page scan.
    if (!state.lastScanResult) return;
    const html = buildHtmlReport();
    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.html`);
  });
  document.getElementById("export-pdf")?.addEventListener("click", () => {
    if (!state.lastScanResult) return;
    const html = buildHtmlReport();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    } else {
      // Popup blocked — surface a transient error in the export-pdf button
      // text per R-EXPORT error-handling requirements.
      const btn = document.getElementById("export-pdf");
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Popup blocked";
        setTimeout(() => { btn.textContent = original; }, 3000);
      }
    }
  });
  document.getElementById("export-copy")?.addEventListener("click", async () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const btn = document.getElementById("export-copy");
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    } catch {
      // Clipboard API can fail on insecure contexts or if permission denied.
      // Per R-EXPORT: 'If clipboard write fails: button text changes to
      // Copy failed for 2s'.
      if (btn) {
        btn.textContent = "Copy failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    }
  });
  // Observer export
  document.getElementById("export-observer")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "OBSERVER_EXPORT_HISTORY" });
    if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
      const entries = (result as { payload: iObserverEntry[] }).payload;
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      downloadBlob(blob, `A11y-Observer-History-${getDateStamp()}.json`);
    }
  });
  // Observer clear
  document.getElementById("clear-observer")?.addEventListener("click", async () => {
    await sendMessage({ type: "OBSERVER_CLEAR_HISTORY" });
    observerEntries = [];
    observerLoaded = false;
    observerFilter = "";
    renderScanTab();
  });
  // Observer domain filter (F04-AC12)
  // Targeted DOM update — full re-render would destroy the input mid-keystroke and lose focus.
  document.getElementById("observer-domain-filter")?.addEventListener("input", (e) => {
    observerFilter = (e.target as HTMLInputElement).value;
    const listEl = document.getElementById("observer-list-content");
    if (listEl) listEl.innerHTML = renderObserverListInner();
  });

}

/**
 * Adds .ds-flash-active to `target` for 3s so the user gets visual feedback
 * in the panel that "this is the item I just highlighted on the page".
 * Stacked clicks reset the timer on the same target.
 */
const flashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
function flashActiveItem(target: HTMLElement | null): void {
  if (!target) return;
  const existing = flashTimers.get(target);
  if (existing) clearTimeout(existing);
  target.classList.add("ds-flash-active");
  const timer = setTimeout(() => {
    target.classList.remove("ds-flash-active");
    flashTimers.delete(target);
  }, 3000);
  flashTimers.set(target, timer);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showError(message: string): void {
  const content = document.getElementById("scan-content");
  if (content) {
    content.innerHTML = `
      <div style="padding:16px">
        <div style="padding:12px;background:var(--ds-red-50);border:1px solid var(--ds-red-200);border-radius:8px">
          <div style="font-size:12px;font-weight:700;color:var(--ds-red-800);margin-bottom:4px">Scan failed</div>
          <div style="font-size:11px;color:var(--ds-red-900);word-break:break-all">${escHtml(message)}</div>
        </div>
      </div>
    `;
  }
}

function getDomain(): string {
  return urlToDomainSlug(state.lastScanResult?.url || "");
}

function getDateStamp(): string {
  return formatDateStamp(new Date());
}

/* ═══════════════════════════════════════════════════════════════════
   Export Builders (F12)
   ═══════════════════════════════════════════════════════════════════ */

function buildJsonReport(): import("@shared/types").iJsonReport {
  return buildJsonReportFrom({
    lastScanResult: state.lastScanResult,
    crawlResults: state.crawlResults,
    crawlFailed: state.crawlFailed,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
    lastMvResult: state.lastMvResult,
    tabOrder: getTabOrder(),
    focusGaps: getFocusGaps(),
    documentTitle: document.title,
    nowIso: new Date().toISOString(),
  });
}


function buildHtmlReport(): string {
  if (!state.lastScanResult) throw new Error("buildHtmlReport called without a single-page scan result");
  return buildHtmlReportFrom({
    scan: state.lastScanResult,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
  });
}


