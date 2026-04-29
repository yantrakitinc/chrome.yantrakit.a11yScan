/**
 * Innerhtml template for the SR tab. Pure-ish — reads srState but does no
 * DOM mutation; the orchestrator (sr-tab.ts) runs `panel.innerHTML = ...`
 * with the result.
 */

import { escHtml } from "@shared/utils";
import { srState } from "./state";
import { renderSrRowHtml } from "./pure";

export function buildSrTabHtml(): string {
  const { elements, scopeSelector, inspectActive, srAnalyzed, playState, playIndex, singleSpeakIndex, selectedRowIndex } = srState;
  const countLabel = scopeSelector
    ? `${elements.length} elements in scope`
    : `${elements.length} elements in reading order`;

  const renderRow = (el: typeof elements[number]) => {
    const rowIdx = el.index - 1;
    const isHighlighted =
      singleSpeakIndex !== null ? singleSpeakIndex === rowIdx :
      playState !== "idle" && rowIdx === playIndex ? true :
      selectedRowIndex === rowIdx;
    return renderSrRowHtml(el, isHighlighted);
  };

  return `
    <div class="fs-0" style="padding:var(--ds-space-4) var(--ds-space-6);border-bottom:1px solid var(--ds-zinc-200);display:flex;gap:var(--ds-space-4);background:var(--ds-zinc-50)">
      <button id="sr-analyze" class="f-1 cur-pointer min-h-24" style="padding:var(--ds-space-4);font-size:12px;font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:var(--ds-radius-3)">Analyze</button>
      <button id="sr-inspect" aria-label="Inspect element" aria-pressed="${inspectActive}" class="cur-pointer min-h-24" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid ${inspectActive ? "var(--ds-amber-500)" : "var(--ds-zinc-300)"};border-radius:4px;background:${inspectActive ? "var(--ds-amber-50)" : "none"};color:${inspectActive ? "var(--ds-amber-700)" : "var(--ds-zinc-600)"}">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>
      </button>
      ${srAnalyzed ? '<button id="sr-clear" class="cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-5);font-size:11px;font-weight:700;color:var(--ds-red-600);border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);background:none">Clear</button>' : ""}
    </div>
    ${scopeSelector ? `
      <div class="fs-0" style="padding:var(--ds-space-2) var(--ds-space-6);background:var(--ds-blue-50);border-bottom:1px solid var(--ds-blue-100);display:flex;align-items:center;gap:var(--ds-space-3)">
        <span style="font-size:10px;font-weight:600;color:var(--ds-blue-700)">Scoped to:</span>
        <span class="truncate f-1 font-mono" style="font-size:10px;color:var(--ds-sky-700)" title="${escHtml(scopeSelector)}">${escHtml(scopeSelector)}</span>
        <button id="sr-clear-scope" class="cur-pointer" style="font-size:10px;font-weight:700;color:var(--ds-red-600);border:none;background:none;padding:var(--ds-space-1) var(--ds-space-2)">Clear scope</button>
      </div>
    ` : ""}
    <div role="status" aria-live="polite" aria-atomic="true" class="fs-0" style="padding:var(--ds-space-4) var(--ds-space-6);border-bottom:1px solid var(--ds-zinc-200);display:flex;align-items:center;gap:var(--ds-space-4);${playState === "playing" || playState === "paused" ? "background:var(--ds-amber-50)" : ""}">
      <span class="f-1 font-mono" style="font-size:11px;font-weight:600;color:var(--ds-zinc-600)">${
        playState === "complete" ? '<span style="color:var(--ds-green-700);font-weight:700">Complete</span>' :
        playState === "playing" ? `<span style="color:var(--ds-amber-800);font-weight:700">${
          singleSpeakIndex !== null ? `Speaking element ${singleSpeakIndex + 1}` : `Playing ${playIndex + 1} of ${elements.length}`
        }</span>` :
        playState === "paused" ? `<span style="color:var(--ds-amber-800);font-weight:700">${
          singleSpeakIndex !== null ? `Paused element ${singleSpeakIndex + 1}` : `Paused at ${playIndex + 1} of ${elements.length}`
        }</span>` :
        countLabel
      }</span>
      ${elements.length > 0 ? `
        ${playState === "idle" || playState === "complete" ? `
          <button id="sr-play-all" aria-label="Play all — read all elements aloud" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>
          </button>
        ` : ""}
        ${playState === "playing" ? `
          <button id="sr-pause" aria-label="Pause speech" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg>
          </button>
        ` : ""}
        ${playState === "paused" ? `
          <button id="sr-resume" aria-label="Resume speech" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-amber-300);border-radius:var(--ds-radius-3);background:none;color:var(--ds-amber-700)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>
          </button>
        ` : ""}
        ${playState === "playing" || playState === "paused" ? `
          <button id="sr-stop" aria-label="Stop speech" title="Stop speech (Esc)" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);background:none;color:var(--ds-red-600)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="8" height="8"/></svg>
          </button>
        ` : ""}
      ` : ""}
    </div>
    <div id="sr-list" class="f-1" style="overflow-y:auto">
      ${elements.length === 0
        ? '<div style="padding:var(--ds-space-8);text-align:center;font-size:12px;color:var(--ds-zinc-500)">Click Analyze to scan the page reading order.</div>'
        : elements.map((el) => renderRow(el)).join("")
      }
    </div>
  `;
}
