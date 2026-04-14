/**
 * Observer History tab — renders the list of auto-scanned pages, their
 * violation counts, and the filter / clear / export controls.
 *
 * The background script is the source of truth. This module only sends
 * messages and re-renders when it receives updates.
 */

import type { iObserverScanResult, iObserverState } from '@shared/observer-types';

interface iRenderOptions {
  root: HTMLElement;
  onToggle: (nextEnabled: boolean) => void;
  onOpenSettings: () => void;
}

const state: {
  history: iObserverScanResult[];
  filters: { domain: string; minViolations: number };
  expanded: Set<string>;
  rootOpts: iRenderOptions | null;
  observerState: iObserverState | null;
} = {
  history: [],
  filters: { domain: '', minViolations: 0 },
  expanded: new Set(),
  rootOpts: null,
  observerState: null,
};

/**
 * Initializes the history tab. Fetches the current state and history,
 * then renders into `opts.root`. Returns a refresh function.
 */
export async function initObserverHistoryTab(opts: iRenderOptions): Promise<() => void> {
  state.rootOpts = opts;
  await refresh();
  return refresh;
}

async function refresh() {
  if (!state.rootOpts) return;
  const [stateResp, historyResp] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'OBSERVER_GET_STATE' }),
    chrome.runtime.sendMessage({ type: 'OBSERVER_GET_HISTORY' }),
  ]);
  state.observerState = stateResp?.payload ?? null;
  state.history = (historyResp?.payload ?? []) as iObserverScanResult[];
  render();
  updateHistoryBadge(state.history.length);
}

/** Updates the History tab's badge count if present in the DOM. */
function updateHistoryBadge(count: number) {
  const badge = document.getElementById('history-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.hidden = false;
  } else {
    badge.textContent = '';
    badge.hidden = true;
  }
}

function render() {
  const root = state.rootOpts?.root;
  if (!root) return;

  const filtered = filterHistory(state.history, state.filters);
  const totalViolations = filtered.reduce(
    (sum, e) => sum + e.violations.reduce((s, v) => s + (v.nodes?.length ?? 0), 0),
    0,
  );
  const uniqueUrls = new Set(filtered.map((e) => e.url)).size;
  const dates = filtered.map((e) => e.scannedAt).sort();
  const dateRange =
    dates.length > 0
      ? `${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])}`
      : '—';

  const enabled = state.observerState?.enabled ?? false;

  root.innerHTML = `
    <section aria-label="Observer Mode status" class="mb-3 p-3 border border-indigo-200 rounded-lg bg-indigo-50/60">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div>
          <div class="text-[11px] font-bold text-indigo-950">Observer Mode</div>
          <div class="text-[9px] text-zinc-600">${enabled ? 'On — scanning every page you visit' : 'Off — enable to auto-scan pages'}</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button id="observer-toggle-btn" class="px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer ${enabled ? 'text-white bg-indigo-950 hover:bg-indigo-900' : 'text-indigo-700 border border-indigo-300 hover:bg-indigo-100'}">${enabled ? 'Turn Off' : 'Turn On'}</button>
          <button id="observer-settings-btn" class="px-2 py-1 text-[10px] font-bold text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 cursor-pointer" aria-label="Observer settings">⚙</button>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-2 text-center">
        <div><div class="text-[14px] font-black text-indigo-950">${filtered.length}</div><div class="text-[8px] uppercase text-zinc-500 font-bold">scans</div></div>
        <div><div class="text-[14px] font-black text-red-700">${totalViolations}</div><div class="text-[8px] uppercase text-zinc-500 font-bold">issues</div></div>
        <div><div class="text-[14px] font-black text-indigo-950">${uniqueUrls}</div><div class="text-[8px] uppercase text-zinc-500 font-bold">pages</div></div>
        <div><div class="text-[9px] font-bold text-zinc-700 mt-1">${escapeHtml(dateRange)}</div><div class="text-[8px] uppercase text-zinc-500 font-bold">range</div></div>
      </div>
    </section>

    <div class="mb-3 flex gap-1.5">
      <input id="observer-filter-domain" type="search" placeholder="Filter by domain…" value="${escapeHtml(state.filters.domain)}" class="flex-1 px-2 py-1 text-[11px] border border-zinc-300 rounded bg-white">
      <input id="observer-filter-min" type="number" min="0" placeholder="Min issues" value="${state.filters.minViolations || ''}" class="w-20 px-2 py-1 text-[11px] border border-zinc-300 rounded bg-white">
    </div>

    <div class="mb-3 flex gap-1.5">
      <button id="observer-export-btn" class="px-2 py-1 text-[10px] font-bold text-zinc-600 border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer">↓ Export JSON</button>
      <button id="observer-clear-btn" class="px-2 py-1 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-50 cursor-pointer">Clear History</button>
    </div>

    <div id="observer-list"></div>
  `;

  // Wire toolbar controls
  root.querySelector('#observer-toggle-btn')?.addEventListener('click', () => {
    state.rootOpts?.onToggle(!enabled);
  });
  root.querySelector('#observer-settings-btn')?.addEventListener('click', () => {
    state.rootOpts?.onOpenSettings();
  });
  root.querySelector('#observer-filter-domain')?.addEventListener('input', (e) => {
    state.filters.domain = (e.target as HTMLInputElement).value;
    renderList(filterHistory(state.history, state.filters));
  });
  root.querySelector('#observer-filter-min')?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    state.filters.minViolations = Number.isFinite(val) ? val : 0;
    renderList(filterHistory(state.history, state.filters));
  });
  root.querySelector('#observer-export-btn')?.addEventListener('click', exportHistoryJson);
  root.querySelector('#observer-clear-btn')?.addEventListener('click', async () => {
    if (!confirm('Clear all observer history? This cannot be undone.')) return;
    await chrome.runtime.sendMessage({ type: 'OBSERVER_CLEAR_HISTORY' });
    state.expanded.clear();
    await refresh();
  });

  renderList(filtered);
}

