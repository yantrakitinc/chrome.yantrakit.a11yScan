/**
 * Event listener wiring for the kb-tab — Analyze (5-way Promise.all),
 * Clear, row click + gap/indicator/trap activation, Movie Mode play /
 * pause / resume / stop, overlay toggles. Idempotent across re-renders
 * because innerHTML replacement drops old elements.
 */

import { state } from "../sidepanel";
import { sendMessage } from "@shared/messages";
import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";
import { kbState } from "./state";
import { flashKbItem } from "./movie";
import { rerender } from "./callbacks";

/** Wire the Keyboard tab — Analyze, Clear, row clicks, gap/indicator/trap activation, movie controls, overlay toggles, and Escape-to-stop. */
export function attachKbTabListeners(): void {
  // Analyze — fetch all keyboard data in parallel
  document.getElementById("kb-analyze")?.addEventListener("click", async () => {
    const [tabResult, gapResult, fiResult, trapResult, slResult] = await Promise.all([
      sendMessage({ type: "GET_TAB_ORDER" }),
      sendMessage({ type: "GET_FOCUS_GAPS" }),
      sendMessage({ type: "GET_FOCUS_INDICATORS" }),
      sendMessage({ type: "GET_KEYBOARD_TRAPS" }),
      sendMessage({ type: "GET_SKIP_LINKS" }),
    ]);
    if (tabResult && (tabResult as { type: string }).type === "TAB_ORDER_RESULT") {
      kbState.tabOrder = (tabResult as { payload: iTabOrderElement[] }).payload;
    }
    if (gapResult && (gapResult as { type: string }).type === "FOCUS_GAPS_RESULT") {
      kbState.focusGaps = (gapResult as { payload: iFocusGap[] }).payload;
    }
    if (fiResult && (fiResult as { type: string }).type === "FOCUS_INDICATORS_RESULT") {
      kbState.focusIndicators = (fiResult as { payload: iFocusIndicator[] }).payload;
    }
    if (trapResult && (trapResult as { type: string }).type === "KEYBOARD_TRAPS_RESULT") {
      kbState.keyboardTraps = (trapResult as { payload: iKeyboardTrap[] }).payload;
    }
    if (slResult && (slResult as { type: string }).type === "SKIP_LINKS_RESULT") {
      kbState.skipLinks = (slResult as { payload: iSkipLink[] }).payload;
    }
    kbState.kbAnalyzed = true;
    kbState.kbScrollSetByAnalyze = true;
    rerender();
    // R-KB AC5: auto-focus Play All so keyboard users don't have to tab
    // through the disclosure to reach the Movie Mode entry point.
    document.getElementById("movie-play-all")?.focus();
  });

  // Clear — wipe data, hide overlays, reset highlight
  document.getElementById("kb-clear")?.addEventListener("click", () => {
    kbState.tabOrder = [];
    kbState.focusGaps = [];
    kbState.focusIndicators = [];
    kbState.keyboardTraps = [];
    kbState.skipLinks = [];
    kbState.kbScrollSetByAnalyze = true;
    if (state.tabOrderOverlayOn) {
      state.tabOrderOverlayOn = false;
      sendMessage({ type: "HIDE_TAB_ORDER" });
    }
    if (state.focusGapsOverlayOn) {
      state.focusGapsOverlayOn = false;
      sendMessage({ type: "HIDE_FOCUS_GAPS" });
    }
    kbState.kbAnalyzed = false;
    if (kbState.selectedKbTimer) {
      clearTimeout(kbState.selectedKbTimer);
      kbState.selectedKbTimer = null;
    }
    kbState.selectedKbIndex = null;
    rerender();
  });

  // Row click/keyboard → highlight on page + flash row in panel
  document.querySelectorAll<HTMLDivElement>(".kb-row").forEach((row) => {
    const activate = () => {
      const selector = row.dataset.selector;
      const idx = parseInt(row.dataset.index || "-1");
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Skip during Movie Mode — Movie Mode owns the active row.
      if (idx >= 0 && kbState.moviePlayState === "idle") {
        if (kbState.selectedKbTimer) clearTimeout(kbState.selectedKbTimer);
        kbState.selectedKbIndex = idx;
        rerender();
        kbState.selectedKbTimer = setTimeout(() => {
          kbState.selectedKbIndex = null;
          kbState.selectedKbTimer = null;
          rerender();
        }, 3000);
      }
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  // Gap/indicator/trap item activation → highlight + flash
  document.querySelectorAll<HTMLDivElement>(".kb-gap, .kb-fi, .kb-trap").forEach((item) => {
    const activate = () => {
      const selector = item.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      flashKbItem(item);
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  // Movie Mode controls
  document.getElementById("movie-play-all")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (kbState.tabOrder.length === 0) return;
    if (kbState.selectedKbTimer) {
      clearTimeout(kbState.selectedKbTimer);
      kbState.selectedKbTimer = null;
    }
    kbState.selectedKbIndex = null;
    kbState.moviePlayState = "playing";
    kbState.movieIndex = 0;
    sendMessage({ type: "START_MOVIE_MODE" });
    rerender();
  });
  document.getElementById("movie-pause")?.addEventListener("click", (e) => {
    e.stopPropagation();
    kbState.moviePlayState = "paused";
    sendMessage({ type: "PAUSE_MOVIE_MODE" });
    rerender();
  });
  document.getElementById("movie-resume")?.addEventListener("click", (e) => {
    e.stopPropagation();
    kbState.moviePlayState = "playing";
    sendMessage({ type: "RESUME_MOVIE_MODE" });
    rerender();
  });
  document.getElementById("movie-stop")?.addEventListener("click", (e) => {
    e.stopPropagation();
    kbState.moviePlayState = "idle";
    kbState.movieIndex = 0;
    sendMessage({ type: "STOP_MOVIE_MODE" });
    rerender();
  });

  // Overlay toggles (Tab order + Focus gaps live in kb-tab, not Scan tab)
  document.getElementById("toggle-tab-order")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.tabOrderOverlayOn = checked;
    sendMessage(checked ? { type: "SHOW_TAB_ORDER" } : { type: "HIDE_TAB_ORDER" });
  });
  document.getElementById("toggle-focus-gaps")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    state.focusGapsOverlayOn = checked;
    sendMessage(checked ? { type: "SHOW_FOCUS_GAPS" } : { type: "HIDE_FOCUS_GAPS" });
  });
}
