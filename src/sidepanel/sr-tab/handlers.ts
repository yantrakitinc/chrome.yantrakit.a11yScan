/**
 * Event listener wiring for the SR tab — Analyze, Clear, Inspect, scope
 * controls, row click, sr-speak buttons, Play All / Pause / Resume / Stop.
 * All listeners attach to elements freshly rendered by the orchestrator,
 * so they're idempotent across re-renders.
 */

import { sendMessage } from "@shared/messages";
import type { iScreenReaderElement } from "@shared/types";
import { srState } from "./state";
import { stopPlayback, speakWithVoices, playNext, getSpeakTextForElement } from "./playback";
import { rerender } from "./callbacks";

/** Wire the SR tab — Analyze, Clear, Inspect, scope controls, row click, sr-speak buttons, Play All / Pause / Resume / Stop. */
export function attachSrTabListeners(): void {
  // Analyze — fetch reading order (with current scope if set)
  document.getElementById("sr-analyze")?.addEventListener("click", async () => {
    const payload: { scopeSelector?: string } = {};
    if (srState.scopeSelector) payload.scopeSelector = srState.scopeSelector;
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      srState.elements = (result as { payload: iScreenReaderElement[] }).payload;
      srState.srAnalyzed = true;
      srState.srShouldScrollTop = true;
      rerender();
    }
  });

  // Clear — wipe everything back to initial state
  document.getElementById("sr-clear")?.addEventListener("click", () => {
    srState.elements = [];
    srState.scopeSelector = null;
    srState.srAnalyzed = false;
    if (srState.inspectActive) {
      srState.inspectActive = false;
      sendMessage({ type: "EXIT_INSPECT_MODE" });
    }
    stopPlayback();
    srState.srShouldScrollTop = true;
    rerender();
  });

  // Inspect — toggle inspect mode (sends ENTER/EXIT)
  document.getElementById("sr-inspect")?.addEventListener("click", () => {
    srState.inspectActive = !srState.inspectActive;
    sendMessage(srState.inspectActive ? { type: "ENTER_INSPECT_MODE" } : { type: "EXIT_INSPECT_MODE" });
    rerender();
  });

  // Clear scope — drops scope selector + re-analyzes whole page
  document.getElementById("sr-clear-scope")?.addEventListener("click", async () => {
    srState.scopeSelector = null;
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload: {} });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      srState.elements = (result as { payload: iScreenReaderElement[] }).payload;
    }
    srState.srShouldScrollTop = true;
    rerender();
  });

  // Row click + Enter/Space → highlight on page + flash row
  document.querySelectorAll<HTMLDivElement>(".sr-row").forEach((row) => {
    const activate = () => {
      const selector = row.dataset.selector;
      const idx = parseInt(row.dataset.index || "-1");
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      if (idx >= 0) {
        if (srState.selectedRowTimer) clearTimeout(srState.selectedRowTimer);
        srState.selectedRowIndex = idx;
        rerender();
        srState.selectedRowTimer = setTimeout(() => {
          srState.selectedRowIndex = null;
          srState.selectedRowTimer = null;
          rerender();
        }, 3000);
      }
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });

  // Speak button — speaks one element (or scoped subtree for containers)
  document.querySelectorAll<HTMLButtonElement>(".sr-speak").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!("speechSynthesis" in window)) return;
      const idx = parseInt(btn.dataset.rowIndex || "-1");
      if (idx < 0 || idx >= srState.elements.length) return;
      const el = srState.elements[idx];

      speechSynthesis.cancel();
      srState.singleSpeakIndex = idx;
      srState.playState = "playing";
      rerender();

      // getSpeakTextForElement is async (fetches scoped subtree for containers).
      // If the user clicked a different speak button while we were awaiting,
      // singleSpeakIndex changes — abort to avoid out-of-order speech.
      const text = await getSpeakTextForElement(el);
      if (srState.singleSpeakIndex !== idx) return;
      speakWithVoices(text, () => {
        if (srState.singleSpeakIndex === idx) {
          srState.singleSpeakIndex = null;
          srState.playState = "idle";
          rerender();
        }
      });
    });
  });

  // Play All
  document.getElementById("sr-play-all")?.addEventListener("click", () => {
    if (srState.elements.length === 0) return;
    srState.playState = "playing";
    srState.playIndex = 0;
    rerender();
    playNext();
  });

  // Pause
  document.getElementById("sr-pause")?.addEventListener("click", () => {
    srState.playState = "paused";
    if ("speechSynthesis" in window) speechSynthesis.pause();
    rerender();
  });

  // Resume
  document.getElementById("sr-resume")?.addEventListener("click", () => {
    srState.playState = "playing";
    if ("speechSynthesis" in window) speechSynthesis.resume();
    rerender();
  });

  // Stop
  document.getElementById("sr-stop")?.addEventListener("click", () => {
    stopPlayback();
    rerender();
  });
}
