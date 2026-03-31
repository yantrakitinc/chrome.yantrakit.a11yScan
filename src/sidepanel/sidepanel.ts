/**
 * Side panel entry point. Wires together all modules.
 */

import './sidepanel.css';
import { initTabs } from './tabs';
import { renderResultsTab } from './render-results';
import { renderAriaTab } from './render-aria';
import { initManualReview, renderManualTab } from './manual-review';
import { exportJSON, exportHTML, exportPDF } from './reports';
import {
  requestTabResults,
  triggerScan,
  clearTabResults,
  resetState,
  setManualState,
  setPageElements,
  setLastScanResponse,
  getLastScanResponse,
} from './state';
import type { iAriaWidgetResult } from '@shared/aria-patterns';

const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLDivElement;
const manualListEl = document.getElementById('manual-list') as HTMLDivElement;
const ariaOutput = document.getElementById('aria-output') as HTMLDivElement;
const wcagVersion = document.getElementById('wcag-version') as HTMLSelectElement;
const wcagLevel = document.getElementById('wcag-level') as HTMLSelectElement;
const tabsEl = document.getElementById('tabs') as HTMLDivElement;
const tabResultsEl = document.getElementById('tab-results') as HTMLDivElement;
const tabManualEl = document.getElementById('tab-manual') as HTMLDivElement;
const tabAriaEl = document.getElementById('tab-aria') as HTMLDivElement;
const manualBadge = document.getElementById('manual-badge') as HTMLSpanElement;
const ariaBadge = document.getElementById('aria-badge') as HTMLSpanElement;
const exportBar = document.getElementById('export-bar') as HTMLDivElement;
const exportJsonBtn = document.getElementById('export-json') as HTMLButtonElement;
const exportHtmlBtn = document.getElementById('export-html') as HTMLButtonElement;
const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;

const overlayBar = document.getElementById('overlay-bar') as HTMLDivElement;
const toggleViolationsBtn = document.getElementById('toggle-violations') as HTMLButtonElement;
const toggleTabOrderBtn = document.getElementById('toggle-tab-order') as HTMLButtonElement;
const toggleFocusGapsBtn = document.getElementById('toggle-focus-gaps') as HTMLButtonElement;
const violationToggleIcon = document.getElementById('violation-toggle-icon') as HTMLSpanElement;
const tabOrderToggleIcon = document.getElementById('tab-order-toggle-icon') as HTMLSpanElement;
const focusGapsToggleIcon = document.getElementById('focus-gaps-toggle-icon') as HTMLSpanElement;

const cvdSelect = document.getElementById('cvd-select') as HTMLSelectElement;

const CVD_MATRICES: Record<string, number[]> = {
  protanopia: [0.567,0.433,0, 0.558,0.442,0, 0,0.242,0.758],
  deuteranopia: [0.625,0.375,0, 0.7,0.3,0, 0,0.3,0.7],
  protanomaly: [0.817,0.183,0, 0.333,0.667,0, 0,0.125,0.875],
  deuteranomaly: [0.8,0.2,0, 0.258,0.742,0, 0,0.142,0.858],
  tritanopia: [0.95,0.05,0, 0,0.433,0.567, 0,0.475,0.525],
  tritanomaly: [0.967,0.033,0, 0,0.733,0.267, 0,0.183,0.817],
  achromatopsia: [0.299,0.587,0.114, 0.299,0.587,0.114, 0.299,0.587,0.114],
  achromatomaly: [0.618,0.32,0.062, 0.163,0.775,0.062, 0.163,0.32,0.516],
};

cvdSelect.addEventListener('change', async () => {
  const type = cvdSelect.value;
  const matrix = type ? CVD_MATRICES[type] || null : null;
  try {
    await chrome.runtime.sendMessage({ type: 'APPLY_CVD_FILTER', matrix });
  } catch { /* no content script */ }
});

/** Overlay toggle state. */
let violationOverlayOn = false;
let tabOrderOverlayOn = false;
let focusGapsOverlayOn = false;

/** Cached ARIA widget results for the current scan. */
let ariaWidgets: iAriaWidgetResult[] = [];

