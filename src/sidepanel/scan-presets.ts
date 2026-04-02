/**
 * Scan preset cards — selectable toggles that configure what happens during/after a scan.
 * Replaces the old informational empty-state cards.
 */

import { SITE_URL } from '@shared/config';

export type iPresetId = 'multi-viewport' | 'site-crawl';

export interface iScanPreset {
  id: iPresetId;
  icon: string;
  title: string;
  description: string;
}

export const SCAN_PRESETS: iScanPreset[] = [
  {
    id: 'multi-viewport',
    icon: '📱',
    title: 'Multi-Viewport',
    description: 'Scan at mobile, tablet, and desktop widths to catch responsive-only issues.',
  },
  {
    id: 'site-crawl',
    icon: '🕸️',
    title: 'Site Crawl',
    description: 'Scan multiple pages via link discovery or sitemap upload.',
  },
];

/** Currently selected presets. */
const selectedPresets = new Set<iPresetId>();

export function getSelectedPresets(): Set<iPresetId> {
  return selectedPresets;
}

export function isPresetSelected(id: iPresetId): boolean {
  return selectedPresets.has(id);
}

export function togglePreset(id: iPresetId): void {
  if (selectedPresets.has(id)) {
    selectedPresets.delete(id);
  } else {
    selectedPresets.add(id);
  }
}

export function clearPresets(): void {
  selectedPresets.clear();
}

/**
 * Builds a scan description based on currently selected presets.
 */
function buildScanDescription(): string {
  const parts: string[] = [];

  if (selectedPresets.size === 0) {
    parts.push('Scans the current page for WCAG violations, runs a manual review checklist, and validates ARIA widget patterns.');
  } else {
    parts.push('Scans for WCAG violations, manual review items, and ARIA patterns.');
    if (selectedPresets.has('site-crawl')) {
      parts.push('Crawls multiple pages from the current site.');
    }
    if (selectedPresets.has('multi-viewport')) {
      parts.push('Tests at multiple viewport widths (mobile, tablet, desktop).');
    }
  }

  parts.push('Download results as JSON, HTML, or PDF.');

  return parts.join(' ');
}

/**
 * Renders the scan preset cards and description into the given container.
 * Cards are toggleable. Calls onSelectionChange when selection changes.
 */
export function renderScanPresets(
  container: HTMLElement,
  onSelectionChange: () => void,
): void {
  container.innerHTML = `
    <div class="px-3.5 py-3">
      <p class="text-[10px] text-zinc-500 mb-2 uppercase tracking-wide font-bold">Scan options</p>
      <div class="flex gap-2 mb-3">
        ${SCAN_PRESETS.map((preset) => {
          const selected = selectedPresets.has(preset.id);
          const checkbox = selected
            ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-indigo-600"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2Zm10.03 4.97a.75.75 0 0 1 .011 1.06l-5 5.25a.75.75 0 0 1-1.07.02L3.97 9.28a.75.75 0 0 1 1.06-1.06l1.5 1.5 4.44-4.66a.75.75 0 0 1 1.06-.01Z"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-zinc-300"><rect x="0.5" y="0.5" width="15" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
          return `
          <button
            data-preset="${preset.id}"
            class="preset-card relative flex-1 p-2 pt-5 rounded-lg border-2 text-left transition-all cursor-pointer ${selected ? 'border-indigo-600 bg-indigo-50' : 'border-zinc-200 bg-white hover:border-zinc-300'}"
          >
            <span class="absolute top-1.5 right-1.5">${checkbox}</span>
            <div class="text-sm mb-0.5">${preset.icon}</div>
            <div class="text-[10px] font-bold ${selected ? 'text-indigo-950' : 'text-zinc-700'}">${preset.title}</div>
            <div class="text-[9px] ${selected ? 'text-indigo-700' : 'text-zinc-400'} leading-snug">${preset.description}</div>
          </button>
        `}).join('')}
      </div>
      <div id="scan-description" class="text-[10px] text-zinc-500 mb-3 leading-relaxed">${buildScanDescription()}</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1 mb-3 text-[10px] text-zinc-600">
        <div class="flex items-center gap-1"><span class="text-red-500">●</span> Automated violations</div>
        <div class="flex items-center gap-1"><span class="text-amber-500">●</span> Manual review checklist</div>
        <div class="flex items-center gap-1"><span class="text-violet-500">●</span> ARIA pattern validation</div>
        <div class="flex items-center gap-1"><span class="text-green-500">●</span> Passing rules</div>
        <div class="flex items-center gap-1"><span class="text-indigo-500">●</span> Tab order &amp; focus gaps</div>
        <div class="flex items-center gap-1"><span class="text-zinc-500">●</span> JSON / HTML / PDF export</div>
      </div>
      <div class="flex gap-3 text-[10px]">
        <a href="${SITE_URL}/getting-started" target="_blank" rel="noopener" class="font-bold text-indigo-700 hover:text-indigo-900">How to use A11y Scan →</a>
        <a href="${SITE_URL}/tools/test-config-builder" target="_blank" rel="noopener" class="font-bold text-indigo-700 hover:text-indigo-900">Test Config Builder →</a>
      </div>
    </div>
  `;

  // Wire card click handlers
  const cards = container.querySelectorAll<HTMLButtonElement>('.preset-card');
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.preset as iPresetId;
      togglePreset(id);
      renderScanPresets(container, onSelectionChange);
      onSelectionChange();
    });
  });
}
