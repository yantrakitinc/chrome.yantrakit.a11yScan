/**
 * Mutable closure state shared between the kb-tab orchestrator (render +
 * handlers) and movie-mode integration. Encapsulating in one exported
 * object lets every module mutate fields without an awkward setter API.
 */

import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";

export const kbState = {
  /** Tab-order elements collected from GET_TAB_ORDER. */
  tabOrder: [] as iTabOrderElement[],
  /** Focus gaps from GET_FOCUS_GAPS. */
  focusGaps: [] as iFocusGap[],
  /** Per-element focus-indicator state from GET_FOCUS_INDICATORS. */
  focusIndicators: [] as iFocusIndicator[],
  /** Keyboard traps from GET_KEYBOARD_TRAPS. */
  keyboardTraps: [] as iKeyboardTrap[],
  /** Skip links from GET_SKIP_LINKS. */
  skipLinks: [] as iSkipLink[],
  /** True after the first successful Analyze (drives Clear button + UI). */
  kbAnalyzed: false,
  /** Movie Mode lifecycle. */
  moviePlayState: "idle" as "idle" | "playing" | "paused" | "complete",
  /** Index of the row Movie Mode is currently highlighting. */
  movieIndex: 0,
  /** Row the user clicked/activated; flashes "active" for 3s. */
  selectedKbIndex: null as number | null,
  /** Pending timer for selectedKbIndex auto-clear. */
  selectedKbTimer: null as ReturnType<typeof setTimeout> | null,
  /** Last scroll position of the kb-scroll-container — restored across renders. */
  kbSavedScroll: 0,
  /** One-shot flag: next render scrolls back to top (set by Analyze/Clear). */
  kbScrollSetByAnalyze: false,
  /** Pending timer for the 2-second "Complete" pill. */
  movieCompleteTimer: null as ReturnType<typeof setTimeout> | null,
};
