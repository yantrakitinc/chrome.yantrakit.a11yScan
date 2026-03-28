/**
 * Renders WCAG-mapped scan results into the Results tab.
 */

import { filterCriteria, axeRuleToWcag, type iWcagCriterion } from '@shared/wcag-mapping';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
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

  let html = `<p class="mb-2 text-sm"><strong>WCAG ${version} Level ${level}</strong> — ${criteria.length} criteria</p>`;

  // Failed
  html += `<div class="mb-3"><h3 class="text-sm font-bold text-red-600 mb-1.5">Failed (${violated.length})</h3>`;
  if (violated.length === 0) {
    html += `<p class="text-xs text-zinc-500">No automated violations found.</p>`;
  }
  for (const [, { criterion, axeItems }] of violated) {
    const totalNodes = axeItems.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
    const impact = axeItems[0]?.impact || 'unknown';
    html += `<details class="my-1 border-l-3 border-red-600 bg-red-50 rounded-r">`;
    html += `<summary class="py-1.5 px-2 text-xs cursor-pointer hover:bg-red-100">`;
    html += `<strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>`;
    html += `<span class="block text-zinc-500 text-[11px] ml-4">Impact: ${impact} · ${totalNodes} element(s)</span>`;
    html += `</summary>`;
    html += `<div class="px-2 pb-2 space-y-1.5">`;

    // Show each affected element
    for (const v of axeItems) {
      html += `<div class="text-[11px] text-zinc-700 mb-1">`;
      html += `<span class="font-semibold text-red-800">${esc(v.id)}</span> — ${esc(v.help)}`;
      html += `</div>`;
      for (const node of v.nodes) {
        html += `<div class="bg-white border border-red-200 rounded p-2 text-[10px] font-mono overflow-x-auto">`;
        html += `<div class="text-indigo-800 font-semibold mb-0.5">${esc(node.target.join(', '))}</div>`;
        html += `<div class="text-zinc-600 whitespace-pre-wrap break-all mb-1">${esc(truncate(node.html, 200))}</div>`;
        if (node.failureSummary) {
          html += `<div class="text-red-700 text-[10px] mt-1">${esc(node.failureSummary)}</div>`;
        }
        html += `</div>`;
      }
    }

    html += `</div></details>`;
  }
  html += `</div>`;

  // Warnings
  html += `<div class="mb-3"><h3 class="text-sm font-bold text-amber-600 mb-1.5">Needs Review (${warnings.length})</h3>`;
  if (warnings.length === 0) {
    html += `<p class="text-xs text-zinc-500">No items need manual verification.</p>`;
  } else {
    for (const [, { criterion, axeItems }] of warnings) {
      const totalNodes = axeItems.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
      html += `<details class="my-1 border-l-3 border-amber-500 bg-amber-50 rounded-r">`;
      html += `<summary class="py-1.5 px-2 text-xs cursor-pointer hover:bg-amber-100">`;
      html += `<strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>`;
      html += `<span class="block text-zinc-500 text-[11px] ml-4">${totalNodes} element(s) need verification</span>`;
      html += `</summary>`;
      html += `<div class="px-2 pb-2 space-y-1.5">`;

      for (const v of axeItems) {
        html += `<div class="text-[11px] text-zinc-700 mb-1">`;
        html += `<span class="font-semibold text-amber-800">${esc(v.id)}</span> — ${esc(v.help)}`;
        html += `</div>`;
        for (const node of v.nodes) {
          html += `<div class="bg-white border border-amber-200 rounded p-2 text-[10px] font-mono overflow-x-auto">`;
          html += `<div class="text-indigo-800 font-semibold mb-0.5">${esc(node.target.join(', '))}</div>`;
          html += `<div class="text-zinc-600 whitespace-pre-wrap break-all">${esc(truncate(node.html, 200))}</div>`;
          html += `</div>`;
        }
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

  html += `<details class="mb-3" open><summary class="text-sm font-bold text-green-600 mb-1.5 cursor-pointer">Passed (${passedWithData.length})</summary>`;
  if (passedWithData.length === 0) {
    html += `<p class="text-xs text-zinc-500">No criteria passed with verified elements.</p>`;
  }
  for (const [, { criterion, axeRules }] of passedWithData) {
    html += `<details class="my-0.5 border-l-3 border-green-600 bg-green-50 rounded-r">`;
    html += `<summary class="py-1 px-2 text-[11px] cursor-pointer hover:bg-green-100"><strong>${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong></summary>`;
    html += `<div class="px-2 pb-1.5 text-[10px] text-zinc-600">`;
    html += `<span>Verified by: ${axeRules.map(r => `<span class="font-semibold text-green-800">${esc(r)}</span>`).join(', ')}</span>`;
    html += `</div></details>`;
  }
  html += `</details>`;

  // Unmapped
  const allUnmapped = [...unmappedViolations, ...unmappedWarnings];
  if (allUnmapped.length > 0) {
    html += `<div class="mb-3"><h3 class="text-sm font-bold text-zinc-500 mb-1.5">Other axe-core Findings (${allUnmapped.length})</h3>`;
    for (const v of allUnmapped) {
      html += `<div class="my-0.5 py-1 px-2 text-[11px] border-l-3 border-zinc-300 bg-zinc-50 rounded-r"><strong>${esc(v.id)}</strong> (${v.impact}) — ${esc(v.help)} [${v.nodes.length}]</div>`;
    }
    html += `</div>`;
  }

  output.innerHTML = html;
}
