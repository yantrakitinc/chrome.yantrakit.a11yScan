/**
 * Sidepanel main entry — UI orchestration.
 * Source of truth: F18 (Panel Layout), F19 (Phase & Mode System)
 */

import "./sidepanel.css";
import { sendMessage } from "@shared/messages";
import type { iMessage } from "@shared/messages";
import type { iScanResult, iTestConfig, iMultiViewportResult } from "@shared/types";
import { renderScanTab, invalidateObserverCache } from "./scan-tab";
import { renderScreenReaderTab, setScopeFromInspect } from "./sr-tab";
import { renderKeyboardTab, onMovieTick, onMovieComplete } from "./kb-tab";
import { renderAiChatTab, openAiHistoryPanel } from "./ai-tab";

/* ═══════════════════════════════════════════════════════════════════
   CVD Matrices (F08) — verified from codebase
   ═══════════════════════════════════════════════════════════════════ */

const CVD_MATRICES: Record<string, number[]> = {
  protanopia:     [0.567, 0.433, 0,     0.558, 0.442, 0,     0,     0.242, 0.758],
  deuteranopia:   [0.625, 0.375, 0,     0.7,   0.3,   0,     0,     0.3,   0.7  ],
  protanomaly:    [0.817, 0.183, 0,     0.333, 0.667, 0,     0,     0.125, 0.875],
  deuteranomaly:  [0.8,   0.2,   0,     0.258, 0.742, 0,     0,     0.142, 0.858],
  tritanopia:     [0.95,  0.05,  0,     0,     0.433, 0.567, 0,     0.475, 0.525],
  tritanomaly:    [0.967, 0.033, 0,     0,     0.733, 0.267, 0,     0.183, 0.817],
  achromatopsia:  [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
  achromatomaly:  [0.618, 0.32,  0.062, 0.163, 0.775, 0.062, 0.163, 0.32,  0.516],
};

/* ═══════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════ */

export type iTopTab = "scan" | "sr" | "kb" | "ai";
export type iScanPhase = "idle" | "scanning" | "results";
export type iCrawlPhase = "idle" | "crawling" | "paused" | "wait" | "complete";

export const state = {
  topTab: "scan" as iTopTab,
  scanPhase: "idle" as iScanPhase,
  crawlPhase: "idle" as iCrawlPhase,
  crawl: false,
  observer: false,
  movie: false,
  mv: false,
  viewports: [375, 768, 1280],
  wcagVersion: "2.2",
  wcagLevel: "AA",
  lastScanResult: null as iScanResult | null,
  accordionExpanded: true,
  scanSubTab: "results" as "results" | "manual" | "aria" | "observe",
  ariaWidgets: [] as import("@shared/types").iAriaWidget[],
  manualReview: {} as Record<string, import("@shared/types").iManualReviewStatus>,
  testConfig: null as iTestConfig | null,
  lastMvResult: null as iMultiViewportResult | null,
  mvViewportFilter: null as number | null,
  mvProgress: null as { current: number; total: number } | null,
  crawlProgress: { pagesVisited: 0, pagesTotal: 0, currentUrl: "" } as { pagesVisited: number; pagesTotal: number; currentUrl: string },
  /** Crawl results stored when crawl completes — used in JSON export (F12-AC1) */
  crawlResults: null as Record<string, iScanResult> | null,
  crawlFailed: null as Record<string, string> | null,
  /** Whether the violation-overlay toolbar toggle is currently on. Survives re-render. */
  violationsOverlayOn: false,
  /** KB-tab overlay toggles. Survive re-render so the checkboxes don't drift. */
  tabOrderOverlayOn: false,
  focusGapsOverlayOn: false,
};

/* ═══════════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════════ */

/** chrome.storage.local key for persisting active test config (F13) */
export const TEST_CONFIG_STORAGE_KEY = "a11yscan_test_config";
/** Timestamp of the last successful Apply — companion to TEST_CONFIG_STORAGE_KEY (R-CONFIG). */
export const TEST_CONFIG_TIMESTAMP_KEY = "a11yscan_test_config_timestamp";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initCvd();
  initConfirmClearBar();
  initMessageListener();
  // Restore test config from storage before first render (F13-AC8)
  chrome.storage.local.get(TEST_CONFIG_STORAGE_KEY, (result) => {
    const stored = result[TEST_CONFIG_STORAGE_KEY];
    if (stored && typeof stored === "object") {
      state.testConfig = stored as iTestConfig;
      // Sync MV viewports from the stored config so the chips match
      // testConfig on panel reopen (R-MV AC8).
      const vp = state.testConfig.viewports;
      if (vp && Array.isArray(vp) && vp.length > 0) {
        state.viewports = [...vp].sort((a, b) => a - b);
      }
    }
    // Restore observer toggle state on panel reopen (F04-AC15)
    sendMessage({ type: "OBSERVER_GET_STATE" }).then((res) => {
      if (res && (res as { type: string }).type === "OBSERVER_STATE") {
        state.observer = (res as { payload: { enabled: boolean } }).payload.enabled;
      }
      // Restore active top-level tab so reopen returns the user to where they were (R-PANEL)
      restoreTopTab();
    }).catch(() => {
      restoreTopTab();
    });
  });
});

