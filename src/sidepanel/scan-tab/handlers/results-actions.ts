/**
 * Results-tab actions: Highlight buttons, Explain Further (jumps to AI tab),
 * the violations-overlay toggle, manual review pass/fail/N-A buttons,
 * ARIA scan + ARIA highlight buttons.
 */

import { state, switchTab } from "../../sidepanel";
import { openAiChatWithContext } from "../../ai-tab";
import { sendMessage } from "@shared/messages";
import type { iAriaWidget, iManualReviewStatus } from "@shared/types";
import { rerender, saveManualReviewFor } from "./callbacks";
import { flashActiveItem } from "./dom-utils";

/** Wire click handlers for the Results sub-tab — Highlight buttons, Explain Further (jumps to AI tab), violations-overlay toggle, manual-review pass/fail/N-A, ARIA scan + ARIA highlight buttons. */
export function attachResultsActionListeners(): void {
  // Highlight buttons inside violation rows
  document.querySelectorAll<HTMLButtonElement>(".highlight-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Flash the closest containing card so the user sees the panel↔page link.
      flashActiveItem(btn.closest("details") || btn.closest(".violation-card") || btn.parentElement);
    });
  });

  // Explain Further → AI tab with violation context pre-filled
  document.querySelectorAll<HTMLButtonElement>(".explain-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ruleId = btn.dataset.rule || "";
      const description = btn.dataset.description || "";
      switchTab("ai");
      // Defer until renderAiChatTab() runs after the tab switch.
      setTimeout(() => openAiChatWithContext(ruleId, description), 0);
    });
  });

  // Violation overlay toggle (state-tracked across re-renders)
  document.getElementById("toggle-violations")?.addEventListener("click", () => {
    state.violationsOverlayOn = !state.violationsOverlayOn;
    const btn = document.getElementById("toggle-violations") as HTMLButtonElement;
    btn.setAttribute("aria-pressed", String(state.violationsOverlayOn));
    btn.classList.toggle("active", state.violationsOverlayOn);
    if (state.violationsOverlayOn && state.lastScanResult) {
      sendMessage({ type: "SHOW_VIOLATION_OVERLAY", payload: { violations: state.lastScanResult.violations } });
    } else {
      sendMessage({ type: "HIDE_VIOLATION_OVERLAY" });
    }
  });

  // Manual review buttons (F09) — toggle on, second click deselects
  document.querySelectorAll<HTMLButtonElement>(".manual-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      const newStatus = btn.dataset.status as iManualReviewStatus;
      state.manualReview[id] = state.manualReview[id] === newStatus ? null : newStatus;
      if (state.lastScanResult?.url) saveManualReviewFor(state.lastScanResult.url);
      rerender();
    });
  });

  // ARIA scan kickoff button (F10 empty-state)
  document.getElementById("run-aria-scan")?.addEventListener("click", async () => {
    const result = await sendMessage({ type: "RUN_ARIA_SCAN" });
    if (result && (result as { type: string }).type === "ARIA_SCAN_RESULT") {
      state.ariaWidgets = (result as { payload: iAriaWidget[] }).payload;
      state.ariaScanned = true;
      rerender();
    }
  });

  // ARIA widget Highlight buttons
  document.querySelectorAll<HTMLButtonElement>(".aria-highlight").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      flashActiveItem(btn.closest("details"));
    });
  });
}
