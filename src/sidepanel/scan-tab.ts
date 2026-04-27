/**
 * Scan tab rendering — accordion, action button, results, sub-tabs, toolbar.
 * Source of truth: F01, F02, F03, F04, F09, F10, F12, F19
 */

import { state, updateTabDisabledStates, switchTab, TEST_CONFIG_STORAGE_KEY } from "./sidepanel";
import { getTabOrder, getFocusGaps } from "./kb-tab";
import { openAiChatWithContext } from "./ai-tab";
import { sendMessage } from "@shared/messages";
import type { iScanResult, iAriaWidget, iManualReviewStatus, iObserverEntry, iTestConfig } from "@shared/types";
import { getManualReviewCriteria, getWcagUrl } from "@shared/wcag-mapping";
import { uuid, isoNow, getViewportBucket } from "@shared/utils";

/** Tracks whether the config panel (F13) is currently expanded */
let configPanelOpen = false;

/** Tracks whether the viewport editor (F02) is currently open */
let viewportEditing = false;

/** URL list for urllist crawl mode (F03-AC3) */
let crawlUrlList: string[] = [];

/** Whether the URL list inline panel is open */
let urlListPanelOpen = false;

/** Crawl results view toggle: "page" or "wcag" (F03-AC13) */
let crawlViewMode: "page" | "wcag" = "page";

/** Currently selected crawl mode dropdown value (F03-AC2) */
let _crawlMode: "follow" | "urllist" = "follow";

/**
 * Returns the action button text for every mode × phase combination.
 * Source of truth: F19 Chart 1.
 */
function getActionButtonText(): string {
  const crawling = state.crawlPhase === "crawling" || state.crawlPhase === "wait";
  const scanning = state.scanPhase === "scanning";

  if (crawling) return "Crawling\u2026";
  if (scanning) return "Scanning\u2026";

  const paused = state.crawlPhase === "paused";
  const idle = state.crawlPhase === "idle" && state.scanPhase === "idle";
  const results = state.scanPhase === "results" || state.crawlPhase === "complete";

  // Paused phase — Observer+Crawl or Crawl+Movie: "Scan This Page" only when Observer is on
  if (paused) {
    return state.observer ? "Scan This Page" : "Scan Page";
  }

  // Idle or Results — determine by active mode combination
  if (idle || results) {
    if (state.crawl) return "Start Crawl";
    if (state.observer) return "Scan This Page";
    return "Scan Page";
  }

  return "Scan Page";
}

/** Per-sub-tab scroll positions so re-renders don't yank the user back to top. */
const scanScrollMemory: Record<string, number> = {};
/** Tracks which sub-tab was last rendered so we attribute scroll to the correct
   key — state.scanSubTab is updated BEFORE renderScanTab() runs on tab switch. */
let lastRenderedSubTab: string | null = null;

/** Render the entire Scan tab content */
export function renderScanTab(): void {
  const panel = document.getElementById("panel-scan");
  if (!panel) return;

  // Save scroll for whichever sub-tab was last rendered (the DOM still shows
  // that tab's content at this moment). Restore for the now-active sub-tab.
  const prevScrollEl = document.getElementById("scan-content");
  if (prevScrollEl && lastRenderedSubTab) {
    scanScrollMemory[lastRenderedSubTab] = prevScrollEl.scrollTop;
  }

  const busy = state.scanPhase === "scanning" || state.crawlPhase === "crawling" || state.crawlPhase === "wait";
  const showClear = state.crawlPhase === "paused" || state.crawlPhase === "wait" || state.crawlPhase === "complete" || state.scanPhase === "results";
  const showSubTabs = state.scanPhase === "results" || ["paused", "wait", "complete"].includes(state.crawlPhase);
  const showToolbar = state.scanPhase === "results" || ["crawling", "paused", "wait", "complete"].includes(state.crawlPhase);

  // Button text (F19 Chart 1 — full lookup table)
  const btnText = getActionButtonText();

  panel.innerHTML = `
    <div class="accordion-wrapper">
      ${state.accordionExpanded ? `
        <div class="accordion-toggle" role="group" aria-label="Scan settings">
          <span style="font-size:11px;font-weight:700;color:#92400e">WCAG</span>
          ${renderExpandedToggle(busy)}
        </div>
      ` : `
        <button type="button" class="accordion-toggle" id="accordion-toggle" aria-expanded="false" aria-controls="accordion-body" aria-label="Expand scan settings">
          <span style="font-size:11px;font-weight:700;color:#92400e">WCAG</span>
          ${renderCollapsedToggle()}
        </button>
      `}
      <div class="accordion-body ${state.accordionExpanded ? "" : "collapsed"}" id="accordion-body" ${state.accordionExpanded ? "" : "hidden"}>
        <div class="accordion-body-inner">
          <div class="accordion-content">
            ${renderModeToggles(busy)}
            ${renderMvCheckbox(busy)}
            ${state.crawl ? renderCrawlConfig(busy) : ""}
            ${state.movie ? renderMovieSpeed() : ""}
          </div>
        </div>
      </div>
      <div class="action-area">
        <button id="scan-btn" ${busy ? "disabled" : ""}>${btnText}</button>
        ${showClear ? '<button id="clear-btn">Clear</button>' : ""}
      </div>
    </div>

    ${state.scanPhase === "scanning" ? renderScanProgress() : ""}
    ${(state.crawlPhase === "crawling" || state.crawlPhase === "paused") ? renderCrawlProgress() : ""}
    ${state.crawlPhase === "wait" ? renderPageRuleWait() : ""}
    ${showSubTabs ? renderSubTabs() : ""}

    <div id="scan-content" ${
      state.scanSubTab && showSubTabs
        ? `role="tabpanel" aria-labelledby="subtab-${state.scanSubTab}"`
        : `role="region" aria-label="Scan results"`
    } aria-live="polite" style="flex:1;overflow-y:auto;min-height:0">
      ${renderContent()}
    </div>

    ${showToolbar ? renderToolbar() : ""}
  `;

  // Restore scroll for the now-active sub-tab.
  const nextScrollEl = document.getElementById("scan-content");
  if (nextScrollEl && state.scanSubTab) {
    const remembered = scanScrollMemory[state.scanSubTab];
    if (remembered) nextScrollEl.scrollTop = remembered;
  }
  lastRenderedSubTab = state.scanSubTab || null;

  // Attach event listeners
  attachScanTabListeners();
}

function renderExpandedToggle(busy: boolean): string {
  return `
    <select id="wcag-version" aria-label="WCAG version" ${busy ? "disabled" : ""} style="font-size:12px;padding:4px 6px;border:1px solid #d4d4d8;border-radius:4px;font-weight:600">
      <option ${state.wcagVersion === "2.2" ? "selected" : ""}>2.2</option>
      <option ${state.wcagVersion === "2.1" ? "selected" : ""}>2.1</option>
      <option ${state.wcagVersion === "2.0" ? "selected" : ""}>2.0</option>
    </select>
    <select id="wcag-level" aria-label="Conformance level" ${busy ? "disabled" : ""} style="font-size:12px;padding:4px 6px;border:1px solid #d4d4d8;border-radius:4px;font-weight:600">
      <option ${state.wcagLevel === "AA" ? "selected" : ""}>AA</option>
      <option ${state.wcagLevel === "A" ? "selected" : ""}>A</option>
      <option ${state.wcagLevel === "AAA" ? "selected" : ""}>AAA</option>
    </select>
    <div style="display:flex;align-items:center;gap:2px">
      <button id="settings-btn" aria-label="Test configuration" aria-expanded="${configPanelOpen}" ${busy ? "disabled" : ""} style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:${configPanelOpen ? "#fef3c7" : "none"};cursor:pointer;border-radius:4px;color:${state.testConfig ? "#d97706" : "#71717a"}">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/></svg>
      </button>
      ${state.testConfig ? '<span style="font-size:10px;font-weight:700;color:#d97706;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;padding:1px 5px;white-space:nowrap">Config loaded</span>' : ""}
    </div>
    <button id="reset-btn" aria-label="Reset all settings" ${busy ? "disabled" : ""} style="font-size:11px;font-weight:700;color:#dc2626;background:none;border:1px solid #fecaca;border-radius:4px;cursor:pointer;min-height:24px;padding:4px 10px">Reset</button>
    <button id="collapse-btn" aria-label="Collapse settings" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;border-radius:4px;color:#71717a;margin-left:auto">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5l4-4 4 4"/></svg>
    </button>
  `;
}

function renderCollapsedToggle(): string {
  const modes = [
    state.crawl && "Crawl",
    state.observer && "Observer",
    state.movie && "Movie",
    state.mv && "Multi-Viewport",
  ].filter(Boolean);

  const modeColors: Record<string, string> = {
    Crawl: "background:#e0f2fe;color:#0c4a6e",
    Observer: "background:#d1fae5;color:#064e3b",
    Movie: "background:#ede9fe;color:#4c1d95",
    "Multi-Viewport": "background:#fef3c7;color:#92400e",
  };
  let modeHtml = "";
  if (modes.length === 0) {
    modeHtml = '<span style="font-size:11px;color:#71717a">Single page</span>';
  } else if (modes.length <= 2) {
    modeHtml = modes.map((m) => `<span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;${modeColors[m as string] || "background:#e4e4e7;color:#3f3f46"}">${m}</span>`).join(" ");
  } else {
    modeHtml = `<span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:#e4e4e7;color:#3f3f46">${modes.length} modes</span>`;
  }

  return `
    <span style="font-size:11px;font-weight:600;color:#3f3f46">${state.wcagVersion} ${state.wcagLevel}</span>
    ${modeHtml}
    <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#71717a;margin-left:auto">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>
    </span>
  `;
}

