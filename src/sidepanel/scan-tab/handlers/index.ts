/**
 * Barrel that calls every per-feature handler module. Called from
 * scan-tab.ts after `panel.innerHTML = ...` so the freshly-rendered
 * elements get fresh listeners.
 *
 * Listeners attach to specific element ids/classes — they're idempotent
 * across re-renders because innerHTML replacement drops the old elements
 * with their listeners.
 */

import { attachHeaderListeners } from "./header";
import { attachScanButtonListeners } from "./scan-button";
import { attachCrawlListeners } from "./crawl";
import { attachResultsActionListeners } from "./results-actions";
import { attachExportListeners } from "./export";
import { attachObserverListeners } from "./observer";

export { bindScanTabCallbacks } from "./callbacks";

/** Composite — calls every handler module's attach function in turn so a single rerender wires up the entire scan-tab UI. */
export function attachScanTabListeners(): void {
  attachHeaderListeners();
  attachScanButtonListeners();
  attachCrawlListeners();
  attachResultsActionListeners();
  attachExportListeners();
  attachObserverListeners();
}