function restoreTopTab(): void {
  try {
    chrome.storage.session.get(TOP_TAB_STORAGE_KEY, (result) => {
      const stored = result?.[TOP_TAB_STORAGE_KEY] as iTopTab | undefined;
      if (stored && stored !== state.topTab && stored !== "ai") {
        switchTab(stored);
      } else {
        renderScanTab();
      }
    });
  } catch {
    renderScanTab();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Tab Navigation (F18)
   ═══════════════════════════════════════════════════════════════════ */

function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>("#top-tabs .tab");
  const enabledTabs = Array.from(tabs).filter((t) => !t.disabled);
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab as iTopTab;
      if (!tabId) return;
      switchTab(tabId);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const idx = enabledTabs.indexOf(tab);
      if (idx === -1) return;
      let next: HTMLButtonElement;
      if (e.key === "Home") next = enabledTabs[0];
      else if (e.key === "End") next = enabledTabs[enabledTabs.length - 1];
      else if (e.key === "ArrowRight") next = enabledTabs[(idx + 1) % enabledTabs.length];
      else next = enabledTabs[(idx - 1 + enabledTabs.length) % enabledTabs.length];
      const tabId = next.dataset.tab as iTopTab;
      if (tabId) {
        switchTab(tabId);
        next.focus();
      }
    });
  });
}

/** chrome.storage.session key for the active top-level tab — survives side
   panel close/reopen so users land back where they were (R-PANEL). */
const TOP_TAB_STORAGE_KEY = "a11yscan_top_tab";

