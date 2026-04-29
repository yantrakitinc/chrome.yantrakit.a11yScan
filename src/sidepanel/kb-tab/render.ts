/**
 * innerHTML template for the kb-tab. Reads kbState + sidepanel.state but
 * does no DOM mutation — orchestrator runs `panel.innerHTML = buildKbTabHtml()`
 * with the result.
 */

import { state } from "../sidepanel";
import { escHtml } from "@shared/utils";
import { kbState } from "./state";
import { renderKbRowHtml } from "./pure";

/** Build the HTML string for the keyboard tab (analyzed or empty state, depending on kbState). */
export function buildKbTabHtml(): string {
  const {
    tabOrder, focusGaps, focusIndicators, keyboardTraps, skipLinks,
    kbAnalyzed, moviePlayState, movieIndex, selectedKbIndex,
  } = kbState;
  const failedIndicators = focusIndicators.filter((fi) => !fi.hasIndicator);

  return `
    <div class="fs-0" style="padding:var(--ds-space-4) var(--ds-space-6);border-bottom:1px solid var(--ds-zinc-200);display:flex;gap:var(--ds-space-4);background:var(--ds-zinc-50)">
      <button id="kb-analyze" class="f-1 cur-pointer min-h-24" style="padding:var(--ds-space-4);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:var(--ds-radius-3)">Analyze</button>
      ${kbAnalyzed ? '<button id="kb-clear" class="cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-5);font-size:var(--ds-text-base);font-weight:700;color:var(--ds-red-600);border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);background:none">Clear</button>' : ""}
    </div>
    ${!kbAnalyzed ? '<div class="f-1" style="padding:var(--ds-space-8);text-align:center;font-size:var(--ds-text-md);color:var(--ds-zinc-500)">Click Analyze to scan keyboard navigation.</div>' : ""}
    ${kbAnalyzed ? `<div id="kb-scroll-container" class="f-1" style="overflow-y:auto;min-height:0">
      <details open>
        <summary class="cur-pointer" style="padding:var(--ds-space-4) var(--ds-space-6);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-zinc-900);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-zinc-50);display:flex;align-items:center;gap:var(--ds-space-4)">
          <span class="f-1">Tab Order — ${tabOrder.length} elements</span>
          ${tabOrder.length > 0 && (moviePlayState === "idle" || moviePlayState === "complete") ? `
            <button id="movie-play-all" aria-label="Play all - animate through tab order" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z"/></svg>
            </button>
            ${moviePlayState === "complete" ? `<span role="status" aria-live="polite" class="font-mono" style="font-size:var(--ds-text-base);color:var(--ds-green-700);font-weight:600">Complete</span>` : ""}
          ` : ""}
          ${moviePlayState === "playing" ? `
            <button id="movie-pause" aria-label="Pause movie" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg>
            </button>
            <button id="movie-stop" aria-label="Stop movie" title="Stop movie (Esc)" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);background:none;color:var(--ds-red-600)">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8"/></svg>
            </button>
            <span role="status" aria-live="polite" class="font-mono" style="font-size:var(--ds-text-base);color:var(--ds-amber-800);font-weight:600">Playing ${movieIndex + 1} of ${tabOrder.length}</span>
          ` : ""}
          ${moviePlayState === "paused" ? `
            <button id="movie-resume" aria-label="Resume movie" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4z"/></svg>
            </button>
            <button id="movie-stop" aria-label="Stop movie" title="Stop movie (Esc)" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);background:none;color:var(--ds-red-600)">
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8"/></svg>
            </button>
            <span role="status" aria-live="polite" class="font-mono" style="font-size:var(--ds-text-base);color:var(--ds-amber-800);font-weight:600">Paused at ${movieIndex + 1} of ${tabOrder.length}</span>
          ` : ""}
        </summary>
        <div>
          ${tabOrder.length === 0
            ? '<div class="ds-empty" style="padding:var(--ds-space-6)">Click Analyze to scan keyboard navigation.</div>'
            : tabOrder.map((el, i) => {
              const isActive = (moviePlayState !== "idle" && i === movieIndex) || (selectedKbIndex === i);
              return renderKbRowHtml(el, i, isActive);
            }).join("")
          }
        </div>
      </details>
      <details${focusGaps.length > 0 ? " open" : ""}>
        <summary class="cur-pointer" style="padding:var(--ds-space-4) var(--ds-space-6);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-red-700);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-red-50)">Focus Gaps — ${focusGaps.length} elements</summary>
        <div style="padding:${focusGaps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${focusGaps.length === 0
            ? '<div class="ds-empty" style="padding:var(--ds-space-6)">No focus gaps detected.</div>'
            : focusGaps.map((g) => `
              <div class="kb-gap cur-pointer" role="button" tabindex="0" aria-label="Highlight focus gap: ${escHtml(g.selector)}" data-selector="${escHtml(g.selector)}" style="font-size:var(--ds-text-base);padding:var(--ds-space-4);border:1px solid var(--ds-red-200);background:var(--ds-red-50);border-radius:var(--ds-radius-3)">
                <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(g.selector)}</div>
                <div style="color:var(--ds-red-700);margin-top:var(--ds-space-1)">${escHtml(g.reason)}</div>
              </div>
            `).join("")}
        </div>
      </details>
      <details${failedIndicators.length > 0 ? " open" : ""}>
        <summary class="cur-pointer" style="padding:var(--ds-space-4) var(--ds-space-6);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-amber-600);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-amber-50)">Focus Indicators — ${failedIndicators.length} missing</summary>
        <div style="padding:${failedIndicators.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${focusIndicators.length === 0
            ? '<div class="ds-empty" style="padding:var(--ds-space-6)">Run Analyze to check focus indicators.</div>'
            : failedIndicators.length === 0
              ? '<div style="padding:var(--ds-space-6);font-size:var(--ds-text-base);color:var(--ds-green-700);text-align:center">All focusable elements have visible focus indicators.</div>'
              : failedIndicators.map((fi) => `
                <div class="kb-fi cur-pointer" role="button" tabindex="0" aria-label="Highlight missing focus indicator: ${escHtml(fi.selector)}" data-selector="${escHtml(fi.selector)}" style="font-size:var(--ds-text-base);padding:var(--ds-space-4);border:1px solid var(--ds-amber-200);background:var(--ds-amber-50);border-radius:var(--ds-radius-3)">
                  <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(fi.selector)}</div>
                  <div style="color:var(--ds-amber-600);margin-top:var(--ds-space-1)">No visible focus indicator detected</div>
                </div>
              `).join("")}
        </div>
      </details>
      <details${keyboardTraps.length > 0 ? " open" : ""}>
        <summary class="cur-pointer" style="padding:var(--ds-space-4) var(--ds-space-6);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-red-600);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-red-50)">Keyboard Traps — ${keyboardTraps.length}</summary>
        <div style="padding:${keyboardTraps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${tabOrder.length === 0
            ? '<div class="ds-empty" style="padding:var(--ds-space-6)">Run Analyze to detect keyboard traps.</div>'
            : keyboardTraps.length === 0
              ? '<div style="padding:var(--ds-space-6);font-size:var(--ds-text-base);color:var(--ds-green-700);text-align:center">No keyboard traps detected.</div>'
              : keyboardTraps.map((t) => `
                <div class="kb-trap cur-pointer" role="button" tabindex="0" aria-label="Highlight keyboard trap: ${escHtml(t.selector)}" data-selector="${escHtml(t.selector)}" style="font-size:var(--ds-text-base);padding:var(--ds-space-4);border:1px solid var(--ds-red-200);background:var(--ds-red-50);border-radius:var(--ds-radius-3)">
                  <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(t.selector)}</div>
                  <div style="color:var(--ds-red-600);margin-top:var(--ds-space-1)">${escHtml(t.description)}</div>
                </div>
              `).join("")}
        </div>
      </details>
      <details>
        <summary class="cur-pointer" style="padding:var(--ds-space-4) var(--ds-space-6);font-size:var(--ds-text-md);font-weight:800;color:var(--ds-sky-700);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-blue-50)">Skip Links — ${skipLinks.length}</summary>
        <div style="padding:${skipLinks.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
          ${tabOrder.length === 0
            ? '<div class="ds-empty" style="padding:var(--ds-space-6)">Run Analyze to detect skip links.</div>'
            : skipLinks.length === 0
              ? '<div style="padding:var(--ds-space-6);font-size:var(--ds-text-base);color:var(--ds-amber-600);text-align:center">No skip links found. Consider adding a "Skip to main content" link.</div>'
              : skipLinks.map((sl) => `
                <div style="font-size:var(--ds-text-base);padding:var(--ds-space-4);border:1px solid ${sl.targetExists ? "var(--ds-sky-200)" : "var(--ds-red-200)"};background:${sl.targetExists ? "var(--ds-blue-50)" : "var(--ds-red-50)"};border-radius:4px">
                  <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(sl.selector)}</div>
                  <div style="margin-top:var(--ds-space-1);color:${sl.targetExists ? "var(--ds-sky-700)" : "var(--ds-red-600)"}">
                    Target: ${escHtml(sl.target)} ${sl.targetExists ? "✓ exists" : "✗ target not found"}
                  </div>
                </div>
              `).join("")}
        </div>
      </details>
    </div>` : ""}
    ${kbAnalyzed ? `<!-- Overlay toggles — Tab order + Focus gaps live here, not in Scan tab -->
    <div class="fs-0" style="border-top:2px solid var(--ds-zinc-300);background:var(--ds-zinc-100)">
      <div role="group" aria-labelledby="kb-highlight-label" style="display:flex;align-items:center;gap:var(--ds-space-3);padding:var(--ds-space-3) var(--ds-space-6)">
        <span id="kb-highlight-label" style="font-size:var(--ds-text-base);font-weight:800;color:var(--ds-zinc-600)">Highlight</span>
        <label class="cur-pointer min-h-24" style="display:flex;align-items:center;gap:var(--ds-space-2);font-size:var(--ds-text-base);font-weight:700;color:var(--ds-zinc-700);padding:var(--ds-space-2) var(--ds-space-4);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff">
          <input type="checkbox" id="toggle-tab-order" ${state.tabOrderOverlayOn ? "checked" : ""} style="margin:0">
          Tab order
        </label>
        <label class="cur-pointer min-h-24" style="display:flex;align-items:center;gap:var(--ds-space-2);font-size:var(--ds-text-base);font-weight:700;color:var(--ds-zinc-700);padding:var(--ds-space-2) var(--ds-space-4);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff">
          <input type="checkbox" id="toggle-focus-gaps" ${state.focusGapsOverlayOn ? "checked" : ""} style="margin:0">
          Focus gaps
        </label>
      </div>
    </div>` : ""}
  `;
}
