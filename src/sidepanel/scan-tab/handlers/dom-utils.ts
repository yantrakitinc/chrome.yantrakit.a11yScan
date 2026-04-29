/**
 * Tiny DOM utilities shared by every handler module: element-flash for
 * "this is what I just highlighted" feedback, blob download, error
 * surfacing, filename pieces.
 */

import { state } from "../../sidepanel";
import { escHtml } from "@shared/utils";
import { urlToDomainSlug, formatDateStamp } from "../formatting";

const flashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Add `.ds-flash-active` to `target` for 3s so the user sees which panel
 * row corresponds to the page element they just highlighted. Stacked
 * clicks reset the timer on the same target.
 */
export function flashActiveItem(target: HTMLElement | null): void {
  if (!target) return;
  const existing = flashTimers.get(target);
  if (existing) clearTimeout(existing);
  target.classList.add("ds-flash-active");
  const timer = setTimeout(() => {
    target.classList.remove("ds-flash-active");
    flashTimers.delete(target);
  }, 3000);
  flashTimers.set(target, timer);
}

/** Trigger a browser file download from a Blob + filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Replace the scan-content panel with a friendly error card. */
export function showError(message: string): void {
  const content = document.getElementById("scan-content");
  if (content) {
    content.innerHTML = `
      <div style="padding:16px">
        <div style="padding:12px;background:var(--ds-red-50);border:1px solid var(--ds-red-200);border-radius:8px">
          <div style="font-size:var(--ds-text-md);font-weight:700;color:var(--ds-red-800);margin-bottom:4px">Scan failed</div>
          <div style="font-size:var(--ds-text-base);color:var(--ds-red-900);word-break:break-all">${escHtml(message)}</div>
        </div>
      </div>
    `;
  }
}

/** Filename-safe slug of the active scan's URL host. */
export function getDomain(): string {
  return urlToDomainSlug(state.lastScanResult?.url || "");
}

/** Filename-safe `YYYY-MM-DD_HH-mm` stamp for the current moment. */
export function getDateStamp(): string {
  return formatDateStamp(new Date());
}
