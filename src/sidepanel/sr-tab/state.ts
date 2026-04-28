/**
 * Mutable closure state shared between sr-tab.ts (renderer/handlers) and
 * sr-tab/playback.ts (the speak chain). Encapsulating in one exported
 * object lets either module mutate fields without an awkward setter API.
 */

import type { iScreenReaderElement } from "@shared/types";

export const srState = {
  /** Reading-order elements returned by the last ANALYZE_READING_ORDER. */
  elements: [] as iScreenReaderElement[],
  /** Playback lifecycle. */
  playState: "idle" as "idle" | "playing" | "paused" | "complete",
  /** Index of the next element Play All will speak. */
  playIndex: 0,
  /** When set, ANALYZE_READING_ORDER is sent with scopeSelector + the panel
   *  shows a "Scoped to:" banner. */
  scopeSelector: null as string | null,
  /** Inspect-mode is active — clicks on the page set scope. */
  inspectActive: false,
  /** True after the first successful Analyze (drives Clear button + UI state). */
  srAnalyzed: false,
  /** One-shot flag: next render scrolls #sr-list to top (used after Analyze /
   *  Clear / scope change so the list starts at row 1). */
  srShouldScrollTop: false,
  /** Index of the row currently being individually-spoken (sr-speak button). */
  singleSpeakIndex: null as number | null,
  /** Index of the row most recently clicked — flashes "active" for 3s. */
  selectedRowIndex: null as number | null,
  /** Pending timer for selectedRowIndex auto-clear. */
  selectedRowTimer: null as ReturnType<typeof setTimeout> | null,
};
