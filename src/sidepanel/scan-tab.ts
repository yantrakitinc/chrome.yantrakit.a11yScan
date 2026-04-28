/**
 * Scan tab rendering — accordion, action button, results, sub-tabs, toolbar.
 * Source of truth: F01, F02, F03, F04, F09, F10, F12, F19
 */

import { state, updateTabDisabledStates, switchTab, TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } from "./sidepanel";
import { getTabOrder, getFocusGaps } from "./kb-tab";
import { openAiChatWithContext } from "./ai-tab";
import { sendMessage } from "@shared/messages";
import type { iScanResult, iAriaWidget, iManualReviewStatus, iObserverEntry, iTestConfig } from "@shared/types";
import { getManualReviewCriteria, getWcagUrl } from "@shared/wcag-mapping";
import { uuid, isoNow, getViewportBucket, escHtml } from "@shared/utils";
import { validateTestConfig } from "@shared/validate-test-config";

/** Tracks whether the config panel (F13) is currently expanded */
let configPanelOpen = false;

/* ═══════════════════════════════════════════════════════════════════
   Manual review per-page persistence (R-MANUAL)
   ═══════════════════════════════════════════════════════════════════ */

/** Compute storage key for manual review state. Per-URL granularity so two
   different pages on the same site don't share review status. Matches the
   key format documented in R-MANUAL-review.md. */
/**
 * Storage key for per-page manual review state. The key intentionally drops
 * the URL hash and query string — manual-review notes follow the page's
 * conceptual identity (origin + pathname), not the navigation state. Returns
 * null when the input isn't a parseable URL (e.g., chrome://, about:, "").
 *
 * Exported for unit testing.
 */
export function manualReviewKey(url: string): string | null {
  try {
    const u = new URL(url);
    return `manualReview_${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/** Load saved manual review for the given URL, or {} if none saved. */
function loadManualReviewFor(url: string): void {
  const key = manualReviewKey(url);
  if (!key) { state.manualReview = {}; return; }
  chrome.storage.local.get(key, (result) => {
    const stored = result?.[key] as Record<string, iManualReviewStatus> | undefined;
    state.manualReview = stored && typeof stored === "object" ? stored : {};
    renderScanTab();
  });
}

/** Persist current manual review state for the given URL. */
function saveManualReviewFor(url: string): void {
  const key = manualReviewKey(url);
  if (!key) return;
  chrome.storage.local.set({ [key]: state.manualReview });
}

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
  return computeActionButtonText({
    crawlPhase: state.crawlPhase,
    scanPhase: state.scanPhase,
    observer: state.observer,
    crawl: state.crawl,
    mv: state.mv,
  });
}

/**
 * Compute the scan action button label from mode flags + phase.
 * Source of truth: R-SCAN AC4. Exported for unit testing.
 */
export function computeActionButtonText(s: {
  crawlPhase: "idle" | "crawling" | "wait" | "paused" | "complete";
  scanPhase: "idle" | "scanning" | "results";
  observer: boolean;
  crawl: boolean;
  mv: boolean;
}): string {
  const crawling = s.crawlPhase === "crawling" || s.crawlPhase === "wait";
  const scanning = s.scanPhase === "scanning";

  if (crawling) return "Crawling\u2026";
  if (scanning) return "Scanning\u2026";

  const paused = s.crawlPhase === "paused";
  const idle = s.crawlPhase === "idle" && s.scanPhase === "idle";
  const results = s.scanPhase === "results" || s.crawlPhase === "complete";

  if (paused) return s.observer ? "Scan This Page" : "Scan Page";

  if (idle || results) {
    if (s.crawl) return "Start Crawl";
    if (s.observer) return "Scan This Page";
    if (s.mv) return "Scan All Viewports";
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
          <span style="font-size:11px;font-weight:700;color:var(--ds-amber-800)">WCAG</span>
          ${renderExpandedToggle(busy)}
        </div>
      ` : `
        <button type="button" class="accordion-toggle" id="accordion-toggle" aria-expanded="false" aria-controls="accordion-body" aria-label="Expand scan settings">
          <span style="font-size:11px;font-weight:700;color:var(--ds-amber-800)">WCAG</span>
          ${renderCollapsedToggle()}
        </button>
      `}
      <div class="accordion-body ${state.accordionExpanded ? "" : "collapsed"}" id="accordion-body" ${state.accordionExpanded ? "" : "hidden"}>
        <div class="accordion-body-inner">
          <div class="accordion-content">
            ${renderModeToggles(busy)}
            ${renderMvCheckbox(busy)}
            ${state.crawl ? renderCrawlConfig(busy) : ""}
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
    } aria-live="polite" class="f-1" style="overflow-y:auto;min-height:0">
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
  return renderExpandedToggleHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    hasTestConfig: !!state.testConfig,
    configPanelOpen,
    busy,
  });
}

/**
 * Render the expanded settings toolbar: WCAG version + level dropdowns,
 * settings cog with config-loaded badge, Reset, Collapse. Pure; exported
 * for tests.
 */
export function renderExpandedToggleHtml(s: {
  wcagVersion: string; wcagLevel: string;
  hasTestConfig: boolean; configPanelOpen: boolean; busy: boolean;
}): string {
  return `
    <select id="wcag-version" aria-label="WCAG version" ${s.busy ? "disabled" : ""} style="font-size:12px;padding:4px 6px;border:1px solid var(--ds-zinc-300);border-radius:4px;font-weight:600">
      <option ${s.wcagVersion === "2.2" ? "selected" : ""}>2.2</option>
      <option ${s.wcagVersion === "2.1" ? "selected" : ""}>2.1</option>
      <option ${s.wcagVersion === "2.0" ? "selected" : ""}>2.0</option>
    </select>
    <select id="wcag-level" aria-label="Conformance level" ${s.busy ? "disabled" : ""} style="font-size:12px;padding:4px 6px;border:1px solid var(--ds-zinc-300);border-radius:4px;font-weight:600">
      <option ${s.wcagLevel === "AA" ? "selected" : ""}>AA</option>
      <option ${s.wcagLevel === "A" ? "selected" : ""}>A</option>
      <option ${s.wcagLevel === "AAA" ? "selected" : ""}>AAA</option>
    </select>
    <div style="display:flex;align-items:center;gap:2px">
      <button id="settings-btn" aria-label="Test configuration" aria-expanded="${s.configPanelOpen}" ${s.busy ? "disabled" : ""} class="cur-pointer" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:${s.configPanelOpen ? "var(--ds-amber-100)" : "none"};border-radius:4px;color:${s.hasTestConfig ? "var(--ds-amber-600)" : "var(--ds-zinc-500)"}">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/></svg>
      </button>
      ${s.hasTestConfig ? '<span style="font-size:10px;font-weight:700;color:var(--ds-amber-600);background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:4px;padding:1px 5px;white-space:nowrap">Config loaded</span>' : ""}
    </div>
    <button id="reset-btn" aria-label="Reset all settings" ${s.busy ? "disabled" : ""} class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:4px;padding:4px 10px">Reset</button>
    <button id="collapse-btn" aria-label="Collapse settings" class="cur-pointer" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:4px;color:var(--ds-zinc-500);margin-left:auto">
      <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5l4-4 4 4"/></svg>
    </button>
  `;
}

function renderCollapsedToggle(): string {
  return renderCollapsedToggleHtml({
    crawl: state.crawl,
    observer: state.observer,
    movie: state.movie,
    mv: state.mv,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
  });
}

/**
 * Render the collapsed settings toolbar showing the WCAG level + active
 * scan-mode chips. ≤2 modes render as individual chips; ≥3 collapse to
 * an "N modes" summary chip. Pure; exported for tests.
 */
export function renderCollapsedToggleHtml(s: {
  crawl: boolean; observer: boolean; movie: boolean; mv: boolean;
  wcagVersion: string; wcagLevel: string;
}): string {
  const modes = [
    s.crawl && "Crawl",
    s.observer && "Observer",
    s.movie && "Movie",
    s.mv && "Multi-Viewport",
  ].filter(Boolean);

  const modeColors: Record<string, string> = {
    Crawl: "background:var(--ds-blue-100);color:var(--ds-sky-900)",
    Observer: "background:var(--ds-emerald-100);color:var(--ds-green-900)",
    Movie: "background:var(--ds-violet-100);color:var(--ds-violet-900)",
    "Multi-Viewport": "background:var(--ds-amber-100);color:var(--ds-amber-800)",
  };
  let modeHtml = "";
  if (modes.length === 0) {
    modeHtml = '<span style="font-size:11px;color:var(--ds-zinc-500)">Single page</span>';
  } else if (modes.length <= 2) {
    modeHtml = modes.map((m) => `<span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;${modeColors[m as string] || "background:var(--ds-zinc-200);color:var(--ds-zinc-700)"}">${m}</span>`).join(" ");
  } else {
    modeHtml = `<span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:var(--ds-zinc-200);color:var(--ds-zinc-700)">${modes.length} modes</span>`;
  }

  return `
    <span style="font-size:11px;font-weight:600;color:var(--ds-zinc-700)">${s.wcagVersion} ${s.wcagLevel}</span>
    ${modeHtml}
    <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--ds-zinc-500);margin-left:auto">
      <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>
    </span>
  `;
}

