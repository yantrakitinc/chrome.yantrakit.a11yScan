/**
 * Renders ARIA Patterns scan results into the ARIA tab.
 * Matches the Results tab styling for consistency.
 */

import type { iAriaWidgetResult } from '@shared/aria-patterns';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function renderAriaTab(output: HTMLDivElement, widgets: iAriaWidgetResult[]): void {
  if (widgets.length === 0) {
    output.innerHTML = '<p class="text-xs text-zinc-500">No ARIA widgets detected on this page.</p>';
    return;
  }

  const totalWidgets = widgets.length;
  const compliant = widgets.filter((w) => w.failCount === 0).length;
  const withIssues = totalWidgets - compliant;

  let html = `<p class="mb-2 text-sm"><strong>${totalWidgets} widget${totalWidgets !== 1 ? 's' : ''} detected</strong> — ${compliant} compliant, ${withIssues} with issues</p>`;

  // Issues first
  if (withIssues > 0) {
    html += `<div class="mb-3"><h3 class="text-sm font-bold text-red-600 mb-1.5">Issues (${withIssues})</h3>`;
    for (const widget of widgets.filter((w) => w.failCount > 0)) {
      html += renderWidget(widget);
    }
    html += `</div>`;
  }

  // Compliant
  if (compliant > 0) {
    html += `<details class="mb-3" open><summary class="text-sm font-bold text-green-600 mb-1.5 cursor-pointer">Compliant (${compliant})</summary>`;
    for (const widget of widgets.filter((w) => w.failCount === 0)) {
      html += renderWidget(widget);
    }
    html += `</details>`;
  }

  output.innerHTML = html;

  // Wire highlight buttons — route through background to ensure content script is injected
  output.querySelectorAll('.highlight-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const role = (btn as HTMLElement).dataset.role;
      const sel = (btn as HTMLElement).dataset.sel;
      const selector = role ? `[role="${role}"]` : sel;
      if (!selector) return;
      try {
        await chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ELEMENT', selector });
      } catch { /* no content script */ }
    });
  });
}

function renderWidget(widget: iAriaWidgetResult): string {
  const hasIssues = widget.failCount > 0;
  const borderColor = hasIssues ? 'border-red-600' : 'border-green-600';
  const bgColor = hasIssues ? 'bg-red-50' : 'bg-green-50';
  const hoverBg = hasIssues ? 'hover:bg-red-100' : 'hover:bg-green-100';

  let html = `<details class="my-1 border-l-3 ${borderColor} ${bgColor} rounded-r">`;
  html += `<summary class="py-1.5 px-2 text-xs cursor-pointer ${hoverBg}">`;
  html += `<strong>${esc(widget.role)}</strong>`;
  html += `<span class="text-zinc-500 text-[11px] ml-1">${esc(widget.selector)}</span>`;
  html += `<span class="block text-zinc-500 text-[11px] ml-4">${widget.passCount} passed · ${widget.failCount} failed</span>`;
  html += `</summary>`;
  html += `<div class="px-2 pb-2 space-y-1.5">`;

  // Each check
  for (const check of widget.checks) {
    const borderClr = check.pass ? 'border-green-200' : 'border-red-200';
    const bgClr = check.pass ? 'bg-green-50/50' : 'bg-red-50/50';
    const icon = check.pass
      ? '<span class="text-green-600 font-bold">✓</span>'
      : '<span class="text-red-600 font-bold">✗</span>';

    html += `<div class="${bgClr} border ${borderClr} rounded p-2 text-[10px]">`;
    html += `<div class="flex items-start gap-1.5">`;
    html += `<span class="shrink-0 mt-px">${icon}</span>`;
    html += `<div>`;
    html += `<span class="font-semibold text-indigo-950">${esc(check.description)}</span>`;
    html += `<div class="text-zinc-600 mt-0.5">${esc(check.message)}</div>`;
    html += `</div>`;
    html += `</div>`;
    html += `</div>`;
  }

  // Highlight button — use role selector directly, not escaped
  const roleAttr = widget.role ? `[role="${widget.role}"]` : '';
  const highlightSel = widget.selector.includes('[role=') ? widget.selector : (el => el)(widget.selector);
  html += `<div class="mt-1 flex items-center justify-between">`;
  html += `<button class="highlight-btn text-[9px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer underline underline-offset-1" data-role="${esc(widget.role)}" data-sel="${esc(widget.selector)}">Highlight</button>`;
  html += `</div>`;

  html += `</div></details>`;
  return html;
}
