/**
 * Observer Mode — passive background scanning (F04).
 * Auto-scans pages as the user navigates.
 */

import type { iMessage } from "@shared/messages";
import type { iObserverState, iObserverEntry, iObserverSettings } from "@shared/types";
import { OBSERVER_STORAGE_KEYS, DEFAULT_OBSERVER_SETTINGS } from "@shared/types";
import { isScannableUrl, matchesDomain, uuid, isoNow, getViewportBucket, DEFAULT_VIEWPORTS } from "@shared/utils";
import { getConfig } from "@shared/config";

/** In-memory throttle map: URL → last scan timestamp */
const throttleMap = new Map<string, number>();

/** Is a crawl currently running? Set by crawl module. */
let crawlActive = false;
export function setCrawlActive(active: boolean): void { crawlActive = active; }

/* ═══════════════════════════════════════════════════════════════════
   State Management
   ═══════════════════════════════════════════════════════════════════ */

async function getState(): Promise<iObserverState> {
  const data = await chrome.storage.local.get(OBSERVER_STORAGE_KEYS.state);
  return (data[OBSERVER_STORAGE_KEYS.state] as iObserverState) || { enabled: false, settings: DEFAULT_OBSERVER_SETTINGS };
}

async function setState(state: iObserverState): Promise<void> {
  await chrome.storage.local.set({ [OBSERVER_STORAGE_KEYS.state]: state });
}

async function getHistory(): Promise<iObserverEntry[]> {
  const data = await chrome.storage.local.get(OBSERVER_STORAGE_KEYS.history);
  return (data[OBSERVER_STORAGE_KEYS.history] as iObserverEntry[]) || [];
}

async function setHistory(history: iObserverEntry[]): Promise<void> {
  await chrome.storage.local.set({ [OBSERVER_STORAGE_KEYS.history]: history });
}

/* ═══════════════════════════════════════════════════════════════════
   Tab Navigation Handler
   ═══════════════════════════════════════════════════════════════════ */

export async function onTabUpdated(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
  const state = await getState();
  if (!state.enabled) return;
  if (crawlActive) return; // crawl owns navigation
  if (!tab.url || !isScannableUrl(tab.url)) return;

  const { settings } = state;

  // Domain filter
  if (!matchesDomain(tab.url, settings.includeDomains)) return;
  if (settings.excludeDomains.length > 0 && matchesDomain(tab.url, settings.excludeDomains)) return;

  // Throttle
  const lastScan = throttleMap.get(tab.url);
  if (lastScan && (Date.now() - lastScan) / 1000 < settings.throttleSeconds) return;

  // Run scan
  try {
    const config = await getConfig();
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    const result = await chrome.tabs.sendMessage(tabId, { type: "RUN_SCAN", payload: { config } });

    if (result?.type === "SCAN_RESULT") {
      throttleMap.set(tab.url, Date.now());

      const tabWidth = (tab as { width?: number }).width ?? window.screen.width;
      const entry: iObserverEntry = {
        id: uuid(),
        url: tab.url,
        title: tab.title || "",
        timestamp: isoNow(),
        source: "auto",
        violations: result.payload.violations,
        passes: result.payload.passes,
        violationCount: result.payload.violations.reduce(
          (sum: number, v: { nodes: unknown[] }) => sum + v.nodes.length, 0
        ),
        viewportBucket: getViewportBucket(tabWidth, DEFAULT_VIEWPORTS),
      };

      // Add to history
      const history = await getHistory();
      history.unshift(entry);

      // Enforce max cap
      if (history.length > settings.maxHistoryEntries) {
        history.length = settings.maxHistoryEntries;
      }

      await setHistory(history);

      // Notify sidepanel
      chrome.runtime.sendMessage({ type: "OBSERVER_SCAN_COMPLETE", payload: { entry } });
    }
  } catch {
    // Content script injection failed — page may not allow it
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Message Handler
   ═══════════════════════════════════════════════════════════════════ */

export async function handleObserverMessage(
  msg: iMessage,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  switch (msg.type) {
    case "OBSERVER_ENABLE": {
      const state = await getState();
      state.enabled = true;
      await setState(state);
      sendResponse({ type: "OBSERVER_STATE", payload: state });
      break;
    }

    case "OBSERVER_DISABLE": {
      const state = await getState();
      state.enabled = false;
      await setState(state);
      sendResponse({ type: "OBSERVER_STATE", payload: state });
      break;
    }

    case "OBSERVER_GET_STATE": {
      const state = await getState();
      sendResponse({ type: "OBSERVER_STATE", payload: state });
      break;
    }

    case "OBSERVER_UPDATE_SETTINGS": {
      const state = await getState();
      state.settings = { ...state.settings, ...(msg as { payload: Partial<iObserverSettings> }).payload };
      await setState(state);
      sendResponse({ type: "OBSERVER_STATE", payload: state });
      break;
    }

    case "OBSERVER_GET_HISTORY": {
      const history = await getHistory();
      sendResponse({ type: "OBSERVER_HISTORY", payload: history });
      break;
    }

    case "OBSERVER_CLEAR_HISTORY": {
      await setHistory([]);
      throttleMap.clear();
      sendResponse({ success: true });
      break;
    }

    case "OBSERVER_EXPORT_HISTORY": {
      const history = await getHistory();
      sendResponse({ type: "OBSERVER_HISTORY", payload: history });
      break;
    }

    case "OBSERVER_LOG_ENTRY": {
      const entry = (msg as { payload: iObserverEntry }).payload;
      const history = await getHistory();
      history.unshift(entry);
      const state = await getState();
      if (history.length > state.settings.maxHistoryEntries) {
        history.length = state.settings.maxHistoryEntries;
      }
      await setHistory(history);
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: "Unknown observer message" });
  }
}
