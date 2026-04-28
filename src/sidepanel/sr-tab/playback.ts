/**
 * Speech-synthesis playback engine for Play All + sr-speak buttons:
 *  stop, finish (with 2-second "Complete" pill), the speakWithVoices
 *  voice-load-await dance, the playNext recursion, and getSpeakTextForElement
 *  (fetches scoped subtree for container roles).
 *
 * Mutates srState. Calls the rerender callback through callbacks.ts.
 */

import { state } from "../sidepanel";
import { sendMessage } from "@shared/messages";
import type { iScreenReaderElement } from "@shared/types";
import { srState } from "./state";
import { CONTAINER_ROLES, composeContainerSpeechText, elementToSpeechText } from "./pure";
import { rerender } from "./callbacks";
import { logWarn } from "@shared/log";

/** Cancel any in-progress speech and reset playback state to idle. */
export function stopPlayback(): void {
  srState.playState = "idle";
  srState.playIndex = 0;
  srState.singleSpeakIndex = null;
  srState.selectedRowIndex = null;
  if (srState.selectedRowTimer) {
    clearTimeout(srState.selectedRowTimer);
    srState.selectedRowTimer = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  sendMessage({ type: "CLEAR_HIGHLIGHTS" });
}

/** AC14: show "Complete" for 2 seconds before reverting to idle. */
export function finishPlayback(): void {
  srState.playState = "complete";
  srState.playIndex = 0;
  sendMessage({ type: "CLEAR_HIGHLIGHTS" });
  rerender();
  setTimeout(() => {
    if (srState.playState === "complete") {
      srState.playState = "idle";
      rerender();
    }
  }, 2000);
}

/**
 * AC7: ensure Chrome voices are loaded before speaking. Per R-SR test 17,
 * testConfig.timing.movieSpeed scales the speech rate (1× default).
 */
export function speakWithVoices(text: string, onEnd: () => void): void {
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

/**
 * Play All recursion. Each step: highlight on page, scroll into view, speak,
 * advance on speech-end. When playIndex passes the last element, finish.
 */
export function playNext(): void {
  if (srState.playState !== "playing" || srState.playIndex >= srState.elements.length) {
    if (srState.playIndex >= srState.elements.length) finishPlayback();
    return;
  }
  const el = srState.elements[srState.playIndex];
  sendMessage({ type: "HIGHLIGHT_ELEMENT", payload: { selector: el.selector } });
  // Panel-side highlight handled by .ds-row--active class via render.
  const rows = document.querySelectorAll<HTMLDivElement>(".sr-row");
  rows[srState.playIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const text = elementToSpeechText(el);
  if ("speechSynthesis" in window) {
    speakWithVoices(text, () => {
      if (srState.playState !== "playing") return;
      srState.playIndex++;
      if (srState.playIndex < srState.elements.length) {
        rerender();
        // Scroll the now-active row into view IMMEDIATELY so the highlight
        // stays visible during the 300ms gap before the next playNext call.
        document.querySelectorAll<HTMLDivElement>(".sr-row")[srState.playIndex]
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setTimeout(playNext, 300);
      } else {
        finishPlayback();
      }
    });
  } else {
    srState.playIndex++;
    setTimeout(playNext, 1000);
  }
}

/**
 * For container roles, fetch the scoped reading order from the content
 * script and build a "container + child1. child2. ..." string. For leaf
 * elements (and on errors), fall back to bare element text.
 */
export async function getSpeakTextForElement(el: iScreenReaderElement): Promise<string> {
  if (!CONTAINER_ROLES.has(el.role)) return elementToSpeechText(el);
  try {
    const result = await sendMessage({ type: "ANALYZE_READING_ORDER", payload: { scopeSelector: el.selector } });
    if (result && (result as { type: string }).type === "READING_ORDER_RESULT") {
      return composeContainerSpeechText(el, (result as { payload: iScreenReaderElement[] }).payload);
    }
  } catch (err) {
    // Scoped subtree fetch failed — Speak still works, but only announces
    // the container's own role+name without its children. Warn so a user
    // reporting "Speak on a region read nothing inside" can diagnose.
    logWarn("sr-tab.getSpeakTextForElement", `scoped reading-order fetch failed for ${el.selector}`, err);
  }
  return elementToSpeechText(el);
}
