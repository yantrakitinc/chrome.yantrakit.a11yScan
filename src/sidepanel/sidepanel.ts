/**
 * Side panel entry point. Wires together all modules.
 */

import './sidepanel.css';
import { initTabs } from './tabs';
import { renderResultsTab } from './render-results';
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

const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLDivElement;
const manualListEl = document.getElementById('manual-list') as HTMLDivElement;
const wcagVersion = document.getElementById('wcag-version') as HTMLSelectElement;
const wcagLevel = document.getElementById('wcag-level') as HTMLSelectElement;
const tabsEl = document.getElementById('tabs') as HTMLDivElement;
const tabResultsEl = document.getElementById('tab-results') as HTMLDivElement;
const tabManualEl = document.getElementById('tab-manual') as HTMLDivElement;
const manualBadge = document.getElementById('manual-badge') as HTMLSpanElement;
const exportBar = document.getElementById('export-bar') as HTMLDivElement;
const exportJsonBtn = document.getElementById('export-json') as HTMLButtonElement;
const exportHtmlBtn = document.getElementById('export-html') as HTMLButtonElement;
const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;

initTabs(tabsEl, tabResultsEl, tabManualEl);
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
  }
});

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  output.textContent = 'Scanning...';
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;

  const response = await triggerScan();

  if (response.type === 'SCAN_RESULT') {
    showResults(response);
    renderManualTab();
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

function showResults(response: any): void {
  const version = wcagVersion.value as '2.0' | '2.1' | '2.2';
  const level = wcagLevel.value as 'A' | 'AA' | 'AAA';
  renderResultsTab(output, response, version, level);
  clearBtn.hidden = false;
  tabsEl.hidden = false;
  exportBar.hidden = false;
}

function hideResults(): void {
  output.innerHTML = '';
  manualListEl.innerHTML = '';
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;
  tabResultsEl.hidden = false;
  exportBar.hidden = true;
  resetState();
}