function renderModeToggles(busy: boolean): string {
  return `
    <div class="mode-row">
      <button class="mode-btn mode-crawl" aria-pressed="${state.crawl}" ${busy ? "disabled" : ""} data-mode="crawl">Crawl</button>
      <button class="mode-btn mode-observe" disabled style="opacity:0.4;cursor:not-allowed;position:relative" title="Coming soon">Observe<span style="font-size:8px;font-weight:800;color:#b45309;position:absolute;top:-2px;right:-2px;background:#fef3c7;border:1px solid #fcd34d;border-radius:3px;padding:0 3px;line-height:1.4">SOON</span></button>
      <button class="mode-btn mode-movie" aria-pressed="${state.movie}" ${busy ? "disabled" : ""} data-mode="movie">Movie</button>
    </div>
  `;
}

function renderMvCheckbox(busy: boolean): string {
  const chipsRow = state.mv
    ? state.mv && viewportEditing
      ? `<div style="padding-left:24px;margin-top:4px">
          <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px">
            ${state.viewports.map((v, i) => `
              <input type="number" min="320" value="${v}" data-index="${i}" class="vp-input" aria-label="Viewport ${i + 1} width in pixels"
                style="width:60px;font-size:11px;font-family:monospace;font-weight:600;padding:2px 4px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#27272a;min-height:24px;box-sizing:border-box">
              <button type="button" class="vp-remove" data-index="${i}" aria-label="Remove ${v}px viewport"
                style="font-size:12px;font-weight:700;line-height:1;padding:2px 5px;min-height:24px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#52525b;cursor:pointer"
                ${state.viewports.length <= 1 ? "disabled" : ""}>×</button>
            `).join("")}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button type="button" id="vp-add"
              style="font-size:11px;font-weight:700;padding:2px 8px;min-height:24px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#27272a;cursor:pointer"
              ${state.viewports.length >= 6 ? "disabled" : ""}>+ add</button>
            <button type="button" id="vp-done"
              style="font-size:11px;font-weight:700;padding:2px 8px;min-height:24px;border:1px solid #d97706;border-radius:4px;background:#fef3c7;color:#92400e;cursor:pointer">done</button>
          </div>
        </div>`
      : `<div style="display:flex;align-items:center;gap:4px;padding-left:24px;flex-wrap:wrap">
          ${state.viewports.map((v) => `<span style="font-size:11px;font-family:monospace;font-weight:600;color:#3f3f46;background:#fff;border:1px solid #d4d4d8;border-radius:4px;padding:2px 6px">${v}</span>`).join("")}
          <button type="button" id="vp-edit"
            style="font-size:11px;font-weight:700;padding:1px 6px;min-height:24px;border:none;background:none;color:#4338ca;cursor:pointer;text-decoration:underline">edit</button>
        </div>`
    : "";

  return `
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;${busy ? "opacity:0.4;pointer-events:none" : ""}">
      <input type="checkbox" id="mv-check" ${state.mv ? "checked" : ""} ${busy ? "disabled" : ""} style="width:16px;height:16px;accent-color:#d97706;cursor:pointer">
      <span style="font-size:12px;font-weight:600;color:#27272a">Multi-Viewport</span>
    </label>
    ${chipsRow}
  `;
}

function renderCrawlConfig(busy: boolean): string {
  const urlCount = crawlUrlList.length;
  const urlListBtn = _crawlMode === "urllist"
    ? `<button type="button" id="url-list-open"
        style="font-size:11px;font-weight:700;padding:3px 10px;min-height:24px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#27272a;cursor:pointer;margin-top:4px">
        ${urlCount === 0 ? "Set up URL list" : `${urlCount} URL${urlCount === 1 ? "" : "s"} \u2014 Edit list`}
      </button>`
    : "";

  const panel = (_crawlMode === "urllist" && urlListPanelOpen) ? renderUrlListPanel() : "";

  return `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:600;color:#52525b">Crawl mode</span>
      <select id="crawl-mode" aria-label="Crawl mode" ${busy ? "disabled" : ""} style="flex:1;font-size:12px;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;font-weight:600">
        <option value="follow" ${_crawlMode === "follow" ? "selected" : ""}>Follow all links</option>
        <option value="urllist" ${_crawlMode === "urllist" ? "selected" : ""}>URL list</option>
      </select>
    </div>
    ${urlListBtn}
    ${panel}
  `;
}

function renderUrlListPanel(): string {
  const listRows = crawlUrlList.map((url, i) => `
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
      <input type="text" readonly value="${escHtmlConfig(url)}"
        style="flex:1;font-size:11px;font-family:monospace;padding:3px 6px;border:1px solid #e4e4e7;border-radius:3px;background:#fafafa;color:#27272a;min-width:0">
      <button type="button" class="url-remove-btn" data-index="${i}"
        aria-label="Remove URL"
        style="font-size:12px;font-weight:700;color:#b91c1c;background:none;border:none;cursor:pointer;min-height:24px;padding:0 4px;flex-shrink:0">&times;</button>
    </div>
  `).join("");

  const summary = crawlUrlList.length > 0
    ? `<div style="font-size:11px;font-weight:600;color:#52525b;margin-bottom:6px">${crawlUrlList.length} URL${crawlUrlList.length === 1 ? "" : "s"} will be scanned</div>`
    : "";

  return `
    <div id="url-list-panel" style="margin-top:6px;border:1px solid #d4d4d8;border-radius:6px;background:#fafafa;padding:8px">
      <div style="font-size:11px;font-weight:800;color:#27272a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">URL List</div>

      <div style="margin-bottom:8px">
        <textarea id="url-paste-area" rows="3" aria-label="Paste URLs or sitemap XML" placeholder="Paste URLs (one per line) or sitemap XML (&lt;?xml\u2026)"
          style="width:100%;box-sizing:border-box;font-size:11px;font-family:monospace;padding:6px;border:1px solid #d4d4d8;border-radius:4px;resize:vertical;background:#fff;color:#27272a"></textarea>
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          <button type="button" id="url-paste-add"
            style="font-size:11px;font-weight:700;padding:3px 10px;min-height:24px;border:none;border-radius:4px;background:#f59e0b;color:#1a1000;cursor:pointer">Add from textarea</button>
          <label style="font-size:11px;font-weight:700;padding:3px 10px;min-height:24px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#3f3f46;cursor:pointer;display:flex;align-items:center">
            Upload .txt
            <input type="file" id="url-file-input" accept=".txt,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)">
          </label>
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:8px">
        <input type="url" id="url-manual-input" aria-label="Add URL to crawl list" placeholder="https://example.com/page"
          style="flex:1;font-size:11px;padding:4px 6px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;color:#27272a;min-width:0">
        <button type="button" id="url-manual-add"
          style="font-size:11px;font-weight:700;padding:3px 10px;min-height:24px;border:none;border-radius:4px;background:#f59e0b;color:#1a1000;cursor:pointer;flex-shrink:0">Add</button>
      </div>

      ${summary}
      <div id="url-list-rows" style="max-height:160px;overflow-y:auto">${listRows}</div>

      <button type="button" id="url-list-done"
        style="width:100%;margin-top:8px;font-size:11px;font-weight:800;padding:5px;min-height:24px;border:none;border-radius:4px;background:#f59e0b;color:#1a1000;cursor:pointer">Done</button>
    </div>
  `;
}