/** Reset all overlay toggles to off and hide overlays on the page. */
function resetOverlays(): void {
  if (violationOverlayOn) {
    violationOverlayOn = false;
    updateToggleButton(toggleViolationsBtn, violationToggleIcon, false, 'red');
    chrome.runtime.sendMessage({ type: 'HIDE_VIOLATION_OVERLAY' }).catch(() => {});
  }
  if (tabOrderOverlayOn) {
    tabOrderOverlayOn = false;
    updateToggleButton(toggleTabOrderBtn, tabOrderToggleIcon, false, 'indigo');
    chrome.runtime.sendMessage({ type: 'HIDE_TAB_ORDER' }).catch(() => {});
  }
  if (focusGapsOverlayOn) {
    focusGapsOverlayOn = false;
    updateToggleButton(toggleFocusGapsBtn, focusGapsToggleIcon, false, 'amber');
    chrome.runtime.sendMessage({ type: 'HIDE_FOCUS_GAPS' }).catch(() => {});
  }
}

/**
 * Updates a toggle button's icon and active/inactive style.
 */
function updateToggleButton(
  btn: HTMLButtonElement,
  icon: HTMLSpanElement,
  active: boolean,
  color: 'red' | 'indigo' | 'amber',
): void {
  icon.textContent = active ? '●' : '○';
  if (active) {
    btn.classList.remove(`bg-${color}-50`);
    btn.classList.add(`bg-${color}-200`);
  } else {
    btn.classList.remove(`bg-${color}-200`);
    btn.classList.add(`bg-${color}-50`);
  }
}

toggleViolationsBtn.addEventListener('click', async () => {
  violationOverlayOn = !violationOverlayOn;
  updateToggleButton(toggleViolationsBtn, violationToggleIcon, violationOverlayOn, 'red');
  try {
    if (violationOverlayOn) {
      const response = getLastScanResponse();
      await chrome.runtime.sendMessage({
        type: 'SHOW_VIOLATION_OVERLAY',
        violations: response?.violations || [],
      });
    } else {
      await chrome.runtime.sendMessage({ type: 'HIDE_VIOLATION_OVERLAY' });
    }
  } catch { /* no content script */ }
});

toggleTabOrderBtn.addEventListener('click', async () => {
  tabOrderOverlayOn = !tabOrderOverlayOn;
  updateToggleButton(toggleTabOrderBtn, tabOrderToggleIcon, tabOrderOverlayOn, 'indigo');
  try {
    if (tabOrderOverlayOn) {
      await chrome.runtime.sendMessage({ type: 'SHOW_TAB_ORDER' });
    } else {
      await chrome.runtime.sendMessage({ type: 'HIDE_TAB_ORDER' });
    }
  } catch { /* no content script */ }
});

toggleFocusGapsBtn.addEventListener('click', async () => {
  focusGapsOverlayOn = !focusGapsOverlayOn;
  updateToggleButton(toggleFocusGapsBtn, focusGapsToggleIcon, focusGapsOverlayOn, 'amber');
  try {
    if (focusGapsOverlayOn) {
      await chrome.runtime.sendMessage({ type: 'SHOW_FOCUS_GAPS' });
    } else {
      await chrome.runtime.sendMessage({ type: 'HIDE_FOCUS_GAPS' });
    }
  } catch { /* no content script */ }
});

initTabs(tabsEl, tabResultsEl, tabManualEl, tabAriaEl);
initManualReview(manualListEl, manualBadge, wcagVersion, wcagLevel);

/** Listen for tab changes from background. */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAB_CHANGED') {
    if (message.results) {
      setLastScanResponse(message.results);
      setManualState(message.results._manualState || {});
      setPageElements(message.results.pageElements || {});
      showResults(message.results);
      renderManualTab();
      // Restore cached ARIA results if available
      if (message.results._ariaWidgets) {
        ariaWidgets = message.results._ariaWidgets;
        renderAriaTab(ariaOutput, ariaWidgets);
        updateAriaBadge();
      } else {
        ariaWidgets = [];
        ariaOutput.innerHTML = '';
        updateAriaBadge();
      }
    } else if (message.reason === 'navigated') {
      hideResults();
      output.innerHTML = '<p class="text-xs text-amber-600">Page changed — rescan needed.</p>';
    } else {
      hideResults();
    }
  }
});

