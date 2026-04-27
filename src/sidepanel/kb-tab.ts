/**
 * Keyboard tab (F16).
 */

import { sendMessage } from "@shared/messages";
import { state } from "./sidepanel";
import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";

let tabOrder: iTabOrderElement[] = [];
let focusGaps: iFocusGap[] = [];
let focusIndicators: iFocusIndicator[] = [];
let keyboardTraps: iKeyboardTrap[] = [];
let skipLinks: iSkipLink[] = [];
let kbAnalyzed = false;
let moviePlayState: "idle" | "playing" | "paused" | "complete" = "idle";
let movieIndex = 0;

// Tracks the row the user clicked/activated so the panel highlights it for 3s
// (matches the page-element highlight duration). Mirrors SR tab pattern.
let selectedKbIndex: number | null = null;
let selectedKbTimer: ReturnType<typeof setTimeout> | null = null;

/** Receives MOVIE_TICK from the content script — keeps the "Playing N of total"
   counter and the active-row highlight in sync with what's actually playing. */
export function onMovieTick(currentIndex: number): void {
  if (moviePlayState !== "playing") return;
  movieIndex = currentIndex;
  renderKeyboardTab();
}

/** Receives MOVIE_COMPLETE from the content script — drops controls back
   to idle and clears the highlight. Without this the kb-tab stays stuck
   on Pause/Stop forever after the movie reaches the last element. */
let movieCompleteTimer: ReturnType<typeof setTimeout> | null = null;
export function onMovieComplete(): void {
  if (moviePlayState === "idle") return;
  moviePlayState = "complete";
  renderKeyboardTab();
  if (movieCompleteTimer) clearTimeout(movieCompleteTimer);
  movieCompleteTimer = setTimeout(() => {
    moviePlayState = "idle";
    movieIndex = 0;
    movieCompleteTimer = null;
    renderKeyboardTab();
  }, 2000);
}

