/**
 * Side panel entry point. Wires together all modules.
 */

import './sidepanel.css';
import { initTabs } from './tabs';
import { renderResultsTab } from './render-results';
import { renderAriaTab } from './render-aria';
import { initManualReview, renderManualTab } from './manual-review';
import { exportJSON, exportHTML, exportPDF } from './reports';
import { renderScanPresets, getSelectedPresets, clearPresets, selectPreset, deselectPreset } from './scan-presets';
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
import { filterCriteria, axeRuleToWcag } from '@shared/wcag-mapping';

/** Build axe-core WCAG tag filters from version/level dropdowns or config. */
function buildWcagTags(): string[] {
  const version = (getActiveConfig()?.wcagVersion || wcagVersion.value) as string;
  const level = (getActiveConfig()?.wcagLevel || wcagLevel.value) as string;
  const tags: string[] = [];
  const versions = ['2.0', '2.1', '2.2'];
  const levels = ['A', 'AA', 'AAA'];
  for (const v of versions) {
    if (versions.indexOf(v) > versions.indexOf(version)) break;
    for (const l of levels) {
      if (levels.indexOf(l) > levels.indexOf(level)) break;
      const vTag = v === '2.0' ? '2' : v.replace('.', '');
      tags.push(`wcag${vTag}${l.toLowerCase()}`);
    }
  }
  tags.push('best-practice');
  return tags;
}

const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

// Crawl elements
const crawlConfig = document.getElementById('crawl-config') as HTMLDivElement;
const crawlMode = document.getElementById('crawl-mode') as HTMLSelectElement;
const crawlSitemapUrl = document.getElementById('crawl-sitemap-url') as HTMLInputElement;
const crawlUrlListInfo = document.getElementById('crawl-url-list-info') as HTMLDivElement;
const crawlPageCount = document.getElementById('crawl-page-count') as HTMLSpanElement;
const crawlStartBtn = document.getElementById('crawl-start') as HTMLButtonElement;
const crawlActiveBar = document.getElementById('crawl-active-bar') as HTMLDivElement;
const crawlPauseBtn = document.getElementById('crawl-pause') as HTMLButtonElement;
const crawlResumeBtn = document.getElementById('crawl-resume') as HTMLButtonElement;
const crawlRescanBtn = document.getElementById('crawl-rescan') as HTMLButtonElement;
const crawlCancelBtn = document.getElementById('crawl-cancel') as HTMLButtonElement;
const crawlStatusEl = document.getElementById('crawl-status') as HTMLDivElement;
const crawlBar = document.getElementById('crawl-bar') as HTMLDivElement;
const crawlUserWait = document.getElementById('crawl-user-wait') as HTMLDivElement;
const crawlWaitMessage = document.getElementById('crawl-wait-message') as HTMLDivElement;
const crawlWaitUrl = document.getElementById('crawl-wait-url') as HTMLDivElement;
const crawlContinueBtn = document.getElementById('crawl-continue') as HTMLButtonElement;
const crawlRescanWaitBtn = document.getElementById('crawl-rescan-wait') as HTMLButtonElement;
const crawlCancelWaitBtn = document.getElementById('crawl-cancel-wait') as HTMLButtonElement;

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

/** Cached crawl results for export. */
let lastCrawlResults: any = null;

