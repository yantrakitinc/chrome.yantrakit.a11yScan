/**
 * ARIA validation tab body. Pure — given the list of detected widgets,
 * returns the full HTML.
 */

import type { iAriaWidget } from "@shared/types";
import { escHtml } from "@shared/utils";

/**
 * Render the ARIA tab body. Empty state shows a 'Scan ARIA Patterns' button.
 * Otherwise splits widgets into compliant + issues sections.
 */
export function renderAriaResultsHtml(widgets: iAriaWidget[]): string {
  if (widgets.length === 0) {
    return `
      <div style="padding:16px;text-align:center">
        <div style="font-size:var(--ds-text-md);color:var(--ds-zinc-500)">No ARIA widgets scanned yet.</div>
        <button id="run-aria-scan" class="cur-pointer min-h-24" style="margin-top:8px;padding:8px;font-size:var(--ds-text-md);font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Scan ARIA Patterns</button>
      </div>
    `;
  }

  const issues = widgets.filter((w) => w.failCount > 0);
  const compliant = widgets.filter((w) => w.failCount === 0);

  return `
    <div class="scan-pane">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:var(--ds-text-base);color:var(--ds-zinc-600);font-weight:600">${widgets.length} widgets detected</span>
        <span style="font-size:var(--ds-text-base);font-weight:700;color:var(--ds-red-700)">${issues.length} issues &middot; ${compliant.length} compliant</span>
      </div>
      ${issues.length > 0 ? `<div style="font-size:var(--ds-text-base);font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Issues</div>` : ""}
      ${issues.map((w) => renderAriaWidget(w, false)).join("")}
      ${compliant.length > 0 ? `<div style="font-size:var(--ds-text-base);font-weight:800;color:var(--ds-zinc-500);text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 4px">Compliant</div>` : ""}
      ${compliant.map((w) => renderAriaWidget(w, true)).join("")}
    </div>
  `;
}

/**
 * Render one ARIA widget row. Per R-ARIA: passing widgets are collapsed
 * by default; failing are open by default.
 */
export function renderAriaWidget(w: iAriaWidget, pass: boolean): string {
  return `
    <details${pass ? "" : " open"} style="border:1px solid ${pass ? "var(--ds-green-200)" : "var(--ds-red-200)"};border-radius:4px;background:${pass ? "var(--ds-green-50)" : "var(--ds-red-50)"};margin-bottom:4px">
      <summary class="cur-pointer" style="list-style:none;display:flex;align-items:center;gap:8px;padding:8px;font-size:var(--ds-text-base)">
        <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
        <span style="font-weight:700;padding:2px 6px;border-radius:3px;min-width:50px;text-align:center;${pass ? "background:var(--ds-green-200);color:var(--ds-green-900)" : "background:var(--ds-red-200);color:var(--ds-red-900)"}">${escHtml(w.role)}</span>
        <span class="truncate f-1" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(w.label)}</span>
        <span style="font-weight:700;${pass ? "color:var(--ds-green-700)" : "color:var(--ds-red-700)"}">${pass ? "✓" : w.failCount + " issues"}</span>
      </summary>
      <div class="scan-detail-body">
        ${w.checks.filter((c) => !c.pass).map((c) => `
          <div style="font-size:var(--ds-text-base);color:var(--ds-red-700);padding:2px 0 2px 8px;border-left:2px solid var(--ds-red-200)">${escHtml(c.message)}</div>
        `).join("")}
        ${w.checks.filter((c) => c.pass).map((c) => `
          <div style="font-size:var(--ds-text-base);color:var(--ds-green-700);padding:2px 0 2px 8px;border-left:2px solid var(--ds-green-200)">${escHtml(c.message)}</div>
        `).join("")}
        <button class="aria-highlight cur-pointer min-h-24" data-selector="${escHtml(w.selector)}" aria-label="Highlight ${escHtml(w.role)} ${escHtml(w.label)} on the page" style="font-size:var(--ds-text-base);font-weight:700;color:var(--ds-amber-700);background:none;border:none;margin-top:4px">Highlight on page</button>
      </div>
    </details>
  `;
}
