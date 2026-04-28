/**
 * Observer-tab handlers: export, clear, domain filter input. Targeted DOM
 * update for the filter (full re-render would steal focus mid-keystroke).
 */

import { sendMessage } from "@shared/messages";
import type { iObserverEntry } from "@shared/types";
import { scanTabState } from "../state";
import { renderObserverListInnerHtml } from "../render-observer";
import { rerender } from "./callbacks";
import { downloadBlob, getDateStamp } from "./dom-utils";

export function attachObserverListeners(): void {
  document.getElementById("export-observer")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "OBSERVER_EXPORT_HISTORY" });
    if (result && (result as { type: string }).type === "OBSERVER_HISTORY") {
      const entries = (result as { payload: iObserverEntry[] }).payload;
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      downloadBlob(blob, `A11y-Observer-History-${getDateStamp()}.json`);
    }
  });

  document.getElementById("clear-observer")?.addEventListener("click", async () => {
    await sendMessage({ type: "OBSERVER_CLEAR_HISTORY" });
    scanTabState.observerEntries = [];
    scanTabState.observerLoaded = false;
    scanTabState.observerFilter = "";
    rerender();
  });

  // Targeted DOM update — full re-render would destroy the input mid-keystroke.
  document.getElementById("observer-domain-filter")?.addEventListener("input", (e) => {
    scanTabState.observerFilter = (e.target as HTMLInputElement).value;
    const listEl = document.getElementById("observer-list-content");
    if (listEl) listEl.innerHTML = renderObserverListInnerHtml(scanTabState.observerEntries, scanTabState.observerFilter);
  });
}