export function switchTab(tabId: iTopTab): void {
  state.topTab = tabId;
  // Persist so reopening the side panel returns to this tab.
  try { chrome.storage.session.set({ [TOP_TAB_STORAGE_KEY]: tabId }); } catch { /* session storage may not be available in tests */ }

  // Update tab buttons
  document.querySelectorAll<HTMLButtonElement>("#top-tabs .tab").forEach((tab) => {
    const isActive = tab.dataset.tab === tabId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  // Update panels
  document.querySelectorAll<HTMLDivElement>(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${tabId}`;
    panel.classList.toggle("active", panel.id === `panel-${tabId}`);
  });

  // Render tab content
  switch (tabId) {
    case "scan": renderScanTab(); break;
    case "sr": renderScreenReaderTab(); break;
    case "kb": renderKeyboardTab(); break;
    case "ai": renderAiChatTab(); break;
  }

  // Disable SR/KB during busy (F19)
  updateTabDisabledStates();
}

/* ═══════════════════════════════════════════════════════════════════
   Pop-out (F21)
   ═══════════════════════════════════════════════════════════════════ */


export function updateTabDisabledStates(): void {
  const busy = state.scanPhase === "scanning" || state.crawlPhase === "crawling" || state.crawlPhase === "wait";
  const tabs = document.querySelectorAll<HTMLButtonElement>("#top-tabs .tab");
  tabs.forEach((tab) => {
    const tabId = tab.dataset.tab;
    if (tabId === "ai") {
      // AI Chat is permanently disabled (Coming Soon). Do NOT touch its disabled state.
      return;
    }
    if (tabId === "sr" || tabId === "kb") {
      tab.disabled = busy;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   CVD Simulation (F08)
   ═══════════════════════════════════════════════════════════════════ */

function initCvd(): void {
  const select = document.getElementById("cvd-select") as HTMLSelectElement;
  select.addEventListener("change", () => {
    const type = select.value;
    const matrix = type ? CVD_MATRICES[type] || null : null;
    sendMessage({ type: "APPLY_CVD_FILTER", payload: { matrix } });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Confirm Clear All Bar (F22)
   ═══════════════════════════════════════════════════════════════════ */

function initConfirmClearBar(): void {
  const bar = document.getElementById("confirm-clear-bar");
  const yesBtn = document.getElementById("confirm-clear-yes");
  const cancelBtn = document.getElementById("confirm-clear-cancel");

  yesBtn?.addEventListener("click", () => {
    if (bar) bar.hidden = true;
  // Sync the visible state with the source the user just confirmed.
    sendMessage({ type: "CLEAR_ALL_CONFIRMED" });
  });

  cancelBtn?.addEventListener("click", () => {
    if (bar) bar.hidden = true;
  });

  // Escape closes the alertdialog (R-PANEL: 'Escape closes via JS handler
  // since <div> is not a native dialog'). Only acts when the bar is visible.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bar && !bar.hidden) {
      bar.hidden = true;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Message Listener
   ═══════════════════════════════════════════════════════════════════ */

function initMessageListener(): void {
  chrome.runtime.onMessage.addListener((msg: iMessage) => {
    switch (msg.type) {
      case "NAVIGATE":
        if (msg.payload.target === "settings") {
          switchTab("scan");
          state.accordionExpanded = true;
          renderScanTab();
          // AC3: scroll the accordion into view after render (F22)
          requestAnimationFrame(() => {
            document.getElementById("accordion-toggle")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        } else if (msg.payload.target === "chatHistory") {
          // F22-AC4: switch to AI tab and open the history drawer
          switchTab("ai");
          requestAnimationFrame(() => openAiHistoryPanel());
        }
        break;

      case "CONFIRM_CLEAR_ALL": {
        // AC5: show inline confirmation bar instead of confirm() (F22).
        // Move focus to Cancel by default (safer) per R-PANEL.
        const bar = document.getElementById("confirm-clear-bar");
        if (bar) {
          bar.hidden = false;
          (document.getElementById("confirm-clear-cancel") as HTMLButtonElement | null)?.focus();
        }
        break;
      }

      case "STATE_CLEARED":
        state.scanPhase = "idle";
        state.crawlPhase = "idle";
        state.lastScanResult = null;
        state.lastMvResult = null;
        state.mvViewportFilter = null;
        state.mvProgress = null;
        state.crawlResults = null;
        state.crawlFailed = null;
        state.accordionExpanded = true;
        renderScanTab();
        break;

      case "MULTI_VIEWPORT_PROGRESS":
        state.mvProgress = { current: msg.payload.currentViewport, total: msg.payload.totalViewports };
        renderScanTab();
        break;

      case "CRAWL_PROGRESS":
        state.crawlPhase = msg.payload.status as iCrawlPhase;
        state.crawlProgress = {
          pagesVisited: msg.payload.pagesVisited ?? 0,
          pagesTotal: msg.payload.pagesTotal ?? 0,
          currentUrl: msg.payload.currentUrl ?? "",
        };
        // F12-AC1: capture crawl results when crawl finishes for JSON export
        if (msg.payload.status === "complete" || msg.payload.status === "paused") {
          state.crawlResults = (msg.payload.results as Record<string, iScanResult>) ?? null;
          state.crawlFailed = (msg.payload.failed as Record<string, string>) ?? null;
        }
        updateTabDisabledStates();
        renderScanTab();
        break;

      case "CRAWL_WAITING_FOR_USER":
        state.crawlPhase = "wait";
        updateTabDisabledStates();
        renderScanTab();
        break;

      case "OBSERVER_SCAN_COMPLETE":
        // Observer entry received — invalidate cache so re-render fetches fresh history
        invalidateObserverCache();
        renderScanTab();
        break;

      case "MOVIE_TICK":
        onMovieTick(msg.payload.currentIndex);
        break;

      case "MOVIE_COMPLETE":
        onMovieComplete();
        break;

      case "HIGHLIGHT_RESULT":
        if (!(msg.payload as { found: boolean }).found) {
          const activePanel = document.querySelector<HTMLElement>(".tab-panel:not([hidden])");
          if (activePanel) {
            const toast = document.createElement("div");
            toast.setAttribute("role", "alert");
            toast.setAttribute("aria-live", "assertive");
            toast.textContent = "Element not found on page";
            toast.style.cssText = "position:sticky;top:0;z-index:100;padding:8px 12px;background:#fef2f2;border-bottom:1px solid #fca5a5;color:#b91c1c;font-size:11px;font-weight:700;text-align:center";
            activePanel.prepend(toast);
            setTimeout(() => toast.remove(), 3000);
          }
        }
        break;

      case "VIOLATION_BADGE_CLICKED": {
        // F05-AC4: badge click in overlay → switch to scan results and scroll to violation
        switchTab("scan");
        state.scanSubTab = "results";
        renderScanTab();
        requestAnimationFrame(() => {
          const index = (msg.payload as { index?: number } | undefined)?.index;
          const details = document.querySelectorAll<HTMLDetailsElement>(
            "#scan-content details.severity-critical, #scan-content details.severity-serious, #scan-content details.severity-moderate, #scan-content details.severity-minor"
          );
          const target = (index !== undefined && index >= 0 && index < details.length) ? details[index] : details[0];
          if (target) {
            target.open = true;
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        break;
      }

      case "INSPECT_ELEMENT":
        // F15-AC21: inspect-mode click in SR tab sets scope selector and re-analyzes
        if (state.topTab === "sr") {
          setScopeFromInspect(msg.payload.selector);
        }
        break;
    }
  });
}