/** On side panel load, request current tab's results. */
requestTabResults((results) => {
  if (results) {
    showResults(results);
    renderManualTab();
    // Restore cached ARIA results if available
    if (results._ariaWidgets) {
      ariaWidgets = results._ariaWidgets;
      renderAriaTab(ariaOutput, ariaWidgets);
      updateAriaBadge();
    }
  }
});

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  output.textContent = 'Scanning...';
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;
  tabAriaEl.hidden = true;

  const response = await triggerScan();

  if (response.type === 'SCAN_RESULT') {
    showResults(response);
    renderManualTab();
    // Run ARIA scan after main scan completes
    runAriaScan();
  } else {
    output.textContent = 'Error: ' + (response.message || 'Unknown error');
  }

  scanBtn.disabled = false;
});

clearBtn.addEventListener('click', async () => {
  if (confirm('This will remove all current scan results. Continue?')) {
    await clearTabResults();
    hideResults();
  }
});

/** Returns the current page URL from the last scan response or active tab. */
async function getPageUrl(): Promise<string> {
  const response = getLastScanResponse();
  if (response?.url) return response.url;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || 'unknown';
  } catch {
    return 'unknown';
  }
}

exportJsonBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  exportJSON(response, wcagVersion.value, wcagLevel.value, url);
});

exportHtmlBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  exportHTML(response, wcagVersion.value, wcagLevel.value, url);
});

exportPdfBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  exportPDF(response, wcagVersion.value, wcagLevel.value, url);
});

/**
 * Sends RUN_ARIA_SCAN to the background, stores results, and renders the ARIA tab.
 */
async function runAriaScan(): Promise<void> {
  ariaOutput.innerHTML = '<p class="text-xs text-zinc-400">Scanning ARIA patterns...</p>';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'RUN_ARIA_SCAN' });
    if (response?.type === 'ARIA_SCAN_RESULT') {
      ariaWidgets = response.widgets || [];
    } else {
      ariaWidgets = [];
    }
  } catch {
    ariaWidgets = [];
  }
  renderAriaTab(ariaOutput, ariaWidgets);
  updateAriaBadge();
}

/**
 * Updates the ARIA badge with widget/issue counts.
 */
function updateAriaBadge(): void {
  if (ariaWidgets.length === 0) {
    ariaBadge.textContent = '';
    ariaBadge.hidden = true;
    return;
  }
  ariaBadge.hidden = false;
  const issues = ariaWidgets.filter((w) => w.failCount > 0).length;
  if (issues > 0) {
    ariaBadge.textContent = `${issues}`;
    ariaBadge.classList.remove('bg-zinc-200', 'text-zinc-600');
    ariaBadge.classList.add('bg-red-100', 'text-red-700');
  } else {
    ariaBadge.textContent = `${ariaWidgets.length}`;
    ariaBadge.classList.remove('bg-red-100', 'text-red-700');
    ariaBadge.classList.add('bg-zinc-200', 'text-zinc-600');
  }
}

function showResults(response: any): void {
  const version = wcagVersion.value as '2.0' | '2.1' | '2.2';
  const level = wcagLevel.value as 'A' | 'AA' | 'AAA';
  renderResultsTab(output, response, version, level);
  clearBtn.hidden = false;
  tabsEl.hidden = false;
  exportBar.hidden = false;
  overlayBar.hidden = false;
}

function hideResults(): void {
  output.innerHTML = '';
  manualListEl.innerHTML = '';
  ariaOutput.innerHTML = '';
  ariaWidgets = [];
  updateAriaBadge();
  resetOverlays();
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;
  tabAriaEl.hidden = true;
  tabResultsEl.hidden = false;
  exportBar.hidden = true;
  overlayBar.hidden = true;
  resetState();
}
