/**
 * Side panel entry point. Wires together all modules.
 */

import './sidepanel.css';
import { initTabs } from './tabs';
import { renderResultsTab } from './render-results';
import { renderAriaTab } from './render-aria';
import { initManualReview, renderManualTab } from './manual-review';
import { exportJSON, exportHTML, exportPDF } from './reports';
import { renderScanPresets, getSelectedPresets, clearPresets } from './scan-presets';
import { initConfigPanel, loadSavedConfig, getActiveConfig } from './config-panel';
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

// Crawl elements
const crawlConfig = document.getElementById('crawl-config') as HTMLDivElement;
const crawlMode = document.getElementById('crawl-mode') as HTMLSelectElement;
const crawlSitemapUrl = document.getElementById('crawl-sitemap-url') as HTMLInputElement;
const crawlStartBtn = document.getElementById('crawl-start') as HTMLButtonElement;
const crawlActiveBar = document.getElementById('crawl-active-bar') as HTMLDivElement;
const crawlPauseBtn = document.getElementById('crawl-pause') as HTMLButtonElement;
const crawlResumeBtn = document.getElementById('crawl-resume') as HTMLButtonElement;
const crawlCancelBtn = document.getElementById('crawl-cancel') as HTMLButtonElement;
const crawlStatusEl = document.getElementById('crawl-status') as HTMLDivElement;
const crawlBar = document.getElementById('crawl-bar') as HTMLDivElement;

// Movie mode elements
const movieBar = document.getElementById('movie-bar') as HTMLDivElement;
const moviePlayBtn = document.getElementById('movie-play') as HTMLButtonElement;
const moviePauseBtn = document.getElementById('movie-pause') as HTMLButtonElement;
const movieStopBtn = document.getElementById('movie-stop') as HTMLButtonElement;
const movieSpeed = document.getElementById('movie-speed') as HTMLSelectElement;
const movieProgressEl = document.getElementById('movie-progress') as HTMLSpanElement;
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
const postScanActions = document.getElementById('post-scan-actions') as HTMLDivElement;
const exportJsonBtn = document.getElementById('export-json') as HTMLButtonElement;
const exportHtmlBtn = document.getElementById('export-html') as HTMLButtonElement;
const exportPdfBtn = document.getElementById('export-pdf') as HTMLButtonElement;

const toggleViolationsBtn = document.getElementById('toggle-violations') as HTMLButtonElement;
const toggleTabOrderBtn = document.getElementById('toggle-tab-order') as HTMLButtonElement;
const toggleFocusGapsBtn = document.getElementById('toggle-focus-gaps') as HTMLButtonElement;
const violationToggleIcon = document.getElementById('violation-toggle-icon') as HTMLSpanElement;
const tabOrderToggleIcon = document.getElementById('tab-order-toggle-icon') as HTMLSpanElement;
const focusGapsToggleIcon = document.getElementById('focus-gaps-toggle-icon') as HTMLSpanElement;

const movieModeBtn = document.getElementById('movie-mode-btn') as HTMLButtonElement;
const emptyStateEl = document.getElementById('empty-state') as HTMLDivElement;
const configPanelEl = document.getElementById('config-panel') as HTMLDivElement;
const configGearBtn = document.getElementById('config-gear-btn') as HTMLButtonElement;
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

function updateToggleButton(
  btn: HTMLButtonElement,
  icon: HTMLSpanElement,
  active: boolean,
  color: 'red' | 'indigo' | 'amber',
): void {
  icon.textContent = active ? '✓' : '○';
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

// Initialize config panel (gear icon dropdown — hidden until clicked)
loadSavedConfig().then(() => {
  initConfigPanel(configGearBtn, configPanelEl, (_config) => {
    const current = getActiveConfig();
    if (current) {
      wcagVersion.value = current.wcagVersion;
      wcagLevel.value = current.wcagLevel;
    }
  });
  const saved = getActiveConfig();
  if (saved) {
    wcagVersion.value = saved.wcagVersion;
    wcagLevel.value = saved.wcagLevel;
  }
});

/** Listen for tab changes from background. */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAB_CHANGED') {
    if (message.results) {
      setLastScanResponse(message.results);
      setManualState(message.results._manualState || {});
      setPageElements(message.results.pageElements || {});
      showResults(message.results);
      renderManualTab();
      if (message.results._ariaWidgets) {
        ariaWidgets = message.results._ariaWidgets;
        renderAriaTab(ariaOutput, ariaWidgets);
        updateAriaBadge();
      } else {
        ariaWidgets = [];
        ariaOutput.innerHTML = '';
        updateAriaBadge();
      }
    } else {
      hideResults();
    }
  }
  // TAB_NAVIGATED: page changed within the same tab — do NOT clear results
});

