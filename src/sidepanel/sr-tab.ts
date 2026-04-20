/**
 * Screen Reader tab (F15).
 */

import { sendMessage } from "@shared/messages";
import type { iScreenReaderElement } from "@shared/types";

let elements: iScreenReaderElement[] = [];
let playState: "idle" | "playing" | "paused" | "complete" = "idle";
let playIndex = 0;
let scopeSelector: string | null = null;
let inspectActive = false;
let srAnalyzed = false;

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
    renderScreenReaderTab();
  });
}

export function renderScreenReaderTab(): void {
  const panel = document.getElementById("panel-sr");
  if (!panel) return;

  const countLabel = scopeSelector
    ? `${elements.length} elements in scope`
    : `${elements.length} elements in reading order`;

  panel.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;gap:8px;background:#fafafa;flex-shrink:0">
      <button id="sr-analyze" style="flex:1;padding:8px;font-size:12px;font-weight:800;color:#1a1000;background:#f59e0b;border:none;border-radius:4px;cursor:pointer;min-height:24px">Analyze</button>
      <button id="sr-inspect" aria-label="Inspect element" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid ${inspectActive ? "#f59e0b" : "#d4d4d8"};border-radius:4px;background:${inspectActive ? "#fffbeb" : "none"};cursor:pointer;color:${inspectActive ? "#b45309" : "#52525b"};min-height:24px">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>
      </button>
      ${srAnalyzed ? '<button id="sr-clear" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;min-height:24px">Clear</button>' : ""}
    </div>
    ${scopeSelector ? `
      <div style="padding:4px 12px;background:#eff6ff;border-bottom:1px solid #bfdbfe;display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:10px;font-weight:600;color:#1d4ed8">Scoped to:</span>
        <span style="font-size:10px;font-family:monospace;color:#3b82f6;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${scopeSelector}</span>
        <button id="sr-clear-scope" style="font-size:10px;font-weight:700;color:#dc2626;border:none;background:none;cursor:pointer;padding:2px 4px">Clear scope</button>
      </div>
    ` : ""}
    <div style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <span style="font-size:11px;font-weight:600;color:#52525b;font-family:monospace">${countLabel}</span>
      ${playState === "idle" && elements.length > 0 ? `
        <button id="sr-play-all" style="padding:4px 10px;font-size:11px;font-weight:700;color:#b45309;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;min-height:24px">Play All</button>
      ` : ""}
    </div>
    ${playState === "complete" ? `
      <div style="padding:6px 12px;background:#d1fae5;border-bottom:1px solid #6ee7b7;display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:11px;font-weight:700;color:#047857">Complete</span>
      </div>
    ` : playState !== "idle" ? `
      <div style="padding:6px 12px;background:#fffbeb;border-bottom:1px solid #fde68a;display:flex;align-items:center;gap:8px;flex-shrink:0">
        ${playState === "playing" ? `
          <button id="sr-pause" style="padding:4px 10px;font-size:11px;font-weight:700;color:#b45309;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;min-height:24px">Pause</button>
        ` : `
          <button id="sr-resume" style="padding:4px 10px;font-size:11px;font-weight:700;color:#b45309;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;min-height:24px">Resume</button>
        `}
        <button id="sr-stop" style="padding:4px 10px;font-size:11px;font-weight:700;color:#dc2626;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;min-height:24px">Stop</button>
        <span style="font-size:11px;font-family:monospace;color:#92400e;margin-left:auto">${playState === "paused" ? "Paused at" : "Playing"} ${playIndex + 1} of ${elements.length}</span>
      </div>
    ` : ""}
    <div id="sr-list" style="flex:1;overflow-y:auto">
      ${elements.length === 0
        ? '<div style="padding:16px;text-align:center;font-size:12px;color:#71717a">Click Analyze to scan the page reading order.</div>'
        : elements.map((el) => renderSrRow(el)).join("")
      }
    </div>
  `;

  // Scroll list to top after render
  document.getElementById("sr-list")?.scrollTo(0, 0);

  // Analyze button
  document.getElementById("sr-analyze")?.addEventListener("click", async () => {
    const payload: { scopeSelector?: string } = {};
    if (scopeSelector) payload.scopeSelector = scopeSelector;
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      elements = (result as { payload: iScreenReaderElement[] }).payload;
      srAnalyzed = true;
      renderScreenReaderTab();
    }
  });

  // Clear — reset to initial state
  document.getElementById("sr-clear")?.addEventListener("click", () => {
    elements = [];
    scopeSelector = null;
    srAnalyzed = false;
    stopPlayback();
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
    renderScreenReaderTab();
  });

  // Row hover effects (no inline handlers — CSP)
  document.querySelectorAll<HTMLDivElement>(".sr-row").forEach((row) => {
    row.addEventListener("mouseenter", () => { row.style.background = "#fafafa"; });
    row.addEventListener("mouseleave", () => {
      const idx = parseInt(row.dataset.index || "-1");
      row.style.background = (playState !== "idle" && idx === playIndex) ? "#fef3c7" : "";
    });
  });
  document.querySelectorAll<HTMLButtonElement>(".sr-speak").forEach((btn) => {
    btn.addEventListener("mouseenter", () => { btn.style.color = "#b45309"; btn.style.background = "#fffbeb"; });
    btn.addEventListener("mouseleave", () => { btn.style.color = "#71717a"; btn.style.background = ""; });
  });

  // Row click → highlight on page only
  document.querySelectorAll<HTMLDivElement>(".sr-row").forEach((row) => {
    row.addEventListener("click", () => {
      const selector = row.dataset.selector;
      if (selector) sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector } });
    });
  });

  // Speak buttons (icon click only — speaks without highlighting)
  document.querySelectorAll<HTMLButtonElement>(".sr-speak").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = btn.dataset.text || "";
      if ("speechSynthesis" in window) {
        speakWithVoices(text, () => { /* no-op */ });
      }
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

  // Escape key stops playback
  if (playState !== "idle") {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && playState !== "idle") {
        stopPlayback();
        renderScreenReaderTab();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }
}

function stopPlayback(): void {
  playState = "idle";
  playIndex = 0;
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
  // AC7: ensure Chrome voices are loaded before speaking
  const doSpeak = () => {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
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
  // Highlight row in panel
  const rows = document.querySelectorAll<HTMLDivElement>(".sr-row");
  rows.forEach((r, i) => {
    r.style.background = i === playIndex ? "#fef3c7" : "";
  });
  // Scroll row into view in panel
  rows[playIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  // Speak
  const text = getSpeakTextForElement(el);
  if ("speechSynthesis" in window) {
    speakWithVoices(text, () => {
      if (playState !== "playing") return;
      playIndex++;
      if (playIndex < elements.length) {
        // Update progress
        renderScreenReaderTab();
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

function getSpeakTextForElement(el: iScreenReaderElement): string {
  const base = `${el.role}, ${el.accessibleName}${el.states.length > 0 ? ", " + el.states.join(", ") : ""}`;
  if (CONTAINER_ROLES.has(el.role)) {
    // Find child elements that belong to this container
    const idx = elements.indexOf(el);
    if (idx === -1) return base;
    const children: string[] = [];
    for (let i = idx + 1; i < elements.length; i++) {
      const child = elements[i];
      // Stop when we hit a sibling container or an element at the same/higher level
      if (CONTAINER_ROLES.has(child.role)) break;
      children.push(`${child.role}, ${child.accessibleName}`);
    }
    if (children.length > 0) return `${base}. ${children.join(". ")}.`;
  }
  return base;
}

function renderSrRow(el: iScreenReaderElement): string {
  const roleColors: Record<string, string> = {
    link: "background:#e0f2fe;color:#075985", button: "background:#ede9fe;color:#5b21b6",
    heading: "background:#fef3c7;color:#92400e", img: "background:#fce7f3;color:#9d174d",
    textbox: "background:#d1fae5;color:#065f46", navigation: "background:#e0e7ff;color:#3730a3",
    banner: "background:#e0e7ff;color:#3730a3", contentinfo: "background:#e0e7ff;color:#3730a3",
  };
  const rc = roleColors[el.role] || "background:#f4f4f5;color:#3f3f46";
  const speakText = getSpeakTextForElement(el);
  const sourceLabel = el.nameSource === "contents" ? "text" : el.nameSource;

  return `
    <div class="sr-row" data-selector="${el.selector}" data-index="${el.index - 1}" style="display:flex;align-items:center;gap:8px;padding:4px 12px;border-bottom:1px solid #f4f4f5;cursor:pointer;min-height:30px;transition:background 0.1s${playState !== "idle" && (el.index - 1) === playIndex ? ";background:#fef3c7" : ""}">
      <span style="font-size:11px;font-family:monospace;color:#71717a;width:16px;text-align:right;flex-shrink:0">${el.index}</span>
      <span style="font-size:11px;font-weight:700;padding:2px 4px;border-radius:3px;min-width:50px;text-align:center;flex-shrink:0;${rc}">${el.role}</span>
      <span style="font-size:11px;font-weight:600;color:#27272a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el.accessibleName}</span>
      <span style="font-size:9px;font-weight:600;color:#a1a1aa;background:#f4f4f5;border-radius:2px;padding:1px 3px;flex-shrink:0;font-family:monospace">${sourceLabel}</span>
      ${el.states.map((s) => `<span style="font-size:11px;font-weight:600;color:#71717a;background:#f4f4f5;border-radius:3px;padding:1px 4px;flex-shrink:0">${s}</span>`).join("")}
      <button class="sr-speak" data-text="${speakText.replace(/"/g, "&quot;")}" aria-label="Speak: ${el.accessibleName.replace(/"/g, "&quot;")}" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;color:#71717a;flex-shrink:0;border-radius:4px">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4.5h2l3-2.5v8L3 7.5H1V4.5z"/><path d="M8.5 3.5c1 .7 1.5 1.8 1.5 2.5s-.5 1.8-1.5 2.5"/></svg>
      </button>
    </div>
  `;
}
