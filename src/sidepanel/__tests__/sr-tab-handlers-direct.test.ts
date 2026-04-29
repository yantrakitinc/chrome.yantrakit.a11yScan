// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom Element doesn't have scrollIntoView OR scrollTo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollIntoView = function () { /* noop */ };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollTo = function () { /* noop */ };

let sentMessages: { type: string; payload?: unknown }[];

beforeEach(() => {
  sentMessages = [];
  vi.resetModules();
  document.body.innerHTML = `<div id="panel-sr"></div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
        if (m.type === "ANALYZE_READING_ORDER") {
          return {
            type: "READING_ORDER_RESULT",
            payload: [
              { index: 1, selector: "#a", role: "button", accessibleName: "X", nameSource: "contents", states: [] },
            ],
          };
        }
        return undefined;
      }),
      onMessage: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
      session: { get: vi.fn((_k, cb) => cb({})), set: vi.fn(async () => undefined) },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ name: "v1", lang: "en-US" }],
    onvoiceschanged: null,
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).speechSynthesis;
});

describe("sr-tab handlers — Analyze includes scopeSelector when set", () => {
  it("sr-analyze posts ANALYZE_READING_ORDER with scopeSelector when srState has one", async () => {
    const mod = await import("../sr-tab");
    const { srState } = await import("../sr-tab/state");
    srState.scopeSelector = "#main";
    mod.renderScreenReaderTab();
    document.getElementById("sr-analyze")?.click();
    await new Promise((r) => setTimeout(r, 30));
    const msg = sentMessages.find((m) => m.type === "ANALYZE_READING_ORDER");
    expect(msg).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((msg!.payload as any).scopeSelector).toBe("#main");
    srState.scopeSelector = null;
  });
});

describe("sr-tab handlers — Clear with inspect active", () => {
  it("sr-clear with inspectActive=true sends EXIT_INSPECT_MODE and flips inspect off", async () => {
    const mod = await import("../sr-tab");
    const { srState } = await import("../sr-tab/state");
    srState.elements = [{ index: 1, selector: "#a", role: "button", accessibleName: "X", nameSource: "contents", states: [] }];
    srState.srAnalyzed = true;
    srState.inspectActive = true;
    mod.renderScreenReaderTab();
    sentMessages.length = 0;
    document.getElementById("sr-clear")?.click();
    expect(srState.inspectActive).toBe(false);
    expect(sentMessages.some((m) => m.type === "EXIT_INSPECT_MODE")).toBe(true);
  });
});

describe("sr-tab handlers — Play All early return on empty elements", () => {
  it("sr-play-all with 0 elements is a no-op", async () => {
    const mod = await import("../sr-tab");
    const { srState } = await import("../sr-tab/state");
    srState.elements = [];
    srState.srAnalyzed = true;
    mod.renderScreenReaderTab();
    sentMessages.length = 0;
    document.getElementById("sr-play-all")?.click();
    // No HIGHLIGHT_ELEMENT message because the loop never starts
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(false);
  });
});

describe("sr-tab handlers — sr-speak when speechSynthesis is missing", () => {
  it("clicking sr-speak without speechSynthesis is a no-op (no throw)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).speechSynthesis;
    const mod = await import("../sr-tab");
    const { srState } = await import("../sr-tab/state");
    srState.elements = [{ index: 1, selector: "#a", role: "button", accessibleName: "X", nameSource: "contents", states: [] }];
    srState.srAnalyzed = true;
    mod.renderScreenReaderTab();
    const speak = document.querySelector<HTMLButtonElement>(".sr-speak");
    expect(speak).toBeTruthy();
    expect(() => speak!.click()).not.toThrow();
  });
});