/** On side panel load, request current tab's results. */
requestTabResults((results) => {
  if (results) {
    showResults(results);
    renderManualTab();
    if (results._ariaWidgets) {
      ariaWidgets = results._ariaWidgets;
      renderAriaTab(ariaOutput, ariaWidgets);
      updateAriaBadge();
    }
  } else {
    renderScanPresets(emptyStateEl, () => {});
  }
});

/** Builds a clickable/expandable violation item for multi-viewport results. */
function buildClickableViolation(v: any, color: 'red' | 'amber'): string {
  const borderColor = color === 'red' ? 'border-red-600' : 'border-amber-500';
  const bgColor = color === 'red' ? 'bg-red-50' : 'bg-amber-50';
  const nodes = (v.nodes || []).map((n: any) => {
    const selector = (n.target || []).join(', ');
    return `<div class="mv-node mt-1 py-1 px-2 bg-white rounded border border-zinc-200 cursor-pointer hover:bg-indigo-50 transition-colors" data-selector="${selector.replace(/"/g, '&quot;')}">
      <div class="text-[10px] font-mono text-indigo-800 truncate">${selector}</div>
      <div class="text-[9px] text-zinc-500 truncate">${(n.html || '').replace(/</g, '&lt;').slice(0, 120)}</div>
      ${n.failureSummary ? `<div class="text-[9px] text-red-600 mt-0.5">${n.failureSummary.replace(/</g, '&lt;').split('\n')[0]}</div>` : ''}
    </div>`;
  }).join('');

  return `<details class="my-0.5 border-l-3 ${borderColor} ${bgColor} rounded-r">
    <summary class="py-1 px-2 text-[11px] cursor-pointer hover:bg-white/50 transition-colors">
      <strong>${v.id}</strong> (${v.impact}) — ${v.help}
      <span class="text-[9px] text-zinc-500 ml-1">${v.nodes?.length || 0} element(s)</span>
    </summary>
    <div class="px-2 pb-1.5">${nodes}</div>
  </details>`;
}

/** Wires click handlers on violation nodes to highlight elements on the page. */
function wireViolationClicks(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.mv-node').forEach((node) => {
    node.addEventListener('click', () => {
      const selector = node.dataset.selector;
      if (selector) {
        chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ELEMENT', selector }).catch(() => {});
      }
    });
  });
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  emptyStateEl.hidden = true;
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;
  tabAriaEl.hidden = true;

  const presets = getSelectedPresets();
  const useSiteCrawl = presets.has('site-crawl');
  const useMultiViewport = presets.has('multi-viewport');

  // Site Crawl mode — show crawl config
  if (useSiteCrawl) {
    crawlConfig.hidden = false;
    scanBtn.disabled = false;
    return;
  }

  // Multi-Viewport mode
  if (useMultiViewport) {
    const config = getActiveConfig();
    const customViewports = config?.viewports;
    const vpLabels = customViewports
      ? customViewports.map((v) => `${v.width}px`).join(', ')
      : '375px, 768px, 1280px';
    output.textContent = `Scanning viewports (${vpLabels})...`;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'MULTI_VIEWPORT_SCAN',
        viewports: customViewports || undefined,
      });
      if (result?.type === 'MULTI_VIEWPORT_RESULT') {
        let html = '<p class="mb-2 text-sm font-bold">Multi-Viewport Results</p>';
        if (result.allViewports.length > 0) {
          html += `<h3 class="text-sm font-bold text-red-600 mb-1">All Viewports (${result.allViewports.length})</h3>`;
          for (const v of result.allViewports) {
            html += buildClickableViolation(v, 'red');
          }
        }
        for (const vp of result.viewportSpecific) {
          if (vp.violations.length > 0) {
            html += `<h3 class="text-sm font-bold text-amber-600 mb-1 mt-2">${vp.label} Only — ${vp.width}px (${vp.violations.length})</h3>`;
            for (const v of vp.violations) {
              html += buildClickableViolation(v, 'amber');
            }
          }
        }
        output.innerHTML = html;
        wireViolationClicks(output);
        clearBtn.hidden = false;
        postScanActions.hidden = false;
      } else {
        output.textContent = 'Error: ' + (result?.message || 'Multi-viewport scan failed');
      }
    } catch (err) {
      output.textContent = 'Error: ' + String(err);
    }

    scanBtn.disabled = false;
    return;
  }

  // Standard single-page scan
  output.textContent = 'Scanning...';
  const response = await triggerScan();

  if (response.type === 'SCAN_RESULT') {
    showResults(response);
    renderManualTab();
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

async function fetchTabOrderAndGaps() {
  let tabOrder = null;
  let focusGaps = null;
  try {
    const toRes = await chrome.runtime.sendMessage({ type: 'GET_TAB_ORDER' });
    if (toRes?.entries) {
      const entries = toRes.entries;
      tabOrder = {
        total: entries.filter((e: any) => e.index > 0).length,
        positiveTabindex: entries.filter((e: any) => e.tabindex > 0).length,
        sequence: entries,
      };
    }
  } catch {}
  try {
    const fgRes = await chrome.runtime.sendMessage({ type: 'GET_FOCUS_GAPS' });
    if (fgRes?.gaps) focusGaps = fgRes.gaps;
  } catch {}
  return { tabOrder, focusGaps };
}

exportJsonBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  const { tabOrder, focusGaps } = await fetchTabOrderAndGaps();
  await exportJSON(response, wcagVersion.value, wcagLevel.value, url, tabOrder, focusGaps);
});

exportHtmlBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  const { tabOrder, focusGaps } = await fetchTabOrderAndGaps();
  exportHTML(response, wcagVersion.value, wcagLevel.value, url, tabOrder, focusGaps);
});

exportPdfBtn.addEventListener('click', async () => {
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  const { tabOrder, focusGaps } = await fetchTabOrderAndGaps();
  exportPDF(response, wcagVersion.value, wcagLevel.value, url, tabOrder, focusGaps);
});

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
  emptyStateEl.hidden = true;
  clearBtn.hidden = false;
  tabsEl.hidden = false;
  postScanActions.hidden = false;
}

function hideResults(): void {
  output.innerHTML = '';
  manualListEl.innerHTML = '';
  ariaOutput.innerHTML = '';
  ariaWidgets = [];
  updateAriaBadge();
  resetOverlays();
  emptyStateEl.hidden = false;
  renderScanPresets(emptyStateEl, () => {});
  clearBtn.hidden = true;
  tabsEl.hidden = true;
  tabManualEl.hidden = true;
  tabAriaEl.hidden = true;
  tabResultsEl.hidden = false;
  postScanActions.hidden = true;
  movieBar.hidden = true;
  movieModeActive = false;
  movieModeBtn.classList.remove('bg-indigo-200');
  resetState();
}

// ─── Crawl ───────────────────────────────────────────────────────────────────

crawlMode.addEventListener('change', () => {
  crawlSitemapUrl.hidden = crawlMode.value !== 'sitemap';
});

crawlStartBtn.addEventListener('click', async () => {
  crawlConfig.hidden = true;
  crawlActiveBar.hidden = false;
  crawlPauseBtn.hidden = false;
  crawlResumeBtn.hidden = true;
  crawlStatusEl.textContent = 'Starting crawl...';

  try {
    await chrome.runtime.sendMessage({
      type: 'START_CRAWL',
      options: {
        mode: crawlMode.value,
        maxPages: getActiveConfig()?.pages?.maxPages || 0,
        sitemapUrl: crawlMode.value === 'sitemap' ? crawlSitemapUrl.value : undefined,
      },
    });
  } catch (err) {
    crawlStatusEl.textContent = 'Error: ' + String(err);
  }
});

crawlPauseBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'PAUSE_CRAWL' });
  crawlPauseBtn.hidden = true;
  crawlResumeBtn.hidden = false;
  crawlStatusEl.textContent = 'Paused — interact with the page, then resume';
});

crawlResumeBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'RESUME_CRAWL' });
  crawlPauseBtn.hidden = false;
  crawlResumeBtn.hidden = true;
});

crawlCancelBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL_CRAWL' });
  crawlActiveBar.hidden = true;
});

