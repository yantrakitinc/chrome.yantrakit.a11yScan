/**
 * Renders WCAG-mapped scan results into the Results tab.
 */

import { filterCriteria, axeRuleToWcag, type iWcagCriterion } from '@shared/wcag-mapping';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
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

  const violated = Array.from(wcagViolations.entries()).sort(([a], [b]) => a.localeCompare(b));
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
    html += `<div class="my-1 py-1.5 px-2 text-xs border-l-3 border-red-600 bg-red-50 rounded-r">`;
    html += `<strong class="block">${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>`;
    html += `<span class="text-zinc-500 text-[11px]">Impact: ${impact} · ${totalNodes} element(s) · Rules: ${axeItems.map((v: any) => v.id).join(', ')}</span>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Warnings
  if (warnings.length > 0) {
    html += `<div class="mb-3"><h3 class="text-sm font-bold text-amber-600 mb-1.5">Needs Review (${warnings.length})</h3>`;
    for (const [, { criterion, axeItems }] of warnings) {
      const totalNodes = axeItems.reduce((sum: number, v: any) => sum + v.nodes.length, 0);
      html += `<div class="my-1 py-1.5 px-2 text-xs border-l-3 border-amber-500 bg-amber-50 rounded-r">`;
      html += `<strong class="block">${criterion.id} ${esc(criterion.name)} (${criterion.level})</strong>`;
      html += `<span class="text-zinc-500 text-[11px]">${totalNodes} element(s) need manual verification · Rules: ${axeItems.map((v: any) => v.id).join(', ')}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Passed
  html += `<div class="mb-3"><h3 class="text-sm font-bold text-green-600 mb-1.5">Passed (${passed.length})</h3>`;
  for (const c of passed) {
    html += `<div class="my-0.5 py-1 px-2 text-[11px] border-l-3 border-green-600 bg-green-50 rounded-r"><strong>${c.id} ${esc(c.name)} (${c.level})</strong></div>`;
  }
  html += `</div>`;

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
