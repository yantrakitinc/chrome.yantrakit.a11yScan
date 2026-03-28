/**
 * Renders WCAG-mapped scan results into the Results tab.
 */

import { filterCriteria, axeRuleToWcag, type iWcagCriterion } from '@shared/wcag-mapping';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function renderResultsTab(
  output: HTMLDivElement,
  response: any,
  version: '2.0' | '2.1' | '2.2',
  level: 'A' | 'AA' | 'AAA'
): void {
  const criteria = filterCriteria(version, level);
  const violations = response.violations as any[];

  const wcagViolations = new Map<string, { criterion: iWcagCriterion; axeViolations: any[] }>();
  const unmappedViolations: any[] = [];

  for (const v of violations) {
    const mappedCriteria = axeRuleToWcag(v.id);
    const relevantCriteria = mappedCriteria.filter((c) => criteria.some((fc) => fc.id === c.id));

    if (relevantCriteria.length === 0) {
      unmappedViolations.push(v);
    } else {
      for (const c of relevantCriteria) {
        if (!wcagViolations.has(c.id)) {
          wcagViolations.set(c.id, { criterion: c, axeViolations: [] });
        }
        wcagViolations.get(c.id)!.axeViolations.push(v);
      }
    }
  }

  const violated = Array.from(wcagViolations.entries()).sort(([a], [b]) => a.localeCompare(b));
  const automated = criteria.filter(
    (c) => c.automation !== 'manual' && !wcagViolations.has(c.id)
  );

  let html = `<p class="mb-2 text-sm"><strong>WCAG ${version} Level ${level}</strong> — ${criteria.length} criteria</p>`;

  html += `<div class="mb-3"><h3 class="text-sm font-bold text-red-600 mb-1.5">Failed (${violated.length})</h3>`;
  if (violated.length === 0) {
    html += `<p class="text-xs text-zinc-500">No automated violations found.</p>`;
  }
  for (const [, { criterion, axeViolations }] of violated) {
    const totalNodes = axeViolations.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
    const impact = axeViolations[0]?.impact || 'unknown';
    html += `<div class="my-1 py-1.5 px-2 text-xs border-l-3 border-red-600 bg-red-50 rounded-r">`;
    html += `<strong class="block">${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>`;
    html += `<span class="text-zinc-500 text-[11px]">Impact: ${impact} · ${totalNodes} element(s) · Rules: ${axeViolations.map((v: any) => v.id).join(', ')}</span>`;
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div class="mb-3"><h3 class="text-sm font-bold text-green-600 mb-1.5">Passed (${automated.length})</h3>`;
  for (const c of automated) {
    html += `<div class="my-0.5 py-1 px-2 text-[11px] border-l-3 border-green-600 bg-green-50 rounded-r"><strong>${c.id} ${esc(c.name)} (${c.level})</strong></div>`;
  }
  html += `</div>`;

  if (unmappedViolations.length > 0) {
    html += `<div class="mb-3"><h3 class="text-sm font-bold text-zinc-500 mb-1.5">Other axe-core Findings (${unmappedViolations.length})</h3>`;
    for (const v of unmappedViolations) {
      html += `<div class="my-0.5 py-1 px-2 text-[11px] border-l-3 border-zinc-300 bg-zinc-50 rounded-r"><strong>${esc(v.id)}</strong> (${v.impact}) — ${esc(v.help)} [${v.nodes.length}]</div>`;
    }
    html += `</div>`;
  }

  output.innerHTML = html;
}