function renderMovieSpeed(): string {
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:600;color:#52525b">Movie speed</span>
      <select id="movie-speed" aria-label="Movie playback speed" style="font-size:12px;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;font-weight:600">
        <option value="0.5">0.5&times;</option>
        <option value="1" selected>1&times;</option>
        <option value="2">2&times;</option>
        <option value="4">4&times;</option>
      </select>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   Test Configuration Panel (F13)
   ═══════════════════════════════════════════════════════════════════ */

let dialogReturnFocus: HTMLElement | null = null;

function openConfigDialog(): void {
  const dialog = document.getElementById("config-dialog") as HTMLDialogElement | null;
  const content = document.getElementById("config-dialog-content");
  if (!dialog || !content) return;
  // Save focus to restore after dialog closes
  dialogReturnFocus = (document.activeElement as HTMLElement) || null;

  const configJson = state.testConfig ? JSON.stringify(state.testConfig, null, 2) : "";
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;font-weight:800;color:#27272a;text-transform:uppercase;letter-spacing:0.05em">Test Configuration</span>
      <button id="config-close-btn" aria-label="Close" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;color:#71717a;border-radius:4px">
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
    </div>
    <a href="https://a11yscan.yantrakit.com/tools/test-config-builder" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:#4338ca;text-decoration:none">Open Builder ↗</a>
    <textarea id="config-textarea" aria-label="Paste config JSON here" placeholder='Paste JSON config here, e.g. {\n  "wcag": { "version": "2.1", "level": "AA" }\n}' style="width:100%;box-sizing:border-box;font-size:11px;font-family:monospace;padding:8px;border:1px solid ${state.testConfig ? "#fcd34d" : "#d4d4d8"};border-radius:4px;resize:vertical;min-height:100px;background:#fff;color:#27272a;line-height:1.5">${escHtmlConfig(configJson)}</textarea>
    <div id="config-error" role="alert" aria-live="polite" style="font-size:11px;color:#b91c1c;display:none"></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <button id="config-apply-btn" style="padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px;flex:1">Apply</button>
      <label id="config-upload-label" style="padding:4px 10px;font-size:11px;font-weight:700;color:#3f3f46;background:#fff;border:1px solid #d4d4d8;border-radius:4px;cursor:pointer;min-height:24px;display:flex;align-items:center">
        Upload .json
        <input type="file" id="config-file-input" accept=".json,application/json" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-label="Upload JSON config file">
      </label>
      ${state.testConfig ? '<button id="config-clear-btn" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;background:none;border:1px solid #fecaca;border-radius:4px;cursor:pointer;min-height:24px">Clear Config</button>' : ""}
    </div>
  `;

  dialog.showModal();
  // Focus textarea instead of the first link
  const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
  if (textarea) textarea.focus();
  attachConfigDialogListeners(dialog);
}

let configDialogGlobalListenersAttached = false;
function attachConfigDialogListeners(dialog: HTMLDialogElement): void {
  // Close button — re-rendered each open so this listener attaches to a fresh element each time
  document.getElementById("config-close-btn")?.addEventListener("click", () => {
    dialog.close();
  });

  // Backdrop + close listeners attach ONCE at first open (avoid stacking across opens)
  if (!configDialogGlobalListenersAttached) {
    configDialogGlobalListenersAttached = true;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      configPanelOpen = false;
      renderScanTab();
      if (dialogReturnFocus && document.contains(dialogReturnFocus)) {
        dialogReturnFocus.focus();
      } else {
        document.getElementById("settings-btn")?.focus();
      }
      dialogReturnFocus = null;
    });
  }

  // Apply (F13-AC1, AC3, AC4, AC5)
  document.getElementById("config-apply-btn")?.addEventListener("click", () => {
    const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
    const errorEl = document.getElementById("config-error") as HTMLElement | null;
    if (!textarea || !errorEl) return;

    const text = textarea.value.trim();
    if (!text) {
      errorEl.textContent = "Paste JSON config or upload a .json file first.";
      errorEl.style.display = "block";
      return;
    }

    try {
      const config = validateTestConfig(text);
      state.testConfig = config;
      chrome.storage.local.set({ [TEST_CONFIG_STORAGE_KEY]: config });
      errorEl.style.display = "none";
      dialog.close();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      errorEl.style.display = "block";
    }
  });

  // File upload (F13-AC2)
  document.getElementById("config-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = typeof reader.result === "string" ? reader.result : "";
      }
    };
    reader.readAsText(file);
    input.value = "";
  });

  // Clear Config (F13-AC7)
  document.getElementById("config-clear-btn")?.addEventListener("click", () => {
    state.testConfig = null;
    chrome.storage.local.remove(TEST_CONFIG_STORAGE_KEY);
    dialog.close();
  });
}

function escHtmlConfig(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderScanProgress(): string {
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#52525b;font-family:monospace">${state.mv ? `viewport ${state.mvProgress ? `${state.mvProgress.current}/${state.mvProgress.total}` : `1/${state.viewports.length}`}` : "analyzing page\u2026"}</span>
        <button id="cancel-scan" aria-label="Cancel scan" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;color:#dc2626">
          <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
        </button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:60%;animation:pulse 1.5s ease infinite"></div></div>
    </div>
  `;
}

function renderCrawlProgress(): string {
  const { pagesVisited, pagesTotal, currentUrl } = state.crawlProgress;
  const pageLabel = pagesTotal > 0 ? `${pagesVisited}/${pagesTotal} pages` : "scanning\u2026";
  const urlDisplay = currentUrl
    ? (() => { try { return new URL(currentUrl).pathname || currentUrl; } catch { return currentUrl; } })()
    : "";
  const progressPct = pagesTotal > 0 ? Math.round((pagesVisited / pagesTotal) * 100) : 42;
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;align-items:center;margin-bottom:4px;gap:8px">
        <span style="font-size:11px;font-weight:700;color:#52525b;font-family:monospace;flex-shrink:0">${pageLabel}</span>
        ${urlDisplay ? `<span style="font-size:10px;color:#71717a;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="${currentUrl}">${urlDisplay}</span>` : ""}
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${state.crawlPhase === "crawling"
            ? '<button id="pause-crawl" aria-label="Pause crawl" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #d4d4d8;border-radius:4px;background:none;cursor:pointer;color:#52525b"><svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><rect width="3" height="10" rx=".5"/><rect x="5" width="3" height="10" rx=".5"/></svg></button>'
            : '<button id="resume-crawl" aria-label="Resume crawl" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #d4d4d8;border-radius:4px;background:none;cursor:pointer;color:#52525b"><svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><path d="M0 0l8 5-8 5z"/></svg></button>'
          }
          <button id="cancel-crawl" aria-label="Cancel crawl" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;color:#dc2626">
            <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
          </button>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%${state.crawlPhase === "crawling" ? ";animation:pulse 1.5s ease infinite" : ""}"></div></div>
    </div>
  `;
}

function renderPageRuleWait(): string {
  return `
    <div style="padding:8px 12px;border-bottom:2px solid #fbbf24;background:#fffbeb;flex-shrink:0">
      <div style="font-size:11px;font-weight:700;color:#78350f;margin-bottom:6px">\u26a0 Page rule triggered</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="continue-crawl" style="padding:4px 10px;font-size:11px;font-weight:700;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">Continue</button>
        <button id="scan-then-continue" style="padding:4px 10px;font-size:11px;font-weight:700;color:#3f3f46;background:#fff;border:1px solid #d4d4d8;border-radius:4px;cursor:pointer;min-height:24px">Scan page, then continue</button>
        <button id="cancel-wait" style="font-size:11px;font-weight:700;color:#dc2626;background:none;border:1px solid #fecaca;border-radius:4px;cursor:pointer;margin-left:auto;padding:4px 10px;min-height:24px">Cancel</button>
      </div>
    </div>
  `;
}

function renderSubTabs(): string {
  const tabs = ["results", "manual", "aria"];
  if (state.observer) tabs.push("observe");
  return `
    <div class="sub-tabs" role="tablist" aria-label="Scan results sections">
      ${tabs.map((t) => {
        const label = t === "results" ? "Results" : t === "manual" ? "Manual" : t === "aria" ? "ARIA" : "Observe";
        const isActive = t === state.scanSubTab;
        return `<button role="tab" id="subtab-${t}" aria-selected="${isActive}" aria-controls="scan-content" tabindex="${isActive ? "0" : "-1"}" class="sub-tab ${isActive ? "active" : ""}" data-subtab="${t}">${label}</button>`;
      }).join("")}
    </div>
  `;
}

function renderContent(): string {
  if (state.scanPhase === "idle" && state.crawlPhase === "idle") {
    return renderEmptyState();
  }
  if (state.scanPhase === "scanning") {
    // Show partial results if available (F01-AC7: results render as soon as they arrive)
    if (state.lastScanResult) return renderResults(state.lastScanResult);
    return '<div style="padding:12px"><div style="font-size:11px;color:#71717a;font-weight:600;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5" stroke="#d4d4d8" stroke-width="2"/><path d="M12 7a5 5 0 00-5-5" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>Analyzing page\u2026</div></div>';
  }

  // Sub-tab content routing
  switch (state.scanSubTab) {
    case "results":
      // Crawl results take precedence over single-page results when present (F03-AC13)
      if (state.crawlResults && Object.keys(state.crawlResults).length > 0) {
        return renderCrawlResults();
      }
      if (state.lastScanResult) return renderResults(state.lastScanResult);
      return "";
    case "manual":
      return renderManualReview();
    case "aria":
      return renderAriaResults();
    case "observe":
      return renderObserveHistory();
    default:
      return "";
  }
}

function renderEmptyState(): string {
  return `
    <div style="padding:16px">
      <h2 style="font-size:14px;font-weight:800;color:#18181b;margin-bottom:4px">Get started</h2>
      <p style="font-size:12px;color:#52525b;line-height:1.5">Click the button above to check this page for accessibility issues.</p>
      <div style="margin-top:16px">
        <h3 style="font-size:11px;font-weight:800;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Scan modes</h3>
        <div style="padding-left:12px;border-left:2px solid #38bdf8;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#18181b">Crawl</div>
          <div style="font-size:11px;color:#52525b;line-height:1.5">Automatically visits every page on your website and checks each one for issues.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid #34d399;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#18181b">Observer</div>
          <div style="font-size:11px;color:#52525b;line-height:1.5">Watches your browsing and checks every page you visit. Everything stays on your computer.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid #a78bfa;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#18181b">Movie</div>
          <div style="font-size:11px;color:#52525b;line-height:1.5">After each scan, shows you how keyboard-only users navigate the page step by step.</div>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   Crawl Results Display (F03-AC13–AC16)
   ═══════════════════════════════════════════════════════════════════ */

function renderCrawlResults(): string {
  const results = state.crawlResults!;
  const failed = state.crawlFailed ?? {};
  const allUrls = [...Object.keys(results), ...Object.keys(failed).filter((u) => !(u in results))];

  const toggle = `
    <div style="display:flex;gap:0;border:1px solid #d4d4d8;border-radius:4px;overflow:hidden;margin-bottom:8px">
      <button type="button" id="crawl-view-page"
        style="flex:1;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;border:none;min-height:24px;background:${crawlViewMode === "page" ? "#fef3c7" : "#fff"};color:${crawlViewMode === "page" ? "#92400e" : "#52525b"}">By page</button>
      <button type="button" id="crawl-view-wcag"
        style="flex:1;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;border:none;border-left:1px solid #d4d4d8;min-height:24px;background:${crawlViewMode === "wcag" ? "#fef3c7" : "#fff"};color:${crawlViewMode === "wcag" ? "#92400e" : "#52525b"}">By WCAG</button>
    </div>
  `;

  const totalViolations = Object.values(results).reduce((sum, r) => sum + r.violations.reduce((s, v) => s + v.nodes.length, 0), 0);
  const totalFailed = Object.keys(failed).length;
  const summary = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:8px;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;text-align:center;margin-bottom:8px">
      <div><div style="font-size:15px;font-weight:800;color:#27272a">${allUrls.length}</div><div style="font-size:10px;font-weight:600;color:#52525b">Pages</div></div>
      <div><div style="font-size:15px;font-weight:800;color:#b91c1c">${totalViolations}</div><div style="font-size:10px;font-weight:600;color:#52525b">Violations</div></div>
      <div><div style="font-size:15px;font-weight:800;color:#dc2626">${totalFailed}</div><div style="font-size:10px;font-weight:600;color:#52525b">Failed</div></div>
    </div>
  `;

  let body = "";
  if (crawlViewMode === "page") {
    body = allUrls.map((url) => {
      const r = results[url];
      const err = failed[url];
      if (err) {
        return `
          <details style="border:1px solid #fecaca;border-radius:4px;margin-bottom:4px;background:#fef2f2">
            <summary style="list-style:none;display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;font-size:11px">
              <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
              <span style="color:#dc2626;font-weight:700;flex-shrink:0">\u2717</span>
              <span style="font-family:monospace;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtmlConfig(url)}">${escHtmlConfig(url)}</span>
            </summary>
            <div style="padding:4px 8px 8px;font-size:11px;color:#b91c1c">${escHtmlConfig(err)}</div>
          </details>
        `;
      }
      const violationCount = r.violations.reduce((s, v) => s + v.nodes.length, 0);
      const passCount = r.passes.length;
      const hasViolations = violationCount > 0;
      return `
        <details style="border:1px solid ${hasViolations ? "#fecaca" : "#a7f3d0"};border-radius:4px;margin-bottom:4px;background:${hasViolations ? "#fef2f2" : "#ecfdf5"}">
          <summary style="list-style:none;display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;font-size:11px">
            <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
            <span style="color:${hasViolations ? "#dc2626" : "#047857"};font-weight:700;flex-shrink:0">${hasViolations ? "\u2717" : "\u2713"}</span>
            <span style="font-family:monospace;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtmlConfig(url)}">${escHtmlConfig(url)}</span>
            <span style="font-size:10px;font-weight:700;color:${hasViolations ? "#b91c1c" : "#047857"};flex-shrink:0">${hasViolations ? violationCount + " issue" + (violationCount === 1 ? "" : "s") : passCount + " pass"}</span>
          </summary>
          <div style="padding:4px 8px 8px">
            ${r.violations.sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact)).map((v) => renderViolation(v)).join("") || '<div style="font-size:11px;color:#047857;padding:4px 0">No violations found.</div>'}
          </div>
        </details>
      `;
    }).join("");
  } else {
    // By WCAG — group all violations across all pages by criterion
    const byCriterion = new Map<string, { violation: iScanResult["violations"][0]; pages: string[] }[]>();
    for (const [url, r] of Object.entries(results)) {
      for (const v of r.violations) {
        const criteria = v.wcagCriteria && v.wcagCriteria.length > 0 ? v.wcagCriteria : [v.id];
        for (const criterion of criteria) {
          if (!byCriterion.has(criterion)) byCriterion.set(criterion, []);
          byCriterion.get(criterion)!.push({ violation: v, pages: [url] });
        }
      }
    }

    if (byCriterion.size === 0) {
      body = '<div style="padding:12px;font-size:12px;color:#047857;font-weight:600;text-align:center">No violations found across all pages.</div>';
    } else {
      body = Array.from(byCriterion.entries()).map(([criterion, entries]) => {
        const totalNodes = entries.reduce((s, e) => s + e.violation.nodes.length, 0);
        const uniquePages = [...new Set(entries.map((e) => e.pages[0]))];
        return `
          <details class="severity-${entries[0].violation.impact}" style="border-radius:0 4px 4px 0;margin-bottom:4px">
            <summary style="list-style:none;display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:11px;cursor:pointer">
              <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
              <b style="color:#18181b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                <a href="https://a11yscan.yantrakit.com/wcag/${criterion}" target="_blank" rel="noopener" style="color:#4338ca;text-decoration:underline">${criterion}</a>
              </b>
              <span style="font-size:10px;color:#52525b;flex-shrink:0">${uniquePages.length} page${uniquePages.length === 1 ? "" : "s"}</span>
              <span style="color:#52525b;font-family:monospace;font-weight:700;flex-shrink:0">${totalNodes}</span>
            </summary>
            <div style="padding:4px 8px 8px">
              ${uniquePages.map((pageUrl) => {
                const pageEntries = entries.filter((e) => e.pages[0] === pageUrl);
                return `
                  <div style="margin-bottom:4px">
                    <div style="font-size:10px;font-family:monospace;color:#52525b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px" title="${escHtmlConfig(pageUrl)}">${escHtmlConfig(pageUrl)}</div>
                    ${pageEntries.map((e) => renderViolation(e.violation)).join("")}
                  </div>
                `;
              }).join("")}
            </div>
          </details>
        `;
      }).join("");
    }
  }

  return `<div style="padding:12px">${toggle}${summary}${body}</div>`;
}

function renderResults(result: iScanResult): string {
  const mvResult = state.lastMvResult;
  const mvFilter = state.mvViewportFilter;

  // Determine which violations to display based on MV filter (F02)
  let displayViolations = result.violations;
  if (mvResult && mvFilter !== null) {
    const perViewportResult = mvResult.perViewport[mvFilter];
    displayViolations = perViewportResult ? perViewportResult.violations : [];
  }

  const totalPasses = result.passes.length;
  const totalRules = displayViolations.length + totalPasses;
  const passRate = totalRules > 0 ? Math.round((totalPasses / totalRules) * 100) : 100;
  const totalViolationNodes = displayViolations.reduce((sum, v) => sum + v.nodes.length, 0);

  // Map of viewport-specific violation id → viewport widths for badge rendering
  const viewportSpecificMap = new Map(mvResult ? mvResult.viewportSpecific.map((v) => [v.id, v.viewports]) : []);

  // MV summary banner and filter chips (F02-AC10, AC11)
  const mvBanner = mvResult ? `
    <div style="padding:6px 10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;margin-bottom:6px;font-size:11px;font-weight:600;color:#92400e">
      Multi-Viewport: ${mvResult.shared.length} shared &middot; ${mvResult.viewportSpecific.length} viewport-specific
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
      <button class="mv-filter-chip" data-mvfilter="all" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;cursor:pointer;min-height:24px;border:1px solid ${mvFilter === null ? "#d97706" : "#d4d4d8"};background:${mvFilter === null ? "#fef3c7" : "#fff"};color:${mvFilter === null ? "#92400e" : "#52525b"}">All</button>
      ${mvResult.viewports.map((vp) => `<button class="mv-filter-chip" data-mvfilter="${vp}" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;cursor:pointer;min-height:24px;border:1px solid ${mvFilter === vp ? "#d97706" : "#d4d4d8"};background:${mvFilter === vp ? "#fef3c7" : "#fff"};color:${mvFilter === vp ? "#92400e" : "#52525b"};font-family:monospace">${vp}px</button>`).join("")}
    </div>
  ` : "";

  return `
    <div style="padding:12px">
      ${mvBanner}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:10px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;text-align:center;margin-bottom:8px">
        <div><div style="font-size:16px;font-weight:800;color:#b91c1c">${totalViolationNodes}</div><div style="font-size:11px;font-weight:600;color:#52525b">Violations</div></div>
        <div><div style="font-size:16px;font-weight:800;color:#047857">${result.passes.length}</div><div style="font-size:11px;font-weight:600;color:#52525b">Passes</div></div>
        <div><div style="font-size:16px;font-weight:800;color:#b45309">${result.incomplete.length}</div><div style="font-size:11px;font-weight:600;color:#52525b">Review</div></div>
        <div><div style="font-size:16px;font-weight:800;color:#3f3f46">${passRate}%</div><div style="font-size:11px;font-weight:600;color:#52525b">Pass rate</div></div>
      </div>

      ${displayViolations
        .sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact))
        .map((v) => {
          const vpWidths = viewportSpecificMap.has(v.id) ? (viewportSpecificMap.get(v.id) ?? null) : null;
          return renderViolation(v, vpWidths);
        })
        .join("")}

      <details style="margin-top:8px">
        <summary style="list-style:none;font-size:12px;font-weight:700;color:#047857;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:6px">
          <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
          ${result.passes.length} rules passed
        </summary>
        <div>
          ${result.passes.map((p) => `
            <details style="border-bottom:1px solid #f4f4f5">
              <summary style="list-style:none;display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;font-size:11px">
                <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
                <span style="font-weight:600;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.id}</span>
                <span style="color:#71717a;flex-shrink:0">${p.wcagCriteria?.join(", ") || ""}</span>
                <span style="color:#047857;font-weight:700;flex-shrink:0">${p.nodes.length}</span>
              </summary>
              <div style="padding:2px 8px 6px 28px">
                <div style="font-size:11px;color:#52525b;margin-bottom:4px">${escHtmlConfig(p.description)}</div>
                ${p.nodes.map((n) => `
                  <div style="font-size:11px;font-family:monospace;color:#047857;padding:2px 8px;margin:1px 0;background:#ecfdf5;border-radius:3px;display:flex;align-items:center;gap:6px;overflow:hidden">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0"><path d="M1 4l2 2 4-4"/></svg>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.selector}</span>
                  </div>
                `).join("")}
              </div>
            </details>
          `).join("")}
        </div>
      </details>
    </div>
  `;
}

function renderViolation(v: iScanResult["violations"][0], viewportWidths: number[] | null = null): string {
  // Viewport-specific badge shown when violation only appears at some widths (F02-AC13)
  const vpBadge = viewportWidths && viewportWidths.length > 0
    ? viewportWidths.map((w) => `<span style="font-size:10px;font-weight:700;font-family:monospace;padding:1px 4px;background:#e0f2fe;color:#0369a1;border-radius:3px;margin-left:2px">${w}px</span>`).join("")
    : "";
  return `
    <details class="severity-${v.impact} sr-details" style="border-radius:0 4px 4px 0;margin-bottom:4px">
      <summary style="list-style:none;display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:11px;cursor:pointer">
        <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
        <b style="color:#18181b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.wcagCriteria?.join(", ") || v.id}${vpBadge}</b>
        <span style="font-weight:700;padding:2px 6px;border-radius:4px;font-size:11px;flex-shrink:0">${v.impact}</span>
        <span style="color:#52525b;font-family:monospace;font-weight:700;flex-shrink:0">${v.nodes.length}</span>
      </summary>
      <div style="padding:4px 8px 8px">
        ${v.wcagCriteria && v.wcagCriteria.length > 0 ? `<div style="margin-bottom:6px">${v.wcagCriteria.map((c) => `<a href="${getWcagUrl(c)}" target="_blank" rel="noopener" style="font-size:11px;font-weight:700;color:#4338ca;text-decoration:underline;margin-right:8px">${c} — Learn more \u2197</a>`).join("")}</div>` : ""}
        ${v.nodes.map((n) => `
          <div style="background:#fff;border:1px solid #e4e4e7;border-radius:4px;padding:6px;margin-bottom:4px;font-size:11px">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <span style="font-family:monospace;font-weight:600;color:#27272a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.selector}</span>
              <button class="highlight-btn" data-selector="${n.selector}" style="font-size:11px;font-weight:700;color:#b45309;background:none;border:none;cursor:pointer;flex-shrink:0;min-height:24px">Highlight</button>
            </div>
            <div style="color:#b91c1c;margin-top:2px">${escHtmlConfig(n.failureSummary)}</div>
            <button class="explain-btn" data-rule="${v.id}" data-description="${escHtmlConfig(v.description)}" style="display:none;font-size:11px;font-weight:700;color:#4338ca;background:none;border:none;cursor:pointer;margin-top:4px;min-height:24px">Chat about it \u2192</button>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   Manual Review (F09)
   ═══════════════════════════════════════════════════════════════════ */

function renderManualReview(): string {
  const criteria = getManualReviewCriteria(state.wcagVersion, state.wcagLevel);
  // Filter by page elements if available
  const pageElements = state.lastScanResult?.pageElements;
  const filtered = pageElements
    ? criteria.filter((c) => {
        if (!c.relevantWhen) return true;
        return pageElements[c.relevantWhen as keyof typeof pageElements];
      })
    : criteria;

  const reviewed = Object.values(state.manualReview).filter((v) => v !== null).length;

  return `
    <div style="padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:#52525b;font-weight:600">${filtered.length} criteria need human review</span>
        <span style="font-size:11px;font-weight:700;color:#b45309">${reviewed} of ${filtered.length} reviewed</span>
      </div>
      ${filtered.map((c) => {
        const status = state.manualReview[c.id] || null;
        return `
          <div style="padding:8px;border:1px solid #e4e4e7;border-radius:4px;background:#fff;margin-bottom:6px" data-criterion="${c.id}">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;font-weight:700;color:#27272a;flex:1;min-width:0">${c.id} ${c.name}</span>
              <div style="display:flex;gap:2px;flex-shrink:0">
                <button class="manual-btn" data-id="${c.id}" data-status="pass" aria-pressed="${status === "pass"}" aria-label="Mark ${c.id} ${c.name} as Pass" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;cursor:pointer;min-height:24px;min-width:24px;border:none;${status === "pass" ? "background:#047857;color:#fff" : "background:#f4f4f5;color:#52525b"}">Pass</button>
                <button class="manual-btn" data-id="${c.id}" data-status="fail" aria-pressed="${status === "fail"}" aria-label="Mark ${c.id} ${c.name} as Fail" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;cursor:pointer;min-height:24px;min-width:24px;border:none;${status === "fail" ? "background:#b91c1c;color:#fff" : "background:#f4f4f5;color:#52525b"}">Fail</button>
                <button class="manual-btn" data-id="${c.id}" data-status="na" aria-pressed="${status === "na"}" aria-label="Mark ${c.id} ${c.name} as Not Applicable" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;cursor:pointer;min-height:24px;min-width:24px;border:none;${status === "na" ? "background:#3f3f46;color:#fff" : "background:#f4f4f5;color:#52525b"}">N/A</button>
              </div>
            </div>
            <div style="font-size:11px;color:#52525b;line-height:1.5;margin-top:4px">${c.manualCheck}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   ARIA Validation (F10)
   ═══════════════════════════════════════════════════════════════════ */

function renderAriaResults(): string {
  const widgets = state.ariaWidgets;
  if (widgets.length === 0) {
    return `
      <div style="padding:16px;text-align:center">
        <div style="font-size:12px;color:#71717a">No ARIA widgets scanned yet.</div>
        <button id="run-aria-scan" style="margin-top:8px;padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">Scan ARIA Patterns</button>
      </div>
    `;
  }

  const issues = widgets.filter((w) => w.failCount > 0);
  const compliant = widgets.filter((w) => w.failCount === 0);

  return `
    <div style="padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:#52525b;font-weight:600">${widgets.length} widgets detected</span>
        <span style="font-size:11px;font-weight:700;color:#b91c1c">${issues.length} issues \u00b7 ${compliant.length} compliant</span>
      </div>
      ${issues.length > 0 ? `<div style="font-size:11px;font-weight:800;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Issues</div>` : ""}
      ${issues.map((w) => renderAriaWidget(w, false)).join("")}
      ${compliant.length > 0 ? `<div style="font-size:11px;font-weight:800;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 4px">Compliant</div>` : ""}
      ${compliant.map((w) => renderAriaWidget(w, true)).join("")}
    </div>
  `;
}

function renderAriaWidget(w: iAriaWidget, pass: boolean): string {
  return `
    <details style="border:1px solid ${pass ? "#a7f3d0" : "#fecaca"};border-radius:4px;background:${pass ? "#ecfdf5" : "#fef2f2"};margin-bottom:4px">
      <summary style="list-style:none;display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer;font-size:11px">
        <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#71717a;transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
        <span style="font-weight:700;padding:2px 6px;border-radius:3px;min-width:50px;text-align:center;${pass ? "background:#a7f3d0;color:#064e3b" : "background:#fecaca;color:#7f1d1d"}">${w.role}</span>
        <span style="font-weight:600;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.label}</span>
        <span style="font-weight:700;${pass ? "color:#047857" : "color:#b91c1c"}">${pass ? "\u2713" : w.failCount + " issues"}</span>
      </summary>
      <div style="padding:4px 8px 8px">
        ${w.checks.filter((c) => !c.pass).map((c) => `
          <div style="font-size:11px;color:#b91c1c;padding:2px 0 2px 8px;border-left:2px solid #fecaca">${c.message}</div>
        `).join("")}
        ${w.checks.filter((c) => c.pass).map((c) => `
          <div style="font-size:11px;color:#047857;padding:2px 0 2px 8px;border-left:2px solid #a7f3d0">${c.message}</div>
        `).join("")}
        <button class="aria-highlight" data-selector="${w.selector}" style="font-size:11px;font-weight:700;color:#b45309;background:none;border:none;cursor:pointer;margin-top:4px;min-height:24px">Highlight on page</button>
      </div>
    </details>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   Observer History (F04)
   ═══════════════════════════════════════════════════════════════════ */

let observerEntries: iObserverEntry[] = [];
let observerLoaded = false;

/** Reset observer cache so next render re-fetches from storage */
export function invalidateObserverCache(): void {
  observerLoaded = false;
}
let observerFilter = "";

function renderObserveHistory(): string {
  // Fetch entries if not loaded yet
  if (!observerLoaded) {
    observerLoaded = true;
    sendMessage({ type: "OBSERVER_GET_HISTORY" }).then((result) => {
      if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
        observerEntries = (result as { payload: iObserverEntry[] }).payload;
        // Targeted update: refresh only the list, not the whole scan tab,
        // so the filter input keeps focus mid-typing.
        const listEl = document.getElementById("observer-list-content");
        if (listEl) listEl.innerHTML = renderObserverListInner();
        else renderScanTab();
      }
    });
  }

  return `
    <div style="padding:12px">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="observer-domain-filter" type="search" placeholder="Filter by domain\u2026" aria-label="Filter by domain" value="${observerFilter}" style="flex:1;font-size:11px;padding:6px 8px;border:1px solid #d4d4d8;border-radius:4px;min-width:0">
        <button id="clear-observer" style="font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;padding:4px 10px;background:none;cursor:pointer;min-height:24px;flex-shrink:0">Clear</button>
        <button id="export-observer" style="font-size:11px;font-weight:700;color:#b45309;border:1px solid #fcd34d;border-radius:4px;padding:4px 10px;background:none;cursor:pointer;min-height:24px;flex-shrink:0">Export</button>
      </div>
      <div id="observer-list-content">${renderObserverListInner()}</div>
    </div>
  `;
}

function renderObserverListInner(): string {
  if (observerEntries.length === 0) {
    return '<div style="font-size:11px;color:#71717a;text-align:center;padding:16px">Observer history will appear here as you browse with Observer mode on. Data stays local to your browser.</div>';
  }
  const filtered = observerFilter
    ? observerEntries.filter((e) => e.url.includes(observerFilter) || (e.title || "").toLowerCase().includes(observerFilter.toLowerCase()))
    : observerEntries;
  if (filtered.length === 0) return '<div style="font-size:11px;color:#71717a;text-align:center;padding:16px">No entries match that domain.</div>';
  return filtered.map((entry) => `
    <div role="button" tabindex="0" aria-label="Open observer entry: ${escHtmlConfig(entry.title || entry.url)}" style="padding:8px;border:1px solid #e4e4e7;border-radius:4px;background:#fff;margin-bottom:4px;cursor:pointer" class="observer-entry" data-url="${entry.url}">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;font-weight:700;color:${entry.violationCount > 0 ? "#b91c1c" : "#047857"};flex-shrink:0">${entry.violationCount}</span>
        <span style="font-size:11px;font-weight:600;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.title || entry.url}</span>
        <span style="font-size:10px;color:#71717a;flex-shrink:0">${entry.source === "auto" ? "auto" : "manual"}</span>
        ${entry.viewportBucket ? `<span style="font-size:10px;color:#0369a1;background:#e0f2fe;padding:1px 4px;border-radius:3px;flex-shrink:0">${entry.viewportBucket}</span>` : ""}
      </div>
      <div style="font-size:10px;color:#71717a;margin-top:2px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.url}</div>
      <div style="font-size:10px;color:#71717a;margin-top:1px">${new Date(entry.timestamp).toLocaleString()}</div>
    </div>
  `).join("");
}

function renderToolbar(): string {
  return `<div class="toolbar">${renderToolbarContent()}</div>`;
}

function renderToolbarContent(): string {
  // HTML/PDF reports are single-page only; crawl-only data has no compatible
  // layout in those formats yet, so disable them when no single-page scan.
  const singlePageScan = !!state.lastScanResult;
  const disabledAttr = singlePageScan ? "" : 'disabled aria-disabled="true" title="Run a single-page scan to enable this export"';
  return `
      <div class="toolbar-row">
        <span class="toolbar-label">Export</span>
        <button class="toolbar-btn" id="export-json">JSON</button>
        <button class="toolbar-btn" id="export-html" ${disabledAttr}>HTML</button>
        <button class="toolbar-btn" id="export-pdf" ${disabledAttr}>PDF</button>
        <button class="toolbar-btn accent" id="export-copy">Copy</button>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">Highlight</span>
        <button class="toolbar-btn${state.violationsOverlayOn ? " active" : ""}" id="toggle-violations" aria-pressed="${state.violationsOverlayOn}" ${state.lastScanResult ? "" : 'disabled aria-disabled="true"'}>Violations</button>
      </div>
  `;
}

function severityOrder(impact: string): number {
  return { critical: 0, serious: 1, moderate: 2, minor: 3 }[impact] ?? 4;
}

/* ═══════════════════════════════════════════════════════════════════
   Test Config Validation (F13)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Validates raw JSON text against the iTestConfig shape.
 * All fields are optional; unknown keys are silently ignored (forward compat).
 * Returns the parsed config on success, or throws with a descriptive message.
 */
function validateTestConfig(jsonText: string): iTestConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    throw new Error("Invalid JSON — " + msg);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Config must be a JSON object, not an array or primitive.");
  }

  const obj = parsed as Record<string, unknown>;

  // wcag
  if ("wcag" in obj && obj.wcag !== undefined) {
    if (typeof obj.wcag !== "object" || obj.wcag === null || Array.isArray(obj.wcag)) {
      throw new Error("wcag must be an object. Got: " + JSON.stringify(obj.wcag));
    }
    const wcag = obj.wcag as Record<string, unknown>;
    if ("version" in wcag && wcag.version !== undefined) {
      if (!["2.0", "2.1", "2.2"].includes(wcag.version as string)) {
        throw new Error("wcag.version must be '2.0', '2.1', or '2.2'. Got: '" + String(wcag.version) + "'");
      }
    }
    if ("level" in wcag && wcag.level !== undefined) {
      if (!["A", "AA", "AAA"].includes(wcag.level as string)) {
        throw new Error("wcag.level must be 'A', 'AA', or 'AAA'. Got: '" + String(wcag.level) + "'");
      }
    }
  }

  // viewports
  if ("viewports" in obj && obj.viewports !== undefined) {
    if (!Array.isArray(obj.viewports)) {
      throw new Error("viewports must be an array of numbers. Got: " + JSON.stringify(obj.viewports));
    }
    for (const v of obj.viewports) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        throw new Error("viewports entries must be positive numbers. Got: " + JSON.stringify(v));
      }
    }
  }

  // timing
  if ("timing" in obj && obj.timing !== undefined) {
    if (typeof obj.timing !== "object" || obj.timing === null || Array.isArray(obj.timing)) {
      throw new Error("timing must be an object. Got: " + JSON.stringify(obj.timing));
    }
    const timing = obj.timing as Record<string, unknown>;
    for (const key of ["pageLoadTimeout", "delayBetweenPages"] as const) {
      if (key in timing && timing[key] !== undefined) {
        if (typeof timing[key] !== "number" || !Number.isFinite(timing[key] as number) || (timing[key] as number) < 0) {
          throw new Error("timing." + key + " must be a non-negative number. Got: " + JSON.stringify(timing[key]));
        }
      }
    }
  }

  // rules
  if ("rules" in obj && obj.rules !== undefined) {
    if (typeof obj.rules !== "object" || obj.rules === null || Array.isArray(obj.rules)) {
      throw new Error("rules must be an object. Got: " + JSON.stringify(obj.rules));
    }
    const rules = obj.rules as Record<string, unknown>;
    for (const key of ["include", "exclude"] as const) {
      if (key in rules && rules[key] !== undefined) {
        if (!Array.isArray(rules[key])) {
          throw new Error("rules." + key + " must be an array of strings. Got: " + JSON.stringify(rules[key]));
        }
        for (const r of rules[key] as unknown[]) {
          if (typeof r !== "string") {
            throw new Error("rules." + key + " entries must be strings. Got: " + JSON.stringify(r));
          }
        }
      }
    }
  }

  // crawl.mode
  if ("crawl" in obj && obj.crawl !== undefined) {
    if (typeof obj.crawl !== "object" || obj.crawl === null || Array.isArray(obj.crawl)) {
      throw new Error("crawl must be an object. Got: " + JSON.stringify(obj.crawl));
    }
    const crawl = obj.crawl as Record<string, unknown>;
    if ("mode" in crawl && crawl.mode !== undefined) {
      if (!["follow", "urllist"].includes(crawl.mode as string)) {
        throw new Error("crawl.mode must be 'follow' or 'urllist'. Got: '" + String(crawl.mode) + "'");
      }
    }
  }

  return obj as iTestConfig;
}

