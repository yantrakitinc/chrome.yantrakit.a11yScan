/**
 * Keyboard tab (F16).
 */

import { sendMessage } from "@shared/messages";
import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";

let tabOrder: iTabOrderElement[] = [];
let focusGaps: iFocusGap[] = [];
let focusIndicators: iFocusIndicator[] = [];
let keyboardTraps: iKeyboardTrap[] = [];
let skipLinks: iSkipLink[] = [];
let moviePlaying = false;
let moviePaused = false;
let kbAnalyzed = false;

/** Returns the current tab order for F12 export */
export function getTabOrder(): iTabOrderElement[] { return tabOrder; }

/** Returns the current focus gaps for F12 export */
export function getFocusGaps(): iFocusGap[] { return focusGaps; }

export function renderKeyboardTab(): void {
  const panel = document.getElementById("panel-kb");
  if (!panel) return;

  const failedIndicators = focusIndicators.filter((fi) => !fi.hasIndicator);

  panel.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;gap:8px;background:#fafafa;flex-shrink:0">
      <button id="kb-analyze" style="flex:1;padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">Analyze</button>
      ${kbAnalyzed ? '<button id="kb-clear" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;min-height:24px">Clear</button>' : ""}
    </div>
    ${!kbAnalyzed ? '<div style="flex:1;padding:16px;text-align:center;font-size:12px;color:#71717a">Click Analyze to scan keyboard navigation.</div>' : ""}
    ${kbAnalyzed ? `<div style="flex:1;overflow-y:auto;min-height:0">
      <details open>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#18181b;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fafafa">Tab Order \u2014 ${tabOrder.length} elements</summary>
        <div>
          ${tabOrder.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">Click Analyze to scan keyboard navigation.</div>'
            : tabOrder.map((el) => `
              <div class="kb-row" data-selector="${el.selector}" style="display:flex;align-items:center;gap:8px;padding:4px 12px;border-bottom:1px solid #f4f4f5;cursor:pointer;min-height:30px;transition:background 0.1s">
                <span style="font-size:11px;font-family:monospace;font-weight:700;color:#fff;background:#1e1b4b;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${el.index}</span>
                <span style="font-size:11px;font-weight:700;padding:2px 4px;border-radius:3px;flex-shrink:0;${el.role === "button" ? "background:#ede9fe;color:#5b21b6" : el.role === "link" ? "background:#e0f2fe;color:#075985" : "background:#d1fae5;color:#065f46"}">${el.role}</span>
                <span style="font-size:11px;font-weight:600;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el.accessibleName}</span>
                <span style="font-size:11px;font-weight:700;color:${el.hasFocusIndicator ? "#047857" : "#b91c1c"};flex-shrink:0">${el.hasFocusIndicator ? "\u2713" : "\u2717"}</span>
              </div>
            `).join("")
          }
        </div>
      </details>
      <details${focusGaps.length > 0 ? " open" : ""}>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#b91c1c;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fef2f2">Focus Gaps \u2014 ${focusGaps.length} elements</summary>
        <div style="padding:${focusGaps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${focusGaps.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">No focus gaps detected.</div>'
            : focusGaps.map((g) => `
              <div class="kb-gap" data-selector="${g.selector}" style="font-size:11px;padding:8px;border:1px solid #fecaca;background:#fef2f2;border-radius:4px;cursor:pointer">
                <div style="font-family:monospace;font-weight:600;color:#27272a">${g.selector}</div>
                <div style="color:#b91c1c;margin-top:2px">${g.reason}</div>
              </div>
            `).join("")}
        </div>
      </details>
      <details${failedIndicators.length > 0 ? " open" : ""}>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#d97706;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fffbeb">Focus Indicators \u2014 ${failedIndicators.length} missing</summary>
        <div style="padding:${failedIndicators.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${focusIndicators.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">Run Analyze to check focus indicators.</div>'
            : failedIndicators.length === 0
              ? '<div style="padding:12px;font-size:11px;color:#047857;text-align:center">All focusable elements have visible focus indicators.</div>'
              : failedIndicators.map((fi) => `
                <div class="kb-fi" data-selector="${fi.selector}" style="font-size:11px;padding:8px;border:1px solid #fde68a;background:#fffbeb;border-radius:4px;cursor:pointer">
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${fi.selector}</div>
                  <div style="color:#d97706;margin-top:2px">No visible focus indicator detected</div>
                </div>
              `).join("")}
        </div>
      </details>
      <details${keyboardTraps.length > 0 ? " open" : ""}>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#dc2626;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fef2f2">Keyboard Traps \u2014 ${keyboardTraps.length}</summary>
        <div style="padding:${keyboardTraps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${tabOrder.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">Run Analyze to detect keyboard traps.</div>'
            : keyboardTraps.length === 0
              ? '<div style="padding:12px;font-size:11px;color:#047857;text-align:center">No keyboard traps detected.</div>'
              : keyboardTraps.map((t) => `
                <div class="kb-trap" data-selector="${t.selector}" style="font-size:11px;padding:8px;border:1px solid #fecaca;background:#fef2f2;border-radius:4px;cursor:pointer">
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${t.selector}</div>
                  <div style="color:#dc2626;margin-top:2px">${t.description}</div>
                </div>
              `).join("")}
        </div>
      </details>
      <details>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#0369a1;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#f0f9ff">Skip Links \u2014 ${skipLinks.length}</summary>
        <div style="padding:${skipLinks.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${tabOrder.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">Run Analyze to detect skip links.</div>'
            : skipLinks.length === 0
              ? '<div style="padding:12px;font-size:11px;color:#d97706;text-align:center">No skip links found. Consider adding a "Skip to main content" link.</div>'
              : skipLinks.map((sl) => `
                <div style="font-size:11px;padding:8px;border:1px solid ${sl.targetExists ? "#bae6fd" : "#fecaca"};background:${sl.targetExists ? "#f0f9ff" : "#fef2f2"};border-radius:4px">
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${sl.selector}</div>
                  <div style="margin-top:2px;color:${sl.targetExists ? "#0369a1" : "#dc2626"}">
                    Target: ${sl.target} ${sl.targetExists ? "\u2713 exists" : "\u2717 target not found"}
                  </div>
                </div>
              `).join("")}
        </div>
      </details>
      <details>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#7c3aed;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#f5f3ff">Movie Mode</summary>
        <div style="padding:12px">
          <p style="font-size:11px;color:#52525b;margin-bottom:8px">Animated walkthrough of the keyboard tab order.</p>
          ${moviePlaying ? '<div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;padding:4px 8px;background:#ede9fe;border-radius:4px;display:inline-block">&#9654; Playing\u2026</div>' : ""}
          <div style="display:flex;align-items:center;gap:8px">
            <button id="movie-play" style="padding:6px 12px;font-size:11px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">${moviePlaying ? "Pause" : "Play"}</button>
            <button id="movie-stop" ${!moviePlaying ? "disabled" : ""} style="padding:6px 12px;font-size:11px;font-weight:700;color:${moviePlaying ? "#dc2626" : "#a1a1aa"};border:1px solid ${moviePlaying ? "#fecaca" : "#e4e4e7"};border-radius:4px;background:none;min-height:24px;cursor:${moviePlaying ? "pointer" : "not-allowed"}">Stop</button>
            <select id="movie-speed" aria-label="Movie speed" style="font-size:11px;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;font-weight:600;margin-left:auto">
              <option value="0.5">0.5&times;</option>
              <option value="1" selected>1&times;</option>
              <option value="2">2&times;</option>
              <option value="4">4&times;</option>
            </select>
          </div>
        </div>
      </details>
    </div>` : ""}
    ${kbAnalyzed ? `<!-- Overlay toggles — Tab order + Focus gaps live here, not in Scan tab -->
    <div style="flex-shrink:0;border-top:2px solid #d4d4d8;background:#f4f4f5">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 12px">
        <span style="font-size:11px;font-weight:800;color:#52525b">Highlight</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#3f3f46;cursor:pointer;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;min-height:24px">
          <input type="checkbox" id="toggle-tab-order" style="margin:0">
          Tab order
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#3f3f46;cursor:pointer;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;min-height:24px">
          <input type="checkbox" id="toggle-focus-gaps" style="margin:0">
          Focus gaps
        </label>
      </div>
    </div>` : ""}
  `;

  // Analyze — fetch all keyboard data
  document.getElementById("kb-analyze")?.addEventListener("click", async () => {
    const [tabResult, gapResult, fiResult, trapResult, slResult] = await Promise.all([
      sendMessage({ type: "GET_TAB_ORDER" }),
      sendMessage({ type: "GET_FOCUS_GAPS" }),
      sendMessage({ type: "GET_FOCUS_INDICATORS" }),
      sendMessage({ type: "GET_KEYBOARD_TRAPS" }),
      sendMessage({ type: "GET_SKIP_LINKS" }),
    ]);
    if (tabResult && (tabResult as { type: string }).type === "TAB_ORDER_RESULT") {
      tabOrder = (tabResult as { payload: iTabOrderElement[] }).payload;
    }
    if (gapResult && (gapResult as { type: string }).type === "FOCUS_GAPS_RESULT") {
      focusGaps = (gapResult as { payload: iFocusGap[] }).payload;
    }
    if (fiResult && (fiResult as { type: string }).type === "FOCUS_INDICATORS_RESULT") {
      focusIndicators = (fiResult as { payload: iFocusIndicator[] }).payload;
    }
    if (trapResult && (trapResult as { type: string }).type === "KEYBOARD_TRAPS_RESULT") {
      keyboardTraps = (trapResult as { payload: iKeyboardTrap[] }).payload;
    }
    if (slResult && (slResult as { type: string }).type === "SKIP_LINKS_RESULT") {
      skipLinks = (slResult as { payload: iSkipLink[] }).payload;
    }
    kbAnalyzed = true;
    renderKeyboardTab();
  });

  // Clear
  document.getElementById("kb-clear")?.addEventListener("click", () => {
    tabOrder = [];
    focusGaps = [];
    focusIndicators = [];
    keyboardTraps = [];
    skipLinks = [];
    kbAnalyzed = false;
    moviePlaying = false;
    renderKeyboardTab();
  });

  // Row hover (no inline handlers — CSP) + click → highlight
  document.querySelectorAll<HTMLDivElement>(".kb-row").forEach((row) => {
    row.addEventListener("mouseenter", () => { row.style.background = "#fafafa"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
    row.addEventListener("click", () => {
      const selector = row.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
    });
  });

  // Gap/indicator/trap item click → highlight
  document.querySelectorAll<HTMLDivElement>(".kb-gap, .kb-fi, .kb-trap").forEach((item) => {
    item.addEventListener("click", () => {
      const selector = item.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
    });
  });

  // Movie controls
  document.getElementById("movie-play")?.addEventListener("click", () => {
    const speed = parseFloat((document.getElementById("movie-speed") as HTMLSelectElement).value);
    sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
    if (moviePlaying) {
      sendMessage({ type: "PAUSE_MOVIE_MODE" });
      moviePlaying = false;
      moviePaused = true;
    } else {
      sendMessage(moviePaused ? { type: "RESUME_MOVIE_MODE" } : { type: "START_MOVIE_MODE" });
      moviePlaying = true;
      moviePaused = false;
    }
    renderKeyboardTab();
  });
  document.getElementById("movie-stop")?.addEventListener("click", () => {
    sendMessage({ type: "STOP_MOVIE_MODE" });
    moviePlaying = false;
    moviePaused = false;
    renderKeyboardTab();
  });

  // Speed change during playback
  document.getElementById("movie-speed")?.addEventListener("change", () => {
    const speed = parseFloat((document.getElementById("movie-speed") as HTMLSelectElement).value);
    sendMessage({ type: "SET_MOVIE_SPEED", payload: { speed } });
  });

  // Overlay toggles
  document.getElementById("toggle-tab-order")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    sendMessage(checked ? { type: "SHOW_TAB_ORDER" } : { type: "HIDE_TAB_ORDER" });
  });
  document.getElementById("toggle-focus-gaps")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    sendMessage(checked ? { type: "SHOW_FOCUS_GAPS" } : { type: "HIDE_FOCUS_GAPS" });
  });
}
