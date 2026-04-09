/**
 * Manages per-tab state: scan results, manual review state, page elements.
 * Communicates with the background service worker.
 */

import type { iTestConfig } from '@shared/test-config';

/** Manual review state: criterion ID → 'pass' | 'fail' | 'na' | null */
let manualState: Record<string, string | null> = {};

/** Page elements detected during last scan */
let pageElements: Record<string, boolean> = {};

/** Last scan response */
let lastScanResponse: any = null;

/** Active test config (null = defaults) */
let testConfig: iTestConfig | null = null;

export function getTestConfig(): iTestConfig | null {
  return testConfig;
}

export function setTestConfig(config: iTestConfig | null): void {
  testConfig = config;
}

export function getManualState(): Record<string, string | null> {
  return manualState;
}

export function setManualState(state: Record<string, string | null>): void {
  manualState = state;
}

export function setManualItem(criterionId: string, value: string | null): void {
  manualState[criterionId] = value;
  saveManualState();
}

export function getPageElements(): Record<string, boolean> {
  return pageElements;
}

export function setPageElements(elements: Record<string, boolean>): void {
  pageElements = elements;
}

export function getLastScanResponse(): any {
  return lastScanResponse;
}

export function setLastScanResponse(response: any): void {
  lastScanResponse = response;
}

export function resetState(): void {
  manualState = {};
  pageElements = {};
  lastScanResponse = null;
}

function saveManualState(): void {
  chrome.runtime.sendMessage({
    type: 'SAVE_MANUAL_STATE',
    payload: manualState,
  });
}

/**
 * Requests the current tab's results from the background service worker.
 */
export function requestTabResults(callback: (results: any | null) => void): void {
  chrome.runtime.sendMessage({ type: 'GET_TAB_RESULTS' }, (response) => {
    if (response?.results) {
      lastScanResponse = response.results;
      manualState = response.results._manualState || {};
      pageElements = response.results.pageElements || {};
      callback(response.results);
    } else {
      callback(null);
    }
  });
}

/**
 * Triggers a scan via the background service worker.
 * If a config with pages.urls is active, navigates to that URL first.
 */
export async function triggerScan(): Promise<any> {
  const config = getTestConfig();

  // If config specifies a URL, navigate to it first
  if (config?.pages?.urls && config.pages.urls.length > 0) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { url: config.pages.urls[0] });
      // Wait for page to load
      await new Promise<void>((resolve) => {
        const listener = (tabId: number, info: { status?: string }) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
  }

  const response = await chrome.runtime.sendMessage({
    type: 'SCAN_REQUEST',
    scanTimeout: config?.timing?.scanTimeout || 0,
  });
  if (response.type === 'SCAN_RESULT') {
    lastScanResponse = response;
    manualState = {};
    pageElements = response.pageElements || {};
  }
  return response;
}

/**
 * Clears results for the current tab.
 */
export async function clearTabResults(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'CLEAR_TAB_RESULTS' });
  resetState();
}
