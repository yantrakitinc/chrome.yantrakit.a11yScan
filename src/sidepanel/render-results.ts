/**
 * Renders WCAG-mapped scan results into the Results tab.
 */

import { filterCriteria, axeRuleToWcag, type iWcagCriterion } from '@shared/wcag-mapping';
import { SITE_URL } from '@shared/config';
import { criterionSlug } from '@shared/utils';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function learnMoreLink(criterion: iWcagCriterion): string {
  const slug = criterionSlug(criterion.id, criterion.name);
  return ` <a href="${SITE_URL}/wcag/${slug}" target="_blank" rel="noopener noreferrer" class="text-[var(--c-accent)] hover:underline text-[11px] ml-1.5 font-medium">Learn more</a>`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

function mapToWcag(items: any[], criteria: iWcagCriterion[]) {
  const mapped = new Map<string, { criterion: iWcagCriterion; axeItems: any[] }>();
  const unmapped: any[] = [];

  for (const v of items) {
    const matchedCriteria = axeRuleToWcag(v.id);
    const relevant = matchedCriteria.filter((c) => criteria.some((fc) => fc.id === c.id));

    if (relevant.length === 0) {
      unmapped.push(v);
    } else {
      for (const c of relevant) {
        if (!mapped.has(c.id)) {
          mapped.set(c.id, { criterion: c, axeItems: [] });
        }
        mapped.get(c.id)!.axeItems.push(v);
      }
    }
  }

  return { mapped, unmapped };
}

/**
 * Simplifies verbose axe-core failure messages into concise descriptions.
 */
export function simplifyMessage(failureSummary: string): string {
  // Strip "Fix any of the following:\n" and "Fix all of the following:\n" prefixes
  let msg = failureSummary
    .replace(/^Fix any of the following:\s*/i, '')
    .replace(/^Fix all of the following:\s*/i, '')
    .trim();

  // Color contrast simplification
  const contrastMatch = msg.match(
    /Element has insufficient color contrast of ([\d.]+) \(foreground color: (#[0-9a-fA-F]+), background color: (#[0-9a-fA-F]+).*?Expected contrast ratio of ([\d.]+):1/
  );
  if (contrastMatch) {
    const [, ratio, fg, bg, expected] = contrastMatch;
    return `Contrast ${ratio}:1 (needs ${expected}:1). Text ${fg} on ${bg}`;
  }

  // Image alt attribute
  if (/element does not have an alt attribute/i.test(msg)) {
    return 'Missing alt attribute';
  }
  if (/element's alt attribute is not present/i.test(msg)) {
    return 'Missing alt attribute';
  }

  // Form label
  if (/form element does not have an implicit (or|nor) explicit label/i.test(msg)) {
    return 'Missing form label';
  }
  if (/form element does not have.*label/i.test(msg)) {
    return 'Missing form label';
  }

  // Heading order
  if (/heading order/i.test(msg) || /heading levels should only increase by one/i.test(msg)) {
    return 'Heading level skipped';
  }

  return msg;
}

export function renderResultsTab(
  output: HTMLDivElement,
  response: any,
  version: '2.0' | '2.1' | '2.2',
  level: 'A' | 'AA' | 'AAA'
): void {
  const criteria = filterCriteria(version, level);
  const violations = response.violations as any[];
  const incomplete = (Array.isArray(response.incomplete) ? response.incomplete : []) as any[];

  const { mapped: wcagViolations, unmapped: unmappedViolations } = mapToWcag(violations, criteria);
  const { mapped: wcagWarnings, unmapped: unmappedWarnings } = mapToWcag(incomplete, criteria);

  // Remove warnings that are already in violations (don't double-count)
  for (const key of wcagViolations.keys()) {
    wcagWarnings.delete(key);
  }

  const impactOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const violated = Array.from(wcagViolations.entries()).sort(([, a], [, b]) => {
    const aImpact = a.axeItems[0]?.impact || 'minor';
    const bImpact = b.axeItems[0]?.impact || 'minor';
    return (impactOrder[aImpact] ?? 4) - (impactOrder[bImpact] ?? 4);
  });
  const warnings = Array.from(wcagWarnings.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Passed = automatable criteria with no violations AND no warnings
  const failedOrWarnedIds = new Set([...wcagViolations.keys(), ...wcagWarnings.keys()]);
  const passed = criteria.filter(
    (c) => c.automation !== 'manual' && !failedOrWarnedIds.has(c.id)
  );

  let html = `<p class="mb-3 text-[13px]"><strong>WCAG ${version} Level ${level}</strong> <span class="text-[var(--c-text-muted)]">— ${criteria.length} criteria</span></p>`;

  // Failed
  html += `<div class="mb-4"><h3 class="text-[13px] font-semibold text-[var(--c-danger)] mb-2">Failed (${violated.length})</h3>`;
  if (violated.length === 0) {
    html += `<p class="text-[12px] text-[var(--c-text-muted)]">No automated violations found.</p>`;
  }
  for (const [, { criterion, axeItems }] of violated) {
    const totalNodes = axeItems.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
    const impact = axeItems[0]?.impact || 'unknown';
    html += `<details class="my-1.5 border-l-[3px] border-[var(--c-danger)] bg-[var(--c-danger-light)] rounded-r">`;
    html += `<summary class="py-2 px-2.5 text-[12px] cursor-pointer hover:bg-red-100 transition-colors">`;
    html += `<strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>${learnMoreLink(criterion)}`;
    html += `<span class="block text-[var(--c-text-muted)] text-[11px] ml-5 mt-0.5">Impact: ${impact} · ${totalNodes} element(s)</span>`;
    html += `</summary>`;
    html += `<div class="px-2.5 pb-2.5 space-y-2">`;

    // Group elements by axe rule ID (collapsible)
    for (const v of axeItems) {
      const nodeCount = v.nodes.length;
      html += `<details class="my-1 border border-red-200 rounded-md bg-[var(--c-surface)]" data-rule-id="${esc(v.id)}">`;
      html += `<summary class="py-2 px-2.5 text-[12px] cursor-pointer hover:bg-red-50 transition-colors">`;
      html += `<span class="font-semibold text-red-800">${esc(v.id)}</span>`;
      html += ` — ${esc(v.help)}`;
      html += ` <span class="text-[var(--c-text-muted)]">(${nodeCount})</span>`;
      html += `</summary>`;
      html += `<div class="px-2.5 pb-2.5 space-y-1.5">`;

      for (const node of v.nodes) {
        const sel = esc(node.target.join(', '));
        html += `<div class="bg-red-50/60 border border-red-100 rounded-md p-2.5 text-[11px] font-mono overflow-x-auto" data-node-selector="${node.target.join(', ').replace(/"/g, '&quot;')}">`;
        html += `<div class="flex items-start justify-between gap-2 mb-1">`;
        html += `<div class="text-[var(--c-accent)] font-semibold">${sel}</div>`;
        html += `<button class="highlight-btn shrink-0 text-[11px] font-semibold text-[var(--c-warning)] hover:text-amber-900 cursor-pointer underline underline-offset-2" data-selector="${node.target.join(', ').replace(/"/g, '&quot;')}">Highlight</button>`;
        html += `</div>`;
        html += `<div class="text-[var(--c-text-secondary)] whitespace-pre-wrap break-all mb-1">${esc(truncate(node.html, 200))}</div>`;
        if (node.failureSummary) {
          html += `<div class="text-red-700 text-[11px] mt-1.5">${esc(simplifyMessage(node.failureSummary))}</div>`;
        }
        html += `</div>`;
      }

      html += `</div></details>`;
    }

    html += `</div></details>`;
  }
  html += `</div>`;

  // Warnings
  html += `<div class="mb-4"><h3 class="text-[13px] font-semibold text-[var(--c-warning)] mb-2">Needs Review (${warnings.length})</h3>`;
  if (warnings.length === 0) {
    html += `<p class="text-[12px] text-[var(--c-text-muted)]">No items need manual verification.</p>`;
  } else {
    for (const [, { criterion, axeItems }] of warnings) {
      const totalNodes = axeItems.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
      html += `<details class="my-1.5 border-l-[3px] border-[var(--c-warning)] bg-[var(--c-warning-light)] rounded-r">`;
      html += `<summary class="py-2 px-2.5 text-[12px] cursor-pointer hover:bg-amber-100 transition-colors">`;
      html += `<strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>${learnMoreLink(criterion)}`;
      html += `<span class="block text-[var(--c-text-muted)] text-[11px] ml-5 mt-0.5">${totalNodes} element(s) need verification</span>`;
      html += `</summary>`;
      html += `<div class="px-2.5 pb-2.5 space-y-2">`;

      for (const v of axeItems) {
        const nodeCount = v.nodes.length;
        html += `<details class="my-1 border border-amber-200 rounded-md bg-[var(--c-surface)]">`;
        html += `<summary class="py-2 px-2.5 text-[12px] cursor-pointer hover:bg-amber-50 transition-colors">`;
        html += `<span class="font-semibold text-amber-800">${esc(v.id)}</span>`;
        html += ` — ${esc(v.help)}`;
        html += ` <span class="text-[var(--c-text-muted)]">(${nodeCount})</span>`;
        html += `</summary>`;
        html += `<div class="px-2.5 pb-2.5 space-y-1.5">`;

        for (const node of v.nodes) {
          const sel = esc(node.target.join(', '));
          html += `<div class="bg-amber-50/60 border border-amber-100 rounded-md p-2.5 text-[11px] font-mono overflow-x-auto">`;
          html += `<div class="flex items-start justify-between gap-2 mb-1">`;
          html += `<div class="text-[var(--c-accent)] font-semibold">${sel}</div>`;
          html += `<button class="highlight-btn shrink-0 text-[11px] font-semibold text-[var(--c-warning)] hover:text-amber-900 cursor-pointer underline underline-offset-2" data-selector="${node.target.join(', ').replace(/"/g, '&quot;')}">Highlight</button>`;
          html += `</div>`;
          html += `<div class="text-[var(--c-text-secondary)] whitespace-pre-wrap break-all">${esc(truncate(node.html, 200))}</div>`;
          html += `</div>`;
        }

        html += `</div></details>`;
      }

      html += `</div></details>`;
    }
  }
  html += `</div>`;

  // Passed — map axe passes to WCAG criteria
  const passesArray = Array.isArray(response.passes) ? response.passes : [];
  const wcagPasses = new Map<string, { criterion: iWcagCriterion; axeRules: string[] }>();

  for (const p of passesArray) {
    const mappedCriteria = axeRuleToWcag(p.id);
    const relevant = mappedCriteria.filter((c) => criteria.some((fc) => fc.id === c.id));
    for (const c of relevant) {
      if (!failedOrWarnedIds.has(c.id)) {
        if (!wcagPasses.has(c.id)) {
          wcagPasses.set(c.id, { criterion: c, axeRules: [] });
        }
        wcagPasses.get(c.id)!.axeRules.push(p.id);
      }
    }
  }

  // Also include automated criteria with no axe results at all
  const passedWithData = Array.from(wcagPasses.entries()).sort(([a], [b]) => a.localeCompare(b));
  const passedNoData = passed.filter((c) => !wcagPasses.has(c.id));

  html += `<details class="mb-4" open><summary class="text-[13px] font-semibold text-[var(--c-success)] mb-2 cursor-pointer">Passed (${passedWithData.length})</summary>`;
  if (passedWithData.length === 0) {
    html += `<p class="text-[12px] text-[var(--c-text-muted)]">No criteria passed with verified elements.</p>`;
  }
  for (const [, { criterion, axeRules }] of passedWithData) {
    html += `<details class="my-1 border-l-[3px] border-[var(--c-success)] bg-[var(--c-success-light)] rounded-r">`;
    html += `<summary class="py-1.5 px-2.5 text-[12px] cursor-pointer hover:bg-green-100 transition-colors"><strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>${learnMoreLink(criterion)}</summary>`;
    html += `<div class="px-2.5 pb-2 text-[11px] text-[var(--c-text-secondary)]">`;
    html += `<span>Verified by: ${axeRules.map(r => `<span class="font-semibold text-green-800">${esc(r)}</span>`).join(', ')}</span>`;
    html += `</div></details>`;
  }
  html += `</details>`;

  // Unmapped
  const allUnmapped = [...unmappedViolations, ...unmappedWarnings];
  if (allUnmapped.length > 0) {
    html += `<div class="mb-4"><h3 class="text-[13px] font-semibold text-[var(--c-text-muted)] mb-2">Other axe-core Findings (${allUnmapped.length})</h3>`;
    for (const v of allUnmapped) {
      html += `<div class="my-1 py-1.5 px-2.5 text-[12px] border-l-[3px] border-zinc-300 bg-zinc-50 rounded-r"><strong>${esc(v.id)}</strong> <span class="text-[var(--c-text-muted)]">(${v.impact})</span> — ${esc(v.help)} <span class="text-[var(--c-text-muted)]">[${v.nodes.length}]</span></div>`;
    }
    html += `</div>`;
  }

  output.innerHTML = html;

  // Wire highlight buttons
  output.querySelectorAll('.highlight-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selector = (btn as HTMLElement).dataset.selector;
      if (!selector) return;
      try {
        await chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ELEMENT', selector });
      } catch { /* no content script */ }
    });
  });
}
