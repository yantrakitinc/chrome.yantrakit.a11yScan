/**
 * Screen Reader tab (F15).
 */

import { sendMessage } from "@shared/messages";
import { escHtml } from "@shared/utils";
import { state } from "./sidepanel";
import type { iScreenReaderElement } from "@shared/types";

let elements: iScreenReaderElement[] = [];
let playState: "idle" | "playing" | "paused" | "complete" = "idle";
let playIndex = 0;
let scopeSelector: string | null = null;
let inspectActive = false;
let srAnalyzed = false;
/** Set true only on Analyze/Clear/scope-change so the next render scrolls to top. */
let srShouldScrollTop = false;

/** Index of the row currently being highlighted (for individual speak clicks) */
let singleSpeakIndex: number | null = null;
/** Index of the row most recently clicked/activated — highlight in panel */
let selectedRowIndex: number | null = null;
let selectedRowTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sets the SR scope selector from an inspect-mode click and re-analyzes (F15-AC21).
 */
export function setScopeFromInspect(selector: string): void {
  scopeSelector = selector;
  inspectActive = false;
  sendMessage({ type: "EXIT_INSPECT_MODE" });
  sendMessage({ type: "ANALYZE_READING_ORDER", payload: { scopeSelector: selector } }).then((result) => {
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      elements = (result as { payload: iScreenReaderElement[] }).payload;
    }
    srShouldScrollTop = true;
    renderScreenReaderTab();
  });
}

