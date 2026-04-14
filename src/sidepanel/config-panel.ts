/**
 * Config panel — dropdown overlay from the gear icon in the header.
 * Paste/upload JSON test configs. Stores in chrome.storage.local.
 *
 * DOM is created once in initConfigPanel(). State changes update specific
 * elements instead of re-rendering the entire panel.
 */

import type { iTestConfig } from '@shared/test-config';
import { validateTestConfig, mergeWithDefaults } from '@shared/test-config';
import { SITE_URL } from '@shared/config';

const STORAGE_KEY = 'a11yscan_test_config';

let activeConfig: iTestConfig | null = null;

export function getActiveConfig(): iTestConfig | null {
  return activeConfig;
}

export async function setActiveConfig(config: iTestConfig | null): Promise<void> {
  activeConfig = config;
  if (config) {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
  } else {
    await chrome.storage.local.remove(STORAGE_KEY);
  }
}

export async function loadSavedConfig(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      const { config, errors } = mergeWithDefaults(result[STORAGE_KEY]);
      if (errors.length === 0) activeConfig = config;
    }
  } catch { /* storage not available */ }
}

function parseConfigJson(jsonStr: string): { config: iTestConfig | null; errorMessage: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { config: null, errorMessage: `Invalid JSON: ${(e as Error).message}` };
  }
  const errors = validateTestConfig(parsed);
  if (errors.length > 0) {
    return { config: null, errorMessage: errors.map((e) => `${e.field}: ${e.message}`).join('\n') };
  }
  const { config } = mergeWithDefaults(parsed);
  return { config, errorMessage: '' };
}

/**
 * Builds the panel DOM once, wires events once, and returns an update function
 * for refreshing UI state without re-creating the DOM.
 */
export function initConfigPanel(
  gearBtn: HTMLButtonElement,
  panel: HTMLDivElement,
  onConfigChange: (config: iTestConfig | null) => void,
): void {
  const backdrop = document.getElementById('config-backdrop') as HTMLDivElement;

  // ── Build DOM once ──────────────────────────────────────────────────────
  panel.innerHTML = `
    <div class="bg-white px-3.5 py-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-indigo-950">Test Config</span>
        <span id="cfg-status" class="text-[10px] text-zinc-400"></span>
      </div>
      <p class="text-[10px] text-zinc-500 mb-2">Override default scan settings — WCAG version, viewports, timing, rules, and more. Build a config with the step-by-step wizard or paste JSON directly.</p>
      <a href="${SITE_URL}/tools/test-config-builder" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 mb-2">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z"/><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z"/></svg>
        Build config on website
      </a>
      <textarea id="cfg-textarea" rows="5" class="w-full text-[10px] font-mono p-2 border border-zinc-300 rounded bg-white resize-y mb-2" placeholder="Paste a JSON config file here..."></textarea>
      <div id="cfg-error" class="text-[10px] text-red-600 mb-2 hidden whitespace-pre-wrap"></div>
      <div class="flex gap-1.5">
        <button id="cfg-apply" class="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-950 rounded hover:bg-indigo-900 cursor-pointer">Apply</button>
        <label class="px-2.5 py-1 text-[10px] font-bold text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-50 cursor-pointer">
          Upload<input id="cfg-file" type="file" accept=".json,application/json" class="hidden">
        </label>
        <button id="cfg-clear" class="px-2.5 py-1 text-[10px] font-bold text-red-600 border border-red-200 rounded hover:bg-red-50 cursor-pointer hidden">Remove</button>
        <button id="cfg-close" class="ml-auto px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-600 cursor-pointer">Close</button>
      </div>

      <!-- Observer Mode settings slot — populated by observer-settings.ts -->
      <div id="observer-settings-root" class="mt-3 pt-3 border-t border-zinc-200"></div>
    </div>
  `;

  // ── Cache refs (queried once) ───────────────────────────────────────────
  const statusEl = panel.querySelector('#cfg-status') as HTMLSpanElement;
  const textarea = panel.querySelector('#cfg-textarea') as HTMLTextAreaElement;
  const errorEl = panel.querySelector('#cfg-error') as HTMLDivElement;
  const applyBtn = panel.querySelector('#cfg-apply') as HTMLButtonElement;
  const fileInput = panel.querySelector('#cfg-file') as HTMLInputElement;
  const clearBtn = panel.querySelector('#cfg-clear') as HTMLButtonElement;
  const closeBtn = panel.querySelector('#cfg-close') as HTMLButtonElement;

  // ── UI update function (no DOM rebuild) ─────────────────────────────────
  function refreshUI(): void {
    if (activeConfig) {
      statusEl.textContent = activeConfig.name;
      statusEl.className = 'text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700';
      textarea.value = JSON.stringify(activeConfig, null, 2);
      clearBtn.classList.remove('hidden');
      gearBtn.classList.remove('text-indigo-300');
      gearBtn.classList.add('text-emerald-400');
      gearBtn.title = `Config: ${activeConfig.name}`;
    } else {
      statusEl.textContent = 'Using defaults';
      statusEl.className = 'text-[10px] text-zinc-400';
      textarea.value = '';
      clearBtn.classList.add('hidden');
      gearBtn.classList.remove('text-emerald-400');
      gearBtn.classList.add('text-indigo-300');
      gearBtn.title = 'Test configuration';
    }
    errorEl.classList.add('hidden');
  }

  function showPanel(): void { panel.hidden = false; backdrop.hidden = false; }
  function hidePanel(): void { panel.hidden = true; backdrop.hidden = true; }
  function togglePanel(): void { panel.hidden ? showPanel() : hidePanel(); }

  // ── Initial state ───────────────────────────────────────────────────────
  refreshUI();

  // ── Events (wired once) ─────────────────────────────────────────────────
  gearBtn.addEventListener('click', togglePanel);
  backdrop.addEventListener('click', hidePanel);
  closeBtn.addEventListener('click', hidePanel);

  applyBtn.addEventListener('click', async () => {
    const { config, errorMessage } = parseConfigJson(textarea.value);
    if (errorMessage) {
      errorEl.textContent = errorMessage;
      errorEl.classList.remove('hidden');
      return;
    }
    await setActiveConfig(config);
    refreshUI();
    hidePanel();
    onConfigChange(config);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    errorEl.classList.add('hidden');
    const reader = new FileReader();
    reader.onload = () => { textarea.value = reader.result as string; };
    reader.onerror = () => {
      errorEl.textContent = 'Failed to read file.';
      errorEl.classList.remove('hidden');
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  clearBtn.addEventListener('click', async () => {
    await setActiveConfig(null);
    refreshUI();
    onConfigChange(null);
  });
}
