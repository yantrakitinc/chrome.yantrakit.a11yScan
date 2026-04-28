/**
 * Scan-button click — the central dispatch for "what does pressing the
 * primary button do given current mode flags + phase?". Plus the related
 * Clear / Reset / Settings buttons that share state lifecycle concerns.
 */

import { state, updateTabDisabledStates, TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } from "../../sidepanel";
import { sendMessage } from "@shared/messages";
import type { iScanResult, iAriaWidget, iMultiViewportResult } from "@shared/types";
import { uuid, isoNow } from "@shared/utils";
import { scanTabState } from "../state";
import {
  clearScanResultsSlice, resetScanStateSlice, buildObserverEntry,
  mergeMvResultToScan, buildStartCrawlPayload,
} from "../state-slices";
import { openConfigDialog } from "../config-dialog";
import { rerender, loadManualReviewFor } from "./callbacks";
import { showError } from "./dom-utils";

export function attachScanButtonListeners(): void {
  // Scan button — branches between START_CRAWL (when Crawl mode + idle) and
  // SCAN_REQUEST / MULTI_VIEWPORT_SCAN otherwise.
  document.getElementById("scan-btn")?.addEventListener("click", async () => {
    if (state.crawl && state.crawlPhase === "idle") {
      state.crawlPhase = "crawling";
      state.accordionExpanded = false;
      // Crawl navigates to new pages; any prior overlay is gone — reset state.
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      updateTabDisabledStates();
      rerender();
      await sendMessage({ type: "START_CRAWL", payload: buildStartCrawlPayload({
        testConfig: state.testConfig,
        crawlMode: scanTabState.crawlMode,
        crawlUrlList: scanTabState.crawlUrlList,
      }) });
      return;
    }

    // Single-page or Multi-Viewport scan
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
    rerender();
    try {
      const result = state.mv
        ? await sendMessage({ type: "MULTI_VIEWPORT_SCAN", payload: { viewports: state.testConfig?.viewports ?? state.viewports, testConfig: state.testConfig ?? undefined } })
        : await sendMessage({ type: "SCAN_REQUEST", payload: { testConfig: state.testConfig ?? undefined } });
      const resType = (result as { type: string })?.type;
      if (resType === "SCAN_RESULT") {
        state.lastScanResult = (result as { payload: iScanResult }).payload;
        state.scanPhase = "results";
        loadManualReviewFor(state.lastScanResult.url);
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
        // F04-AC8: log manual scan to observer history when observer is on
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
        // F06-AC5: auto-play Movie Mode after scan
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
    rerender();
  });

  // Clear (F22 Clear All) — wipe results + crawl + MV cache, hide overlays.
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    Object.assign(state, clearScanResultsSlice(state));
    updateTabDisabledStates();
    rerender();
    sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    sendMessage({ type: "HIDE_TAB_ORDER" });
    sendMessage({ type: "HIDE_FOCUS_GAPS" });
    sendMessage({ type: "CLEAR_HIGHLIGHTS" });
    sendMessage({ type: "DEACTIVATE_MOCKS" });
  });

  // Settings — open the test-config dialog (F13)
  document.getElementById("settings-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    scanTabState.configPanelOpen = true;
    (e.currentTarget as HTMLElement).setAttribute("aria-expanded", "true");
    openConfigDialog({
      onClose: () => { scanTabState.configPanelOpen = false; rerender(); },
      rerender: rerender,
    });
  });

  // Reset (R-MV "Reset restores defaults" + F13-AC7 "Reset clears testConfig")
  document.getElementById("reset-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    Object.assign(state, resetScanStateSlice(state));
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    scanTabState.configPanelOpen = false;
    rerender();
  });
}