export function renderScreenReaderTab(): void {
  const panel = document.getElementById("panel-sr");
  if (!panel) return;
  ensureSrEscapeHandler();

  const countLabel = scopeSelector
    ? `${elements.length} elements in scope`
    : `${elements.length} elements in reading order`;

  panel.innerHTML = `
    <div class="fs-0" style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;gap:8px;background:#fafafa">
      <button id="sr-analyze" class="f-1 cur-pointer min-h-24" style="padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px">Analyze</button>
      <button id="sr-inspect" aria-label="Inspect element" aria-pressed="${inspectActive}" class="cur-pointer min-h-24" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid ${inspectActive ? "#f59e0b" : "#d4d4d8"};border-radius:4px;background:${inspectActive ? "#fffbeb" : "none"};color:${inspectActive ? "#b45309" : "#52525b"}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>
      </button>
      ${srAnalyzed ? '<button id="sr-clear" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;background:none">Clear</button>' : ""}
    </div>
    ${scopeSelector ? `
      <div class="fs-0" style="padding:4px 12px;background:#eff6ff;border-bottom:1px solid #bfdbfe;display:flex;align-items:center;gap:6px">
        <span style="font-size:10px;font-weight:600;color:#1d4ed8">Scoped to:</span>
        <span class="f-1 font-mono" style="font-size:10px;color:#3b82f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${scopeSelector}</span>
        <button id="sr-clear-scope" class="cur-pointer" style="font-size:10px;font-weight:700;color:#dc2626;border:none;background:none;padding:2px 4px">Clear scope</button>
      </div>
    ` : ""}
    <div role="status" aria-live="polite" aria-atomic="true" class="fs-0" style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;gap:8px;${playState === "playing" || playState === "paused" ? "background:#fffbeb" : ""}">
      <span class="f-1 font-mono" style="font-size:11px;font-weight:600;color:#52525b">${
        playState === "complete" ? '<span style="color:#047857;font-weight:700">Complete</span>' :
        playState === "playing" ? `<span style="color:#92400e;font-weight:700">${
          singleSpeakIndex !== null ? `Speaking element ${singleSpeakIndex + 1}` : `Playing ${playIndex + 1} of ${elements.length}`
        }</span>` :
        playState === "paused" ? `<span style="color:#92400e;font-weight:700">${
          singleSpeakIndex !== null ? `Paused element ${singleSpeakIndex + 1}` : `Paused at ${playIndex + 1} of ${elements.length}`
        }</span>` :
        countLabel
      }</span>
      ${elements.length > 0 ? `
        ${playState === "idle" || playState === "complete" ? `
          <button id="sr-play-all" aria-label="Play all — read all elements aloud" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;color:#b45309">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>
          </button>
        ` : ""}
        ${playState === "playing" ? `
          <button id="sr-pause" aria-label="Pause speech" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;color:#b45309">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg>
          </button>
        ` : ""}
        ${playState === "paused" ? `
          <button id="sr-resume" aria-label="Resume speech" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fcd34d;border-radius:4px;background:none;color:#b45309">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>
          </button>
        ` : ""}
        ${playState === "playing" || playState === "paused" ? `
          <button id="sr-stop" aria-label="Stop speech" title="Stop speech (Esc)" class="cur-pointer" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;color:#dc2626">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="8" height="8"/></svg>
          </button>
        ` : ""}
      ` : ""}
    </div>
    <div id="sr-list" class="f-1" style="overflow-y:auto">
      ${elements.length === 0
        ? '<div style="padding:16px;text-align:center;font-size:12px;color:#71717a">Click Analyze to scan the page reading order.</div>'
        : elements.map((el) => renderSrRow(el)).join("")
      }
    </div>
  `;

  // Scroll-to-top only on the first render after Analyze produces a fresh list.
  // Subsequent re-renders (row click, speak click, scope change) preserve scroll
  // so the user isn't yanked to the top. Playback uses scrollIntoView per-row.
  if (srShouldScrollTop) {
    srShouldScrollTop = false;
    document.getElementById("sr-list")?.scrollTo(0, 0);
  }

  // Analyze button
  document.getElementById("sr-analyze")?.addEventListener("click", async () => {
    const payload: { scopeSelector?: string } = {};
    if (scopeSelector) payload.scopeSelector = scopeSelector;
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      elements = (result as { payload: iScreenReaderElement[] }).payload;
      srAnalyzed = true;
      srShouldScrollTop = true;
      renderScreenReaderTab();
    }
  });

  // Clear — reset to initial state
  document.getElementById("sr-clear")?.addEventListener("click", () => {
    elements = [];
    scopeSelector = null;
    srAnalyzed = false;
    if (inspectActive) {
      inspectActive = false;
      sendMessage({ type: "EXIT_INSPECT_MODE" });
    }
    stopPlayback();
    srShouldScrollTop = true;
    renderScreenReaderTab();
  });


  // Inspect button
  document.getElementById("sr-inspect")?.addEventListener("click", () => {
    inspectActive = !inspectActive;
    if (inspectActive) {
      sendMessage({ type: "ENTER_INSPECT_MODE" });
    } else {
      sendMessage({ type: "EXIT_INSPECT_MODE" });
    }
    renderScreenReaderTab();
  });

  // Clear scope
  document.getElementById("sr-clear-scope")?.addEventListener("click", async () => {
    scopeSelector = null;
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload: {} });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      elements = (result as { payload: iScreenReaderElement[] }).payload;
    }
    srShouldScrollTop = true;
    renderScreenReaderTab();
  });

  // Row + button hover handled by CSS :hover — no JS handlers

  // Row click/keyboard → highlight on page AND in panel
  document.querySelectorAll<HTMLDivElement>(".sr-row").forEach((row) => {
    const activate = () => {
      const selector = row.dataset.selector;
      const idx = parseInt(row.dataset.index || "-1");
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
      // Also highlight the row in the panel — clear after 3s (matches page highlight duration)
      if (idx >= 0) {
        if (selectedRowTimer) clearTimeout(selectedRowTimer);
        selectedRowIndex = idx;
        renderScreenReaderTab();
        selectedRowTimer = setTimeout(() => {
          selectedRowIndex = null;
          selectedRowTimer = null;
          renderScreenReaderTab();
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

  // Speak buttons — highlight row + speak element (or container subtree)
  document.querySelectorAll<HTMLButtonElement>(".sr-speak").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!("speechSynthesis" in window)) return;
      const idx = parseInt(btn.dataset.rowIndex || "-1");
      if (idx < 0 || idx >= elements.length) return;
      const el = elements[idx];

      // Cancel any in-progress speech
      speechSynthesis.cancel();

      // Set playing state so toolbar shows Pause/Stop controls
      singleSpeakIndex = idx;
      playState = "playing";
      renderScreenReaderTab();

      // Compute speech text (async — fetches scoped subtree for containers).
      // If the user clicked a different speak button while we were awaiting,
      // singleSpeakIndex will have changed — abort to avoid out-of-order speech.
      const text = await getSpeakTextForElement(el);
      if (singleSpeakIndex !== idx) return;
      speakWithVoices(text, () => {
        // Clear when done (only if we're still in single-speak mode for this row)
        if (singleSpeakIndex === idx) {
          singleSpeakIndex = null;
          playState = "idle";
          renderScreenReaderTab();
        }
      });
    });
  });

  // Play All
  document.getElementById("sr-play-all")?.addEventListener("click", () => {
    if (elements.length === 0) return;
    playState = "playing";
    playIndex = 0;
    renderScreenReaderTab();
    playNext();
  });

  // Pause
  document.getElementById("sr-pause")?.addEventListener("click", () => {
    playState = "paused";
    if ("speechSynthesis" in window) speechSynthesis.pause();
    renderScreenReaderTab();
  });

  // Resume
  document.getElementById("sr-resume")?.addEventListener("click", () => {
    playState = "playing";
    if ("speechSynthesis" in window) speechSynthesis.resume();
    renderScreenReaderTab();
  });

  // Stop
  document.getElementById("sr-stop")?.addEventListener("click", () => {
    stopPlayback();
    renderScreenReaderTab();
  });

  // Escape handler is attached ONCE globally, see srEscapeHandler below
}

