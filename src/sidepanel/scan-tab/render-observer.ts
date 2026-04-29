/**
 * Observer history list. Pure — given the entries + filter, returns rows.
 */

import type { iObserverEntry } from "@shared/types";
import { escHtml } from "@shared/utils";

/**
 * Render the inner observer list (no chrome). Returns the empty-state copy
 * when entries is empty, the no-match copy when the filter excludes
 * everything, otherwise one row per entry.
 */
export function renderObserverListInnerHtml(
  entries: iObserverEntry[],
  filter: string,
): string {
  if (entries.length === 0) {
    return '<div class="scan-empty">Observer history will appear here as you browse with Observer mode on. Data stays local to your browser.</div>';
  }
  const filtered = filter
    ? entries.filter((e) => e.url.includes(filter) || (e.title || "").toLowerCase().includes(filter.toLowerCase()))
    : entries;
  if (filtered.length === 0) return '<div class="scan-empty">No entries match that domain.</div>';
  return filtered.map((entry) => `
    <div role="button" tabindex="0" aria-label="Open observer entry: ${escHtml(entry.title || entry.url)}" style="padding:var(--ds-space-4);border:1px solid var(--ds-zinc-200);border-radius:var(--ds-radius-3);background:#fff;margin-bottom:4px" class="observer-entry cur-pointer" data-url="${escHtml(entry.url)}">
      <div style="display:flex;align-items:center;gap:var(--ds-space-3)">
        <span class="fs-0" style="font-size:11px;font-weight:700;color:${entry.violationCount > 0 ? "var(--ds-red-700)" : "var(--ds-green-700)"}">${entry.violationCount}</span>
        <span class="truncate f-1" style="font-size:11px;font-weight:600;color:var(--ds-zinc-800)">${escHtml(entry.title || entry.url)}</span>
        <span class="fs-0" style="font-size:10px;color:var(--ds-zinc-500)">${entry.source === "auto" ? "auto" : "manual"}</span>
        ${entry.viewportBucket ? `<span class="fs-0" style="font-size:10px;color:var(--ds-sky-700);background:var(--ds-blue-100);padding:1px var(--ds-space-2);border-radius:var(--ds-radius-2)">${escHtml(entry.viewportBucket)}</span>` : ""}
      </div>
      <div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-500);margin-top:2px">${escHtml(entry.url)}</div>
      <div style="font-size:10px;color:var(--ds-zinc-500);margin-top:1px">${new Date(entry.timestamp).toLocaleString()}</div>
    </div>
  `).join("");
}
