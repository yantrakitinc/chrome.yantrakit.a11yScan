/**
 * Movie Mode — animated tab order walkthrough (F06).
 * Steps through each focusable element, scrolls to it, highlights it.
 */

type iMovieState = "idle" | "playing" | "paused" | "complete";

const MOVIE_HOST_ID = "a11y-movie-overlay-host";

let state: iMovieState = "idle";
let currentIndex = 0;
let elements: HTMLElement[] = [];
let speed = 1000; // ms per element (1× = 1000ms)
let timer: ReturnType<typeof setTimeout> | null = null;
let highlightEl: HTMLElement | null = null;

function getMovieShadowRoot(): ShadowRoot {
  let host = document.getElementById(MOVIE_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MOVIE_HOST_ID;
    host.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;";
    document.body.appendChild(host);
    host.attachShadow({ mode: "open" });
  }
  return host.shadowRoot!;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function startMovie(): void {
  elements = Array.from(document.querySelectorAll(FOCUSABLE)).filter((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  }) as HTMLElement[];

  if (elements.length === 0) return;

  state = "playing";
  currentIndex = 0;
  highlightCurrent();
  scheduleNext();
}

export function pauseMovie(): void {
  if (state !== "playing") return;
  state = "paused";
  if (timer) clearTimeout(timer);
}

export function resumeMovie(): void {
  if (state !== "paused") return;
  state = "playing";
  scheduleNext();
}

export function stopMovie(): void {
  state = "idle";
  currentIndex = 0;
  if (timer) clearTimeout(timer);
  removeHighlight();
}

export function setSpeed(multiplier: number): void {
  // Guard against invalid input (0, negative, NaN) so we don't divide-by-zero
  // and end up with Infinity/NaN as the timer interval — which schedules an
  // immediate next tick on every browser, busy-looping through the elements.
  if (!Number.isFinite(multiplier) || multiplier <= 0) return;
  speed = 1000 / multiplier;
}

function scheduleNext(): void {
  timer = setTimeout(() => {
    if (state !== "playing") return;
    currentIndex++;
    if (currentIndex >= elements.length) {
      state = "complete";
      removeHighlight();
      // Notify side panel so it can drop out of "playing" state.
      // Without this, kb-tab's controls stay stuck on Pause/Stop forever.
      try { chrome.runtime.sendMessage({ type: "MOVIE_COMPLETE" }); } catch { /* sidepanel may be closed */ }
      return;
    }
    highlightCurrent();
    // Notify side panel of progress so the "Playing X of Y" status counts up.
    try { chrome.runtime.sendMessage({ type: "MOVIE_TICK", payload: { currentIndex, total: elements.length } }); } catch { /* sidepanel may be closed */ }
    scheduleNext();
  }, speed);
}

function highlightCurrent(): void {
  removeHighlight();
  const el = elements[currentIndex];
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  highlightEl = document.createElement("div");
  const rect = el.getBoundingClientRect();
  highlightEl.style.cssText = `
    position: fixed;
    top: ${rect.top - 4}px;
    left: ${rect.left - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    border: 3px solid #f59e0b;
    border-radius: 4px;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
    pointer-events: none;
    z-index: 2147483647;
    animation: a11y-pulse 0.8s ease-in-out infinite alternate;
  `;
  // Index badge (F06-AC6)
  const badge = document.createElement("span");
  badge.textContent = `${currentIndex + 1}/${elements.length}`;
  badge.style.cssText = `
    position: absolute;
    top: -12px;
    left: -4px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: #f59e0b;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: monospace;
  `;
  highlightEl.appendChild(badge);

  const shadow = getMovieShadowRoot();

  // Add animation keyframes if not present in shadow root
  if (!shadow.getElementById("a11y-movie-styles")) {
    const style = document.createElement("style");
    style.id = "a11y-movie-styles";
    style.textContent = `@keyframes a11y-pulse { from { box-shadow: 0 0 8px rgba(245,158,11,0.3); } to { box-shadow: 0 0 20px rgba(245,158,11,0.7); } }`;
    shadow.appendChild(style);
  }

  shadow.appendChild(highlightEl);
}

function removeHighlight(): void {
  if (highlightEl) {
    highlightEl.remove();
    highlightEl = null;
  }
  // Clean up host when fully stopped
  if (state === "idle" || state === "complete") {
    document.getElementById(MOVIE_HOST_ID)?.remove();
  }
}

// Escape key stops movie
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state !== "idle") {
    stopMovie();
  }
});