let srEscapeHandlerAttached = false;
function ensureSrEscapeHandler(): void {
  if (srEscapeHandlerAttached) return;
  srEscapeHandlerAttached = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const srTabActive = document.getElementById("panel-sr")?.hasAttribute("hidden") === false;
    if (!srTabActive) return;
    // R-INSPECT: Escape during inspect mode exits without picking.
    if (inspectActive) {
      inspectActive = false;
      sendMessage({ type: "EXIT_INSPECT_MODE" });
      renderScreenReaderTab();
      return;
    }
    // Existing behavior: Escape stops playback when something is playing.
    if (playState !== "idle") {
      stopPlayback();
      renderScreenReaderTab();
    }
  });
}

function stopPlayback(): void {
  playState = "idle";
  playIndex = 0;
  singleSpeakIndex = null;
  selectedRowIndex = null;
  if (selectedRowTimer) { clearTimeout(selectedRowTimer); selectedRowTimer = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  sendMessage({ type: "CLEAR_HIGHLIGHTS" });
}

function finishPlayback(): void {
  // AC14: show "Complete" for 2 seconds before reverting to idle
  playState = "complete";
  playIndex = 0;
  sendMessage({ type: "CLEAR_HIGHLIGHTS" });
  renderScreenReaderTab();
  setTimeout(() => {
    if (playState === "complete") {
      playState = "idle";
      renderScreenReaderTab();
    }
  }, 2000);
}

function speakWithVoices(text: string, onEnd: () => void): void {
  // AC7: ensure Chrome voices are loaded before speaking. Per R-SR test 17,
  // testConfig.timing.movieSpeed scales the speech rate (1× default).
  const rate = state.testConfig?.timing?.movieSpeed ?? 1;
  const doSpeak = () => {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.onend = onEnd;
    speechSynthesis.speak(utter);
  };
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    doSpeak();
  } else {
    speechSynthesis.onvoiceschanged = () => {
      speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  }
}

function playNext(): void {
  if (playState !== "playing" || playIndex >= elements.length) {
    if (playIndex >= elements.length) {
      finishPlayback();
    }
    return;
  }
  const el = elements[playIndex];
  // Highlight on page
  sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector: el.selector } });
  // Panel-side highlight is handled by renderSrRow via .ds-row--active class —
  // re-render already happened (or runs after speech ends below). Just scroll
  // the current row into view.
  const rows = document.querySelectorAll<HTMLDivElement>(".sr-row");
  rows[playIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  // Speak — for Play All, speak each element individually (children are separate rows)
  const text = elementToSpeechText(el);
  if ("speechSynthesis" in window) {
    speakWithVoices(text, () => {
      if (playState !== "playing") return;
      playIndex++;
      if (playIndex < elements.length) {
        // Update progress (active class moves to the new playIndex via render)
        renderScreenReaderTab();
        // Scroll the now-active row into view IMMEDIATELY after render so the
        // user sees the highlight move smoothly. Otherwise the 300ms gap
        // between render and the next playNext call leaves the active row
        // off-screen and the previous row no longer highlighted.
        document.querySelectorAll<HTMLDivElement>(".sr-row")[playIndex]
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setTimeout(playNext, 300);
      } else {
        // Done
        finishPlayback();
      }
    });
  } else {
    playIndex++;
    setTimeout(playNext, 1000);
  }
}