/** Cached crawl page results for re-rendering on toggle. */
let lastCrawlPageResults: any[] = [];
let lastCrawlCompletedCount: number | null = null;
let crawlGroupBy: 'page' | 'wcag' = 'page';

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
      // Flatten violations: each node.target becomes a separate overlay entry
      const flatViolations = [];
      for (const v of (response?.violations || [])) {
        for (const node of (v.nodes || [])) {
          for (const selector of (node.target || [])) {
            flatViolations.push({
              selector: selector.toString(),
              impact: v.impact,
              ruleId: v.id,
              description: v.help,
            });
          }
        }
      }
      await chrome.runtime.sendMessage({
        type: 'SHOW_VIOLATION_OVERLAY',
        violations: flatViolations,
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
      // Auto-select presets based on config
      if (current.scanMode === 'sitemap' || current.scanMode === 'discover' || current.scanMode === 'url-list') {
        selectPreset('site-crawl');
      }
      if (current.viewports && current.viewports.length > 0) {
        selectPreset('multi-viewport');
      }
      populateCrawlFromConfig();
    } else {
      clearPresets();
    }
    renderScanPresets(emptyStateEl, () => {});
  });
  const saved = getActiveConfig();
  if (saved) {
    wcagVersion.value = saved.wcagVersion;
    wcagLevel.value = saved.wcagLevel;
    populateCrawlFromConfig();
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
        scanTimeout: getActiveConfig()?.timing?.scanTimeout || 0,
        wcagTags: buildWcagTags(),
        rulesMode: getActiveConfig()?.rules?.mode || 'all',
        ruleIds: getActiveConfig()?.rules?.ruleIds || [],
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
  // Crawl results export
  if (lastCrawlResults) {
    const json = JSON.stringify(lastCrawlResults, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `A11y-Scan-Crawl-Report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  // Single page export
  const response = getLastScanResponse();
  if (!response) return;
  const url = await getPageUrl();
  const { tabOrder, focusGaps } = await fetchTabOrderAndGaps();
  await exportJSON(response, wcagVersion.value, wcagLevel.value, url, tabOrder, focusGaps, getActiveConfig()?.enrichment as Record<string, boolean> | undefined);
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
  lastCrawlResults = null;
  resetState();
}

/** Renders crawl results into the output area. Called live during crawl and on completion. */
function renderCrawlResults(results: any[], completedCount: number | null): void {
  // Cache for re-rendering on group toggle
  lastCrawlPageResults = results;
  lastCrawlCompletedCount = completedCount;

  const isLive = completedCount === null;
  const header = isLive
    ? `<p class="mb-1 text-sm font-bold text-indigo-800">Crawling — ${results.length} pages so far...</p>`
    : `<p class="mb-1 text-sm font-bold">Site Crawl Results — ${completedCount} pages scanned</p>`;

  // Toggle buttons (only show when not live)
  const toggleHtml = isLive ? '' : `
    <div class="flex gap-1 mb-2">
      <button class="crawl-group-btn px-2 py-0.5 text-[9px] font-bold rounded border cursor-pointer ${crawlGroupBy === 'page' ? 'bg-indigo-950 text-white border-indigo-950' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}" data-group="page">By Page</button>
      <button class="crawl-group-btn px-2 py-0.5 text-[9px] font-bold rounded border cursor-pointer ${crawlGroupBy === 'wcag' ? 'bg-indigo-950 text-white border-indigo-950' : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}" data-group="wcag">By WCAG</button>
    </div>`;

  const criteria = filterCriteria(wcagVersion.value as '2.0' | '2.1' | '2.2', wcagLevel.value as 'A' | 'AA' | 'AAA');

  let html = header + toggleHtml;

  if (crawlGroupBy === 'wcag' && !isLive) {
    // ── Group by WCAG criterion ──
    const wcagMap = new Map<string, { name: string; level: string; impact: string; pages: Map<string, any[]> }>();

    for (const r of results) {
      if (r.status !== 'scanned') continue;
      for (const v of r.violations) {
        const matched = axeRuleToWcag(v.id).filter((c) => criteria.some((fc) => fc.id === c.id));
        const targets = matched.length > 0 ? matched : [{ id: v.id, name: v.help, level: '' }];
        for (const c of targets) {
          if (!wcagMap.has(c.id)) wcagMap.set(c.id, { name: c.name, level: (c as any).level || '', impact: v.impact || '', pages: new Map() });
          const entry = wcagMap.get(c.id)!;
          if (!entry.pages.has(r.url)) entry.pages.set(r.url, []);
          entry.pages.get(r.url)!.push(...(v.nodes || []));
        }
      }
    }

    if (wcagMap.size === 0) {
      html += `<p class="text-xs text-zinc-500 mt-2">No violations found across all pages.</p>`;
    }

    const impactOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    const sorted = Array.from(wcagMap.entries()).sort(([, a], [, b]) => (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4));

    for (const [cId, { name, level, impact, pages }] of sorted) {
      const totalNodes = Array.from(pages.values()).reduce((s, nodes) => s + nodes.length, 0);
      const impactColors: Record<string, string> = { critical: 'border-red-600 bg-red-50', serious: 'border-orange-500 bg-orange-50', moderate: 'border-yellow-500 bg-yellow-50', minor: 'border-blue-400 bg-blue-50' };
      const colors = impactColors[impact] || 'border-zinc-400 bg-zinc-50';
      html += `<details class="my-0.5 border-l-3 ${colors} rounded-r">`;
      html += `<summary class="py-1.5 px-2 text-[11px] cursor-pointer hover:brightness-95">`;
      html += `<strong>${cId}${level ? ` (${level})` : ''}</strong> ${name}`;
      html += ` <span class="text-zinc-500">· ${pages.size} page${pages.size !== 1 ? 's' : ''}, ${totalNodes} element${totalNodes !== 1 ? 's' : ''}</span>`;
      html += `</summary>`;
      html += `<div class="px-2 pb-2 pt-1 space-y-0.5">`;
      for (const [pageUrl, nodes] of pages) {
        html += `<details class="border-l-2 border-zinc-300 bg-white rounded-r">`;
        html += `<summary class="py-1 px-2 text-[10px] cursor-pointer hover:bg-zinc-50 break-all">${pageUrl} <span class="text-zinc-400">(${nodes.length})</span></summary>`;
        html += `<div class="px-2 pb-1.5 space-y-1">`;
        for (const node of nodes) {
          const sel = (node.target || []).join(', ');
          html += `<div class="bg-zinc-50 border border-zinc-200 rounded p-1.5 text-[10px] font-mono">`;
          html += `<div class="flex items-start justify-between gap-1 mb-0.5">`;
          html += `<div class="text-indigo-800 font-semibold truncate">${sel}</div>`;
          html += `<button class="crawl-highlight-btn shrink-0 text-[9px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer underline" data-selector="${sel.replace(/"/g, '&quot;')}" data-url="${pageUrl.replace(/"/g, '&quot;')}">Highlight</button>`;
          html += `</div>`;
          if (node.html) html += `<div class="text-zinc-500 truncate">${node.html.replace(/</g, '&lt;').slice(0, 120)}</div>`;
          html += `</div>`;
        }
        html += `</div></details>`;
      }
      html += `</div></details>`;
    }
  } else {
    // ── Group by Page ──
  for (const r of results) {
    const vCount = r.violations.reduce((sum: number, v: any) => sum + (v.nodes?.length || 0), 0);
    const statusIcon = r.status === 'scanned' ? (vCount > 0 ? '⚠️' : '✅') : r.status === 'redirected' ? '↪️' : '❌';
    const borderColor = vCount > 0 ? 'border-red-600' : r.status === 'failed' ? 'border-zinc-400' : r.status === 'redirected' ? 'border-amber-400' : 'border-green-600';
    const bgColor = vCount > 0 ? 'bg-red-50' : r.status === 'failed' ? 'bg-zinc-50' : r.status === 'redirected' ? 'bg-amber-50' : 'bg-green-50';

    html += `<details class="my-0.5 border-l-3 ${borderColor} ${bgColor} rounded-r">`;
    html += `<summary class="py-1.5 px-2 text-[11px] cursor-pointer hover:brightness-95 list-none flex items-center gap-1">`;
    html += `<span>${statusIcon}</span>`;
    html += `<span class="font-semibold break-all flex-1">${r.url}</span>`;
    html += `<span class="${vCount > 0 ? 'text-red-700 font-bold' : 'text-zinc-500'} shrink-0">${vCount}V</span>`;
    if (r.passes) html += ` <span class="text-green-700 shrink-0">${r.passes}P</span>`;
    if (r.redirectedTo) html += ` <span class="text-amber-600 text-[10px]">→ ${r.redirectedTo}</span>`;
    if (r.error) html += ` <span class="text-red-600 text-[10px]">${r.error}</span>`;
    html += `</summary>`;

    if (r.status !== 'scanned') {
      html += `<div class="px-2 py-1.5 text-[10px] text-zinc-500">${r.status}${r.error ? ': ' + r.error : ''}</div>`;
    } else if (vCount === 0) {
      html += `<div class="px-2 py-1.5 text-[10px] text-green-700">No violations found.</div>`;
    } else {
      // Group violations by WCAG criterion
      const mapped = new Map<string, { name: string; level: string; impact: string; rules: any[] }>();
      for (const v of r.violations) {
        const matched = axeRuleToWcag(v.id).filter((c) => criteria.some((fc) => fc.id === c.id));
        const targets = matched.length > 0 ? matched : [{ id: v.id, name: v.help, level: '' }];
        for (const c of targets) {
          if (!mapped.has(c.id)) mapped.set(c.id, { name: c.name, level: (c as any).level || '', impact: v.impact || '', rules: [] });
          mapped.get(c.id)!.rules.push(v);
        }
      }

      html += `<div class="px-2 pb-2 pt-1 space-y-0.5">`;
      for (const [cId, { name, level, impact, rules }] of mapped) {
        const totalNodes = rules.reduce((s: number, v: any) => s + (v.nodes?.length || 0), 0);
        const impactColors: Record<string, string> = { critical: 'border-red-600 bg-red-50', serious: 'border-orange-500 bg-orange-50', moderate: 'border-yellow-500 bg-yellow-50', minor: 'border-blue-400 bg-blue-50' };
        const colors = impactColors[impact] || 'border-zinc-400 bg-zinc-50';
        html += `<details class="border-l-2 ${colors} rounded-r">`;
        html += `<summary class="py-1 px-2 text-[10px] cursor-pointer hover:brightness-95">`;
        html += `<strong>${cId}${level ? ` (${level})` : ''}</strong> ${name}`;
        html += ` <span class="text-zinc-500">· ${totalNodes} element${totalNodes !== 1 ? 's' : ''}</span>`;
        html += `</summary>`;
        html += `<div class="px-2 pb-1.5 space-y-1">`;
        for (const v of rules) {
          for (const node of (v.nodes || [])) {
            const sel = (node.target || []).join(', ');
            html += `<div class="bg-white border border-zinc-200 rounded p-1.5 text-[10px] font-mono">`;
            html += `<div class="flex items-start justify-between gap-1 mb-0.5">`;
            html += `<div class="text-indigo-800 font-semibold truncate">${sel}</div>`;
            html += `<button class="crawl-highlight-btn shrink-0 text-[9px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer underline" data-selector="${sel.replace(/"/g, '&quot;')}" data-url="${r.url.replace(/"/g, '&quot;')}">Highlight</button>`;
            html += `</div>`;
            if (node.html) html += `<div class="text-zinc-500 truncate">${node.html.replace(/</g, '&lt;').slice(0, 120)}</div>`;
            html += `</div>`;
          }
        }
        html += `</div></details>`;
      }
      html += `</div>`;
    }

    html += `</details>`;
  }
  } // end else (group by page)

  output.innerHTML = html;

  // Wire group toggle buttons
  output.querySelectorAll<HTMLElement>('.crawl-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      crawlGroupBy = btn.dataset.group as 'page' | 'wcag';
      renderCrawlResults(lastCrawlPageResults, lastCrawlCompletedCount);
    });
  });

  // Wire highlight buttons — navigate to page if needed, then highlight
  output.querySelectorAll<HTMLElement>('.crawl-highlight-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selector = btn.dataset.selector;
      const url = btn.dataset.url;
      if (!selector || !url) return;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      if (tab.url !== url) {
        await chrome.tabs.update(tab.id, { url });
        const listener = (tabId: number, info: { status?: string }) => {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(() => chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ELEMENT', selector }).catch(() => {}), 500);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      } else {
        chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ELEMENT', selector }).catch(() => {});
      }
    });
  });
}

// ─── Crawl ───────────────────────────────────────────────────────────────────

crawlMode.addEventListener('change', () => {
  crawlSitemapUrl.hidden = crawlMode.value !== 'sitemap';
  crawlUrlListInfo.hidden = crawlMode.value !== 'url-list';
  updateCrawlUrlListInfo();
});

function updateCrawlUrlListInfo(): void {
  const config = getActiveConfig();
  const urls = config?.pages?.urls || [];
  if (crawlMode.value === 'url-list' && urls.length > 0) {
    crawlUrlListInfo.innerHTML = urls.map((u) => `<div class="truncate">${u}</div>`).join('');
    crawlPageCount.textContent = `${urls.length} URLs`;
  } else if (crawlMode.value === 'url-list') {
    crawlUrlListInfo.innerHTML = '<span class="text-zinc-400 italic">No URLs in config</span>';
    crawlPageCount.textContent = '0 URLs';
  } else {
    crawlPageCount.textContent = 'All pages';
  }
}

function populateCrawlFromConfig(): void {
  const config = getActiveConfig();
  if (!config) return;
  if (config.scanMode === 'single') return;

  // If URLs are already resolved (from sitemap fetch or manual entry), use url-list mode
  const hasUrls = config.pages.urls && config.pages.urls.length > 0;
  const effectiveMode = hasUrls ? 'url-list' : (config.scanMode === 'discover' ? 'discover' : config.scanMode);

  crawlMode.value = effectiveMode;
  crawlSitemapUrl.hidden = effectiveMode !== 'sitemap';
  crawlUrlListInfo.hidden = effectiveMode !== 'url-list';

  if (effectiveMode === 'sitemap' && config.pages.sitemapUrl) {
    crawlSitemapUrl.value = config.pages.sitemapUrl;
  }
  updateCrawlUrlListInfo();
}

crawlStartBtn.addEventListener('click', async () => {
  crawlConfig.hidden = true;
  crawlActiveBar.hidden = false;
  scanBtn.disabled = true;
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
        urls: crawlMode.value === 'url-list' ? (getActiveConfig()?.pages?.urls || []) : undefined,
        autoDiscover: getActiveConfig()?.pages?.autoDiscover ?? true,
        pageRules: getActiveConfig()?.pageRules || [],
        mocks: getActiveConfig()?.mocks || [],
        pageLoadTimeout: getActiveConfig()?.timing?.pageLoadTimeout,
        scanTimeout: getActiveConfig()?.timing?.scanTimeout,
        delayBetweenPages: getActiveConfig()?.timing?.delayBetweenPages,
        crawlScope: getActiveConfig()?.pages?.crawlScope || '',
        wcagTags: buildWcagTags(),
        rulesMode: getActiveConfig()?.rules?.mode || 'all',
        ruleIds: getActiveConfig()?.rules?.ruleIds || [],
        auth: getActiveConfig()?.auth || null,
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
  crawlRescanBtn.hidden = false;
  crawlStatusEl.textContent = 'Paused — interact with the page, then resume or rescan';
});

crawlResumeBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'RESUME_CRAWL' });
  crawlPauseBtn.hidden = false;
  crawlResumeBtn.hidden = true;
  crawlRescanBtn.hidden = true;
});

crawlRescanBtn.addEventListener('click', async () => {
  crawlStatusEl.textContent = 'Rescanning current page...';
  crawlRescanBtn.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'RUN_SCAN', scanTimeout: getActiveConfig()?.timing?.scanTimeout || 0, wcagTags: buildWcagTags(), rulesMode: getActiveConfig()?.rules?.mode || 'all', ruleIds: getActiveConfig()?.rules?.ruleIds || [] });
    }
  } catch { /* ignore */ }
  crawlStatusEl.textContent = 'Rescan complete — resume to continue crawling';
});

crawlCancelBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CANCEL_CRAWL' });
  crawlActiveBar.hidden = true;
  crawlUserWait.hidden = true;
  scanBtn.disabled = false;
  clearBtn.hidden = false;
});

// Page rule wait UI handlers
const WAIT_MESSAGES: Record<string, string> = {
  'login': 'This page requires login. Log in, then click Continue.',
  'interaction': 'This page needs interaction. Make your changes, then click Continue.',
  'deferred-content': 'Waiting for content to load. When ready, click Continue.',
};

crawlContinueBtn.addEventListener('click', async () => {
  crawlUserWait.hidden = true;
  await chrome.runtime.sendMessage({ type: 'USER_CONTINUE' });
});

crawlRescanWaitBtn.addEventListener('click', async () => {
  crawlUserWait.hidden = true;
  // Rescan current page first, then continue
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'RUN_SCAN', scanTimeout: getActiveConfig()?.timing?.scanTimeout || 0, wcagTags: buildWcagTags(), rulesMode: getActiveConfig()?.rules?.mode || 'all', ruleIds: getActiveConfig()?.rules?.ruleIds || [] });
    }
  } catch { /* ignore */ }
  await chrome.runtime.sendMessage({ type: 'USER_CONTINUE' });
});

crawlCancelWaitBtn.addEventListener('click', async () => {
  crawlUserWait.hidden = true;
  await chrome.runtime.sendMessage({ type: 'CANCEL_CRAWL' });
  crawlActiveBar.hidden = true;
  scanBtn.disabled = false;
});

// Listen for crawl progress + movie mode progress
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CRAWL_WAITING_FOR_USER') {
    crawlUserWait.hidden = false;
    crawlWaitMessage.textContent = WAIT_MESSAGES[message.waitType] || 'Waiting for your action.';
    crawlWaitUrl.textContent = message.url || '';
    if (message.description) {
      crawlWaitMessage.textContent += ` (${message.description})`;
    }
  }

  if (message.type === 'CRAWL_PROGRESS' && message.state) {
    const s = message.state;
    const done = s.completed.length + s.failed.length;
    const discovered = s.totalDiscovered + done;
    const unlimited = s.maxPages === 0;
    const limit = unlimited ? discovered : s.maxPages;
    const pct = limit > 0 ? Math.round((done / limit) * 100) : 0;
    crawlBar.style.width = `${Math.min(pct, 100)}%`;
    crawlStatusEl.textContent = `${s.status}: ${done} scanned (depth ${s.depth})${s.current ? ` — ${s.current}` : ''} (${s.failed.length} failed)`;

    // Disable Start Scan during crawl
    if (s.status === 'crawling') {
      scanBtn.disabled = true;
    }

    // Show results as they come in (live update)
    if (s.results && s.results.length > 0) {
      renderCrawlResults(s.results, s.status === 'complete' ? s.completed.length : null);
    }

    if (s.status === 'complete') {
      crawlActiveBar.hidden = true;
      scanBtn.disabled = false;
      clearBtn.hidden = false;

      // Store crawl results for export
      lastCrawlResults = {
        tool: 'A11y Scan',
        toolVersion: '1.0.0',
        type: 'site-crawl',
        origin: s.origin,
        scanDate: new Date().toISOString(),
        wcagVersion: wcagVersion.value,
        wcagLevel: wcagLevel.value,
        summary: {
          pagesScanned: s.completed.length,
          pagesFailed: s.failed.length,
          totalViolations: s.results.reduce((sum: number, r: any) =>
            sum + r.violations.reduce((vs: number, v: any) => vs + (v.nodes?.length || 0), 0), 0),
        },
        pages: s.results.map((r: any) => ({
          url: r.url,
          status: r.status,
          depth: r.depth,
          redirectedTo: r.redirectedTo,
          error: r.error,
          violations: r.violations,
          passes: r.passes,
          incomplete: r.incomplete,
        })),
      };

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
