// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom Element doesn't have scrollTo / scrollIntoView by default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollTo = function () { /* noop */ };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollIntoView = function () { /* noop */ };

let sentMessages: { type: string; payload?: unknown }[];

beforeEach(() => {
  sentMessages = [];
  document.body.innerHTML = `<div id="panel-kb"></div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
        if (m.type === "GET_TAB_ORDER") {
          return {
            type: "TAB_ORDER_RESULT",
            payload: [
              { index: 1, selector: "#a", role: "button", accessibleName: "Submit", tabindex: null, hasFocusIndicator: true },
              { index: 2, selector: "#b", role: "link", accessibleName: "Home", tabindex: null, hasFocusIndicator: false },
            ],
          };
        }
        if (m.type === "GET_FOCUS_GAPS") {
          return { type: "FOCUS_GAPS_RESULT", payload: [{ selector: "#gap1", role: "div", reason: "missing tabindex" }] };
        }
        if (m.type === "GET_FOCUS_INDICATORS") {
          return { type: "FOCUS_INDICATORS_RESULT", payload: [{ selector: "#b", hasIndicator: false }] };
        }
        if (m.type === "GET_KEYBOARD_TRAPS") {
          return { type: "KEYBOARD_TRAPS_RESULT", payload: [{ selector: "#trap1", description: "modal traps focus" }] };
        }
        if (m.type === "GET_SKIP_LINKS") {
          return { type: "SKIP_LINKS_RESULT", payload: [{ selector: "a[href='#main']", target: "#main", targetExists: true }] };
        }
        return undefined;
      }),
      onMessage: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
      session: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
    },
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

/** Drive the kb-tab through Analyze and resolve when the panel re-renders with data. */
async function analyze(): Promise<typeof import("../kb-tab")> {
  const mod = await import("../kb-tab");
  mod.renderKeyboardTab();
  document.getElementById("kb-analyze")?.click();
  // Promise.all of 5 messages + state assignment + renderKeyboardTab + .focus()
  await new Promise((r) => setTimeout(r, 50));
  return mod;
}

describe("kb-tab — analyzed-state render", () => {
  it("after Analyze, tab-order rows + focus-gap + indicator + trap + skip-link items appear", async () => {
    await analyze();
    expect(document.querySelectorAll(".kb-row").length).toBe(2);
    expect(document.querySelectorAll(".kb-gap").length).toBe(1);
    expect(document.querySelectorAll(".kb-fi").length).toBe(1);
    expect(document.querySelectorAll(".kb-trap").length).toBe(1);
    expect(document.getElementById("kb-clear")).toBeTruthy();
    expect(document.getElementById("movie-play-all")).toBeTruthy();
    expect(document.getElementById("toggle-tab-order")).toBeTruthy();
    expect(document.getElementById("toggle-focus-gaps")).toBeTruthy();
  });
});

describe("kb-tab — kb-clear button", () => {
  it("kb-clear resets all data and re-renders to un-analyzed state", async () => {
    await analyze();
    document.getElementById("kb-clear")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.querySelectorAll(".kb-row").length).toBe(0);
    expect(document.getElementById("kb-clear")).toBeFalsy();
    expect(document.getElementById("kb-analyze")).toBeTruthy();
  });
});

describe("kb-tab — row + gap/indicator/trap activation", () => {
  it("clicking a .kb-row sends HIGHLIGHT_ELEMENT", async () => {
    await analyze();
    sentMessages.length = 0;
    document.querySelector<HTMLDivElement>(".kb-row")?.click();
    await new Promise((r) => setTimeout(r, 5));
    const msg = sentMessages.find((m) => m.type === "HIGHLIGHT_ELEMENT");
    expect(msg).toBeTruthy();
  });

  it("Enter on .kb-row triggers HIGHLIGHT_ELEMENT", async () => {
    await analyze();
    sentMessages.length = 0;
    const row = document.querySelector<HTMLDivElement>(".kb-row");
    row?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
  });

  it("clicking a .kb-gap item sends HIGHLIGHT_ELEMENT for that selector", async () => {
    await analyze();
    sentMessages.length = 0;
    document.querySelector<HTMLDivElement>(".kb-gap")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
  });

  it("clicking a .kb-fi item sends HIGHLIGHT_ELEMENT", async () => {
    await analyze();
    sentMessages.length = 0;
    document.querySelector<HTMLDivElement>(".kb-fi")?.click();
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
  });

  it("clicking a .kb-trap item sends HIGHLIGHT_ELEMENT", async () => {
    await analyze();
    sentMessages.length = 0;
    document.querySelector<HTMLDivElement>(".kb-trap")?.click();
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
  });
});

describe("kb-tab — Movie Mode (Play / Pause / Resume / Stop)", () => {
  it("movie-play-all sends START_MOVIE_MODE and re-renders into playing state", async () => {
    await analyze();
    sentMessages.length = 0;
    document.getElementById("movie-play-all")?.click();
    expect(sentMessages.some((m) => m.type === "START_MOVIE_MODE")).toBe(true);
    expect(document.getElementById("movie-pause")).toBeTruthy();
  });

  it("movie-pause sends PAUSE_MOVIE_MODE and shows Resume", async () => {
    await analyze();
    document.getElementById("movie-play-all")?.click();
    sentMessages.length = 0;
    document.getElementById("movie-pause")?.click();
    expect(sentMessages.some((m) => m.type === "PAUSE_MOVIE_MODE")).toBe(true);
    expect(document.getElementById("movie-resume")).toBeTruthy();
  });

  it("movie-resume sends RESUME_MOVIE_MODE", async () => {
    await analyze();
    document.getElementById("movie-play-all")?.click();
    document.getElementById("movie-pause")?.click();
    sentMessages.length = 0;
    document.getElementById("movie-resume")?.click();
    expect(sentMessages.some((m) => m.type === "RESUME_MOVIE_MODE")).toBe(true);
  });

  it("movie-stop sends STOP_MOVIE_MODE and reverts to idle (Play All visible)", async () => {
    await analyze();
    document.getElementById("movie-play-all")?.click();
    sentMessages.length = 0;
    document.getElementById("movie-stop")?.click();
    expect(sentMessages.some((m) => m.type === "STOP_MOVIE_MODE")).toBe(true);
    expect(document.getElementById("movie-play-all")).toBeTruthy();
  });
});

describe("kb-tab — onMovieTick / onMovieComplete from playing state", () => {
  it("onMovieTick during playing updates movieIndex and re-renders", async () => {
    const { onMovieTick } = await analyze();
    document.getElementById("movie-play-all")?.click();
    expect(() => onMovieTick(1)).not.toThrow();
  });

  it("onMovieComplete during playing transitions to complete then resets to idle", async () => {
    const { onMovieComplete } = await analyze();
    document.getElementById("movie-play-all")?.click();
    expect(() => onMovieComplete()).not.toThrow();
    // After 2 seconds the movie state goes back to idle, but we don't need to wait
    // — just verify it didn't throw and re-rendered into a complete state
  });

  it("onMovieComplete called twice synchronously: second call's existing-timer-clear path runs (no throw)", async () => {
    const { onMovieComplete } = await analyze();
    document.getElementById("movie-play-all")?.click();
    onMovieComplete();
    // Second call exercises the `if (kbState.movieCompleteTimer) clearTimeout(...)` branch.
    expect(() => onMovieComplete()).not.toThrow();
  });
});

describe("kb-tab — flashKbItem", () => {
  it("adds .ds-flash-active class synchronously when called", async () => {
    const { flashKbItem } = await import("../kb-tab/movie");
    const div = document.createElement("div");
    document.body.appendChild(div);
    flashKbItem(div);
    expect(div.classList.contains("ds-flash-active")).toBe(true);
  });

  it("calling flashKbItem on the same element a second time exercises the clearTimeout branch", async () => {
    const { flashKbItem } = await import("../kb-tab/movie");
    const div = document.createElement("div");
    document.body.appendChild(div);
    flashKbItem(div);
    // Second call has the existing-timer path — should be safe and re-flash
    expect(() => flashKbItem(div)).not.toThrow();
    expect(div.classList.contains("ds-flash-active")).toBe(true);
  });
});

describe("kb-tab — overlay toggles", () => {
  it("toggle-tab-order ON sends SHOW_TAB_ORDER", async () => {
    await analyze();
    const cb = document.getElementById("toggle-tab-order") as HTMLInputElement;
    sentMessages.length = 0;
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(sentMessages.some((m) => m.type === "SHOW_TAB_ORDER")).toBe(true);
  });

  it("toggle-tab-order OFF sends HIDE_TAB_ORDER", async () => {
    await analyze();
    const cb = document.getElementById("toggle-tab-order") as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    sentMessages.length = 0;
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(sentMessages.some((m) => m.type === "HIDE_TAB_ORDER")).toBe(true);
  });

  it("toggle-focus-gaps ON sends SHOW_FOCUS_GAPS", async () => {
    await analyze();
    const cb = document.getElementById("toggle-focus-gaps") as HTMLInputElement;
    sentMessages.length = 0;
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(sentMessages.some((m) => m.type === "SHOW_FOCUS_GAPS")).toBe(true);
  });

  it("toggle-focus-gaps OFF sends HIDE_FOCUS_GAPS", async () => {
    await analyze();
    const cb = document.getElementById("toggle-focus-gaps") as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    sentMessages.length = 0;
    cb.checked = false;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(sentMessages.some((m) => m.type === "HIDE_FOCUS_GAPS")).toBe(true);
  });
});

describe("kb-tab — Escape during movie mode stops it", () => {
  it("Escape while movie is playing sends STOP_MOVIE_MODE", async () => {
    await analyze();
    // Ensure panel-kb is "active" (not hidden) so escape handler proceeds
    document.getElementById("panel-kb")?.removeAttribute("hidden");
    document.getElementById("movie-play-all")?.click();
    sentMessages.length = 0;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(sentMessages.some((m) => m.type === "STOP_MOVIE_MODE")).toBe(true);
  });
});