const CONTAINER_ROLES = new Set(["navigation", "banner", "contentinfo", "complementary", "region", "article", "form", "list", "group", "main"]);

function elementToSpeechText(el: iScreenReaderElement): string {
  return `${el.role}, ${el.accessibleName}${el.states.length > 0 ? ", " + el.states.join(", ") : ""}`;
}

/** For a container element, fetch its scoped reading order from content script and build full speech */
async function getSpeakTextForElement(el: iScreenReaderElement): Promise<string> {
  const base = elementToSpeechText(el);
  if (!CONTAINER_ROLES.has(el.role)) return base;

  // Fetch scoped reading order for just this container's subtree
  try {
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload: { scopeSelector: el.selector } });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      const scoped = (result as { payload: iScreenReaderElement[] }).payload;
      // The container itself appears in scoped[0]; skip it. The rest are children.
      const childTexts = scoped
        .filter((c) => c.selector !== el.selector)
        .map((c) => elementToSpeechText(c));
      if (childTexts.length > 0) return `${base}. ${childTexts.join(". ")}.`;
    }
  } catch { /* fall through */ }
  return base;
}

function renderSrRow(el: iScreenReaderElement): string {
  const roleClass = roleClassFor(el.role);
  const sourceLabel = el.nameSource === "contents" ? "text" : el.nameSource;
  const rowIdx = el.index - 1;
  // Highlight priority: single speak > Play All current > recently clicked
  const isHighlighted =
    singleSpeakIndex !== null ? singleSpeakIndex === rowIdx :
    playState !== "idle" && rowIdx === playIndex ? true :
    selectedRowIndex === rowIdx;
  const escapedName = escHtml(el.accessibleName);

  return `
    <div class="ds-row sr-row${isHighlighted ? " ds-row--active" : ""}" role="button" tabindex="0" aria-label="Highlight ${escHtml(el.role)}: ${escapedName}" data-selector="${escHtml(el.selector)}" data-index="${rowIdx}">
      <span class="ds-row__index">${el.index}</span>
      <span class="ds-badge ${roleClass} ds-badge--role-min50">${escHtml(el.role)}</span>
      <span class="ds-row__label">${escapedName}</span>
      <span class="ds-badge ds-badge--source">${escHtml(sourceLabel)}</span>
      ${el.states.map((s) => `<span class="ds-badge ds-badge--state">${escHtml(s)}</span>`).join("")}
      <button class="ds-btn ds-btn--icon ds-btn--ghost sr-speak" data-row-index="${rowIdx}" aria-label="Speak: ${escapedName}">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4.5h2l3-2.5v8L3 7.5H1V4.5z"/><path d="M8.5 3.5c1 .7 1.5 1.8 1.5 2.5s-.5 1.8-1.5 2.5"/></svg>
      </button>
    </div>
  `;
}


function roleClassFor(role: string): string {
  const map: Record<string, string> = {
    link: "ds-badge--role-link",
    button: "ds-badge--role-button",
    heading: "ds-badge--role-heading",
    img: "ds-badge--role-img",
    textbox: "ds-badge--role-textbox",
    navigation: "ds-badge--role-landmark",
    banner: "ds-badge--role-landmark",
    contentinfo: "ds-badge--role-landmark",
    main: "ds-badge--role-landmark",
    region: "ds-badge--role-landmark",
    complementary: "ds-badge--role-landmark",
  };
  return map[role] || "ds-badge--role-default";
}
