/**
 * Observer Mode settings UI — rendered into the #observer-settings-root
 * slot inside the gear-icon config panel. Also owns the one-time
 * privacy consent banner shown when the user first enables Observer Mode.
 */

import type { iObserverSettings, iObserverState } from '@shared/observer-types';

let settingsRoot: HTMLElement | null = null;

/** Mounts the settings UI into the config panel's observer-settings slot. */
export function initObserverSettingsPanel(): void {
  settingsRoot = document.getElementById('observer-settings-root');
  if (!settingsRoot) return;
  render();
}

async function render(): Promise<void> {
  if (!settingsRoot) return;
  const resp = await chrome.runtime.sendMessage({ type: 'OBSERVER_GET_STATE' });
  const state: iObserverState | null = resp?.payload ?? null;
  if (!state) {
    settingsRoot.innerHTML = '';
    return;
  }
  const s = state.settings;

  settingsRoot.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-bold text-indigo-950">Observer Mode</span>
      <span class="text-[10px] ${state.enabled ? 'text-emerald-700 font-bold' : 'text-zinc-400'}">${state.enabled ? 'On' : 'Off'}</span>
    </div>
    <p class="text-[10px] text-zinc-500 mb-2">
      Passively scans every page you visit and keeps the results locally in your browser. Review scans in the <strong>History</strong> tab.
    </p>
    <label class="flex items-center gap-2 mb-2 text-[11px] cursor-pointer">
      <input id="obs-enable" type="checkbox" ${state.enabled ? 'checked' : ''}>
      <span>Enable Observer Mode</span>
    </label>

    <div class="space-y-2">
      <div>
        <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">Include domains <span class="font-normal text-zinc-400">(one per line, empty = all)</span></label>
        <textarea id="obs-include" rows="2" class="w-full text-[10px] font-mono p-1.5 border border-zinc-300 rounded bg-white" placeholder="*.example.com">${escapeHtml(s.includeDomains.join('\n'))}</textarea>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">Exclude domains <span class="font-normal text-zinc-400">(one per line)</span></label>
        <textarea id="obs-exclude" rows="2" class="w-full text-[10px] font-mono p-1.5 border border-zinc-300 rounded bg-white" placeholder="*.internal.example.com">${escapeHtml(s.excludeDomains.join('\n'))}</textarea>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">Throttle: <span id="obs-throttle-value">${s.throttleSeconds}</span>s between rescans</label>
        <input id="obs-throttle" type="range" min="5" max="300" step="5" value="${s.throttleSeconds}" class="w-full">
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">WCAG</label>
          <select id="obs-wcag-version" class="w-full text-[10px] py-1 px-1 border border-zinc-300 rounded bg-white cursor-pointer">
            <option value="2.0" ${s.wcagVersion === '2.0' ? 'selected' : ''}>2.0</option>
            <option value="2.1" ${s.wcagVersion === '2.1' ? 'selected' : ''}>2.1</option>
            <option value="2.2" ${s.wcagVersion === '2.2' ? 'selected' : ''}>2.2</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">Level</label>
          <select id="obs-wcag-level" class="w-full text-[10px] py-1 px-1 border border-zinc-300 rounded bg-white cursor-pointer">
            <option value="A" ${s.wcagLevel === 'A' ? 'selected' : ''}>A</option>
            <option value="AA" ${s.wcagLevel === 'AA' ? 'selected' : ''}>AA</option>
            <option value="AAA" ${s.wcagLevel === 'AAA' ? 'selected' : ''}>AAA</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-zinc-600 mb-0.5">Max history</label>
          <input id="obs-max-history" type="number" min="10" max="5000" step="10" value="${s.maxHistoryEntries}" class="w-full text-[10px] py-1 px-1 border border-zinc-300 rounded bg-white">
        </div>
      </div>
      <button id="obs-clear-history" class="w-full px-2 py-1 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-50 cursor-pointer">Clear all observer history</button>
    </div>
  `;

  wire(state);
}

function wire(state: iObserverState): void {
  if (!settingsRoot) return;

  const enableInput = settingsRoot.querySelector('#obs-enable') as HTMLInputElement;
  const includeInput = settingsRoot.querySelector('#obs-include') as HTMLTextAreaElement;
  const excludeInput = settingsRoot.querySelector('#obs-exclude') as HTMLTextAreaElement;
  const throttleInput = settingsRoot.querySelector('#obs-throttle') as HTMLInputElement;
  const throttleValue = settingsRoot.querySelector('#obs-throttle-value') as HTMLSpanElement;
  const versionSelect = settingsRoot.querySelector('#obs-wcag-version') as HTMLSelectElement;
  const levelSelect = settingsRoot.querySelector('#obs-wcag-level') as HTMLSelectElement;
  const maxHistoryInput = settingsRoot.querySelector('#obs-max-history') as HTMLInputElement;
  const clearBtn = settingsRoot.querySelector('#obs-clear-history') as HTMLButtonElement;

  enableInput.addEventListener('change', async () => {
    if (enableInput.checked) {
      if (!state.consentGiven) {
        enableInput.checked = false;
        showObserverConsent(async () => {
          await chrome.runtime.sendMessage({ type: 'OBSERVER_ENABLE' });
          render();
        });
        return;
      }
      await chrome.runtime.sendMessage({ type: 'OBSERVER_ENABLE' });
    } else {
      await chrome.runtime.sendMessage({ type: 'OBSERVER_DISABLE' });
    }
    render();
  });

  const saveSettings = async (patch: Partial<iObserverSettings>) => {
    await chrome.runtime.sendMessage({ type: 'OBSERVER_UPDATE_SETTINGS', payload: patch });
  };

  const linesToArray = (text: string): string[] =>
    text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);

  includeInput.addEventListener('change', () => saveSettings({ includeDomains: linesToArray(includeInput.value) }));
  excludeInput.addEventListener('change', () => saveSettings({ excludeDomains: linesToArray(excludeInput.value) }));
  throttleInput.addEventListener('input', () => {
    throttleValue.textContent = throttleInput.value;
  });
  throttleInput.addEventListener('change', () =>
    saveSettings({ throttleSeconds: parseInt(throttleInput.value, 10) }),
  );
  versionSelect.addEventListener('change', () =>
    saveSettings({ wcagVersion: versionSelect.value as iObserverSettings['wcagVersion'] }),
  );
  levelSelect.addEventListener('change', () =>
    saveSettings({ wcagLevel: levelSelect.value as iObserverSettings['wcagLevel'] }),
  );
  maxHistoryInput.addEventListener('change', () => {
    const n = parseInt(maxHistoryInput.value, 10);
    if (Number.isFinite(n) && n > 0) saveSettings({ maxHistoryEntries: n });
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm('Clear all observer history? This cannot be undone.')) return;
    await chrome.runtime.sendMessage({ type: 'OBSERVER_CLEAR_HISTORY' });
  });
}

/**
 * Shows the one-time privacy consent modal before Observer Mode is first enabled.
 * Calls `onAccept` when the user confirms.
 */
export function showObserverConsent(onAccept: () => void): void {
  const modal = document.getElementById('observer-consent');
  const acceptBtn = document.getElementById('observer-consent-accept');
  const cancelBtn = document.getElementById('observer-consent-cancel');
  if (!modal || !acceptBtn || !cancelBtn) return;

  modal.hidden = false;

  const cleanup = () => {
    modal.hidden = true;
    acceptBtn.removeEventListener('click', onAcceptClick);
    cancelBtn.removeEventListener('click', onCancelClick);
  };
  const onAcceptClick = () => {
    cleanup();
    onAccept();
  };
  const onCancelClick = () => {
    cleanup();
  };
  acceptBtn.addEventListener('click', onAcceptClick);
  cancelBtn.addEventListener('click', onCancelClick);
}

function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