/* ═══════════════════════════════════════════════════════════════════
   Event Listeners
   ═══════════════════════════════════════════════════════════════════ */

function attachScanTabListeners(): void {
  // Accordion toggle
  document.getElementById("accordion-toggle")?.addEventListener("click", () => {
    if (!state.accordionExpanded) {
      state.accordionExpanded = true;
      renderScanTab();
    }
  });
  document.getElementById("collapse-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.accordionExpanded = false;
    renderScanTab();
  });

  // Mode toggles
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "crawl") state.crawl = !state.crawl;
      else if (mode === "observer") {
        state.observer = !state.observer;
        sendMessage(state.observer ? { type: "OBSERVER_ENABLE" } : { type: "OBSERVER_DISABLE" });
        if (state.observer) {
          // Reset observer fetch state so history is re-loaded
          observerLoaded = false;
        }
      }
      else if (mode === "movie") {
        state.movie = !state.movie;
        chrome.storage.local.set({ movie_enabled: state.movie });
      }
      renderScanTab();
    });
  });

  // MV checkbox
  document.getElementById("mv-check")?.addEventListener("change", () => {
    state.mv = !state.mv;
    if (!state.mv) viewportEditing = false;
    renderScanTab();
  });

  // Viewport editor — edit link
  document.getElementById("vp-edit")?.addEventListener("click", () => {
    viewportEditing = true;
    renderScanTab();
  });

  // Viewport editor — done button
  document.getElementById("vp-done")?.addEventListener("click", () => {
    viewportEditing = false;
    renderScanTab();
  });

  // Viewport editor — add button
  document.getElementById("vp-add")?.addEventListener("click", () => {
    if (state.viewports.length >= 6) return;
    const newVal = Math.max(...state.viewports) + 200;
    if (!state.viewports.includes(newVal)) {
      state.viewports = [...state.viewports, newVal].sort((a, b) => a - b);
    }
    renderScanTab();
  });

  // Viewport editor — remove buttons
  document.querySelectorAll<HTMLButtonElement>(".vp-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      if (state.viewports.length <= 1) return;
      state.viewports = state.viewports.filter((_, i) => i !== idx);
      renderScanTab();
    });
  });

  // Viewport editor — input changes
  document.querySelectorAll<HTMLInputElement>(".vp-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.index ?? "0");
      let val = parseInt(input.value) || 320;
      if (val < 320) val = 320;
      const updated = [...state.viewports];
      updated[idx] = val;
      // Dedupe and sort
      const unique = [...new Set(updated)].sort((a, b) => a - b);
      state.viewports = unique;
      renderScanTab();
    });
  });

  // WCAG dropdowns update state (F01-AC19)
  document.getElementById("wcag-version")?.addEventListener("change", (e) => {
    state.wcagVersion = (e.target as HTMLSelectElement).value;
  });
  document.getElementById("wcag-level")?.addEventListener("change", (e) => {
    state.wcagLevel = (e.target as HTMLSelectElement).value;
  });

  // Sub-tab switching (F01-AC17) — click + ARIA tablist arrow keys
  const subTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".sub-tab"));
  subTabs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab as typeof state.scanSubTab;
      if (subtab) {
        state.scanSubTab = subtab;
        renderScanTab();
      }
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
          renderScanTab();
          // Restore focus on the now-rendered tab
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
      updateTabDisabledStates();
      renderScanTab();
      await sendMessage({ type: "START_CRAWL", payload: {
        mode: state.testConfig?.crawl?.mode ?? _crawlMode,
        timeout: state.testConfig?.timing?.pageLoadTimeout ?? 30000,
        delay: state.testConfig?.timing?.delayBetweenPages ?? 1000,
        scope: state.testConfig?.crawl?.scope ?? "",
        urlList: _crawlMode === "urllist" ? [...crawlUrlList] : (state.testConfig?.crawl?.urlList ?? []),
        pageRules: state.testConfig?.pageRules ?? [],
        auth: state.testConfig?.auth ?? undefined,
        testConfig: state.testConfig ?? undefined,
      } });
    } else {
      const wasResults = state.scanPhase === "results";
      state.scanPhase = "scanning";
      if (!wasResults) { state.accordionExpanded = false; }
      // Remove old overlays and highlights before new scan (F05-AC15)
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      updateTabDisabledStates();
      renderScanTab();
      try {
        // Multi-Viewport scan (F02) or standard scan (F01); pass testConfig if active (F13-AC4)
        const result = state.mv
          ? await sendMessage({ type: "MULTI_VIEWPORT_SCAN", payload: { viewports: state.testConfig?.viewports ?? state.viewports, testConfig: state.testConfig ?? undefined } })
          : await sendMessage({ type: "SCAN_REQUEST", payload: { testConfig: state.testConfig ?? undefined } });
        const resType = (result as { type: string })?.type;
        if (resType === "SCAN_RESULT") {
          state.lastScanResult = (result as { payload: iScanResult }).payload;
          state.scanPhase = "results";
        } else if (resType === "MULTI_VIEWPORT_RESULT") {
          // MV scan: store full result and build merged view from shared + all viewport-specific violations
          const mvResult = (result as { payload: import("@shared/types").iMultiViewportResult }).payload;
          state.lastMvResult = mvResult;
          state.mvViewportFilter = null;
          state.mvProgress = null;
          // Build a merged iScanResult: use first viewport metadata + combined violation list
          const firstMvKey = Object.keys(mvResult.perViewport)[0];
          if (firstMvKey) {
            const firstMvResult = mvResult.perViewport[parseInt(firstMvKey)];
            state.lastScanResult = {
              ...firstMvResult,
              violations: [...mvResult.shared, ...mvResult.viewportSpecific] as import("@shared/types").iViolation[],
            };
          }
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
              const scanResult = state.lastScanResult!;
              const viewportWidth = (tab as { width?: number }).width ?? 1280;
              const entry: iObserverEntry = {
                id: uuid(),
                url: tab?.url || "",
                title: tab?.title || "",
                timestamp: isoNow(),
                source: "manual",
                violations: scanResult.violations,
                passes: scanResult.passes,
                violationCount: scanResult.violations.reduce(
                  (sum, v) => sum + v.nodes.length, 0
                ),
                viewportBucket: getViewportBucket(viewportWidth, state.viewports),
              };
              sendMessage({ type: "OBSERVER_LOG_ENTRY", payload: entry });
              observerLoaded = false;
            });
          }
          // Auto-play Movie Mode after scan (F06-AC5)
          if (state.movie) {
            const speedEl = document.getElementById("movie-speed") as HTMLSelectElement | null;
            const speed = speedEl ? parseFloat(speedEl.value) : 1;
            sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
            sendMessage({ type: "START_MOVIE_MODE" });
          }
          // Also run ARIA scan in background
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
      renderScanTab();
    }
  });

  // Clear
  document.getElementById("clear-btn")?.addEventListener("click", () => {
    state.scanPhase = "idle";
    state.crawlPhase = "idle";
    state.lastScanResult = null;
    state.lastMvResult = null;
    state.mvViewportFilter = null;
    state.mvProgress = null;
    state.accordionExpanded = true;
    state.scanSubTab = "results";
    state.ariaWidgets = [];
    state.manualReview = {};
    state.violationsOverlayOn = false;
    state.tabOrderOverlayOn = false;
    state.focusGapsOverlayOn = false;
    updateTabDisabledStates();
    renderScanTab();
    // Remove all overlays and highlights
    sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    sendMessage({ type: "HIDE_TAB_ORDER" });
    sendMessage({ type: "HIDE_FOCUS_GAPS" });
    sendMessage({ type: "CLEAR_HIGHLIGHTS" });
    sendMessage({ type: "DEACTIVATE_MOCKS" });
  });

  // Settings / Test Config modal (F13)
  document.getElementById("settings-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    configPanelOpen = true;
    openConfigDialog();
  });

  // Reset
  document.getElementById("reset-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.crawl = false;
    state.observer = false;
    state.movie = false;
    state.mv = false;
    // Also clear test config on Reset (F13-AC7)
    state.testConfig = null;
    chrome.storage.local.remove(TEST_CONFIG_STORAGE_KEY);
    configPanelOpen = false;
    renderScanTab();
  });

  // Highlight buttons
  // MV viewport filter chips (F02-AC11)
  document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.mvfilter;
      state.mvViewportFilter = val === "all" || val === undefined ? null : parseInt(val);
      renderScanTab();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".highlight-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Flash the closest containing violation/criterion card so the user
      // can see which panel item is being highlighted on the page.
      flashActiveItem(btn.closest("details") || btn.closest(".violation-card") || btn.parentElement);
    });
  });

  // Explain Further buttons
  document.querySelectorAll<HTMLButtonElement>(".explain-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ruleId = btn.dataset.rule || "";
      const description = btn.dataset.description || "";
      switchTab("ai");
      // Defer until after renderAiChatTab() has run
      setTimeout(() => {
        openAiChatWithContext(ruleId, description);
      }, 0);
    });
  });

  // Crawl mode select (F03-AC2)
  document.getElementById("crawl-mode")?.addEventListener("change", (e) => {
    _crawlMode = (e.target as HTMLSelectElement).value as "follow" | "urllist";
    urlListPanelOpen = false;
    renderScanTab();
  });

  // URL list panel open/close (F03-AC3)
  document.getElementById("url-list-open")?.addEventListener("click", () => {
    urlListPanelOpen = !urlListPanelOpen;
    renderScanTab();
  });

  document.getElementById("url-list-done")?.addEventListener("click", () => {
    urlListPanelOpen = false;
    renderScanTab();
  });

  // URL paste-area add (sitemap XML or plain URLs) (F03-AC5)
  document.getElementById("url-paste-add")?.addEventListener("click", () => {
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement | null;
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;
    let newUrls: string[] = [];
    if (text.startsWith("<?xml") || text.startsWith("<urlset") || text.startsWith("<sitemapindex")) {
      // Parse sitemap XML
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "application/xml");
        const locs = Array.from(doc.querySelectorAll("loc")).map((el) => el.textContent?.trim() || "").filter(Boolean);
        newUrls = locs;
      } catch {
        newUrls = [];
      }
    } else {
      newUrls = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    }
    for (const u of newUrls) {
      if (!crawlUrlList.includes(u)) crawlUrlList.push(u);
    }
    ta.value = "";
    renderScanTab();
  });

  // URL file upload (.txt) (F03-AC4)
  document.getElementById("url-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const u of lines) {
        if (!crawlUrlList.includes(u)) crawlUrlList.push(u);
      }
      renderScanTab();
    };
    reader.readAsText(file);
    input.value = "";
  });

  // URL manual add (F03-AC4)
  document.getElementById("url-manual-add")?.addEventListener("click", () => {
    const input = document.getElementById("url-manual-input") as HTMLInputElement | null;
    if (!input) return;
    const url = input.value.trim();
    if (url && !crawlUrlList.includes(url)) {
      crawlUrlList.push(url);
      input.value = "";
      renderScanTab();
    }
  });

  // URL remove buttons (F03-AC4)
  document.querySelectorAll<HTMLButtonElement>(".url-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      crawlUrlList.splice(idx, 1);
      renderScanTab();
    });
  });

  // Crawl results view toggle (F03-AC13)
  document.getElementById("crawl-view-page")?.addEventListener("click", () => {
    crawlViewMode = "page";
    renderScanTab();
  });
  document.getElementById("crawl-view-wcag")?.addEventListener("click", () => {
    crawlViewMode = "wcag";
    renderScanTab();
  });

  // Crawl controls
  document.getElementById("pause-crawl")?.addEventListener("click", () => sendMessage({ type: "PAUSE_CRAWL" }));
  document.getElementById("resume-crawl")?.addEventListener("click", () => sendMessage({ type: "RESUME_CRAWL" }));
  document.getElementById("cancel-crawl")?.addEventListener("click", () => {
    state.crawlPhase = "idle";
    state.accordionExpanded = true;
    sendMessage({ type: "CANCEL_CRAWL" });
    updateTabDisabledStates();
    renderScanTab();
  });
  document.getElementById("cancel-scan")?.addEventListener("click", () => {
    state.scanPhase = "idle";
    updateTabDisabledStates();
    renderScanTab();
  });
  document.getElementById("continue-crawl")?.addEventListener("click", () => sendMessage({ type: "USER_CONTINUE" }));
  document.getElementById("scan-then-continue")?.addEventListener("click", async () => {
    // Scan the current page first, then continue crawl
    const result = await sendMessage({ type: "SCAN_REQUEST" });
    if (result && (result as { type: string }).type === "SCAN_RESULT") {
      state.lastScanResult = (result as { payload: iScanResult }).payload;
      state.scanSubTab = "results";
    }
    sendMessage({ type: "USER_CONTINUE" });
    renderScanTab();
  });
  document.getElementById("cancel-wait")?.addEventListener("click", () => sendMessage({ type: "CANCEL_CRAWL" }));

  // Violation overlay toggle — state-tracked so the button reflects reality
  // across re-renders (manual review marks, sub-tab switches, etc.)
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
      // Toggle: click same button again → deselect
      state.manualReview[id] = state.manualReview[id] === newStatus ? null : newStatus;
      renderScanTab();
    });
  });

  // ARIA scan button (F10)
  document.getElementById("run-aria-scan")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "RUN_ARIA_SCAN" });
    if (result && (result as { type: string }).type === "ARIA_SCAN_RESULT") {
      state.ariaWidgets = (result as { payload: iAriaWidget[] }).payload;
      renderScanTab();
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

  // Export buttons. Accept either a single-page scan or crawl results — both
  // produce a valid iJsonReport (single-page populates top-level violations,
  // crawl-only populates report.crawl with per-page detail).
  const hasExportableData = (): boolean =>
    !!state.lastScanResult || !!(state.crawlResults && Object.keys(state.crawlResults).length > 0);

  document.getElementById("export-json")?.addEventListener("click", () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.json`);
  });
  document.getElementById("export-html")?.addEventListener("click", () => {
    // HTML/PDF reports render a single-page violation list — crawl-only data
    // would require a different layout, so for now require a single-page scan.
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
    }
  });
  document.getElementById("export-copy")?.addEventListener("click", async () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    const btn = document.getElementById("export-copy");
    if (btn) {
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 2000);
    }
  });
  // Observer export
  document.getElementById("export-observer")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "OBSERVER_EXPORT_HISTORY" });
    if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
      const entries = (result as { payload: iObserverEntry[] }).payload;
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      downloadBlob(blob, `A11y-Observer-History-${getDateStamp()}.json`);
    }
  });
  // Observer clear
  document.getElementById("clear-observer")?.addEventListener("click", async () => {
    await sendMessage({ type: "OBSERVER_CLEAR_HISTORY" });
    observerEntries = [];
    observerLoaded = false;
    observerFilter = "";
    renderScanTab();
  });
  // Observer domain filter (F04-AC12)
  // Targeted DOM update — full re-render would destroy the input mid-keystroke and lose focus.
  document.getElementById("observer-domain-filter")?.addEventListener("input", (e) => {
    observerFilter = (e.target as HTMLInputElement).value;
    const listEl = document.getElementById("observer-list-content");
    if (listEl) listEl.innerHTML = renderObserverListInner();
  });

  // Movie speed change (F06-AC4)
  document.getElementById("movie-speed")?.addEventListener("change", (e) => {
    const speed = parseFloat((e.target as HTMLSelectElement).value);
    sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
  });
}

/**
 * Adds .ds-flash-active to `target` for 3s so the user gets visual feedback
 * in the panel that "this is the item I just highlighted on the page".
 * Stacked clicks reset the timer on the same target.
 */
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
        <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
          <div style="font-size:12px;font-weight:700;color:#991b1b;margin-bottom:4px">Scan failed</div>
          <div style="font-size:11px;color:#7f1d1d;word-break:break-all">${message}</div>
        </div>
      </div>
    `;
  }
}

