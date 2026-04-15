/**
 * Scan preset cards — selectable toggles that configure what happens during/after a scan.
 * Replaces the old informational empty-state cards.
 */

import { SITE_URL } from '@shared/config';

export type iPresetId = 'multi-viewport' | 'site-crawl' | 'observer';

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
  {
    id: 'observer',
    icon: '👁️',
    title: 'Observer Mode',
    description: 'Auto-scan every page you visit. Results accumulate in the Observer tab.',
  },
];

/** Currently selected presets. */
const selectedPresets = new Set<iPresetId>();

export function getSelectedPresets(): Set<iPresetId> {
  return new Set(selectedPresets);
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

export function selectPreset(id: iPresetId): void {
  selectedPresets.add(id);
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
    if (selectedPresets.has('observer')) {
      parts.push('Observer Mode auto-scans every page you navigate to. Manual scans are also logged.');
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
    <div class="px-4 py-3">
      <p class="text-[11px] text-[var(--c-text-muted)] mb-2.5 uppercase tracking-wider font-semibold">Scan Options</p>
      <div class="flex gap-2.5 mb-3">
        ${SCAN_PRESETS.map((preset) => {
          const selected = selectedPresets.has(preset.id);
          return `
          <button
            data-preset="${preset.id}"
            class="preset-card relative flex-1 p-3 rounded-lg border text-left transition-all cursor-pointer ${selected ? 'border-[var(--c-accent)] bg-[var(--c-primary-light)] shadow-sm' : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-zinc-300'}"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm">${preset.icon}</span>
              <span class="text-[12px] font-semibold ${selected ? 'text-[var(--c-primary)]' : 'text-[var(--c-text)]'}">${preset.title}</span>
            </div>
            <div class="text-[11px] ${selected ? 'text-[var(--c-accent)]' : 'text-[var(--c-text-muted)]'} leading-snug">${preset.description}</div>
            ${selected ? '<div class="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--c-accent)]"></div>' : ''}
          </button>
        `}).join('')}
      </div>
      <div id="scan-description" class="text-[11px] text-[var(--c-text-muted)] mb-3 leading-relaxed">${buildScanDescription()}</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4 text-[11px] text-[var(--c-text-secondary)]">
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[var(--c-danger)]"></span> Automated violations</div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[var(--c-warning)]"></span> Manual review checklist</div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span> ARIA pattern validation</div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[var(--c-success)]"></span> Passing rules</div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-[var(--c-accent)]"></span> Tab order &amp; focus gaps</div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> JSON / HTML / PDF export</div>
      </div>
      <div class="flex gap-4 text-[11px]">
        <a href="${SITE_URL}/getting-started" target="_blank" rel="noopener" class="font-semibold text-[var(--c-accent)] hover:underline">Getting started</a>
        <a href="${SITE_URL}/tools/test-config-builder" target="_blank" rel="noopener" class="font-semibold text-[var(--c-accent)] hover:underline">Config builder</a>
        <a href="${SITE_URL}/tutorials" target="_blank" rel="noopener" class="font-semibold text-[var(--c-accent)] hover:underline">Tutorials</a>
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
