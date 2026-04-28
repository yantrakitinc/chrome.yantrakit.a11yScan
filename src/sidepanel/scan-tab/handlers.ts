/**
 * Event listener wiring for every interactive element in the scan tab —
 * accordion, mode toggles, MV checkbox + viewport editor, sub-tabs, scan
 * button, manual review, ARIA scan, export buttons, observer controls,
 * crawl controls, page-rule wait controls.
 *
 * Most of the closure state (panel-open flags, URL list, observer cache,
 * crawl-view mode, etc.) lives in ./state.ts so the renderer wrappers in
 * scan-tab.ts can read it. State that's strictly internal to event
 * dispatch (DOM-flash WeakMap) stays here.
 *
 * `renderScanTab` is passed in to break the cycle with scan-tab.ts —
 * caller binds it once at startup via `bindRerender`.
 */

import { state, updateTabDisabledStates, switchTab, TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } from "../sidepanel";
import { getTabOrder, getFocusGaps } from "../kb-tab";
import { openAiChatWithContext } from "../ai-tab";
import { sendMessage } from "@shared/messages";
import type { iScanResult, iAriaWidget, iManualReviewStatus, iObserverEntry, iMultiViewportResult } from "@shared/types";
import { uuid, isoNow, escHtml } from "@shared/utils";

import { scanTabState } from "./state";
import { addViewport, removeViewport } from "./viewports";
import {
  addManualUrlToList, removeUrlAtIndex, mergeNewUrlsIntoList,
  parseTextFileUrls, parsePastedUrls,
} from "./url-list";
import { urlToDomainSlug, formatDateStamp } from "./formatting";
import {
  clearScanResultsSlice, resetScanStateSlice, buildObserverEntry,
  mergeMvResultToScan, buildStartCrawlPayload,
} from "./state-slices";
import { buildJsonReportFrom, buildHtmlReportFrom } from "./reports";
import { renderObserverListInnerHtml } from "./render-observer";
import { openConfigDialog } from "./config-dialog";

let _rerender: () => void = () => {};
let _loadManualReviewFor: (url: string) => void = () => {};
let _saveManualReviewFor: (url: string) => void = () => {};

/**
 * Wire callbacks the handlers need but can't import without a cycle.
 * Called once at module init from scan-tab.ts.
 */
export function bindScanTabCallbacks(opts: {
  rerender: () => void;
  loadManualReview: (url: string) => void;
  saveManualReview: (url: string) => void;
}): void {
  _rerender = opts.rerender;
  _loadManualReviewFor = opts.loadManualReview;
  _saveManualReviewFor = opts.saveManualReview;
}

/* ═══════════════════════════════════════════════════════════════════
   DOM helpers (flash, download, error, filename pieces)
   ═══════════════════════════════════════════════════════════════════ */

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
   Closure-bound report builders
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

/* ═══════════════════════════════════════════════════════════════════
   Main listener attachment — called from renderScanTab after innerHTML
   ═══════════════════════════════════════════════════════════════════ */

