/**
 * Movie Mode integration: receives MOVIE_TICK / MOVIE_COMPLETE from the
 * content script and keeps the kb-tab UI in sync. Also owns the kb-item
 * flash helper used by gap/indicator/trap activation.
 */

import { kbState } from "./state";
import { rerender } from "./callbacks";

/**
 * Receives MOVIE_TICK from the content script — keeps the "Playing N of total"
 * counter and the active-row highlight in sync with what's actually playing.
 */
export function onMovieTick(currentIndex: number): void {
  if (kbState.moviePlayState !== "playing") return;
  kbState.movieIndex = currentIndex;
  rerender();
  // Scroll the now-active row into view so the user can follow which element
  // the page is focusing without manually scrolling the panel.
  document.querySelectorAll<HTMLDivElement>(".kb-row")[currentIndex]
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/**
 * Receives MOVIE_COMPLETE from the content script — drops controls back
 * to idle and clears the highlight after a 2-second "Complete" pill.
 */
export function onMovieComplete(): void {
  if (kbState.moviePlayState === "idle") return;
  kbState.moviePlayState = "complete";
  rerender();
  if (kbState.movieCompleteTimer) clearTimeout(kbState.movieCompleteTimer);
  kbState.movieCompleteTimer = setTimeout(() => {
    kbState.moviePlayState = "idle";
    kbState.movieIndex = 0;
    kbState.movieCompleteTimer = null;
    rerender();
  }, 2000);
}

/**
 * Flash a kb-gap/kb-fi/kb-trap item in the panel for 3s on activation.
 * Direct DOM manipulation — no re-render needed, won't fight inline styles.
 */
const kbFlashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
export function flashKbItem(item: HTMLElement): void {
  const existing = kbFlashTimers.get(item);
  if (existing) clearTimeout(existing);
  item.classList.add("ds-flash-active");
  const t = setTimeout(() => {
    item.classList.remove("ds-flash-active");
    kbFlashTimers.delete(item);
  }, 3000);
  kbFlashTimers.set(item, t);
}
