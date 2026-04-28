/**
 * Mutable, module-local state shared between scan-tab.ts (renderer wrappers)
 * and scan-tab/handlers.ts (event listeners). Encapsulating it in a single
 * exported object lets either module mutate fields without going through
 * an awkward setter API.
 *
 * Anything that lives ONLY in handlers.ts (e.g., element-flash WeakMaps,
 * one-shot listener-attached flags) stays inside that file.
 */

import type { iObserverEntry } from "@shared/types";

export const scanTabState = {
  /** F13 — config dialog is open (drives settings-btn aria-expanded). */
  configPanelOpen: false,
  /** F02 — viewport editor is open. */
  viewportEditing: false,
  /** F03-AC3 — URL list for urllist crawl mode. */
  crawlUrlList: [] as string[],
  /** F03 — URL-list inline panel is open. */
  urlListPanelOpen: false,
  /** F03-AC13 — Crawl results view: "page" or "wcag". */
  crawlViewMode: "page" as "page" | "wcag",
  /** F03-AC2 — selected crawl mode dropdown value. */
  crawlMode: "follow" as "follow" | "urllist",
  /** F04 — Observer history rows fetched from background. */
  observerEntries: [] as iObserverEntry[],
  /** F04 — true once we've kicked off the OBSERVER_GET_HISTORY round-trip. */
  observerLoaded: false,
  /** F04-AC12 — domain-filter input value. */
  observerFilter: "",
};