function getDomain(): string {
  try { return new URL(state.lastScanResult?.url || "").hostname.replace(/\./g, "-"); } catch { return "unknown"; }
}

function getDateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════════
   Export Builders (F12)
   ═══════════════════════════════════════════════════════════════════ */

function buildJsonReport(): import("@shared/types").iJsonReport {
  const r = state.lastScanResult;
  // For crawl-only reports (no single-page scan), top-level fields use the
  // first crawl page as the metadata anchor and summary aggregates across pages.
  const firstCrawlPage = !r && state.crawlResults
    ? Object.values(state.crawlResults)[0] ?? null
    : null;
  const anchor = r ?? firstCrawlPage;
  const violations = r ? r.violations : [];
  const passes = r ? r.passes : [];
  const incomplete = r ? r.incomplete : [];
  const totalRules = violations.length + passes.length;
  const passRate = totalRules > 0 ? Math.round((passes.length / totalRules) * 100) : 100;

  const report: import("@shared/types").iJsonReport = {
    metadata: {
      url: anchor?.url ?? "",
      title: document.title || anchor?.url || "",
      timestamp: anchor?.timestamp ?? new Date().toISOString(),
      wcagVersion: state.wcagVersion,
      wcagLevel: state.wcagLevel,
      toolVersion: "1.0.0",
      scanDurationMs: anchor?.scanDurationMs ?? 0,
    },
    summary: {
      violationCount: violations.reduce((s, v) => s + v.nodes.length, 0),
      passCount: passes.length,
      incompleteCount: incomplete.length,
      passRate,
    },
    violations,
    passes,
    incomplete,
  };

  // Include manual review in documented shape (F12-AC8)
  const allCriteria = getManualReviewCriteria(state.wcagVersion, state.wcagLevel);
  const pageElements = state.lastScanResult?.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(state.manualReview).filter((v) => v !== null).length;
  if (reviewedCount > 0) {
    report.manualReview = {
      reviewed: reviewedCount,
      total: filteredCriteria.length,
      criteria: filteredCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        status: state.manualReview[c.id] ?? null,
      })),
    };
  }

  // Include ARIA widgets if scanned (F12-AC9)
  if (state.ariaWidgets.length > 0) {
    report.ariaWidgets = state.ariaWidgets;
  }

  // Include tab order and focus gaps if collected (F12-AC1)
  const currentTabOrder = getTabOrder();
  if (currentTabOrder.length > 0) {
    report.tabOrder = currentTabOrder;
  }
  const currentFocusGaps = getFocusGaps();
  if (currentFocusGaps.length > 0) {
    report.focusGaps = currentFocusGaps;
  }

  // Include viewport analysis if MV scan was done (F12-AC11)
  if (state.lastMvResult) {
    report.viewportAnalysis = state.lastMvResult;
  }

  // Include crawl results when crawl is complete or paused (F12-AC1)
  if (state.crawlResults && Object.keys(state.crawlResults).length > 0) {
    const failedEntries = state.crawlFailed ?? {};
    report.crawl = {
      pagesScanned: Object.keys(state.crawlResults).length,
      pagesFailed: Object.keys(failedEntries).length,
      results: state.crawlResults,
    };
  }

  return report;
}

