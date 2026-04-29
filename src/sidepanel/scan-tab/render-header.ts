/**
 * Pure renderers for the top of the scan tab: action-button label,
 * expanded/collapsed accordion toggles, mode toggles, MV checkbox,
 * sub-tab nav. No DOM access, no state — every input is a parameter.
 */

/**
 * Compute the scan action button label from mode flags + phase.
 * Source of truth: R-SCAN AC4.
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

  if (crawling) return "Crawling…";
  if (scanning) return "Scanning…";

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

/**
 * Render the expanded settings toolbar: WCAG version + level dropdowns,
 * settings cog with config-loaded badge, Reset, Collapse.
 */
export function renderExpandedToggleHtml(s: {
  wcagVersion: string; wcagLevel: string;
  hasTestConfig: boolean; configPanelOpen: boolean; busy: boolean;
}): string {
  return `
    <select id="wcag-version" aria-label="WCAG version" ${s.busy ? "disabled" : ""} style="font-size:var(--ds-text-md);padding:var(--ds-space-2) var(--ds-space-3);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);font-weight:600">
      <option ${s.wcagVersion === "2.2" ? "selected" : ""}>2.2</option>
      <option ${s.wcagVersion === "2.1" ? "selected" : ""}>2.1</option>
      <option ${s.wcagVersion === "2.0" ? "selected" : ""}>2.0</option>
    </select>
    <select id="wcag-level" aria-label="Conformance level" ${s.busy ? "disabled" : ""} style="font-size:var(--ds-text-md);padding:var(--ds-space-2) var(--ds-space-3);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);font-weight:600">
      <option ${s.wcagLevel === "AA" ? "selected" : ""}>AA</option>
      <option ${s.wcagLevel === "A" ? "selected" : ""}>A</option>
      <option ${s.wcagLevel === "AAA" ? "selected" : ""}>AAA</option>
    </select>
    <div style="display:flex;align-items:center;gap:var(--ds-space-1)">
      <button type="button" id="settings-btn" aria-label="Test configuration" aria-expanded="${s.configPanelOpen}" ${s.busy ? "disabled" : ""} class="cur-pointer" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:${s.configPanelOpen ? "var(--ds-amber-100)" : "none"};border-radius:4px;color:${s.hasTestConfig ? "var(--ds-amber-600)" : "var(--ds-zinc-500)"}">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M11.2 2.8l-1 1M3.8 10.2l-1 1"/></svg>
      </button>
      ${s.hasTestConfig ? '<span style="font-size:var(--ds-text-sm);font-weight:700;color:var(--ds-amber-600);background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);padding:1px 5px;white-space:nowrap">Config loaded</span>' : ""}
    </div>
    <button type="button" id="reset-btn" aria-label="Reset all settings" ${s.busy ? "disabled" : ""} class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);padding:var(--ds-space-2) var(--ds-space-5)">Reset</button>
    <button type="button" id="collapse-btn" aria-label="Collapse settings" class="cur-pointer" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:var(--ds-radius-3);color:var(--ds-zinc-500);margin-left:auto">
      <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5l4-4 4 4"/></svg>
    </button>
  `;
}

/**
 * Render the collapsed settings toolbar showing the WCAG level + active
 * scan-mode chips. ≤2 modes render as individual chips; ≥3 collapse to
 * an "N modes" summary chip.
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
    modeHtml = '<span style="font-size:var(--ds-text-base);color:var(--ds-zinc-500)">Single page</span>';
  } else if (modes.length <= 2) {
    modeHtml = modes.map((m) => `<span style="font-size:var(--ds-text-base);font-weight:600;padding:var(--ds-space-1) var(--ds-space-3);border-radius:var(--ds-radius-3);${modeColors[m as string] || "background:var(--ds-zinc-200);color:var(--ds-zinc-700)"}">${m}</span>`).join(" ");
  } else {
    modeHtml = `<span style="font-size:var(--ds-text-base);font-weight:600;padding:var(--ds-space-1) var(--ds-space-3);border-radius:var(--ds-radius-3);background:var(--ds-zinc-200);color:var(--ds-zinc-700)">${modes.length} modes</span>`;
  }

  return `
    <span style="font-size:var(--ds-text-base);font-weight:600;color:var(--ds-zinc-700)">${s.wcagVersion} ${s.wcagLevel}</span>
    ${modeHtml}
    <span style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--ds-zinc-500);margin-left:auto">
      <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l4 4 4-4"/></svg>
    </span>
  `;
}

/**
 * Render the Crawl / Observe / Movie mode-toggle row.
 * Observe is intentionally hard-disabled (coming soon).
 */