function renderModeToggles(busy: boolean): string {
  return renderModeTogglesHtml({ crawl: state.crawl, movie: state.movie, busy });
}

/**
 * Render the Crawl / Observe / Movie mode-toggle row.
 * Observe is intentionally hard-disabled (coming soon). Pure; exported for tests.
 */
export function renderModeTogglesHtml(s: { crawl: boolean; movie: boolean; busy: boolean }): string {
  return `
    <div class="mode-row" role="group" aria-label="Scan mode">
      <button class="mode-btn mode-crawl" aria-pressed="${s.crawl}" ${s.busy ? "disabled" : ""} data-mode="crawl">Crawl</button>
      <button class="mode-btn mode-observe" disabled aria-disabled="true" aria-label="Observe mode — coming soon" style="opacity:0.4;cursor:not-allowed;position:relative" title="Coming soon">Observe<span aria-hidden="true" style="font-size:8px;font-weight:800;color:var(--ds-amber-700);position:absolute;top:-2px;right:-2px;background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:3px;padding:0 3px;line-height:1.4">SOON</span></button>
      <button class="mode-btn mode-movie" aria-pressed="${s.movie}" ${s.busy ? "disabled" : ""} data-mode="movie">Movie</button>
    </div>
  `;
}

function renderMvCheckbox(busy: boolean): string {
  return renderMvCheckboxHtml({
    mv: state.mv,
    viewports: state.viewports,
    viewportEditing,
    busy,
  });
}

/**
 * Render the Multi-Viewport checkbox + viewport chips/editor row.
 * When mv=false, just the checkbox. When mv=true, chip row showing each
 * viewport width; in editing mode, an inline editor with +add and done.
 * Pure; exported for tests.
 */
export function renderMvCheckboxHtml(s: {
  mv: boolean;
  viewports: number[];
  viewportEditing: boolean;
  busy: boolean;
}): string {
  const chipsRow = s.mv
    ? s.mv && s.viewportEditing
      ? `<div style="padding-left:24px;margin-top:4px">
          <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px">
            ${s.viewports.map((v, i) => `
              <input type="number" min="320" value="${v}" data-index="${i}" class="vp-input font-mono min-h-24" aria-label="Viewport ${i + 1} width in pixels"
                style="width:60px;font-size:11px;font-weight:600;padding:2px 4px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-800);box-sizing:border-box">
              <button type="button" class="vp-remove cur-pointer min-h-24" data-index="${i}" aria-label="Remove ${v}px viewport"
                style="font-size:12px;font-weight:700;line-height:1;padding:2px 5px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-600)"
                ${s.viewports.length <= 1 ? "disabled" : ""}>×</button>
            `).join("")}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button type="button" id="vp-add"
              class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:2px 8px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-800)"
              ${s.viewports.length >= 6 ? "disabled" : ""}>+ add</button>
            <button type="button" id="vp-done"
              class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:2px 8px;border:1px solid var(--ds-amber-600);border-radius:4px;background:var(--ds-amber-100);color:var(--ds-amber-800)">done</button>
          </div>
        </div>`
      : `<div style="display:flex;align-items:center;gap:4px;padding-left:24px;flex-wrap:wrap">
          ${s.viewports.map((v) => `<span class="font-mono" style="font-size:11px;font-weight:600;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:4px;padding:2px 6px">${v}</span>`).join("")}
          <button type="button" id="vp-edit"
            class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:1px 6px;border:none;background:none;color:var(--ds-indigo-700);text-decoration:underline">edit</button>
        </div>`
    : "";

  return `
    <label class="cur-pointer" style="display:flex;align-items:center;gap:6px;${s.busy ? "opacity:0.4;pointer-events:none" : ""}">
      <input type="checkbox" id="mv-check" ${s.mv ? "checked" : ""} ${s.busy ? "disabled" : ""} class="cur-pointer" style="width:16px;height:16px;accent-color:var(--ds-amber-600)">
      <span style="font-size:12px;font-weight:600;color:var(--ds-zinc-800)">Multi-Viewport</span>
    </label>
    ${chipsRow}
  `;
}

function renderCrawlConfig(busy: boolean): string {
  return renderCrawlConfigHtml({
    crawlMode: _crawlMode,
    urlListPanelOpen,
    urlList: crawlUrlList,
    busy,
  });
}

/**
 * Render the crawl-config row: the Crawl mode dropdown (Follow / URL list)
 * plus, in URL-list mode, the open-list button and inline panel. Pure;
 * exported for tests.
 */
export function renderCrawlConfigHtml(s: {
  crawlMode: "follow" | "urllist";
  urlListPanelOpen: boolean;
  urlList: string[];
  busy: boolean;
}): string {
  const urlCount = s.urlList.length;
  const urlListBtn = s.crawlMode === "urllist"
    ? `<button type="button" id="url-list-open" aria-expanded="${s.urlListPanelOpen}" aria-controls="url-list-panel"
        class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:3px 10px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-800);margin-top:4px">
        ${urlCount === 0 ? "Set up URL list" : `${urlCount} URL${urlCount === 1 ? "" : "s"} \u2014 Edit list`}
      </button>`
    : "";

  const panel = (s.crawlMode === "urllist" && s.urlListPanelOpen) ? renderUrlListPanelHtml(s.urlList) : "";

  return `
    <div style="display:flex;align-items:center;gap:8px">
      <span class="scan-caption-strong">Crawl mode</span>
      <select id="crawl-mode" aria-label="Crawl mode" ${s.busy ? "disabled" : ""} class="f-1" style="font-size:12px;padding:4px 8px;border:1px solid var(--ds-zinc-300);border-radius:4px;font-weight:600">
        <option value="follow" ${s.crawlMode === "follow" ? "selected" : ""}>Follow all links</option>
        <option value="urllist" ${s.crawlMode === "urllist" ? "selected" : ""}>URL list</option>
      </select>
    </div>
    ${urlListBtn}
    ${panel}
  `;
}

function renderUrlListPanel(): string {
  return renderUrlListPanelHtml(crawlUrlList);
}

/**
 * Render the URL-list editor panel: paste textarea + add buttons + the
 * read-only list rows. Pure; exported for tests.
 */