// Listen for crawl progress + movie mode progress
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CRAWL_PROGRESS' && message.state) {
    const s = message.state;
    const done = s.completed.length + s.failed.length;
    const discovered = s.totalDiscovered + done;
    const unlimited = s.maxPages === 0;
    const limit = unlimited ? discovered : s.maxPages;
    const pct = limit > 0 ? Math.round((done / limit) * 100) : 0;
    crawlBar.style.width = `${Math.min(pct, 100)}%`;
    crawlStatusEl.textContent = `${s.status}: ${done} scanned (depth ${s.depth})${s.current ? ` — ${s.current}` : ''} (${s.failed.length} failed)`;

    if (s.status === 'complete') {
      crawlActiveBar.hidden = true;
      let html = `<p class="mb-2 text-sm font-bold">Site Crawl Results — ${s.completed.length} pages scanned</p>`;
      for (const r of s.results) {
        const vCount = r.violations.reduce((sum: number, v: any) => sum + (v.nodes?.length || 0), 0);
        const statusIcon = r.status === 'scanned' ? (vCount > 0 ? '⚠️' : '✅') : r.status === 'redirected' ? '↪️' : '❌';
        const borderColor = vCount > 0 ? 'border-red-600 bg-red-50' : r.status === 'failed' ? 'border-zinc-400 bg-zinc-50' : r.status === 'redirected' ? 'border-amber-400 bg-amber-50' : 'border-green-600 bg-green-50';
        html += `<div class="crawl-result my-0.5 py-1.5 px-2 text-[11px] border-l-3 ${borderColor} rounded-r cursor-pointer hover:brightness-95 transition-all" data-url="${r.url.replace(/"/g, '&quot;')}">`;
        html += `${statusIcon} <strong class="break-all">${r.url}</strong> — ${vCount} violations`;
        if (r.redirectedTo) html += ` <span class="text-amber-600">(→ ${r.redirectedTo})</span>`;
        if (r.error) html += ` <span class="text-red-600">(${r.error})</span>`;
        html += `</div>`;
      }
      output.innerHTML = html;

      // Make crawl results clickable — navigate to that page
      output.querySelectorAll<HTMLElement>('.crawl-result').forEach((el) => {
        el.addEventListener('click', () => {
          const url = el.dataset.url;
          if (url) {
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
              if (tab?.id) chrome.tabs.update(tab.id, { url });
            });
          }
        });
      });

      clearBtn.hidden = false;
      postScanActions.hidden = false;
    }
  }

  // Movie mode progress
  if (message.type === 'MOVIE_PROGRESS' && message.state) {
    const ms = message.state;
    movieProgressEl.textContent = ms.status === 'complete'
      ? `Done — ${ms.totalElements} elements`
      : `Element ${ms.currentIndex} of ${ms.totalElements}`;

    if (ms.status === 'playing') {
      moviePlayBtn.hidden = true;
      moviePauseBtn.hidden = false;
      movieStopBtn.hidden = false;
    } else if (ms.status === 'paused') {
      moviePlayBtn.hidden = false;
      moviePlayBtn.textContent = '▶ Resume';
      moviePauseBtn.hidden = true;
    } else {
      moviePlayBtn.hidden = false;
      moviePlayBtn.textContent = '▶ Play';
      moviePauseBtn.hidden = true;
      movieStopBtn.hidden = true;
    }
  }
});

// ─── Movie Mode ──────────────────────────────────────────────────────────────

let movieModeActive = false;

movieModeBtn.addEventListener('click', () => {
  movieModeActive = !movieModeActive;
  movieBar.hidden = !movieModeActive;
  if (movieModeActive) {
    movieModeBtn.classList.add('bg-indigo-200');
  } else {
    movieModeBtn.classList.remove('bg-indigo-200');
    chrome.runtime.sendMessage({ type: 'STOP_MOVIE_MODE' }).catch(() => {});
  }
});

moviePlayBtn.addEventListener('click', async () => {
  const speed = parseInt(movieSpeed.value) || 1000;
  if (moviePlayBtn.textContent?.includes('Resume')) {
    await chrome.runtime.sendMessage({ type: 'RESUME_MOVIE_MODE' });
  } else {
    await chrome.runtime.sendMessage({ type: 'START_MOVIE_MODE', speed });
  }
});

moviePauseBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'PAUSE_MOVIE_MODE' });
});

movieStopBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'STOP_MOVIE_MODE' });
});

movieSpeed.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: 'SET_MOVIE_SPEED', speed: parseInt(movieSpeed.value) });
});