export function renderModeTogglesHtml(s: { crawl: boolean; movie: boolean; busy: boolean }): string {
  return `
    <div class="mode-row" role="group" aria-label="Scan mode">
      <button type="button" class="mode-btn mode-crawl" aria-pressed="${s.crawl}" ${s.busy ? "disabled" : ""} data-mode="crawl">Crawl</button>
      <button type="button" class="mode-btn mode-observe" disabled aria-disabled="true" aria-label="Observe mode — coming soon" style="opacity:0.4;cursor:not-allowed;position:relative" title="Coming soon">Observe<span aria-hidden="true" style="font-size:8px;font-weight:800;color:var(--ds-amber-700);position:absolute;top:-var(--ds-space-1);right:-var(--ds-space-1);background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-2);padding:0 3px;line-height:1.4">SOON</span></button>
      <button type="button" class="mode-btn mode-movie" aria-pressed="${s.movie}" ${s.busy ? "disabled" : ""} data-mode="movie">Movie</button>
    </div>
  `;
}

/**
 * Render the Multi-Viewport checkbox + viewport chips/editor row.
 * When mv=false, just the checkbox. When mv=true, chip row showing each
 * viewport width; in editing mode, an inline editor with +add and done.
 */
export function renderMvCheckboxHtml(s: {
  mv: boolean;
  viewports: number[];
  viewportEditing: boolean;
  busy: boolean;
}): string {
  const chipsRow = s.mv
    ? s.mv && s.viewportEditing
      ? `<div style="padding-left:var(--ds-space-12);margin-top:var(--ds-space-2)">
          <div style="display:flex;flex-wrap:wrap;gap:var(--ds-space-2);align-items:center;margin-bottom:var(--ds-space-2)">
            ${s.viewports.map((v, i) => `
              <input type="number" min="320" value="${v}" data-index="${i}" class="vp-input font-mono min-h-24" aria-label="Viewport ${i + 1} width in pixels"
                style="width:60px;font-size:var(--ds-text-base);font-weight:600;padding:var(--ds-space-1) var(--ds-space-2);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-800);box-sizing:border-box">
              <button type="button" class="vp-remove cur-pointer min-h-24" data-index="${i}" aria-label="Remove ${v}px viewport"
                style="font-size:var(--ds-text-md);font-weight:700;line-height:1;padding:var(--ds-space-1) 5px;border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-600)"
                ${s.viewports.length <= 1 ? "disabled" : ""}>×</button>
            `).join("")}
          </div>
          <div style="display:flex;gap:var(--ds-space-3);align-items:center">
            <button type="button" id="vp-add"
              class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:var(--ds-space-1) var(--ds-space-4);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-800)"
              ${s.viewports.length >= 6 ? "disabled" : ""}>+ add</button>
            <button type="button" id="vp-done"
              class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:var(--ds-space-1) var(--ds-space-4);border:1px solid var(--ds-amber-600);border-radius:var(--ds-radius-3);background:var(--ds-amber-100);color:var(--ds-amber-800)">done</button>
          </div>
        </div>`
      : `<div style="display:flex;align-items:center;gap:var(--ds-space-2);padding-left:var(--ds-space-12);flex-wrap:wrap">
          ${s.viewports.map((v) => `<span class="font-mono" style="font-size:var(--ds-text-base);font-weight:600;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);padding:var(--ds-space-1) var(--ds-space-3)">${v}</span>`).join("")}
          <button type="button" id="vp-edit"
            class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:1px var(--ds-space-3);border:none;background:none;color:var(--ds-indigo-700);text-decoration:underline">edit</button>
        </div>`
    : "";

  return `
    <label class="cur-pointer" style="display:flex;align-items:center;gap:var(--ds-space-3);${s.busy ? "opacity:0.4;pointer-events:none" : ""}">
      <input type="checkbox" id="mv-check" ${s.mv ? "checked" : ""} ${s.busy ? "disabled" : ""} class="cur-pointer" style="width:16px;height:16px;accent-color:var(--ds-amber-600)">
      <span style="font-size:var(--ds-text-md);font-weight:600;color:var(--ds-zinc-800)">Multi-Viewport</span>
    </label>
    ${chipsRow}
  `;
}

/**
 * Render the sub-tab nav row (Results / Manual / ARIA, plus Observe when
 * Observer mode is on).
 */
export function renderSubTabsHtml(s: { observer: boolean; activeSubTab: string }): string {
  const tabs = ["results", "manual", "aria"];
  if (s.observer) tabs.push("observe");
  return `
    <div class="sub-tabs" role="tablist" aria-label="Scan results sections">
      ${tabs.map((t) => {
        const label = t === "results" ? "Results" : t === "manual" ? "Manual" : t === "aria" ? "ARIA" : "Observe";
        const isActive = t === s.activeSubTab;
        return `<button type="button" role="tab" id="subtab-${t}" aria-selected="${isActive}" aria-controls="scan-content" tabindex="${isActive ? "0" : "-1"}" class="sub-tab ${isActive ? "active" : ""}" data-subtab="${t}">${label}</button>`;
      }).join("")}
    </div>
  `;
}