/** Escape page-derived strings for safe innerHTML interpolation. */
function escKb(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Flash a kb-gap/kb-fi/kb-trap item in the panel for 3s on activation.
// Direct DOM manipulation — no re-render needed, won't fight inline styles.
const kbFlashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
function flashKbItem(item: HTMLElement): void {
  const existing = kbFlashTimers.get(item);
  if (existing) clearTimeout(existing);
  item.classList.add("ds-flash-active");
  const t = setTimeout(() => {
    item.classList.remove("ds-flash-active");
    kbFlashTimers.delete(item);
  }, 3000);
  kbFlashTimers.set(item, t);
}

/** Returns the current tab order for F12 export */
export function getTabOrder(): iTabOrderElement[] { return tabOrder; }

/** Returns the current focus gaps for F12 export */
export function getFocusGaps(): iFocusGap[] { return focusGaps; }

/** Preserves scroll position across re-renders so row-clicks/state changes
   don't yank the user back to the top of the analyzed list. */
let kbSavedScroll = 0;
let kbScrollSetByAnalyze = false;

export function renderKeyboardTab(): void {
  const panel = document.getElementById("panel-kb");
  if (!panel) return;

  // Save current scroll before innerHTML replacement.
  const prevScroll = document.getElementById("kb-scroll-container")?.scrollTop ?? null;
  if (prevScroll !== null) kbSavedScroll = prevScroll;

  const failedIndicators = focusIndicators.filter((fi) => !fi.hasIndicator);

  panel.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;gap:8px;background:#fafafa;flex-shrink:0">
      <button id="kb-analyze" style="flex:1;padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">Analyze</button>
      ${kbAnalyzed ? '<button id="kb-clear" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;min-height:24px">Clear</button>' : ""}
    </div>
    ${!kbAnalyzed ? '<div style="flex:1;padding:16px;text-align:center;font-size:12px;color:#71717a">Click Analyze to scan keyboard navigation.</div>' : ""}
    ${kbAnalyzed ? `<div id="kb-scroll-container" style="flex:1;overflow-y:auto;min-height:0">
      <details open>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#18181b;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fafafa;display:flex;align-items:center;gap:8px">
          <span style="flex:1">Tab Order \u2014 ${tabOrder.length} elements</span>
          ${tabOrder.length > 0 && (moviePlayState === "idle" || moviePlayState === "complete") ? `
            <button id="movie-play-all" aria-label="Play all - animate through tab order" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;color:#b45309">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z"/></svg>
            </button>
            ${moviePlayState === "complete" ? `<span style="font-size:11px;font-family:monospace;color:#047857;font-weight:600">Complete</span>` : ""}
          ` : ""}
          ${moviePlayState === "playing" ? `
            <button id="movie-pause" aria-label="Pause movie" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;color:#b45309">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg>
            </button>
            <button id="movie-stop" aria-label="Stop movie" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;color:#dc2626">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8"/></svg>
            </button>
            <span style="font-size:11px;font-family:monospace;color:#92400e;font-weight:600">Playing ${movieIndex + 1} of ${tabOrder.length}</span>
          ` : ""}
          ${moviePlayState === "paused" ? `
            <button id="movie-resume" aria-label="Resume movie" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;color:#b45309">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z"/></svg>
            </button>
            <button id="movie-stop" aria-label="Stop movie" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;color:#dc2626">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8"/></svg>
            </button>
            <span style="font-size:11px;font-family:monospace;color:#92400e;font-weight:600">Paused at ${movieIndex + 1} of ${tabOrder.length}</span>
          ` : ""}
        </summary>
        <div>
          ${tabOrder.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">Click Analyze to scan keyboard navigation.</div>'
            : tabOrder.map((el, i) => {
              const escName = escKb(el.accessibleName);
              const roleClass = el.role === "button" ? "ds-badge--role-button"
                : el.role === "link" ? "ds-badge--role-link"
                : el.role === "textbox" ? "ds-badge--role-textbox"
                : "ds-badge--role-default";
              const isActive = (moviePlayState !== "idle" && i === movieIndex) || (selectedKbIndex === i);
              const focusLabel = el.hasFocusIndicator ? "Has visible focus indicator" : "Missing visible focus indicator";
              const focusColor = el.hasFocusIndicator ? "var(--ds-green-700)" : "var(--ds-red-700)";
              return `
              <div class="ds-row kb-row${isActive ? " ds-row--active" : ""}" role="button" tabindex="0" aria-label="Highlight ${escKb(el.role)}: ${escName}" data-selector="${escKb(el.selector)}" data-index="${i}">
                <span class="ds-row__index-circle">${el.index}</span>
                <span class="ds-badge ${roleClass}">${escKb(el.role)}</span>
                <span class="ds-row__label">${escName}</span>
                <span aria-label="${focusLabel}" title="${focusLabel}" style="display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${focusColor}">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                    <circle cx="7" cy="7" r="5"/>
                    <circle cx="7" cy="7" r="2"/>
                    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13"/>
                  </svg>
                </span>
              </div>
            `;}).join("")
          }
        </div>
      </details>
      <details${focusGaps.length > 0 ? " open" : ""}>
        <summary style="padding:8px 12px;font-size:12px;font-weight:800;color:#b91c1c;cursor:pointer;border-bottom:1px solid #e4e4e7;background:#fef2f2">Focus Gaps \u2014 ${focusGaps.length} elements</summary>
        <div style="padding:${focusGaps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${focusGaps.length === 0
            ? '<div style="padding:12px;font-size:11px;color:#71717a;text-align:center">No focus gaps detected.</div>'
            : focusGaps.map((g) => `
              <div class="kb-gap" role="button" tabindex="0" aria-label="Highlight focus gap: ${escKb(g.selector)}" data-selector="${escKb(g.selector)}" style="font-size:11px;padding:8px;border:1px solid #fecaca;background:#fef2f2;border-radius:4px;cursor:pointer">
                <div style="font-family:monospace;font-weight:600;color:#27272a">${escKb(g.selector)}</div>
                <div style="color:#b91c1c;margin-top:2px">${escKb(g.reason)}</div>
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
                <div class="kb-fi" role="button" tabindex="0" aria-label="Highlight missing focus indicator: ${escKb(fi.selector)}" data-selector="${escKb(fi.selector)}" style="font-size:11px;padding:8px;border:1px solid #fde68a;background:#fffbeb;border-radius:4px;cursor:pointer">
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${escKb(fi.selector)}</div>
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
                <div class="kb-trap" role="button" tabindex="0" aria-label="Highlight keyboard trap: ${escKb(t.selector)}" data-selector="${escKb(t.selector)}" style="font-size:11px;padding:8px;border:1px solid #fecaca;background:#fef2f2;border-radius:4px;cursor:pointer">
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${escKb(t.selector)}</div>
                  <div style="color:#dc2626;margin-top:2px">${escKb(t.description)}</div>
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
                  <div style="font-family:monospace;font-weight:600;color:#27272a">${escKb(sl.selector)}</div>
                  <div style="margin-top:2px;color:${sl.targetExists ? "#0369a1" : "#dc2626"}">
                    Target: ${escKb(sl.target)} ${sl.targetExists ? "\u2713 exists" : "\u2717 target not found"}
                  </div>
                </div>
              `).join("")}
        </div>
      </details>
    </div>` : ""}
    ${kbAnalyzed ? `<!-- Overlay toggles — Tab order + Focus gaps live here, not in Scan tab -->
    <div style="flex-shrink:0;border-top:2px solid #d4d4d8;background:#f4f4f5">
      <div style="display:flex;align-items:center;gap:6px;padding:6px 12px">
        <span style="font-size:11px;font-weight:800;color:#52525b">Highlight</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#3f3f46;cursor:pointer;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;min-height:24px">
          <input type="checkbox" id="toggle-tab-order" ${state.tabOrderOverlayOn ? "checked" : ""} style="margin:0">
          Tab order
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#3f3f46;cursor:pointer;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;min-height:24px">
          <input type="checkbox" id="toggle-focus-gaps" ${state.focusGapsOverlayOn ? "checked" : ""} style="margin:0">
          Focus gaps
        </label>
      </div>
    </div>` : ""}
  `;

  // Restore scroll. Analyze/Clear set kbScrollSetByAnalyze=true to start at top
  // for the freshly-loaded list; everything else (row clicks, movie state changes)
  // restores the previous scroll position.
  const sc = document.getElementById("kb-scroll-container");
  if (sc) {
    if (kbScrollSetByAnalyze) {
      sc.scrollTop = 0;
      kbSavedScroll = 0;
      kbScrollSetByAnalyze = false;
    } else if (kbSavedScroll > 0) {
      sc.scrollTop = kbSavedScroll;
    }
  }

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
    kbScrollSetByAnalyze = true;
    renderKeyboardTab();
  });

  // Clear
  document.getElementById("kb-clear")?.addEventListener("click", () => {
    tabOrder = [];
    focusGaps = [];
    focusIndicators = [];
    keyboardTraps = [];
    kbScrollSetByAnalyze = true;
    // Hide any overlays the user had toggled on, clear state to match
    if (state.tabOrderOverlayOn) {
      state.tabOrderOverlayOn = false;
      sendMessage({ type: "HIDE_TAB_ORDER" });
    }
    if (state.focusGapsOverlayOn) {
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
    }
    skipLinks = [];
    kbAnalyzed = false;
    if (selectedKbTimer) { clearTimeout(selectedKbTimer); selectedKbTimer = null; }
    selectedKbIndex = null;
    renderKeyboardTab();
  });

  // Row click/keyboard → highlight (hover handled by CSS :hover)
  document.querySelectorAll<HTMLDivElement>(".kb-row").forEach((row) => {
    const activate = () => {
      const selector = row.dataset.selector;
      const idx = parseInt(row.dataset.index || "-1");
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Highlight the row in the panel for 3s (matches page highlight duration).
      // Skip during Movie Mode — Movie Mode owns the active row.
      if (idx >= 0 && moviePlayState === "idle") {
        if (selectedKbTimer) clearTimeout(selectedKbTimer);
        selectedKbIndex = idx;
        renderKeyboardTab();
        selectedKbTimer = setTimeout(() => {
          selectedKbIndex = null;
          selectedKbTimer = null;
          renderKeyboardTab();
        }, 3000);
      }
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  // Gap/indicator/trap item click/keyboard → highlight on page + flash in panel
  document.querySelectorAll<HTMLDivElement>(".kb-gap, .kb-fi, .kb-trap").forEach((item) => {
    const activate = () => {
      const selector = item.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      flashKbItem(item);
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  // Movie Mode — Play All pattern (icons only, like Screen Reader)
  document.getElementById("movie-play-all")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tabOrder.length === 0) return;
    // Clear click-highlight — Movie Mode owns the active row from here
    if (selectedKbTimer) { clearTimeout(selectedKbTimer); selectedKbTimer = null; }
    selectedKbIndex = null;
    moviePlayState = "playing";
    movieIndex = 0;
    sendMessage({ type: "START_MOVIE_MODE" });
    renderKeyboardTab();
  });
  document.getElementById("movie-pause")?.addEventListener("click", (e) => {
    e.stopPropagation();
    moviePlayState = "paused";
    sendMessage({ type: "PAUSE_MOVIE_MODE" });
    renderKeyboardTab();
  });
  document.getElementById("movie-resume")?.addEventListener("click", (e) => {
    e.stopPropagation();
    moviePlayState = "playing";
    sendMessage({ type: "RESUME_MOVIE_MODE" });
    renderKeyboardTab();
  });
  document.getElementById("movie-stop")?.addEventListener("click", (e) => {
    e.stopPropagation();
    moviePlayState = "idle";
    movieIndex = 0;
    sendMessage({ type: "STOP_MOVIE_MODE" });
    renderKeyboardTab();
  });

  // Overlay toggles
  document.getElementById("toggle-tab-order")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.tabOrderOverlayOn = checked;
    sendMessage(checked ? { type: "SHOW_TAB_ORDER" } : { type: "HIDE_TAB_ORDER" });
  });
  document.getElementById("toggle-focus-gaps")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.focusGapsOverlayOn = checked;
    sendMessage(checked ? { type: "SHOW_FOCUS_GAPS" } : { type: "HIDE_FOCUS_GAPS" });
  });
}
