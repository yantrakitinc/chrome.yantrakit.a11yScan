/**
 * Background service worker — message router and orchestrator.
 * Source of truth: MESSAGES.md, F01-F23
 */

import type { iMessage } from "@shared/messages";
import { getConfig, forceUpdateConfig } from "@shared/config";
import { isScannableUrl } from "@shared/utils";
import { handleObserverMessage, onTabUpdated as observerOnTabUpdated } from "./observer";
import { handleCrawlMessage } from "./crawl";
import { multiViewportScan } from "./multi-viewport";

/* ═══════════════════════════════════════════════════════════════════
   Extension Lifecycle
   ═══════════════════════════════════════════════════════════════════ */

// Open side panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Register context menu items (F22)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "open-panel", title: "Open Panel", contexts: ["action"] });
  chrome.contextMenus.create({ id: "settings", title: "Settings", contexts: ["action"] });
  chrome.contextMenus.create({ id: "chat-history", title: "Chat History", contexts: ["action"] });
  chrome.contextMenus.create({ id: "clear-all", title: "Clear All Data", contexts: ["action"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.windowId) return;

  switch (info.menuItemId) {
    case "open-panel":
      chrome.sidePanel.open({ windowId: tab.windowId });
      break;
    case "settings":
      chrome.sidePanel.open({ windowId: tab.windowId });
      chrome.runtime.sendMessage({ type: "NAVIGATE", payload: { target: "settings" } });
      break;
    case "chat-history":
      chrome.sidePanel.open({ windowId: tab.windowId });
      chrome.runtime.sendMessage({ type: "NAVIGATE", payload: { target: "chatHistory" } });
      break;
    case "clear-all":
      chrome.runtime.sendMessage({ type: "CONFIRM_CLEAR_ALL" });
      break;
  }
});

/* ═══════════════════════════════════════════════════════════════════
   Observer: Tab Navigation Listener (F04)
   ═══════════════════════════════════════════════════════════════════ */

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && isScannableUrl(tab.url)) {
    observerOnTabUpdated(tabId, tab);
  }
});

/* ═══════════════════════════════════════════════════════════════════
   Message Router
   ═══════════════════════════════════════════════════════════════════ */

chrome.runtime.onMessage.addListener(
  (msg: iMessage, sender, sendResponse) => {
    handleMessage(msg, sender, sendResponse);
    return true; // async response
  }
);

