/**
 * Test Configuration modal (F13). Opens an HTMLDialogElement with a paste
 * textarea + file upload + Apply / Clear / Close. Owns the focus-restore
 * lifecycle and the one-time backdrop/close listeners. Caller passes the
 * callbacks needed when the dialog closes (so this module doesn't import
 * back from scan-tab.ts and create a cycle).
 */

import { state, TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } from "../sidepanel";
import { escHtml } from "@shared/utils";
import { validateTestConfig } from "@shared/validate-test-config";

let dialogReturnFocus: HTMLElement | null = null;
let configDialogGlobalListenersAttached = false;

export interface iConfigDialogOptions {
  /** Called from inside the dialog's `close` event. Allows the caller to
   *  flip its own `configPanelOpen` flag back to false and re-render. */
  onClose(): void;
  /** Called after a successful Apply / Clear so the panel reflects the
   *  new testConfig + viewport list. */
  rerender(): void;
}

/** Open the modal and render its contents. */
export function openConfigDialog(opts: iConfigDialogOptions): void {
  const dialog = document.getElementById("config-dialog") as HTMLDialogElement | null;
  const content = document.getElementById("config-dialog-content");
  if (!dialog || !content) return;

  dialogReturnFocus = (document.activeElement as HTMLElement) || null;

  const configJson = state.testConfig ? JSON.stringify(state.testConfig, null, 2) : "";
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h2 id="config-dialog-title" style="margin:0;font-size:12px;font-weight:800;color:var(--ds-zinc-800);text-transform:uppercase;letter-spacing:0.05em">Test Configuration</h2>
      <button id="config-close-btn" aria-label="Close" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:var(--ds-zinc-500);border-radius:var(--ds-radius-3)">
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
      </button>
    </div>
    <a href="https://a11yscan.yantrakit.com/tools/test-config-builder" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:var(--ds-indigo-700);text-decoration:none">Open Builder ↗</a>
    <textarea id="config-textarea" aria-label="Paste config JSON here" placeholder='Paste JSON config here, e.g. { "wcag": { "version": "2.1", "level": "AA" } }' class="font-mono" style="width:100%;box-sizing:border-box;font-size:11px;padding:var(--ds-space-4);border:1px solid ${state.testConfig ? "var(--ds-amber-300)" : "var(--ds-zinc-300)"};border-radius:4px;resize:vertical;min-height:100px;background:#fff;color:var(--ds-zinc-800);line-height:1.5">${escHtml(configJson)}</textarea>
    <div id="config-error" role="alert" aria-live="polite" style="font-size:11px;color:var(--ds-red-700);display:none"></div>
    <div style="display:flex;align-items:center;gap:var(--ds-space-3);flex-wrap:wrap">
      <button id="config-apply-btn" class="f-1 cur-pointer min-h-24" style="padding:var(--ds-space-4);font-size:12px;font-weight:800;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:var(--ds-radius-3)">Apply</button>
      <label id="config-upload-label" class="cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-5);font-size:11px;font-weight:700;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);display:flex;align-items:center">
        Upload .json
        <input type="file" id="config-file-input" accept=".json,application/json" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" aria-label="Upload JSON config file">
      </label>
      ${state.testConfig ? '<button id="config-clear-btn" class="cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-5);font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3)">Clear Config</button>' : ""}
    </div>
  `;

  dialog.showModal();
  // Focus textarea instead of the first link
  const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
  if (textarea) textarea.focus();
  attachConfigDialogListeners(dialog, opts);
}

function attachConfigDialogListeners(dialog: HTMLDialogElement, opts: iConfigDialogOptions): void {
  // Close button — re-rendered each open so this listener attaches to a fresh element each time
  document.getElementById("config-close-btn")?.addEventListener("click", () => {
    dialog.close();
  });

  // Backdrop + close listeners attach ONCE at first open (avoid stacking across opens)
  if (!configDialogGlobalListenersAttached) {
    configDialogGlobalListenersAttached = true;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      opts.onClose();
      if (dialogReturnFocus && document.contains(dialogReturnFocus)) {
        dialogReturnFocus.focus();
      } else {
        document.getElementById("settings-btn")?.focus();
      }
      dialogReturnFocus = null;
    });
  }

  // Apply (F13-AC1, AC3, AC4, AC5)
  document.getElementById("config-apply-btn")?.addEventListener("click", () => {
    const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
    const errorEl = document.getElementById("config-error") as HTMLElement | null;
    if (!textarea || !errorEl) return;

    const text = textarea.value.trim();
    if (!text) {
      errorEl.textContent = "Paste JSON config or upload a .json file first.";
      errorEl.style.display = "block";
      return;
    }

    try {
      const config = validateTestConfig(text);
      state.testConfig = config;
      // Sync state.viewports to testConfig.viewports when supplied (R-MV AC8)
      if (config.viewports && config.viewports.length > 0) {
        state.viewports = [...config.viewports].sort((a, b) => a - b);
      }
      chrome.storage.local.set({
        [TEST_CONFIG_STORAGE_KEY]: config,
        [TEST_CONFIG_TIMESTAMP_KEY]: new Date().toISOString(),
      });
      errorEl.style.display = "none";
      dialog.close();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      errorEl.style.display = "block";
      // role=alert + aria-live on the error region announces the message.
      textarea.focus();
    }
  });

  // File upload (F13-AC2)
  document.getElementById("config-file-input")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = typeof reader.result === "string" ? reader.result : "";
      }
    };
    reader.readAsText(file);
    input.value = "";
  });

  // Clear Config (F13-AC7)
  document.getElementById("config-clear-btn")?.addEventListener("click", () => {
    state.testConfig = null;
    chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]);
    dialog.close();
  });
}