/** Renders just the scan list — used on filter change for cheaper re-renders. */
function renderList(entries: iObserverScanResult[]) {
  const list = document.getElementById('observer-list');
  if (!list) return;

  if (entries.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-[11px] text-zinc-400 border border-dashed border-zinc-300 rounded-lg">No observer scans yet. Enable Observer Mode and browse normally — scans will appear here.</div>`;
    return;
  }

  // Group by day (YYYY-MM-DD)
  const byDay = new Map<string, iObserverScanResult[]>();
  for (const e of entries) {
    const day = e.scannedAt.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(e);
    byDay.set(day, arr);
  }
  const days = Array.from(byDay.keys()).sort().reverse();

  list.innerHTML = days
    .map((day) => {
      const dayEntries = (byDay.get(day) ?? []).slice().reverse();
      return `
        <div class="mb-3">
          <div class="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">${escapeHtml(formatDayHeading(day))}</div>
          <div class="space-y-1">
            ${dayEntries.map(renderRow).join('')}
          </div>
        </div>
      `;
    })
    .join('');

  // Wire row expand
  list.querySelectorAll('[data-row-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.rowId!;
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      renderList(filterHistory(state.history, state.filters));
    });
  });
}

function renderRow(entry: iObserverScanResult): string {
  const violationCount = entry.violations.reduce((s, v) => s + (v.nodes?.length ?? 0), 0);
  const isExpanded = state.expanded.has(entry.id);
  const time = new Date(entry.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hostname = safeHostname(entry.url);

  return `
    <div class="border border-zinc-200 rounded-lg bg-white overflow-hidden">
      <button type="button" data-row-id="${entry.id}" class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-50 cursor-pointer">
        <span class="text-[9px] text-zinc-400 shrink-0 w-9">${escapeHtml(time)}</span>
        <span class="flex-1 min-w-0">
          <span class="block text-[11px] font-bold text-zinc-800 truncate">${escapeHtml(entry.title || hostname)}</span>
          <span class="block text-[9px] text-zinc-500 truncate font-mono">${escapeHtml(entry.url)}</span>
        </span>
        <span class="shrink-0 flex items-center gap-1">
          ${violationCount > 0
            ? `<span class="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-800 rounded">${violationCount}</span>`
            : `<span class="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded">0</span>`}
          ${entry.incomplete > 0 ? `<span class="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">${entry.incomplete}?</span>` : ''}
        </span>
      </button>
      ${isExpanded ? renderExpanded(entry) : ''}
    </div>
  `;
}

function renderExpanded(entry: iObserverScanResult): string {
  if (entry.violations.length === 0) {
    return `<div class="px-3 py-2 text-[10px] text-emerald-700 border-t border-zinc-100">No violations. ${entry.passes} passes, ${entry.incomplete} need manual review.</div>`;
  }
  return `
    <div class="px-3 py-2 border-t border-zinc-100 space-y-1.5">
      ${entry.violations
        .map(
          (v) => `
        <div class="text-[10px]">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="px-1 py-0.5 text-[8px] font-bold rounded ${impactClass(v.impact)}">${escapeHtml(v.impact || '')}</span>
            <span class="font-bold text-zinc-800">${escapeHtml(v.id)}</span>
            <span class="text-zinc-400">${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}</span>
          </div>
          <div class="text-zinc-600">${escapeHtml(v.help)}</div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function impactClass(impact: string | null): string {
  switch (impact) {
    case 'critical':
      return 'bg-red-200 text-red-900';
    case 'serious':
      return 'bg-red-100 text-red-800';
    case 'moderate':
      return 'bg-amber-100 text-amber-800';
    case 'minor':
      return 'bg-zinc-100 text-zinc-700';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

function filterHistory(
  history: iObserverScanResult[],
  filters: { domain: string; minViolations: number },
): iObserverScanResult[] {
  return history
    .filter((e) => {
      if (filters.domain && !e.url.toLowerCase().includes(filters.domain.toLowerCase())) return false;
      if (filters.minViolations > 0) {
        const count = e.violations.reduce((s, v) => s + (v.nodes?.length ?? 0), 0);
        if (count < filters.minViolations) return false;
      }
      return true;
    })
    .slice()
    .reverse();
}

async function exportHistoryJson() {
  const resp = await chrome.runtime.sendMessage({ type: 'OBSERVER_EXPORT_HISTORY' });
  const json = resp?.json ?? '{}';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `a11yscan-observer-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Handler for OBSERVER_SCAN_COMPLETE pushes from the background. */
export async function onObserverScanComplete(): Promise<void> {
  await refresh();
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDayHeading(day: string): string {
  try {
    const d = new Date(day);
    const today = new Date().toISOString().slice(0, 10);
    if (day === today) return 'Today';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return day;
  }
}

function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