async function handleMessage(
  msg: iMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  try {
    switch (msg.type) {
      /* ── Scan (F01) ── */
      case "SCAN_REQUEST": {
        const config = await getConfig();
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ type: "SCAN_ERROR", payload: { message: "No active tab" } }); return; }

        // F01-AC19 / F13-AC4: Merge testConfig fields into config before scanning
        const testConfig = (msg as { type: "SCAN_REQUEST"; payload?: { testConfig?: import("@shared/types").iTestConfig } }).payload?.testConfig;
        if (testConfig?.wcag?.version) config.wcagVersion = testConfig.wcag.version;
        if (testConfig?.wcag?.level) config.wcagLevel = testConfig.wcag.level;
        if (testConfig?.rules?.include) {
          // Include mode: disable all, then enable only specified
          const overrideRules: Record<string, { enabled: boolean }> = {};
          for (const [id] of Object.entries(config.rules || {})) overrideRules[id] = { enabled: false };
          for (const id of testConfig.rules.include) overrideRules[id] = { enabled: true };
          config.rules = overrideRules;
        } else if (testConfig?.rules?.exclude) {
          // Exclude mode: keep all enabled, disable specified
          const overrideRules: Record<string, { enabled: boolean }> = { ...config.rules };
          for (const id of testConfig.rules.exclude) overrideRules[id] = { enabled: false };
          config.rules = overrideRules;
        }
        if (testConfig?.heuristics?.exclude) {
          config.heuristics = { ...config.heuristics, exclude: testConfig.heuristics.exclude };
        }

        // Inject content script if needed
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        } catch { /* already injected */ }

        // F14-AC1: Activate mocks before scan if testConfig has mocks
        if (testConfig?.mocks && testConfig.mocks.length > 0) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_MOCKS", payload: { mocks: testConfig.mocks } });
          } catch { /* content script not ready */ }
        }

        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "RUN_SCAN",
          payload: { config },
        });
        sendResponse(result);
        break;
      }

      /* ── Config ── */
      case "FORCE_CONFIG_UPDATE": {
        const config = await forceUpdateConfig();
        sendResponse({ type: "CONFIG_UPDATED", payload: { version: config.version } });
        break;
      }

      /* ── Observer (F04) ── */
      case "OBSERVER_ENABLE":
      case "OBSERVER_DISABLE":
      case "OBSERVER_GET_STATE":
      case "OBSERVER_STATE":
      case "OBSERVER_UPDATE_SETTINGS":
      case "OBSERVER_GET_HISTORY":
      case "OBSERVER_CLEAR_HISTORY":
      case "OBSERVER_EXPORT_HISTORY":
      case "OBSERVER_LOG_ENTRY":
        await handleObserverMessage(msg, sendResponse);
        break;

      /* ── Crawl (F03) ── */
      case "START_CRAWL":
      case "PAUSE_CRAWL":
      case "RESUME_CRAWL":
      case "CANCEL_CRAWL":
      case "GET_CRAWL_STATE":
      case "USER_CONTINUE":
        await handleCrawlMessage(msg, sendResponse);
        break;

      /* ── Content script forwarding ── */
      case "SHOW_VIOLATION_OVERLAY":
      case "HIDE_VIOLATION_OVERLAY":
      case "SHOW_TAB_ORDER":
      case "HIDE_TAB_ORDER":
      case "SHOW_FOCUS_GAPS":
      case "HIDE_FOCUS_GAPS":
      case "HIGHLIGHT_ELEMENT":
      case "CLEAR_HIGHLIGHTS":
      case "START_MOVIE_MODE":
      case "PAUSE_MOVIE_MODE":
      case "RESUME_MOVIE_MODE":
      case "STOP_MOVIE_MODE":
      case "SET_MOVIE_SPEED":
      case "APPLY_CVD_FILTER":
      case "RUN_ARIA_SCAN":
      case "COLLECT_ENRICHED_CONTEXT":
      case "ACTIVATE_MOCKS":
      case "DEACTIVATE_MOCKS":
      case "ANALYZE_READING_ORDER":
      case "GET_TAB_ORDER":
      case "GET_FOCUS_GAPS":
      case "GET_FOCUS_INDICATORS":
      case "GET_KEYBOARD_TRAPS":
      case "GET_SKIP_LINKS":
      case "ENTER_INSPECT_MODE":
      case "EXIT_INSPECT_MODE": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ type: "SCAN_ERROR", payload: { message: "No active tab" } }); return; }
        // Ensure content script is injected before forwarding
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        } catch { /* already injected */ }
        try {
          const result = await chrome.tabs.sendMessage(tab.id, msg);
          sendResponse(result);
        } catch (err) {
          sendResponse({ type: "SCAN_ERROR", payload: { message: String(err) } });
        }
        break;
      }

      /* ── Clear All Confirmed (F22) ── */
      case "CLEAR_ALL_CONFIRMED": {
        await chrome.storage.local.remove([
          "observer_state", "observer_history", "crawlState",
          "a11yscan_config", "a11yscan_config_timestamp",
          "chatHistory",
        ]);
        chrome.runtime.sendMessage({ type: "STATE_CLEARED" });
        sendResponse({ type: "STATE_CLEARED" });
        break;
      }

      /* ── Multi-Viewport (F02) ── */
      case "MULTI_VIEWPORT_SCAN": {
        await multiViewportScan(msg.payload.viewports, sendResponse);
        break;
      }

      default:
        sendResponse({ type: "SCAN_ERROR", payload: { message: `Unknown message type: ${(msg as { type: string }).type}` } });
    }
  } catch (err) {
    sendResponse({ type: "SCAN_ERROR", payload: { message: String(err) } });
  }
}
