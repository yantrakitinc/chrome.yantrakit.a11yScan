/**
 * Global Escape key handler — attached once. Acts only when the SR panel
 * is the visible top-level tab. Behaviour:
 * - inspect mode active → exit inspect (R-INSPECT)
 * - playing/paused → stop playback
 * - otherwise → no-op
 */

import { sendMessage } from "@shared/messages";
import { srState } from "./state";
import { stopPlayback } from "./playback";
import { rerender } from "./callbacks";

let attached = false;

export function ensureSrEscapeHandler(): void {
  if (attached) return;
  attached = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const srTabActive = document.getElementById("panel-sr")?.hasAttribute("hidden") === false;
    if (!srTabActive) return;
    if (srState.inspectActive) {
      srState.inspectActive = false;
      sendMessage({ type: "EXIT_INSPECT_MODE" });
      rerender();
      return;
    }
    if (srState.playState !== "idle") {
      stopPlayback();
      rerender();
    }
  });
}