export function renderUrlListPanelHtml(urlList: string[]): string {
  const listRows = urlList.map((url, i) => `
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
      <input type="text" readonly value="${escHtml(url)}"
        class="f-1 font-mono" style="font-size:11px;padding:3px 6px;border:1px solid var(--ds-zinc-200);border-radius:3px;background:var(--ds-zinc-50);color:var(--ds-zinc-800);min-width:0">
      <button type="button" class="url-remove-btn fs-0 cur-pointer min-h-24" data-index="${i}"
        aria-label="Remove URL"
        style="font-size:12px;font-weight:700;color:var(--ds-red-700);background:none;border:none;padding:0 4px">&times;</button>
    </div>
  `).join("");

  const summary = urlList.length > 0
    ? `<div style="font-size:11px;font-weight:600;color:var(--ds-zinc-600);margin-bottom:6px">${urlList.length} URL${urlList.length === 1 ? "" : "s"} will be scanned</div>`
    : "";

  return `
    <div id="url-list-panel" style="margin-top:6px;border:1px solid var(--ds-zinc-300);border-radius:6px;background:var(--ds-zinc-50);padding:8px">
      <div style="font-size:11px;font-weight:800;color:var(--ds-zinc-800);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">URL List</div>

      <div style="margin-bottom:8px">
        <textarea id="url-paste-area" rows="3" aria-label="Paste URLs or sitemap XML" placeholder="Paste URLs (one per line) or sitemap XML (&lt;?xml\u2026)"
          class="font-mono" style="width:100%;box-sizing:border-box;font-size:11px;padding:6px;border:1px solid var(--ds-zinc-300);border-radius:4px;resize:vertical;background:#fff;color:var(--ds-zinc-800)"></textarea>
        <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
          <button type="button" id="url-paste-add"
            class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:3px 10px;border:none;border-radius:4px;background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Add from textarea</button>
          <label class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:3px 10px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-700);display:flex;align-items:center">
            Upload .txt
            <input type="file" id="url-file-input" accept=".txt,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)">
          </label>
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:8px">
        <input type="url" id="url-manual-input" aria-label="Add URL to crawl list" placeholder="https://example.com/page"
          class="f-1" style="font-size:11px;padding:4px 6px;border:1px solid var(--ds-zinc-300);border-radius:4px;background:#fff;color:var(--ds-zinc-800);min-width:0">
        <button type="button" id="url-manual-add"
          class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;padding:3px 10px;border:none;border-radius:4px;background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Add</button>
      </div>

      ${summary}
      <div id="url-list-rows" style="max-height:160px;overflow-y:auto">${listRows}</div>

      <button type="button" id="url-list-done"
        class="cur-pointer min-h-24" style="width:100%;margin-top:8px;font-size:11px;font-weight:800;padding:5px;border:none;border-radius:4px;background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Done</button>
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
      <h2 id="config-dialog-title" style="margin:0;font-size:12px;font-weight:800;color:var(--ds-zinc-800);text-transform:uppercase;letter-spacing:0.05em">Test Configuration</h2>
      <button id="config-close-btn" aria-label="Close" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:var(--ds-zinc-500);border-radius:4px">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
    </div>
    <a href="https://a11yscan.yantrakit.com/tools/test-config-builder" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:var(--ds-indigo-700);text-decoration:none">Open Builder ↗</a>
    <textarea id="config-textarea" aria-label="Paste config JSON here" placeholder='Paste JSON config here, e.g. { "wcag": { "version": "2.1", "level": "AA" } }' class="font-mono" style="width:100%;box-sizing:border-box;font-size:11px;padding:8px;border:1px solid ${state.testConfig ? "var(--ds-amber-300)" : "var(--ds-zinc-300)"};border-radius:4px;resize:vertical;min-height:100px;background:#fff;color:var(--ds-zinc-800);line-height:1.5">${escHtml(configJson)}</textarea>
    <div id="config-error" role="alert" aria-live="polite" style="font-size:11px;color:var(--ds-red-700);display:none"></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <button id="config-apply-btn" class="f-1 cur-pointer min-h-24" style="padding:8px;font-size:12px;font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Apply</button>
      <label id="config-upload-label" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:4px;display:flex;align-items:center">
        Upload .json
        <input type="file" id="config-file-input" accept=".json,application/json" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-label="Upload JSON config file">
      </label>
      ${state.testConfig ? '<button id="config-clear-btn" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:4px">Clear Config</button>' : ""}
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
      // Sync state.viewports to testConfig.viewports when supplied so the MV
      // chips reflect the config-supplied list (R-MV AC8).
      if (config.viewports && config.viewports.length > 0) {
        state.viewports = [...config.viewports].sort((a, b) => a - b);
      }
      chrome.storage.local.set({
        [TEST_CONFIG_STORAGE_KEY]: config,
        [TEST_CONFIG_TIMESTAMP_KEY]: new Date().toISOString(),
      });
      errorEl.style.display = "none";
      dialog.close();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      errorEl.style.display = "block";
      // Return focus to the textarea so the user can fix the JSON without
      // having to re-click into the input. role=alert + aria-live on the
      // error region announces the message.
      textarea.focus();
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
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    dialog.close();
  });
}


function renderScanProgress(): string {
  return renderScanProgressHtml({
    mv: state.mv,
    mvProgress: state.mvProgress,
    viewports: state.viewports,
  });
}

/**
 * Render the scanning progress bar. Pure; exported for tests.
 */
export function renderScanProgressHtml(s: {
  mv: boolean;
  mvProgress: { current: number; total: number } | null;
  viewports: number[];
}): string {
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span class="font-mono" style="font-size:11px;color:var(--ds-zinc-600)">${s.mv ? `viewport ${s.mvProgress ? `${s.mvProgress.current}/${s.mvProgress.total}` : `1/${s.viewports.length}`}` : "analyzing page\u2026"}</span>
        <button id="cancel-scan" aria-label="Cancel scan" class="scan-progress-icon-btn scan-progress-icon-btn--danger">
          <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
        </button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:60%;animation:pulse 1.5s ease infinite"></div></div>
    </div>
  `;
}

function renderCrawlProgress(): string {
  return renderCrawlProgressHtml(state.crawlProgress, state.crawlPhase);
}

/**
 * Render the crawl progress bar. Shows pages-visited/total + current URL,
 * pause/resume button matching crawlPhase, and a percent-fill bar.
 * Pure; exported for tests.
 */
