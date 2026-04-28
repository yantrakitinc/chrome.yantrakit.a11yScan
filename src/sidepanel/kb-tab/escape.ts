/**
 * Document-level Escape handler — stops Movie Mode if it's playing/paused
 * and the KB tab is the active panel (R-KB AC6). Attached once.
 */

import { sendMessage } from "@shared/messages";
import { kbState } from "./state";
import { rerender } from "./callbacks";

let attached = false;

export function ensureKbEscapeHandler(): void {
  if (attached) return;
  attached = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (kbState.moviePlayState === "idle") return;
    const kbTabActive = document.getElementById("panel-kb")?.hasAttribute("hidden") === false;
    if (!kbTabActive) return;
    if (kbState.selectedKbTimer) {
      clearTimeout(kbState.selectedKbTimer);
      kbState.selectedKbTimer = null;
    }
    if (kbState.movieCompleteTimer) {
      clearTimeout(kbState.movieCompleteTimer);
      kbState.movieCompleteTimer = null;
    }
    kbState.selectedKbIndex = null;
    kbState.moviePlayState = "idle";
    kbState.movieIndex = 0;
    sendMessage({ type: "STOP_MOVIE_MODE" });
    rerender();
  });
}
