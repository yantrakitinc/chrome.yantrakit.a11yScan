/**
 * Screen Reader tab (F15) — orchestrator. Splits across sr-tab/ submodules:
 * state, pure helpers, playback engine, escape handler, render template,
 * event listeners. This file binds them and re-exports the public surface.
 */

import { sendMessage } from "@shared/messages";
import type { iScreenReaderElement } from "@shared/types";

import { srState } from "./sr-tab/state";
import { buildSrTabHtml } from "./sr-tab/render";
import { ensureSrEscapeHandler } from "./sr-tab/escape";
import { attachSrTabListeners } from "./sr-tab/handlers";
import { bindSrTabCallbacks } from "./sr-tab/callbacks";

// Re-export pure helpers for tests and any external caller.
export {
  elementToSpeechText, srStatusLabelHtml, composeContainerSpeechText,
  renderSrRowHtml, roleClassFor,
} from "./sr-tab/pure";

/**
 * Set scope selector from an inspect-mode click and re-analyze (F15-AC21).
 */
export function setScopeFromInspect(selector: string): void {
  srState.scopeSelector = selector;
  srState.inspectActive = false;
  sendMessage({ type: "EXIT_INSPECT_MODE" });
  sendMessage({ type: "ANALYZE_READING_ORDER", payload: { scopeSelector: selector } }).then((result) => {
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      srState.elements = (result as { payload: iScreenReaderElement[] }).payload;
    }
    srState.srShouldScrollTop = true;
    renderScreenReaderTab();
  });
}

/** Re-render the SR panel and rewire event listeners. */
export function renderScreenReaderTab(): void {
  const panel = document.getElementById("panel-sr");
  if (!panel) return;
  ensureSrEscapeHandler();

  panel.innerHTML = buildSrTabHtml();

  // Scroll-to-top only on the first render after Analyze produces a fresh list.
  // Subsequent re-renders (row click, speak click, scope change) preserve scroll.
  if (srState.srShouldScrollTop) {
    srState.srShouldScrollTop = false;
    document.getElementById("sr-list")?.scrollTo(0, 0);
  }

  attachSrTabListeners();
}

// Wire the rerender callback so playback.ts / handlers.ts / escape.ts can
// trigger a render without an import cycle.
bindSrTabCallbacks({ rerender: renderScreenReaderTab });