export function renderCrawlProgressHtml(
  progress: { pagesVisited: number; pagesTotal: number; currentUrl: string },
  crawlPhase: "idle" | "crawling" | "wait" | "paused" | "complete",
): string {
  const { pagesVisited, pagesTotal, currentUrl } = progress;
  const pageLabel = pagesTotal > 0 ? `${pagesVisited}/${pagesTotal} pages` : "scanning\u2026";
  const urlDisplay = currentUrl
    ? (() => { try { return new URL(currentUrl).pathname || currentUrl; } catch { return currentUrl; } })()
    : "";
  const progressPct = pagesTotal > 0 ? Math.round((pagesVisited / pagesTotal) * 100) : 42;
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;align-items:center;margin-bottom:4px;gap:8px">
        <span class="fs-0 font-mono" style="font-size:11px;font-weight:700;color:var(--ds-zinc-600)">${pageLabel}</span>
        ${urlDisplay ? `<span class="truncate f-1 font-mono" style="font-size:10px;color:var(--ds-zinc-500);min-width:0" title="${escHtml(currentUrl)}">${escHtml(urlDisplay)}</span>` : ""}
        <div class="fs-0" style="display:flex;gap:4px">
          ${crawlPhase === "crawling"
            ? '<button id="pause-crawl" aria-label="Pause crawl" class="scan-progress-icon-btn"><svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><rect width="3" height="10" rx=".5"/><rect x="5" width="3" height="10" rx=".5"/></svg></button>'
            : '<button id="resume-crawl" aria-label="Resume crawl" class="scan-progress-icon-btn"><svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><path d="M0 0l8 5-8 5z"/></svg></button>'
          }
          <button id="cancel-crawl" aria-label="Cancel crawl" class="scan-progress-icon-btn scan-progress-icon-btn--danger">
            <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
          </button>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%${crawlPhase === "crawling" ? ";animation:pulse 1.5s ease infinite" : ""}"></div></div>
    </div>
  `;
}

function renderPageRuleWait(): string {
  return renderPageRuleWaitHtml(state.crawlWaitInfo);
}

/**
 * Render the alert banner shown when a page rule pauses the crawl. Pure;
 * exported for tests.
 */
export function renderPageRuleWaitHtml(info: { url: string; description: string; waitType?: string } | null): string {
  return `
    <div role="alert" aria-live="assertive" class="fs-0" style="padding:8px 12px;border-bottom:2px solid var(--ds-yellow-400);background:var(--ds-amber-50)">
      <div style="font-size:11px;font-weight:700;color:var(--ds-amber-900);margin-bottom:6px">\u26a0 Page rule triggered</div>
      ${info?.description ? `<div style="font-size:11px;color:var(--ds-zinc-800);margin-bottom:4px">${escHtml(info.description)}</div>` : ""}
      ${info?.url ? `<div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-500);margin-bottom:6px" title="${escHtml(info.url)}">${escHtml(info.url)}</div>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="continue-crawl" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Continue</button>
        <button id="scan-then-continue" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:4px">Scan page, then continue</button>
        <button id="cancel-wait" class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:4px;margin-left:auto;padding:4px 10px">Cancel</button>
      </div>
    </div>
  `;
}

function renderSubTabs(): string {
  return renderSubTabsHtml({ observer: state.observer, activeSubTab: state.scanSubTab });
}

/**
 * Render the sub-tab nav row (Results / Manual / ARIA, plus Observe when
 * Observer mode is on). Pure; exported for tests.
 */
export function renderSubTabsHtml(s: { observer: boolean; activeSubTab: string }): string {
  const tabs = ["results", "manual", "aria"];
  if (s.observer) tabs.push("observe");
  return `
    <div class="sub-tabs" role="tablist" aria-label="Scan results sections">
      ${tabs.map((t) => {
        const label = t === "results" ? "Results" : t === "manual" ? "Manual" : t === "aria" ? "ARIA" : "Observe";
        const isActive = t === s.activeSubTab;
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
    return '<div class="scan-pane"><div style="font-size:11px;color:var(--ds-zinc-500);font-weight:600;display:flex;align-items:center;gap:6px"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><circle cx="7" cy="7" r="5" stroke="var(--ds-zinc-300)" stroke-width="2"/><path d="M12 7a5 5 0 00-5-5" stroke="var(--ds-amber-500)" stroke-width="2" stroke-linecap="round"/></svg>Analyzing page\u2026</div></div>';
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

export function renderEmptyState(): string {
  return `
    <div style="padding:16px">
      <h2 style="font-size:14px;font-weight:800;color:var(--ds-zinc-900);margin-bottom:4px">Get started</h2>
      <p style="font-size:12px;color:var(--ds-zinc-600);line-height:1.5">Click the button above to check this page for accessibility issues.</p>
      <div style="margin-top:16px">
        <h3 style="font-size:11px;font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Scan modes</h3>
        <div style="padding-left:12px;border-left:2px solid var(--ds-sky-400);margin-bottom:8px">
          <div class="scan-section-title">Crawl</div>
          <div class="scan-body">Automatically visits every page on your website and checks each one for issues.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid var(--ds-emerald-400);margin-bottom:8px">
          <div class="scan-section-title">Observer</div>
          <div class="scan-body">Watches your browsing and checks every page you visit. Everything stays on your computer.</div>
        </div>
        <div style="padding-left:12px;border-left:2px solid var(--ds-violet-400);margin-bottom:8px">
          <div class="scan-section-title">Movie</div>
          <div class="scan-body">After each scan, shows you how keyboard-only users navigate the page step by step.</div>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════
   Crawl Results Display (F03-AC13–AC16)
   ═══════════════════════════════════════════════════════════════════ */

function renderCrawlResults(): string {
  return renderCrawlResultsHtml(state.crawlResults!, state.crawlFailed ?? {}, crawlViewMode);
}

/**
 * Render the crawl-results table. Supports two view modes:
 * - "page": one row per crawled URL with violation count + collapsible body
 * - "wcag": violations grouped by WCAG criterion across all pages
 *
 * Pure; exported for tests.
 */
export function renderCrawlResultsHtml(
  results: Record<string, iScanResult>,
  failed: Record<string, string>,
  crawlViewMode: "page" | "wcag",
): string {
  const allUrls = [...Object.keys(results), ...Object.keys(failed).filter((u) => !(u in results))];

  const toggle = `
    <div role="group" aria-label="Group crawl results by" style="display:flex;gap:0;border:1px solid var(--ds-zinc-300);border-radius:4px;overflow:hidden;margin-bottom:8px">
      <button type="button" id="crawl-view-page" aria-pressed="${crawlViewMode === "page"}"
        class="f-1 cur-pointer min-h-24" style="padding:4px 8px;font-size:11px;font-weight:700;border:none;background:${crawlViewMode === "page" ? "var(--ds-amber-100)" : "#fff"};color:${crawlViewMode === "page" ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">By page</button>
      <button type="button" id="crawl-view-wcag" aria-pressed="${crawlViewMode === "wcag"}"
        class="f-1 cur-pointer min-h-24" style="padding:4px 8px;font-size:11px;font-weight:700;border:none;border-left:1px solid var(--ds-zinc-300);background:${crawlViewMode === "wcag" ? "var(--ds-amber-100)" : "#fff"};color:${crawlViewMode === "wcag" ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">By WCAG</button>
    </div>
  `;

  const totalViolations = Object.values(results).reduce((sum, r) => sum + r.violations.reduce((s, v) => s + v.nodes.length, 0), 0);
  const totalFailed = Object.keys(failed).length;
  const summary = `
    <div class="scan-stats-grid scan-stats-grid--3">
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-zinc-800)">${allUrls.length}</div><div class="scan-sublabel">Pages</div></div>
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-red-700)">${totalViolations}</div><div class="scan-sublabel">Violations</div></div>
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-red-600)">${totalFailed}</div><div class="scan-sublabel">Failed</div></div>
    </div>
  `;

  let body = "";
  if (crawlViewMode === "page") {
    body = allUrls.map((url) => {
      const r = results[url];
      const err = failed[url];
      if (err) {
        return `
          <details style="border:1px solid var(--ds-red-200);border-radius:4px;margin-bottom:4px;background:var(--ds-red-50)">
            <summary class="scan-detail-summary">
              <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
              <span class="fs-0" style="color:var(--ds-red-600);font-weight:700">\u2717</span>
              <span class="truncate f-1 font-mono" style="color:var(--ds-zinc-800)" title="${escHtml(url)}">${escHtml(url)}</span>
            </summary>
            <div style="padding:4px 8px 8px;font-size:11px;color:var(--ds-red-700)">${escHtml(err)}</div>
          </details>
        `;
      }
      const violationCount = r.violations.reduce((s, v) => s + v.nodes.length, 0);
      const passCount = r.passes.length;
      const hasViolations = violationCount > 0;
      return `
        <details style="border:1px solid ${hasViolations ? "var(--ds-red-200)" : "var(--ds-green-200)"};border-radius:4px;margin-bottom:4px;background:${hasViolations ? "var(--ds-red-50)" : "var(--ds-green-50)"}">
          <summary class="scan-detail-summary">
            <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
            <span class="fs-0" style="color:${hasViolations ? "var(--ds-red-600)" : "var(--ds-green-700)"};font-weight:700">${hasViolations ? "\u2717" : "\u2713"}</span>
            <span class="truncate f-1 font-mono" style="color:var(--ds-zinc-800)" title="${escHtml(url)}">${escHtml(url)}</span>
            <span class="fs-0" style="font-size:10px;font-weight:700;color:${hasViolations ? "var(--ds-red-700)" : "var(--ds-green-700)"}">${hasViolations ? violationCount + " issue" + (violationCount === 1 ? "" : "s") : passCount + " pass"}</span>
          </summary>
          <div class="scan-detail-body">
            ${r.violations.sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact)).map((v) => renderViolation(v)).join("") || '<div style="font-size:11px;color:var(--ds-green-700);padding:4px 0">No violations found.</div>'}
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
      body = '<div style="padding:12px;font-size:12px;color:var(--ds-green-700);font-weight:600;text-align:center">No violations found across all pages.</div>';
    } else {
      body = Array.from(byCriterion.entries()).map(([criterion, entries]) => {
        const totalNodes = entries.reduce((s, e) => s + e.violation.nodes.length, 0);
        const uniquePages = [...new Set(entries.map((e) => e.pages[0]))];
        return `
          <details class="severity-${entries[0].violation.impact}" style="border-radius:0 4px 4px 0;margin-bottom:4px">
            <summary class="scan-detail-summary">
              <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
              <b class="truncate f-1" style="color:var(--ds-zinc-900)">
                <a href="https://a11yscan.yantrakit.com/wcag/${criterion}" target="_blank" rel="noopener" style="color:var(--ds-indigo-700);text-decoration:underline">${criterion}</a>
              </b>
              <span class="fs-0" style="font-size:10px;color:var(--ds-zinc-600)">${uniquePages.length} page${uniquePages.length === 1 ? "" : "s"}</span>
              <span class="fs-0 font-mono" style="color:var(--ds-zinc-600);font-weight:700">${totalNodes}</span>
            </summary>
            <div class="scan-detail-body">
              ${uniquePages.map((pageUrl) => {
                const pageEntries = entries.filter((e) => e.pages[0] === pageUrl);
                return `
                  <div style="margin-bottom:4px">
                    <div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-600)margin-bottom:2px" title="${escHtml(pageUrl)}">${escHtml(pageUrl)}</div>
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

  return `<div class="scan-pane">${toggle}${summary}${body}</div>`;
}

/**
 * Render the Results tab body for a single scan: stats grid, MV banner +
 * filter chips when an MV scan exists, sorted violations, then a collapsed
 * passes section. Reads MV state from the closure for parity with the
 * production caller; the violation-shape and stat math is fully testable
 * via the result argument.
 */
export function renderResults(result: iScanResult): string {
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
    <div style="padding:6px 10px;background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:6px;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--ds-amber-800)">
      Multi-Viewport: ${mvResult.shared.length} shared &middot; ${mvResult.viewportSpecific.length} viewport-specific
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
      <button class="mv-filter-chip cur-pointer min-h-24" data-mvfilter="all" aria-pressed="${mvFilter === null}" aria-label="Show violations for all viewports" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid ${mvFilter === null ? "var(--ds-amber-600)" : "var(--ds-zinc-300)"};background:${mvFilter === null ? "var(--ds-amber-100)" : "#fff"};color:${mvFilter === null ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">All</button>
      ${mvResult.viewports.map((vp) => `<button class="mv-filter-chip font-mono cur-pointer min-h-24" data-mvfilter="${vp}" aria-pressed="${mvFilter === vp}" aria-label="Show violations only at ${vp} pixel viewport" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid ${mvFilter === vp ? "var(--ds-amber-600)" : "var(--ds-zinc-300)"};background:${mvFilter === vp ? "var(--ds-amber-100)" : "#fff"};color:${mvFilter === vp ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">${vp}px</button>`).join("")}
    </div>
  ` : "";

  return `
    <div class="scan-pane">
      ${mvBanner}
      <div class="scan-stats-grid scan-stats-grid--4">
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-red-700)">${totalViolationNodes}</div><div class="scan-caption-strong">Violations</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-green-700)">${result.passes.length}</div><div class="scan-caption-strong">Passes</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-amber-700)">${result.incomplete.length}</div><div class="scan-caption-strong">Review</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-zinc-700)">${passRate}%</div><div class="scan-caption-strong">Pass rate</div></div>
      </div>

      ${displayViolations
        .sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact))
        .map((v) => {
          const vpWidths = viewportSpecificMap.has(v.id) ? (viewportSpecificMap.get(v.id) ?? null) : null;
          return renderViolation(v, vpWidths);
        })
        .join("")}

      <details style="margin-top:8px">
        <summary class="cur-pointer" style="list-style:none;font-size:12px;font-weight:700;color:var(--ds-green-700);padding:6px 0;display:flex;align-items:center;gap:6px">
          <svg aria-hidden="true" class="chevron fs-0" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
          ${result.passes.length} rules passed
        </summary>
        <div>
          ${result.passes.map((p) => `
            <details style="border-bottom:1px solid var(--ds-zinc-100)">
              <summary class="cur-pointer" style="list-style:none;display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:11px">
                <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" class="fs-0"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
                <span class="truncate f-1" style="font-weight:600;color:var(--ds-zinc-800)">${p.id}</span>
                <span class="fs-0" style="color:var(--ds-zinc-500)">${p.wcagCriteria?.join(", ") || ""}</span>
                <span class="fs-0" style="color:var(--ds-green-700);font-weight:700">${p.nodes.length}</span>
              </summary>
              <div style="padding:2px 8px 6px 28px">
                <div style="font-size:11px;color:var(--ds-zinc-600);margin-bottom:4px">${escHtml(p.description)}</div>
                ${p.nodes.map((n) => `
                  <div class="font-mono" style="font-size:11px;color:var(--ds-green-700);padding:2px 8px;margin:1px 0;background:var(--ds-green-50);border-radius:3px;display:flex;align-items:center;gap:6px;overflow:hidden">
                    <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="fs-0"><path d="M1 4l2 2 4-4"/></svg>
                    <span class="truncate">${escHtml(n.selector)}</span>
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

export function renderViolation(v: iScanResult["violations"][0], viewportWidths: number[] | null = null): string {
  // Viewport-specific badge shown when violation only appears at some widths (F02-AC13)
  const vpBadge = viewportWidths && viewportWidths.length > 0
    ? viewportWidths.map((w) => `<span class="font-mono" style="font-size:10px;font-weight:700;padding:1px 4px;background:var(--ds-blue-100);color:var(--ds-sky-700);border-radius:3px;margin-left:2px">${w}px</span>`).join("")
    : "";
  return `
    <details class="severity-${v.impact} sr-details" style="border-radius:0 4px 4px 0;margin-bottom:4px">
      <summary class="scan-detail-summary">
        <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
        <b class="truncate f-1" style="color:var(--ds-zinc-900)">${v.wcagCriteria?.join(", ") || v.id}${vpBadge}</b>
        <span class="fs-0" style="font-weight:700;padding:2px 6px;border-radius:4px;font-size:11px">${v.impact}</span>
        <span class="fs-0 font-mono" style="color:var(--ds-zinc-600);font-weight:700">${v.nodes.length}</span>
      </summary>
      <div class="scan-detail-body">
        ${v.wcagCriteria && v.wcagCriteria.length > 0 ? `<div style="margin-bottom:6px">${v.wcagCriteria.map((c) => `<a href="${getWcagUrl(c)}" target="_blank" rel="noopener" style="font-size:11px;font-weight:700;color:var(--ds-indigo-700);text-decoration:underline;margin-right:8px">${c} — Learn more \u2197</a>`).join("")}</div>` : ""}
        ${v.nodes.map((n) => `
          <div style="background:#fff;border:1px solid var(--ds-zinc-200);border-radius:4px;padding:6px;margin-bottom:4px;font-size:11px">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <span class="truncate font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(n.selector)}</span>
              <button class="highlight-btn fs-0 cur-pointer min-h-24" data-selector="${escHtml(n.selector)}" aria-label="Highlight ${escHtml(n.selector)} on the page" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);background:none;border:none">Highlight</button>
            </div>
            <div style="color:var(--ds-red-700);margin-top:2px">${escHtml(n.failureSummary)}</div>
            <button class="explain-btn cur-pointer min-h-24" data-rule="${v.id}" data-description="${escHtml(v.description)}" style="display:none;font-size:11px;font-weight:700;color:var(--ds-indigo-700);background:none;border:none;margin-top:4px">Chat about it \u2192</button>
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
  return renderManualReviewHtml({
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    pageElements: state.lastScanResult?.pageElements ?? null,
    manualReview: state.manualReview,
  });
}

/**
 * Render the Manual Review tab body. Filters criteria by relevantWhen
 * against pageElements, then per-criterion shows pass/fail/na buttons with
 * aria-pressed reflecting current state. Pure; exported for tests.
 */
export function renderManualReviewHtml(s: {
  wcagVersion: string;
  wcagLevel: string;
  pageElements: import("@shared/types").iPageElements | null;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
}): string {
  const criteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const filtered = s.pageElements
    ? criteria.filter((c) => {
        if (!c.relevantWhen) return true;
        return s.pageElements![c.relevantWhen as keyof typeof s.pageElements];
      })
    : criteria;

  const reviewed = Object.values(s.manualReview).filter((v) => v !== null).length;

  return `
    <div class="scan-pane">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:var(--ds-zinc-600);font-weight:600">${filtered.length} criteria need human review</span>
        <span style="font-size:11px;font-weight:700;color:var(--ds-amber-700)">${reviewed} of ${filtered.length} reviewed</span>
      </div>
      ${filtered.map((c) => {
        const status = s.manualReview[c.id] || null;
        return `
          <div style="padding:8px;border:1px solid var(--ds-zinc-200);border-radius:4px;background:#fff;margin-bottom:6px" data-criterion="${c.id}">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="f-1" style="font-size:11px;font-weight:700;color:var(--ds-zinc-800);min-width:0">${c.id} ${c.name}</span>
              <div class="fs-0" style="display:flex;gap:2px">
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="pass" aria-pressed="${status === "pass"}" aria-label="Mark ${c.id} ${c.name} as Pass" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;min-width:24px;border:none;${status === "pass" ? "background:var(--ds-green-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">Pass</button>
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="fail" aria-pressed="${status === "fail"}" aria-label="Mark ${c.id} ${c.name} as Fail" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;min-width:24px;border:none;${status === "fail" ? "background:var(--ds-red-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">Fail</button>
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="na" aria-pressed="${status === "na"}" aria-label="Mark ${c.id} ${c.name} as Not Applicable" style="padding:4px 8px;font-size:11px;font-weight:700;border-radius:4px;min-width:24px;border:none;${status === "na" ? "background:var(--ds-zinc-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">N/A</button>
              </div>
            </div>
            <div style="font-size:11px;color:var(--ds-zinc-600);line-height:1.5;margin-top:4px">${c.manualCheck}</div>
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
  return renderAriaResultsHtml(state.ariaWidgets);
}

/**
 * Render the ARIA tab body. Empty state shows a 'Scan ARIA Patterns' button.
 * Otherwise splits widgets into compliant + issues sections. Pure; exported
 * for tests.
 */
export function renderAriaResultsHtml(widgets: iAriaWidget[]): string {
  if (widgets.length === 0) {
    return `
      <div style="padding:16px;text-align:center">
        <div style="font-size:12px;color:var(--ds-zinc-500)">No ARIA widgets scanned yet.</div>
        <button id="run-aria-scan" class="cur-pointer min-h-24" style="margin-top:8px;padding:8px;font-size:12px;font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Scan ARIA Patterns</button>
      </div>
    `;
  }

  const issues = widgets.filter((w) => w.failCount > 0);
  const compliant = widgets.filter((w) => w.failCount === 0);

  return `
    <div class="scan-pane">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:var(--ds-zinc-600);font-weight:600">${widgets.length} widgets detected</span>
        <span style="font-size:11px;font-weight:700;color:var(--ds-red-700)">${issues.length} issues \u00b7 ${compliant.length} compliant</span>
      </div>
      ${issues.length > 0 ? `<div style="font-size:11px;font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Issues</div>` : ""}
      ${issues.map((w) => renderAriaWidget(w, false)).join("")}
      ${compliant.length > 0 ? `<div style="font-size:11px;font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 4px">Compliant</div>` : ""}
      ${compliant.map((w) => renderAriaWidget(w, true)).join("")}
    </div>
  `;
}

export function renderAriaWidget(w: iAriaWidget, pass: boolean): string {
  // Per R-ARIA: 'Passing widgets are collapsed by default; failing are open
  // by default'. So issues are open, compliant are closed.
  return `
    <details${pass ? "" : " open"} style="border:1px solid ${pass ? "var(--ds-green-200)" : "var(--ds-red-200)"};border-radius:4px;background:${pass ? "var(--ds-green-50)" : "var(--ds-red-50)"};margin-bottom:4px">
      <summary class="cur-pointer" style="list-style:none;display:flex;align-items:center;gap:8px;padding:8px;font-size:11px">
        <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
        <span style="font-weight:700;padding:2px 6px;border-radius:3px;min-width:50px;text-align:center;${pass ? "background:var(--ds-green-200);color:var(--ds-green-900)" : "background:var(--ds-red-200);color:var(--ds-red-900)"}">${escHtml(w.role)}</span>
        <span class="truncate f-1" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(w.label)}</span>
        <span style="font-weight:700;${pass ? "color:var(--ds-green-700)" : "color:var(--ds-red-700)"}">${pass ? "\u2713" : w.failCount + " issues"}</span>
      </summary>
      <div class="scan-detail-body">
        ${w.checks.filter((c) => !c.pass).map((c) => `
          <div style="font-size:11px;color:var(--ds-red-700);padding:2px 0 2px 8px;border-left:2px solid var(--ds-red-200)">${escHtml(c.message)}</div>
        `).join("")}
        ${w.checks.filter((c) => c.pass).map((c) => `
          <div style="font-size:11px;color:var(--ds-green-700);padding:2px 0 2px 8px;border-left:2px solid var(--ds-green-200)">${escHtml(c.message)}</div>
        `).join("")}
        <button class="aria-highlight cur-pointer min-h-24" data-selector="${escHtml(w.selector)}" aria-label="Highlight ${escHtml(w.role)} ${escHtml(w.label)} on the page" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);background:none;border:none;margin-top:4px">Highlight on page</button>
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
    <div class="scan-pane">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input id="observer-domain-filter" type="search" placeholder="Filter by domain\u2026" aria-label="Filter by domain" value="${observerFilter}" class="f-1" style="font-size:11px;padding:6px 8px;border:1px solid var(--ds-zinc-300);border-radius:4px;min-width:0">
        <button id="clear-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);border:1px solid var(--ds-red-200);border-radius:4px;padding:4px 10px;background:none">Clear</button>
        <button id="export-observer" class="fs-0 cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);border:1px solid var(--ds-amber-300);border-radius:4px;padding:4px 10px;background:none">Export</button>
      </div>
      <div id="observer-list-content">${renderObserverListInner()}</div>
    </div>
  `;
}

function renderObserverListInner(): string {
  return renderObserverListInnerHtml(observerEntries, observerFilter);
}

/**
 * Render the inner observer list (no chrome). Pure; exported for tests.
 * Returns the empty-state copy when entries is empty, the no-match copy
 * when the filter excludes everything, otherwise one row per entry.
 */
export function renderObserverListInnerHtml(
  entries: iObserverEntry[],
  filter: string,
): string {
  if (entries.length === 0) {
    return '<div class="scan-empty">Observer history will appear here as you browse with Observer mode on. Data stays local to your browser.</div>';
  }
  const filtered = filter
    ? entries.filter((e) => e.url.includes(filter) || (e.title || "").toLowerCase().includes(filter.toLowerCase()))
    : entries;
  if (filtered.length === 0) return '<div class="scan-empty">No entries match that domain.</div>';
  return filtered.map((entry) => `
    <div role="button" tabindex="0" aria-label="Open observer entry: ${escHtml(entry.title || entry.url)}" style="padding:8px;border:1px solid var(--ds-zinc-200);border-radius:4px;background:#fff;margin-bottom:4px" class="observer-entry cur-pointer" data-url="${escHtml(entry.url)}">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="fs-0" style="font-size:11px;font-weight:700;color:${entry.violationCount > 0 ? "var(--ds-red-700)" : "var(--ds-green-700)"}">${entry.violationCount}</span>
        <span class="truncate f-1" style="font-size:11px;font-weight:600;color:var(--ds-zinc-800)">${escHtml(entry.title || entry.url)}</span>
        <span class="fs-0" style="font-size:10px;color:var(--ds-zinc-500)">${entry.source === "auto" ? "auto" : "manual"}</span>
        ${entry.viewportBucket ? `<span class="fs-0" style="font-size:10px;color:var(--ds-sky-700);background:var(--ds-blue-100);padding:1px 4px;border-radius:3px">${escHtml(entry.viewportBucket)}</span>` : ""}
      </div>
      <div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-500);margin-top:2px">${escHtml(entry.url)}</div>
      <div style="font-size:10px;color:var(--ds-zinc-500);margin-top:1px">${new Date(entry.timestamp).toLocaleString()}</div>
    </div>
  `).join("");
}

function renderToolbar(): string {
  return `<div class="toolbar">${renderToolbarContent()}</div>`;
}

function renderToolbarContent(): string {
  return renderToolbarContentHtml({
    hasSinglePageScan: !!state.lastScanResult,
    violationsOverlayOn: state.violationsOverlayOn,
  });
}

/**
 * Render the export/overlay toolbar inside the scan tab. HTML/PDF exports
 * are disabled when there's no single-page scan because those formats
 * don't have a crawl-only layout. Pure; exported for tests.
 */
export function renderToolbarContentHtml(s: {
  hasSinglePageScan: boolean;
  violationsOverlayOn: boolean;
}): string {
  const disabledAttr = s.hasSinglePageScan ? "" : 'disabled aria-disabled="true" title="Run a single-page scan to enable this export"';
  return `
      <div class="toolbar-row">
        <span class="toolbar-label" id="export-label">Export</span>
        <button class="toolbar-btn" id="export-json" aria-labelledby="export-label export-json">JSON</button>
        <button class="toolbar-btn" id="export-html" aria-labelledby="export-label export-html" ${disabledAttr}>HTML</button>
        <button class="toolbar-btn" id="export-pdf" aria-labelledby="export-label export-pdf" ${disabledAttr}>PDF</button>
        <button class="toolbar-btn accent" id="export-copy" aria-label="Copy report JSON to clipboard">Copy</button>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">Highlight</span>
        <button class="toolbar-btn${s.violationsOverlayOn ? " active" : ""}" id="toggle-violations" aria-pressed="${s.violationsOverlayOn}" ${s.hasSinglePageScan ? "" : 'disabled aria-disabled="true"'}>Violations</button>
      </div>
  `;
}

/**
 * Sort key for impact severity: critical(0) → serious(1) → moderate(2) →
 * minor(3) → unknown(4). Used to order violations highest-severity-first
 * in render output. Pure; exported for tests.
 */
export function severityOrder(impact: string): number {
  return { critical: 0, serious: 1, moderate: 2, minor: 3 }[impact] ?? 4;
}

/**
 * Build an observer history entry from a manual scan result + the active
 * tab + viewport breakpoints. Pure-ish — depends on `id` and `timestamp`
 * being passed in so tests can pin the values; production passes
 * uuid()/isoNow().
 *
 * Used by F04-AC8 ("manual scans logged to observer when Observer is on").
 * Exported for tests.
 */
export function buildObserverEntry(s: {
  id: string;
  timestamp: string;
  scanResult: iScanResult;
  tab: { url?: string; title?: string; width?: number };
  viewports: number[];
}): iObserverEntry {
  const viewportWidth = s.tab.width ?? 1280;
  return {
    id: s.id,
    url: s.tab.url || "",
    title: s.tab.title || "",
    timestamp: s.timestamp,
    source: "manual",
    violations: s.scanResult.violations,
    passes: s.scanResult.passes,
    violationCount: s.scanResult.violations.reduce((sum, v) => sum + v.nodes.length, 0),
    viewportBucket: getViewportBucket(viewportWidth, s.viewports),
  };
}

/**
 * Merge a multi-viewport scan result into a single iScanResult that the
 * results renderer can consume. Uses the first viewport's metadata
 * (url/timestamp/etc.) and concatenates `shared + viewportSpecific`
 * violations. Returns null if perViewport is empty.
 *
 * Pure; exported for tests. Used after MULTI_VIEWPORT_SCAN to populate
 * state.lastScanResult so the existing single-page Results UI works.
 */
export function mergeMvResultToScan(
  mv: import("@shared/types").iMultiViewportResult,
): iScanResult | null {
  const firstKey = Object.keys(mv.perViewport)[0];
  if (!firstKey) return null;
  const first = mv.perViewport[parseInt(firstKey)];
  return {
    ...first,
    violations: [...mv.shared, ...mv.viewportSpecific] as import("@shared/types").iViolation[],
  };
}

/**
 * Build the START_CRAWL message payload from sidepanel state. The
 * testConfig (when present) takes precedence over the manual UI controls
 * for every field, per F13-AC4. Pure; exported for tests.
 */
export function buildStartCrawlPayload(s: {
  testConfig: import("@shared/types").iTestConfig | null;
  crawlMode: "follow" | "urllist";
  crawlUrlList: string[];
}): {
  mode: "follow" | "urllist";
  timeout: number;
  delay: number;
  scope: string;
  urlList: string[];
  pageRules: import("@shared/types").iPageRule[];
  auth: import("@shared/types").iCrawlAuth | undefined;
  testConfig: import("@shared/types").iTestConfig | undefined;
} {
  const tc = s.testConfig;
  return {
    mode: tc?.crawl?.mode ?? s.crawlMode,
    timeout: tc?.timing?.pageLoadTimeout ?? 30000,
    delay: tc?.timing?.delayBetweenPages ?? 1000,
    scope: tc?.crawl?.scope ?? "",
    urlList: s.crawlMode === "urllist" ? [...s.crawlUrlList] : (tc?.crawl?.urlList ?? []),
    pageRules: tc?.pageRules ?? [],
    auth: tc?.auth ?? undefined,
    testConfig: tc ?? undefined,
  };
}

/**
 * Add a new viewport to the list. Returns a sorted, deduplicated copy.
 * Caps at 6 entries (returns the input unchanged when already at cap).
 * Picks a value 200px wider than the current widest. Pure; exported for tests.
 */
export function addViewport(viewports: number[], maxCount = 6): number[] {
  if (viewports.length >= maxCount) return viewports;
  const newVal = (viewports.length === 0 ? 320 : Math.max(...viewports) + 200);
  if (viewports.includes(newVal)) return viewports;
  return [...viewports, newVal].sort((a, b) => a - b);
}

/**
 * Remove the viewport at index `idx`. Refuses to remove the last entry
 * (can't have a 0-viewport MV scan). Returns the input unchanged when
 * idx is out of bounds. Pure; exported for tests.
 */
export function removeViewport(viewports: number[], idx: number, minCount = 1): number[] {
  if (viewports.length <= minCount) return viewports;
  if (idx < 0 || idx >= viewports.length) return viewports;
  return viewports.filter((_, i) => i !== idx);
}

/**
 * Parse a paste-area string into a deduplicated list of URLs. Recognizes
 * three input shapes:
 *
 * 1. Sitemap XML (<?xml…> or <urlset> or <sitemapindex> root) — extracts
 *    every <loc> element's text content.
 * 2. Plaintext URL list (one per line) — used when input doesn't start with
 *    XML, OR when XML parsing fails (parsererror), OR when XML had zero
 *    <loc> elements. Lines starting with `<` are dropped so partial XML
 *    fragments don't sneak through.
 * 3. Empty / whitespace-only input — returns an empty array.
 *
 * Pure; exported for tests. Used by the URL-list paste-area handler.
 */
export function parsePastedUrls(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let urls: string[] = [];
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<urlset") || trimmed.startsWith("<sitemapindex")) {
    try {
      const doc = new DOMParser().parseFromString(trimmed, "application/xml");
      if (!doc.querySelector("parsererror")) {
        urls = Array.from(doc.querySelectorAll("loc"))
          .map((el) => el.textContent?.trim() || "")
          .filter(Boolean);
      }
    } catch { /* fall through to plaintext */ }
  }
  if (urls.length === 0) {
    urls = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("<"));
  }
  // Dedupe while preserving order
  return Array.from(new Set(urls));
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
      // Move focus to the now-visible Collapse button so keyboard users don't
      // lose context when the accordion-toggle button disappears mid-render.
      document.getElementById("collapse-btn")?.focus();
    }
  });
  document.getElementById("collapse-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.accordionExpanded = false;
    renderScanTab();
    // Mirror: focus the now-visible Expand toggle.
    document.getElementById("accordion-toggle")?.focus();
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
    state.viewports = addViewport(state.viewports);
    renderScanTab();
  });

  // Viewport editor — remove buttons
  document.querySelectorAll<HTMLButtonElement>(".vp-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      state.viewports = removeViewport(state.viewports, idx);
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
      // Crawl navigates to new pages; any overlay from a prior scan is gone.
      // Reset the toggle state so the toolbar/checkboxes match reality.
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      updateTabDisabledStates();
      renderScanTab();
      await sendMessage({ type: "START_CRAWL", payload: buildStartCrawlPayload({
        testConfig: state.testConfig,
        crawlMode: _crawlMode,
        crawlUrlList,
      }) });
    } else {
      const wasResults = state.scanPhase === "results";
      state.scanPhase = "scanning";
      if (!wasResults) { state.accordionExpanded = false; }
      // Remove old overlays and highlights before new scan (F05-AC15).
      // Reset the corresponding state flags so the toolbar/checkbox toggles
      // reflect what's actually on the page after the new scan completes.
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
      sendMessage({ type: "HIDE_TAB_ORDER" });
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
      sendMessage({ type: "CLEAR_HIGHLIGHTS" });
      state.violationsOverlayOn = false;
      state.tabOrderOverlayOn = false;
      state.focusGapsOverlayOn = false;
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
          // Restore manual review for this URL — or reset to {} if none saved (R-MANUAL)
          loadManualReviewFor(state.lastScanResult.url);
        } else if (resType === "MULTI_VIEWPORT_RESULT") {
          // MV scan: store full result and build merged view from shared + all viewport-specific violations
          const mvResult = (result as { payload: import("@shared/types").iMultiViewportResult }).payload;
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
          // F04-AC8: Log manual scan to observer history when observer is on
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
              observerLoaded = false;
            });
          }
          // Auto-play Movie Mode after scan (F06-AC5).
          // Speed comes from testConfig.timing.movieSpeed only — no UI dropdown
          // (per R-KB-keyboard.md). Defaults to 1 if unset.
          if (state.movie) {
            const speed = state.testConfig?.timing?.movieSpeed ?? 1;
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
    // Clear crawl results too — Clear is a full reset of result state.
    state.crawlResults = null;
    state.crawlFailed = null;
    state.crawlWaitInfo = null;
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
    // Update aria-expanded directly — no re-render before opening the dialog,
    // and we don't want the button to flicker. The dialog 'close' listener
    // sets it back via renderScanTab.
    (e.currentTarget as HTMLElement).setAttribute("aria-expanded", "true");
    openConfigDialog();
  });

  // Reset
  document.getElementById("reset-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.crawl = false;
    state.observer = false;
    state.movie = false;
    state.mv = false;
    // Restore viewports to defaults (R-MV: Reset 'restores defaults [375, 768, 1280]').
    state.viewports = [375, 768, 1280];
    state.wcagVersion = "2.2";
    state.wcagLevel = "AA";
    // Also clear test config on Reset (F13-AC7)
    state.testConfig = null;
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
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
    const newUrls = parsePastedUrls(ta.value);
    if (newUrls.length === 0) return;
    let added = 0;
    for (const u of newUrls) {
      if (!crawlUrlList.includes(u)) {
        crawlUrlList.push(u);
        added++;
      }
    }
    // Only clear the textarea if we actually pulled URLs out of it. If nothing
    // was usable (typo'd XML, blank lines), leave the input so the user can fix.
    if (added > 0) ta.value = "";
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
  const addManualUrl = () => {
    const input = document.getElementById("url-manual-input") as HTMLInputElement | null;
    if (!input) return;
    const url = input.value.trim();
    // Use the browser's built-in URL validation (input type="url"). reportValidity
    // surfaces the native error tooltip when the URL is malformed.
    if (!url || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    if (!crawlUrlList.includes(url)) {
      crawlUrlList.push(url);
      input.value = "";
      renderScanTab();
      // Refocus the now-rendered input so the user can keep adding URLs
      document.getElementById("url-manual-input")?.focus();
    }
  };
  document.getElementById("url-manual-add")?.addEventListener("click", addManualUrl);
  document.getElementById("url-manual-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addManualUrl();
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
  document.getElementById("continue-crawl")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
  });
  document.getElementById("scan-then-continue")?.addEventListener("click", async () => {
    // Scan the current page first, then continue crawl
    const result = await sendMessage({ type: "SCAN_REQUEST" });
    if (result && (result as { type: string }).type === "SCAN_RESULT") {
      state.lastScanResult = (result as { payload: iScanResult }).payload;
      state.scanSubTab = "results";
    }
    state.crawlWaitInfo = null;
    sendMessage({ type: "USER_CONTINUE" });
    renderScanTab();
  });
  document.getElementById("cancel-wait")?.addEventListener("click", () => {
    state.crawlWaitInfo = null;
    sendMessage({ type: "CANCEL_CRAWL" });
  });

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
      // Persist per-page (R-MANUAL) so reload restores the same status
      if (state.lastScanResult?.url) saveManualReviewFor(state.lastScanResult.url);
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
    } else {
      // Popup blocked — surface a transient error in the export-pdf button
      // text per R-EXPORT error-handling requirements.
      const btn = document.getElementById("export-pdf");
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Popup blocked";
        setTimeout(() => { btn.textContent = original; }, 3000);
      }
    }
  });
  document.getElementById("export-copy")?.addEventListener("click", async () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const btn = document.getElementById("export-copy");
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    } catch {
      // Clipboard API can fail on insecure contexts or if permission denied.
      // Per R-EXPORT: 'If clipboard write fails: button text changes to
      // Copy failed for 2s'.
      if (btn) {
        btn.textContent = "Copy failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
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
        <div style="padding:12px;background:var(--ds-red-50);border:1px solid var(--ds-red-200);border-radius:8px">
          <div style="font-size:12px;font-weight:700;color:var(--ds-red-800);margin-bottom:4px">Scan failed</div>
          <div style="font-size:11px;color:var(--ds-red-900);word-break:break-all">${escHtml(message)}</div>
        </div>
      </div>
    `;
  }
}

function getDomain(): string {
  return urlToDomainSlug(state.lastScanResult?.url || "");
}

/**
 * Convert a URL to a filename-safe domain slug: hostname with dots → hyphens.
 * Returns "unknown" when the input isn't a parseable URL. Used in export
 * filenames. Pure; exported for tests.
 */
export function urlToDomainSlug(url: string): string {
  try { return new URL(url).hostname.replace(/\./g, "-"); } catch { return "unknown"; }
}

function getDateStamp(): string {
  return formatDateStamp(new Date());
}

/**
 * Format a Date as YYYY-MM-DD_HH-mm for filename suffixes. Pure;
 * exported for tests so the formatter can be exercised on fixed Dates.
 */
export function formatDateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Compute the summary block of a JSON / HTML report from scan arrays.
 * `passRate` is the percent of rules that fully passed (out of violations +
 * passes). When totalRules is 0 (e.g., empty crawl), passRate is 100.
 *
 * Pure; exported for tests. Used by buildJsonReport / buildHtmlReport.
 */
export function computeReportSummary(
  violations: { nodes: unknown[] }[],
  passes: unknown[],
  incomplete: unknown[],
): { violationCount: number; passCount: number; incompleteCount: number; passRate: number } {
  const totalRules = violations.length + passes.length;
  return {
    violationCount: violations.reduce((s, v) => s + v.nodes.length, 0),
    passCount: passes.length,
    incompleteCount: incomplete.length,
    passRate: totalRules > 0 ? Math.round((passes.length / totalRules) * 100) : 100,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Export Builders (F12)
   ═══════════════════════════════════════════════════════════════════ */

function buildJsonReport(): import("@shared/types").iJsonReport {
  return buildJsonReportFrom({
    lastScanResult: state.lastScanResult,
    crawlResults: state.crawlResults,
    crawlFailed: state.crawlFailed,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
    lastMvResult: state.lastMvResult,
    tabOrder: getTabOrder(),
    focusGaps: getFocusGaps(),
    documentTitle: document.title,
    nowIso: new Date().toISOString(),
  });
}

/**
 * Build the JSON export report from a snapshot of sidepanel state.
 * Pure; exported for tests. The closure-bound caller passes live state +
 * tab-order + focus-gap data; tests can pass any shape they want to
 * exercise the conditional sections (manualReview, ariaWidgets, tabOrder,
 * focusGaps, viewportAnalysis, crawl).
 */
export function buildJsonReportFrom(s: {
  lastScanResult: iScanResult | null;
  crawlResults: Record<string, iScanResult> | null;
  crawlFailed: Record<string, string> | null;
  wcagVersion: string;
  wcagLevel: string;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  ariaWidgets: iAriaWidget[];
  lastMvResult: import("@shared/types").iMultiViewportResult | null;
  tabOrder: import("@shared/types").iTabOrderElement[];
  focusGaps: import("@shared/types").iFocusGap[];
  documentTitle: string;
  nowIso: string;
}): import("@shared/types").iJsonReport {
  const r = s.lastScanResult;
  const firstCrawlPage = !r && s.crawlResults
    ? Object.values(s.crawlResults)[0] ?? null
    : null;
  const anchor = r ?? firstCrawlPage;
  const violations = r ? r.violations : [];
  const passes = r ? r.passes : [];
  const incomplete = r ? r.incomplete : [];

  const report: import("@shared/types").iJsonReport = {
    metadata: {
      url: anchor?.url ?? "",
      title: s.documentTitle || anchor?.url || "",
      timestamp: anchor?.timestamp ?? s.nowIso,
      wcagVersion: s.wcagVersion,
      wcagLevel: s.wcagLevel,
      toolVersion: "1.0.0",
      scanDurationMs: anchor?.scanDurationMs ?? 0,
    },
    summary: computeReportSummary(violations, passes, incomplete),
    violations,
    passes,
    incomplete,
  };

  // F12-AC8: manual review criteria with statuses
  const allCriteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const pageElements = s.lastScanResult?.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(s.manualReview).filter((v) => v !== null).length;
  if (reviewedCount > 0) {
    report.manualReview = {
      reviewed: reviewedCount,
      total: filteredCriteria.length,
      criteria: filteredCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        status: s.manualReview[c.id] ?? null,
      })),
    };
  }

  if (s.ariaWidgets.length > 0) report.ariaWidgets = s.ariaWidgets;
  if (s.tabOrder.length > 0) report.tabOrder = s.tabOrder;
  if (s.focusGaps.length > 0) report.focusGaps = s.focusGaps;
  if (s.lastMvResult) report.viewportAnalysis = s.lastMvResult;

  if (s.crawlResults && Object.keys(s.crawlResults).length > 0) {
    const failedEntries = s.crawlFailed ?? {};
    report.crawl = {
      pagesScanned: Object.keys(s.crawlResults).length,
      pagesFailed: Object.keys(failedEntries).length,
      results: s.crawlResults,
    };
  }

  return report;
}

function buildHtmlReport(): string {
  if (!state.lastScanResult) throw new Error("buildHtmlReport called without a single-page scan result");
  return buildHtmlReportFrom({
    scan: state.lastScanResult,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
  });
}

/**
 * Build a self-contained HTML report. The output is downloaded by the user
 * and opened standalone, so all CSS is inlined and color literals are used
 * directly (the design tokens aren't available outside the side panel).
 *
 * Pure; exported for tests. Throws if `scan` is null since the caller
 * gates on state.lastScanResult.
 */
export function buildHtmlReportFrom(s: {
  scan: iScanResult;
  wcagVersion: string;
  wcagLevel: string;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  ariaWidgets: iAriaWidget[];
}): string {
  const r = s.scan;
  const totalViolationNodes = r.violations.reduce((sum, v) => sum + v.nodes.length, 0);
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
  <div><strong>WCAG:</strong> ${s.wcagVersion} ${s.wcagLevel} &middot; <strong>Duration:</strong> ${r.scanDurationMs}ms</div>
</div>
<div class="summary">
  <div class="summary-card"><div class="num" style="color:var(--ds-red-700)">${totalViolationNodes}</div><div class="label">Violations</div></div>
  <div class="summary-card"><div class="num" style="color:var(--ds-green-700)">${r.passes.length}</div><div class="label">Passes</div></div>
  <div class="summary-card"><div class="num" style="color:var(--ds-amber-700)">${r.incomplete.length}</div><div class="label">Review</div></div>
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
${s.ariaWidgets.length > 0 ? `
<h2>ARIA Widgets (${s.ariaWidgets.length})</h2>
${s.ariaWidgets.map((w) => `<div class="pass">${w.failCount > 0 ? "&cross" : "&check"} ${escHtml(w.role)} — ${escHtml(w.label)} (${w.failCount} issues)</div>`).join("")}
` : ""}
${(() => {
  const allCriteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const pageElements = r.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(s.manualReview).filter((v) => v !== null).length;
  if (reviewedCount === 0) return "";
  const rows = filteredCriteria.map((c) => {
    const status = s.manualReview[c.id] ?? null;
    const color = status === "pass" ? "#047857" : status === "fail" ? "#b91c1c" : status === "na" ? "#52525b" : "#a1a1aa";
    const label = status === "pass" ? "Pass" : status === "fail" ? "Fail" : status === "na" ? "N/A" : "Not reviewed";
    return `<tr><td style="padding:4px 8px;font-size:12px">${escHtml(c.id)}</td><td style="padding:4px 8px;font-size:12px">${escHtml(c.name)}</td><td style="padding:4px 8px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>`;
  }).join("");
  return `<h2>Manual Review (${reviewedCount}/${filteredCriteria.length} reviewed)</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <thead><tr style="background:var(--ds-zinc-100)"><th style="padding:6px 8px;text-align:left;font-size:12px">Criterion</th><th style="padding:6px 8px;text-align:left;font-size:12px">Name</th><th style="padding:6px 8px;text-align:left;font-size:12px">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
})()}
<footer style="margin-top:32px;padding-top:16px;border-top:1px solid var(--ds-zinc-200);font-size:11px;color:var(--ds-zinc-500)">
  Generated by A11y Scan &middot; ${new Date().toISOString()}
</footer>
</body>
</html>`;
}

