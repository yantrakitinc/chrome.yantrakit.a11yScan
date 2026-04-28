/**
 * Header-area handlers: accordion expand/collapse, mode toggles
 * (crawl/observer/movie), MV checkbox + viewport editor, WCAG dropdowns,
 * sub-tab nav (click + ARIA tablist arrow keys), MV viewport-filter chips.
 */

import { state } from "../../sidepanel";
import { sendMessage } from "@shared/messages";
import { scanTabState } from "../state";
import { addViewport, removeViewport } from "../viewports";
import { rerender } from "./callbacks";

export function attachHeaderListeners(): void {
  // Accordion toggle
  document.getElementById("accordion-toggle")?.addEventListener("click", () => {
    if (!state.accordionExpanded) {
      state.accordionExpanded = true;
      rerender();
      document.getElementById("collapse-btn")?.focus();
    }
  });
  document.getElementById("collapse-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    state.accordionExpanded = false;
    rerender();
    document.getElementById("accordion-toggle")?.focus();
  });

  // Mode toggles (Crawl / Observer / Movie)
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "crawl") state.crawl = !state.crawl;
      else if (mode === "observer") {
        state.observer = !state.observer;
        sendMessage(state.observer ? { type: "OBSERVER_ENABLE" } : { type: "OBSERVER_DISABLE" });
        if (state.observer) scanTabState.observerLoaded = false;
      } else if (mode === "movie") {
        state.movie = !state.movie;
        chrome.storage.local.set({ movie_enabled: state.movie });
      }
      rerender();
    });
  });

  // MV checkbox + viewport editor
  document.getElementById("mv-check")?.addEventListener("change", () => {
    state.mv = !state.mv;
    if (!state.mv) scanTabState.viewportEditing = false;
    rerender();
  });
  document.getElementById("vp-edit")?.addEventListener("click", () => {
    scanTabState.viewportEditing = true;
    rerender();
  });
  document.getElementById("vp-done")?.addEventListener("click", () => {
    scanTabState.viewportEditing = false;
    rerender();
  });
  document.getElementById("vp-add")?.addEventListener("click", () => {
    state.viewports = addViewport(state.viewports);
    rerender();
  });
  document.querySelectorAll<HTMLButtonElement>(".vp-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index ?? "0");
      state.viewports = removeViewport(state.viewports, idx);
      rerender();
    });
  });
  document.querySelectorAll<HTMLInputElement>(".vp-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.index ?? "0");
      let val = parseInt(input.value) || 320;
      if (val < 320) val = 320;
      const updated = [...state.viewports];
      updated[idx] = val;
      const unique = [...new Set(updated)].sort((a, b) => a - b);
      state.viewports = unique;
      rerender();
    });
  });

  // WCAG dropdowns (F01-AC19)
  document.getElementById("wcag-version")?.addEventListener("change", (e) => {
    state.wcagVersion = (e.target as HTMLSelectElement).value;
  });
  document.getElementById("wcag-level")?.addEventListener("change", (e) => {
    state.wcagLevel = (e.target as HTMLSelectElement).value;
  });

  // Sub-tab nav (F01-AC17) — click + ARIA tablist arrows
  const subTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".sub-tab"));
  subTabs.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      const subtab = btn.dataset.subtab as typeof state.scanSubTab;
      if (subtab) { state.scanSubTab = subtab; rerender(); }
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const next = e.key === "ArrowRight" ? (i + 1) % subTabs.length
          : e.key === "ArrowLeft" ? (i - 1 + subTabs.length) % subTabs.length
          : e.key === "Home" ? 0
          : subTabs.length - 1;
        const target = subTabs[next];
        const subtab = target.dataset.subtab as typeof state.scanSubTab;
        if (subtab) {
          state.scanSubTab = subtab;
          rerender();
          document.getElementById(`subtab-${subtab}`)?.focus();
        }
      }
    });
  });

  // MV viewport filter chips (F02-AC11)
  document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.mvfilter;
      state.mvViewportFilter = val === "all" || val === undefined ? null : parseInt(val);
      rerender();
    });
  });
}