export function attachScanTabListeners(): void {
  // Accordion toggle
  document.getElementById("accordion-toggle")?.addEventListener("click", () => {
    if (!state.accordionExpanded) {
      state.accordionExpanded = true;
      _rerender();
      document.getElementById("collapse-btn")?.focus();
    }
  });
  document.getElementById("collapse-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.accordionExpanded = false;
    _rerender();
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
        if (state.observer) scanTabState.observerLoaded = false;
      } else if (mode === "movie") {
        state.movie = !state.movie;
        chrome.storage.local.set({ movie_enabled: state.movie });
      }
      _rerender();
    });
  });

  // MV checkbox
  document.getElementById("mv-check")?.addEventListener("change", () => {
    state.mv = !state.mv;
    if (!state.mv) scanTabState.viewportEditing = false;
    _rerender();
  });

  // Viewport editor controls
  document.getElementById("vp-edit")?.addEventListener("click", () => {
    scanTabState.viewportEditing = true;
    _rerender();
  });
  document.getElementById("vp-done")?.addEventListener("click", () => {
    scanTabState.viewportEditing = false;
    _rerender();
  });
  document.getElementById("vp-add")?.addEventListener("click", () => {
    state.viewports = addViewport(state.viewports);
    _rerender();
  });
  document.querySelectorAll<HTMLButtonElement>(".vp-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      state.viewports = removeViewport(state.viewports, idx);
      _rerender();
    });
  });
  document.querySelectorAll<HTMLInputElement>(".vp-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.index ?? "0");
      let val = parseInt(input.value) || 320;
      if (val < 320) val = 320;
      const updated = [...state.viewports];
      updated[idx] = val;
      const unique = [...new Set(updated)].sort((a, b) => a - b);
      state.viewports = unique;
      _rerender();
    });
  });

  // WCAG dropdowns (F01-AC19)
  document.getElementById("wcag-version")?.addEventListener("change", (e) => {
    state.wcagVersion = (e.target as HTMLSelectElement).value;
  });
  document.getElementById("wcag-level")?.addEventListener("change", (e) => {
    state.wcagLevel = (e.target as HTMLSelectElement).value;
  });

  // Sub-tab nav (F01-AC17) — click + ARIA tablist arrows
  const subTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".sub-tab"));
  subTabs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab as typeof state.scanSubTab;
      if (subtab) { state.scanSubTab = subtab; _rerender(); }
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
          _rerender();
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
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      updateTabDisabledStates();
      _rerender();
      await sendMessage({ type: "START_CRAWL", payload: buildStartCrawlPayload({
        testConfig: state.testConfig,
        crawlMode: scanTabState.crawlMode,
        crawlUrlList: scanTabState.crawlUrlList,
      }) });
    } else {
      const wasResults = state.scanPhase === "results";
      state.scanPhase = "scanning";
      if (!wasResults) state.accordionExpanded = false;
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      updateTabDisabledStates();
      _rerender();
      try {
        const result = state.mv
          ? await sendMessage({ type: "MULTI_VIEWPORT_SCAN", payload: { viewports: state.testConfig?.viewports ?? state.viewports, testConfig: state.testConfig ?? undefined } })
          : await sendMessage({ type: "SCAN_REQUEST", payload: { testConfig: state.testConfig ?? undefined } });
        const resType = (result as { type: string })?.type;
        if (resType === "SCAN_RESULT") {
          state.lastScanResult = (result as { payload: iScanResult }).payload;
          state.scanPhase = "results";
          _loadManualReviewFor(state.lastScanResult.url);
        } else if (resType === "MULTI_VIEWPORT_RESULT") {
          const mvResult = (result as { payload: iMultiViewportResult }).payload;
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
              scanTabState.observerLoaded = false;
            });
          }
          // Auto-play Movie Mode after scan (F06-AC5)
          if (state.movie) {
            const speed = state.testConfig?.timing?.movieSpeed ?? 1;
            sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
            sendMessage({ type: "START_MOVIE_MODE" });
          }
          // Background ARIA scan
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
      _rerender();
    }
  });

  // Clear
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    Object.assign(state, clearScanResultsSlice(state));
    updateTabDisabledStates();
    _rerender();
    sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    sendMessage({ type: "HIDE_TAB_ORDER" });
    sendMessage({ type: "HIDE_FOCUS_GAPS" });
    sendMessage({ type: "CLEAR_HIGHLIGHTS" });
    sendMessage({ type: "DEACTIVATE_MOCKS" });
  });

  // Settings / Test Config modal (F13)
  document.getElementById("settings-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    scanTabState.configPanelOpen = true;
    (e.currentTarget as HTMLElement).setAttribute("aria-expanded", "true");
    openConfigDialog({
      onClose: () => { scanTabState.configPanelOpen = false; _rerender(); },
      rerender: _rerender,
    });
  });

  // Reset
  document.getElementById("reset-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    Object.assign(state, resetScanStateSlice(state));
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    scanTabState.configPanelOpen = false;
    _rerender();
  });

  // MV viewport filter chips (F02-AC11)
  document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.mvfilter;
      state.mvViewportFilter = val === "all" || val === undefined ? null : parseInt(val);
      _rerender();
    });
  });

  // Highlight buttons
  document.querySelectorAll<HTMLButtonElement>(".highlight-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      flashActiveItem(btn.closest("details") || btn.closest(".violation-card") || btn.parentElement);
    });
  });

  // Explain Further → AI tab
  document.querySelectorAll<HTMLButtonElement>(".explain-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ruleId = btn.dataset.rule || "";
      const description = btn.dataset.description || "";
      switchTab("ai");
      setTimeout(() => openAiChatWithContext(ruleId, description), 0);
    });
  });

  // Crawl mode select (F03-AC2)
  document.getElementById("crawl-mode")?.addEventListener("change", (e) => {
    scanTabState.crawlMode = (e.target as HTMLSelectElement).value as "follow" | "urllist";
    scanTabState.urlListPanelOpen = false;
    _rerender();
  });

  // URL list panel open/close (F03-AC3)
  document.getElementById("url-list-open")?.addEventListener("click", () => {
    scanTabState.urlListPanelOpen = !scanTabState.urlListPanelOpen;
    _rerender();
  });
  document.getElementById("url-list-done")?.addEventListener("click", () => {
    scanTabState.urlListPanelOpen = false;
    _rerender();
  });

  // URL paste-area add (F03-AC5)
  document.getElementById("url-paste-add")?.addEventListener("click", () => {
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement | null;
    if (!ta) return;
    const newUrls = parsePastedUrls(ta.value);
    if (newUrls.length === 0) return;
    const { list, added } = mergeNewUrlsIntoList(scanTabState.crawlUrlList, newUrls);
    scanTabState.crawlUrlList.length = 0;
    scanTabState.crawlUrlList.push(...list);
    if (added > 0) ta.value = "";
    _rerender();
  });

  // URL file upload .txt (F03-AC4)
  document.getElementById("url-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { list } = mergeNewUrlsIntoList(scanTabState.crawlUrlList, parseTextFileUrls(text));
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      _rerender();
    };
    reader.readAsText(file);
    input.value = "";
  });

  // URL manual add (F03-AC4)
  const addManualUrl = () => {
    const input = document.getElementById("url-manual-input") as HTMLInputElement | null;
    if (!input) return;
    const url = input.value.trim();
    if (!url || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    const { list, added } = { ...addManualUrlToList(scanTabState.crawlUrlList, url) };
    if (added) {
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      input.value = "";
      _rerender();
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

  // URL remove (F03-AC4)
  document.querySelectorAll<HTMLButtonElement>(".url-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      const { list } = removeUrlAtIndex(scanTabState.crawlUrlList, idx);
      scanTabState.crawlUrlList.length = 0;
      scanTabState.crawlUrlList.push(...list);
      _rerender();
    });
  });

  // Crawl results view toggle (F03-AC13)
  document.getElementById("crawl-view-page")?.addEventListener("click", () => {
    scanTabState.crawlViewMode = "page";
    _rerender();
  });
  document.getElementById("crawl-view-wcag")?.addEventListener("click", () => {
    scanTabState.crawlViewMode = "wcag";
    _rerender();
  });

  // Crawl run controls
  document.getElementById("pause-crawl")?.addEventListener("click", () => sendMessage({ type: "PAUSE_CRAWL" }));
  document.getElementById("resume-crawl")?.addEventListener("click", () => sendMessage({ type: "RESUME_CRAWL" }));
  document.getElementById("cancel-crawl")?.addEventListener("click", () => {
    state.crawlPhase = "idle";
    state.accordionExpanded = true;
    sendMessage({ type: "CANCEL_CRAWL" });
    updateTabDisabledStates();
    _rerender();
  });
  document.getElementById("cancel-scan")?.addEventListener("click", () => {
    state.scanPhase = "idle";
    updateTabDisabledStates();
    _rerender();
  });
  document.getElementById("continue-crawl")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
  });
  document.getElementById("scan-then-continue")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "SCAN_REQUEST" });
    if (result && (result as { type: string }).type === "SCAN_RESULT") {
      state.lastScanResult = (result as { payload: iScanResult }).payload;
      state.scanSubTab = "results";
    }
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
    _rerender();
  });
  document.getElementById("cancel-wait")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "CANCEL_CRAWL" });
  });

  // Violation overlay toggle
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
      state.manualReview[id] = state.manualReview[id] === newStatus ? null : newStatus;
      if (state.lastScanResult?.url) _saveManualReviewFor(state.lastScanResult.url);
      _rerender();
    });
  });

  // ARIA scan button (F10)
  document.getElementById("run-aria-scan")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "RUN_ARIA_SCAN" });
    if (result && (result as { type: string }).type === "ARIA_SCAN_RESULT") {
      state.ariaWidgets = (result as { payload: iAriaWidget[] }).payload;
      _rerender();
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

  // Export buttons
  const hasExportableData = (): boolean =>
    !!state.lastScanResult || !!(state.crawlResults && Object.keys(state.crawlResults).length > 0);

  document.getElementById("export-json")?.addEventListener("click", () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.json`);
  });
  document.getElementById("export-html")?.addEventListener("click", () => {
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
      if (btn) {
        btn.textContent = "Copy failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    }
  });

  // Observer export / clear / filter
  document.getElementById("export-observer")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "OBSERVER_EXPORT_HISTORY" });
    if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
      const entries = (result as { payload: iObserverEntry[] }).payload;
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      downloadBlob(blob, `A11y-Observer-History-${getDateStamp()}.json`);
    }
  });
  document.getElementById("clear-observer")?.addEventListener("click", async () => {
    await sendMessage({ type: "OBSERVER_CLEAR_HISTORY" });
    scanTabState.observerEntries = [];
    scanTabState.observerLoaded = false;
    scanTabState.observerFilter = "";
    _rerender();
  });
  // Targeted DOM update — full re-render would destroy the input mid-keystroke and lose focus.
  document.getElementById("observer-domain-filter")?.addEventListener("input", (e) => {
    scanTabState.observerFilter = (e.target as HTMLInputElement).value;
    const listEl = document.getElementById("observer-list-content");
    if (listEl) listEl.innerHTML = renderObserverListInnerHtml(scanTabState.observerEntries, scanTabState.observerFilter);
  });
}
