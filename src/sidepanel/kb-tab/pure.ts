/**
 * Pure helpers — role→class map, row HTML, the four section panels (focus
 * gaps, focus indicators, keyboard traps, skip links). No DOM, no state.
 */

import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";
import { escHtml } from "@shared/utils";

/**
 * Map a tab-order role to its design-token badge class. Roles outside the
 * documented set fall back to the default class.
 */
export function kbRoleClassFor(role: string): string {
  return role === "button" ? "ds-badge--role-button"
    : role === "link" ? "ds-badge--role-link"
    : role === "textbox" ? "ds-badge--role-textbox"
    : "ds-badge--role-default";
}

/**
 * Render one row of the tab-order list. `isActive` is true when the row is
 * the active Movie Mode element or the recently-clicked row (KB tab parity
 * with SR tab).
 */
export function renderKbRowHtml(el: iTabOrderElement, idx: number, isActive: boolean): string {
  const escName = escHtml(el.accessibleName);
  const focusLabel = el.hasFocusIndicator ? "Has visible focus indicator" : "Missing visible focus indicator";
  const focusColor = el.hasFocusIndicator ? "var(--ds-green-700)" : "var(--ds-red-700)";
  return `
    <div class="ds-row kb-row${isActive ? " ds-row--active" : ""}" role="button" tabindex="0" aria-label="Highlight ${escHtml(el.role)}: ${escName}" data-selector="${escHtml(el.selector)}" data-index="${idx}">
      <span class="ds-row__index-circle">${el.index}</span>
      <span class="ds-badge ${kbRoleClassFor(el.role)}">${escHtml(el.role)}</span>
      <span class="ds-row__label">${escName}</span>
      <span aria-label="${focusLabel}" title="${focusLabel}" class="fs-0" style="display:flex;align-items:center;justify-content:center;color:${focusColor}">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <circle cx="7" cy="7" r="5"/>
          <circle cx="7" cy="7" r="2"/>
          <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13"/>
        </svg>
      </span>
    </div>
  `;
}

/** Render the Focus Gaps details panel. Empty array → ds-empty placeholder. */
export function renderFocusGapsHtml(gaps: iFocusGap[]): string {
  return `<details${gaps.length > 0 ? " open" : ""}>
    <summary class="cur-pointer" style="padding:8px 12px;font-size:var(--ds-text-md);font-weight:800;color:var(--ds-red-700);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-red-50)">Focus Gaps — ${gaps.length} elements</summary>
    <div style="padding:${gaps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
      ${gaps.length === 0
        ? '<div class="ds-empty" style="padding:12px">No focus gaps detected.</div>'
        : gaps.map((g) => `
          <div class="kb-gap cur-pointer" role="button" tabindex="0" aria-label="Highlight focus gap: ${escHtml(g.selector)}" data-selector="${escHtml(g.selector)}" style="font-size:var(--ds-text-base);padding:8px;border:1px solid var(--ds-red-200);background:var(--ds-red-50);border-radius:4px">
            <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(g.selector)}</div>
            <div style="color:var(--ds-red-700);margin-top:2px">${escHtml(g.reason)}</div>
          </div>
        `).join("")}
    </div>
  </details>`;
}

/**
 * Render the Focus Indicators details panel. Three states:
 * - empty (analyze hasn't run): ds-empty placeholder
 * - all-pass: green confirmation message
 * - some-fail: list of failing selectors
 */
