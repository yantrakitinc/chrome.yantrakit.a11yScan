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

// SpeechSynthesisUtterance polyfill — jsdom doesn't ship one
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class FakeUtterance {
  text: string;
  rate = 1;
  onend: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;

let sentMessages: { type: string; payload?: unknown }[];
let analyzeResponseElements: Array<{
  index: number;
  selector: string;
  role: string;
  accessibleName: string;
  nameSource: string;
  states: string[];
}>;
let speakInvocations: FakeUtterance[];

beforeEach(() => {
  sentMessages = [];
  speakInvocations = [];
  analyzeResponseElements = [];
  document.body.innerHTML = `<div id="panel-sr"></div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
        if (m.type === "ANALYZE_READING_ORDER") {
          return { type: "READING_ORDER_RESULT", payload: analyzeResponseElements };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).speechSynthesis = {
    speak: vi.fn((u: FakeUtterance) => { speakInvocations.push(u); }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ name: "v1", lang: "en-US" }], // non-empty so doSpeak is called immediately
    onvoiceschanged: null as null | (() => void),
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).speechSynthesis;
});

/** Helper: get sr-tab into analyzed state with the given elements */
async function analyzeWith(els: typeof analyzeResponseElements): Promise<typeof import("../sr-tab")> {
  analyzeResponseElements = els;
  const mod = await import("../sr-tab");
  mod.renderScreenReaderTab();
  document.getElementById("sr-analyze")?.click();
  // Wait for sendMessage promise + state update + re-render
  await new Promise((r) => setTimeout(r, 20));
  return mod;
}

const fixtureElements = [
  { index: 1, selector: "#a", role: "button", accessibleName: "Submit", nameSource: "contents" as const, states: [] },
  { index: 2, selector: "#b", role: "link", accessibleName: "Home", nameSource: "contents" as const, states: [] },
  { index: 3, selector: "#c", role: "navigation", accessibleName: "Main Nav", nameSource: "label" as const, states: [] },
];

describe("sr-tab — analyze flow populates elements and renders rows", () => {
  it("Analyze populates rows in #sr-list", async () => {
    await analyzeWith(fixtureElements);
    const rows = document.querySelectorAll(".sr-row");
    expect(rows.length).toBe(3);
  });

  it("after Analyze, Play All / Pause buttons visible on idle, sr-clear visible", async () => {
    await analyzeWith(fixtureElements);
    expect(document.getElementById("sr-play-all")).toBeTruthy();
    expect(document.getElementById("sr-clear")).toBeTruthy();
  });
});

describe("sr-tab — Play All / Pause / Resume / Stop after analyze", () => {
  it("clicking sr-play-all transitions to playing and invokes speechSynthesis.speak", async () => {
    await analyzeWith(fixtureElements);
    document.getElementById("sr-play-all")?.click();
    await new Promise((r) => setTimeout(r, 5));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).speechSynthesis.speak).toHaveBeenCalled();
    // After click, the toolbar should have re-rendered into playing state
    expect(document.getElementById("sr-pause")).toBeTruthy();
  });

  it("clicking sr-pause from playing state pauses speech", async () => {
    await analyzeWith(fixtureElements);
    document.getElementById("sr-play-all")?.click();
    await new Promise((r) => setTimeout(r, 5));
    document.getElementById("sr-pause")?.click();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).speechSynthesis.pause).toHaveBeenCalled();
    // Resume button should now be visible
    expect(document.getElementById("sr-resume")).toBeTruthy();
  });

  it("clicking sr-resume from paused state resumes speech", async () => {
    await analyzeWith(fixtureElements);
    document.getElementById("sr-play-all")?.click();
    await new Promise((r) => setTimeout(r, 5));
    document.getElementById("sr-pause")?.click();
    document.getElementById("sr-resume")?.click();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).speechSynthesis.resume).toHaveBeenCalled();
  });

  it("clicking sr-stop cancels speech and clears highlights", async () => {
    await analyzeWith(fixtureElements);
    document.getElementById("sr-play-all")?.click();
    await new Promise((r) => setTimeout(r, 5));
    document.getElementById("sr-stop")?.click();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).speechSynthesis.cancel).toHaveBeenCalled();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("CLEAR_HIGHLIGHTS");
  });
});

describe("sr-tab — sr-clear and sr-clear-scope buttons", () => {
  it("sr-clear resets elements + scope and re-renders to empty state", async () => {
    const { setScopeFromInspect } = await analyzeWith(fixtureElements);
    setScopeFromInspect("#main");
    await new Promise((r) => setTimeout(r, 20));
    document.getElementById("sr-clear")?.click();
    // After clear, no rows
    expect(document.querySelectorAll(".sr-row").length).toBe(0);
    // No clear button (un-analyzed) — only Analyze + Inspect
    expect(document.getElementById("sr-analyze")).toBeTruthy();
    expect(document.getElementById("sr-clear")).toBeFalsy();
  });

  it("sr-clear-scope clears scopeSelector and triggers a re-analyze", async () => {
    const { setScopeFromInspect } = await analyzeWith(fixtureElements);
    setScopeFromInspect("#main");
    await new Promise((r) => setTimeout(r, 20));
    sentMessages.length = 0;
    document.getElementById("sr-clear-scope")?.click();
    await new Promise((r) => setTimeout(r, 20));
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("ANALYZE_READING_ORDER");
  });
});

describe("sr-tab — row click sends HIGHLIGHT_ELEMENT", () => {
  it("clicking an .sr-row sends a HIGHLIGHT_ELEMENT message with the row selector", async () => {
    await analyzeWith(fixtureElements);
    sentMessages.length = 0;
    const firstRow = document.querySelector<HTMLDivElement>(".sr-row");
    expect(firstRow).toBeTruthy();
    firstRow?.click();
    await new Promise((r) => setTimeout(r, 5));
    const highlightMsg = sentMessages.find((m) => m.type === "HIGHLIGHT_ELEMENT");
    expect(highlightMsg).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((highlightMsg!.payload as any).selector).toBe("#a");
  });

  it("Enter key on an .sr-row triggers the same HIGHLIGHT_ELEMENT path", async () => {
    await analyzeWith(fixtureElements);
    sentMessages.length = 0;
    const row = document.querySelector<HTMLDivElement>(".sr-row");
    row?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
  });
});

describe("sr-tab — speak button on a leaf element", () => {
  it("clicking .sr-speak invokes speechSynthesis.speak with the element text", async () => {
    await analyzeWith(fixtureElements);
    const speakBtn = document.querySelector<HTMLButtonElement>(".sr-speak");
    expect(speakBtn).toBeTruthy();
    speakBtn?.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(speakInvocations.length).toBeGreaterThan(0);
    // Should contain the role,name format
    expect(speakInvocations[0].text).toMatch(/button, Submit/);
  });

  it("speak on a container role (navigation) fetches scoped subtree before speaking", async () => {
    // Container row is index 3 ("#c", navigation). When clicked, it issues a
    // second ANALYZE_READING_ORDER with scopeSelector. Mock the response.
    await analyzeWith(fixtureElements);
    sentMessages.length = 0;
    // Find the speak button on the navigation row
    const speakButtons = document.querySelectorAll<HTMLButtonElement>(".sr-speak");
    const navSpeak = speakButtons[2];
    expect(navSpeak).toBeTruthy();
    navSpeak?.click();
    await new Promise((r) => setTimeout(r, 50));
    const scoped = sentMessages.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m) => m.type === "ANALYZE_READING_ORDER" && (m.payload as any)?.scopeSelector === "#c"
    );
    expect(scoped).toBeTruthy();
  });
});

describe("sr-tab — speakWithVoices fallback when voices not loaded", () => {
  it("when getVoices() returns [], registers onvoiceschanged then triggers doSpeak when fired", async () => {
    let onvoicesChangedCb: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).speechSynthesis.getVoices = vi.fn(() => []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty((globalThis as any).speechSynthesis, "onvoiceschanged", {
      configurable: true,
      get() { return onvoicesChangedCb; },
      set(v: (() => void) | null) { onvoicesChangedCb = v; },
    });

    await analyzeWith(fixtureElements);
    const speakBtn = document.querySelector<HTMLButtonElement>(".sr-speak");
    speakBtn?.click();
    await new Promise((r) => setTimeout(r, 30));
    // The handler registers onvoiceschanged
    expect(onvoicesChangedCb).toBeTruthy();
    // Fire the voiceschanged callback — should call doSpeak
    onvoicesChangedCb?.();
    await new Promise((r) => setTimeout(r, 5));
    expect(speakInvocations.length).toBeGreaterThan(0);
  });
});

describe("sr-tab — Escape handler", () => {
  it("Escape during inspect mode exits inspect", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    // Make sr panel "active" (not hidden) so escape handler proceeds
    document.getElementById("panel-sr")?.removeAttribute("hidden");
    // Click inspect to enter inspect mode
    document.getElementById("sr-inspect")?.click();
    await new Promise((r) => setTimeout(r, 5));
    sentMessages.length = 0;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await new Promise((r) => setTimeout(r, 5));
    expect(sentMessages.some((m) => m.type === "EXIT_INSPECT_MODE")).toBe(true);
  });
});