function buildHtmlReport(): string {
  const r = state.lastScanResult!;
  const totalViolationNodes = r.violations.reduce((s, v) => s + v.nodes.length, 0);
  const totalRules = r.violations.length + r.passes.length;
  const passRate = totalRules > 0 ? Math.round((r.passes.length / totalRules) * 100) : 100;
  const severityColor: Record<string, string> = { critical: "#991b1b", serious: "#c2410c", moderate: "#a16207", minor: "#4b5563" };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>A11y Scan Report — ${escHtml(r.url)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #18181b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #52525b; margin-bottom: 24px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .summary-card { text-align: center; padding: 16px; border: 1px solid #e4e4e7; border-radius: 8px; }
  .summary-card .num { font-size: 28px; font-weight: 800; }
  .summary-card .label { font-size: 12px; color: #52525b; }
  .violation { border-left: 4px solid; padding: 12px; margin-bottom: 8px; background: #fff; border-radius: 0 4px 4px 0; }
  .violation h3 { margin: 0 0 4px; font-size: 14px; }
  .violation .impact { font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .node { font-size: 12px; font-family: monospace; background: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin: 4px 0; }
  .pass { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f4f4f5; color: #047857; }
  @media print { body { padding: 0; } .violation { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Accessibility Scan Report</h1>
<div class="meta">
  <div><strong>URL:</strong> ${escHtml(r.url)}</div>
  <div><strong>Scanned:</strong> ${new Date(r.timestamp).toLocaleString()}</div>
  <div><strong>WCAG:</strong> ${state.wcagVersion} ${state.wcagLevel} &middot; <strong>Duration:</strong> ${r.scanDurationMs}ms</div>
</div>
<div class="summary">
  <div class="summary-card"><div class="num" style="color:#b91c1c">${totalViolationNodes}</div><div class="label">Violations</div></div>
  <div class="summary-card"><div class="num" style="color:#047857">${r.passes.length}</div><div class="label">Passes</div></div>
  <div class="summary-card"><div class="num" style="color:#b45309">${r.incomplete.length}</div><div class="label">Review</div></div>
  <div class="summary-card"><div class="num">${passRate}%</div><div class="label">Pass Rate</div></div>
</div>
<h2>Violations (${r.violations.length} rules)</h2>
${r.violations.sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact)).map((v) => `
<div class="violation" style="border-color:${severityColor[v.impact] || "#4b5563"}">
  <h3>${escHtml(v.help || v.description)}</h3>
  <div class="impact" style="color:${severityColor[v.impact] || "#4b5563"}">${v.impact} &middot; ${v.wcagCriteria?.join(", ") || v.id}</div>
  ${v.nodes.map((n) => `<div class="node">${escHtml(n.selector)}<br>${escHtml(n.failureSummary)}</div>`).join("")}
</div>`).join("")}
<h2>Passed Rules (${r.passes.length})</h2>
${r.passes.map((p) => `<div class="pass">&check; ${escHtml(p.id)} — ${escHtml(p.description)} (${p.nodes.length} elements)</div>`).join("")}
${state.ariaWidgets.length > 0 ? `
<h2>ARIA Widgets (${state.ariaWidgets.length})</h2>
${state.ariaWidgets.map((w) => `<div class="pass">${w.failCount > 0 ? "&cross;" : "&check;"} ${escHtml(w.role)} — ${escHtml(w.label)} (${w.failCount} issues)</div>`).join("")}
` : ""}
${(() => {
  const allCriteria = getManualReviewCriteria(state.wcagVersion, state.wcagLevel);
  const pageElements = state.lastScanResult?.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(state.manualReview).filter((v) => v !== null).length;
  if (reviewedCount === 0) return "";
  const rows = filteredCriteria.map((c) => {
    const status = state.manualReview[c.id] ?? null;
    const color = status === "pass" ? "#047857" : status === "fail" ? "#b91c1c" : status === "na" ? "#52525b" : "#a1a1aa";
    const label = status === "pass" ? "Pass" : status === "fail" ? "Fail" : status === "na" ? "N/A" : "Not reviewed";
    return `<tr><td style="padding:4px 8px;font-size:12px">${escHtml(c.id)}</td><td style="padding:4px 8px;font-size:12px">${escHtml(c.name)}</td><td style="padding:4px 8px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>`;
  }).join("");
  return `<h2>Manual Review (${reviewedCount}/${filteredCriteria.length} reviewed)</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <thead><tr style="background:#f4f4f5"><th style="padding:6px 8px;text-align:left;font-size:12px">Criterion</th><th style="padding:6px 8px;text-align:left;font-size:12px">Name</th><th style="padding:6px 8px;text-align:left;font-size:12px">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
})()}
<footer style="margin-top:32px;padding-top:16px;border-top:1px solid #e4e4e7;font-size:11px;color:#71717a">
  Generated by A11y Scan &middot; ${new Date().toISOString()}
</footer>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