export function renderFocusIndicatorsHtml(indicators: iFocusIndicator[]): string {
  const failed = indicators.filter((fi) => !fi.hasIndicator);
  return `<details${failed.length > 0 ? " open" : ""}>
    <summary class="cur-pointer" style="padding:8px 12px;font-size:var(--ds-text-md);font-weight:800;color:var(--ds-amber-600);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-amber-50)">Focus Indicators — ${failed.length} missing</summary>
    <div style="padding:${failed.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
      ${indicators.length === 0
        ? '<div class="ds-empty" style="padding:12px">Run Analyze to check focus indicators.</div>'
        : failed.length === 0
          ? '<div style="padding:12px;font-size:var(--ds-text-base);color:var(--ds-green-700);text-align:center">All focusable elements have visible focus indicators.</div>'
          : failed.map((fi) => `
            <div class="kb-fi cur-pointer" role="button" tabindex="0" aria-label="Highlight missing focus indicator: ${escHtml(fi.selector)}" data-selector="${escHtml(fi.selector)}" style="font-size:var(--ds-text-base);padding:8px;border:1px solid var(--ds-amber-200);background:var(--ds-amber-50);border-radius:4px">
              <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(fi.selector)}</div>
              <div style="color:var(--ds-amber-600);margin-top:2px">No visible focus indicator detected</div>
            </div>
          `).join("")}
    </div>
  </details>`;
}

/**
 * Render the Keyboard Traps details panel. Three states (tabOrderEmpty
 * means analyze hasn't run): ds-empty / no-traps / list.
 */
export function renderKeyboardTrapsHtml(traps: iKeyboardTrap[], tabOrderEmpty: boolean): string {
  return `<details${traps.length > 0 ? " open" : ""}>
    <summary class="cur-pointer" style="padding:8px 12px;font-size:var(--ds-text-md);font-weight:800;color:var(--ds-red-600);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-red-50)">Keyboard Traps — ${traps.length}</summary>
    <div style="padding:${traps.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
      ${tabOrderEmpty
        ? '<div class="ds-empty" style="padding:12px">Run Analyze to detect keyboard traps.</div>'
        : traps.length === 0
          ? '<div style="padding:12px;font-size:var(--ds-text-base);color:var(--ds-green-700);text-align:center">No keyboard traps detected.</div>'
          : traps.map((t) => `
            <div class="kb-trap cur-pointer" role="button" tabindex="0" aria-label="Highlight keyboard trap: ${escHtml(t.selector)}" data-selector="${escHtml(t.selector)}" style="font-size:var(--ds-text-base);padding:8px;border:1px solid var(--ds-red-200);background:var(--ds-red-50);border-radius:4px">
              <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(t.selector)}</div>
              <div style="color:var(--ds-red-600);margin-top:2px">${escHtml(t.description)}</div>
            </div>
          `).join("")}
    </div>
  </details>`;
}

/**
 * Render the Skip Links details panel. Three states: ds-empty (analyze
 * not run) / not-found / list. Each link distinguishes target-exists vs
 * broken-target with color.
 */
export function renderSkipLinksHtml(links: iSkipLink[], tabOrderEmpty: boolean): string {
  return `<details>
    <summary class="cur-pointer" style="padding:8px 12px;font-size:var(--ds-text-md);font-weight:800;color:var(--ds-sky-700);border-bottom:1px solid var(--ds-zinc-200);background:var(--ds-blue-50)">Skip Links — ${links.length}</summary>
    <div style="padding:${links.length > 0 ? "12px" : "0"};display:flex;flex-direction:column;gap:6px">
      ${tabOrderEmpty
        ? '<div class="ds-empty" style="padding:12px">Run Analyze to detect skip links.</div>'
        : links.length === 0
          ? '<div style="padding:12px;font-size:var(--ds-text-base);color:var(--ds-amber-600);text-align:center">No skip links found. Consider adding a "Skip to main content" link.</div>'
          : links.map((sl) => `
            <div style="font-size:var(--ds-text-base);padding:8px;border:1px solid ${sl.targetExists ? "var(--ds-sky-200)" : "var(--ds-red-200)"};background:${sl.targetExists ? "var(--ds-blue-50)" : "var(--ds-red-50)"};border-radius:4px">
              <div class="font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(sl.selector)}</div>
              <div style="margin-top:2px;color:${sl.targetExists ? "var(--ds-sky-700)" : "var(--ds-red-600)"}">
                Target: ${escHtml(sl.target)} ${sl.targetExists ? "✓ exists" : "✗ target not found"}
              </div>
            </div>
          `).join("")}
    </div>
  </details>`;
}
