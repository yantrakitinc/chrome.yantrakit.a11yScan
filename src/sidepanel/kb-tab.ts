/**
 * Keyboard tab (F16) — orchestrator. Splits across kb-tab/ submodules:
 * state, pure helpers, render template, escape handler, event listeners,
 * Movie Mode integration. This file binds them together and re-exports
 * the public surface.
 */

import { kbState } from "./kb-tab/state";
import { buildKbTabHtml } from "./kb-tab/render";
import { ensureKbEscapeHandler } from "./kb-tab/escape";
import { attachKbTabListeners } from "./kb-tab/handlers";
import { bindKbTabCallbacks } from "./kb-tab/callbacks";
import type { iTabOrderElement, iFocusGap } from "@shared/types";

// Re-export pure helpers + Movie Mode hooks for tests + sidepanel.ts.
export {
  kbRoleClassFor, renderKbRowHtml, renderFocusGapsHtml,
  renderFocusIndicatorsHtml, renderKeyboardTrapsHtml, renderSkipLinksHtml,
} from "./kb-tab/pure";
export { onMovieTick, onMovieComplete } from "./kb-tab/movie";

/** Returns the current tab order for F12 export. */
export function getTabOrder(): iTabOrderElement[] { return kbState.tabOrder; }
/** Returns the current focus gaps for F12 export. */
export function getFocusGaps(): iFocusGap[] { return kbState.focusGaps; }

/** Re-render the kb panel and rewire event listeners. */
export function renderKeyboardTab(): void {
  const panel = document.getElementById("panel-kb");
  if (!panel) return;
  ensureKbEscapeHandler();

  // Save current scroll before innerHTML replacement so we can restore it.
  const prevScroll = document.getElementById("kb-scroll-container")?.scrollTop ?? null;
  if (prevScroll !== null) kbState.kbSavedScroll = prevScroll;

  panel.innerHTML = buildKbTabHtml();

  // Restore scroll. Analyze/Clear set kbScrollSetByAnalyze=true to start at top
  // for the freshly-loaded list; everything else (row clicks, movie state
  // changes) restores the previous scroll position.
  const sc = document.getElementById("kb-scroll-container");
  if (sc) {
    if (kbState.kbScrollSetByAnalyze) {
      sc.scrollTop = 0;
      kbState.kbSavedScroll = 0;
      kbState.kbScrollSetByAnalyze = false;
    } else if (kbState.kbSavedScroll > 0) {
      sc.scrollTop = kbState.kbSavedScroll;
    }
  }

  attachKbTabListeners();
}

// Wire the rerender callback so handlers / movie / escape can trigger
// a render without an import cycle.
bindKbTabCallbacks({ rerender: renderKeyboardTab });
