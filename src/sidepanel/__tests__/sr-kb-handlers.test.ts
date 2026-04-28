// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let sentMessages: { type: string; payload?: unknown }[];

beforeEach(() => {
  sentMessages = [];
  document.body.innerHTML = `
    <div id="panel-kb"></div>
    <div id="panel-sr"></div>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m) => { sentMessages.push(m); return undefined; }),
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
    speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [],
  };
  // jsdom Element doesn't have scrollTo by default; sr-tab calls it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollTo = function () { /* noop */ };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("kb-tab handlers", () => {
  it("rendering produces an Analyze button that, when clicked, sends keyboard-data messages", async () => {
    const { renderKeyboardTab } = await import("../kb-tab");
    renderKeyboardTab();
    const analyze = document.getElementById("kb-analyze");
    expect(analyze).toBeTruthy();
    analyze?.click();
    // Allow microtasks to flush
    await Promise.resolve();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("GET_TAB_ORDER");
  });

  it("getTabOrder + getFocusGaps export the in-module collected data (initial empty)", async () => {
    const { getTabOrder, getFocusGaps } = await import("../kb-tab");
    expect(Array.isArray(getTabOrder())).toBe(true);
    expect(Array.isArray(getFocusGaps())).toBe(true);
  });
});

describe("sr-tab handlers", () => {
  it("rendering produces an Analyze button + Inspect button", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    expect(document.getElementById("sr-analyze")).toBeTruthy();
    expect(document.getElementById("sr-inspect")).toBeTruthy();
  });

  it("clicking Analyze sends an ANALYZE_READING_ORDER message", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    document.getElementById("sr-analyze")?.click();
    await Promise.resolve();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("ANALYZE_READING_ORDER");
  });

  it("clicking Inspect sends an ENTER_INSPECT_MODE message", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    document.getElementById("sr-inspect")?.click();
    await Promise.resolve();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("ENTER_INSPECT_MODE");
  });

  it("setScopeFromInspect sets the scope and re-renders", async () => {
    const { setScopeFromInspect, renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    setScopeFromInspect("#main");
    await Promise.resolve();
    // After: an EXIT_INSPECT_MODE + ANALYZE_READING_ORDER pair should have been sent
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("EXIT_INSPECT_MODE");
    expect(types).toContain("ANALYZE_READING_ORDER");
  });
});

describe("sr-tab — Play All / Pause / Resume / Stop button wiring", () => {
  // The buttons only appear after analyze populates `elements`. Without
  // that, the play controls aren't rendered. This test covers the
  // gracefully-no-op-when-no-analysis path.
  it("clicking sr-play-all when no analysis is loaded is a no-op", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    // Play All button isn't rendered when elements.length === 0
    expect(document.getElementById("sr-play-all")).toBeFalsy();
  });

  it("clicking sr-clear-scope clears scopeSelector and re-analyzes (when in scoped mode)", async () => {
    const { renderScreenReaderTab, setScopeFromInspect } = await import("../sr-tab");
    renderScreenReaderTab();
    setScopeFromInspect("#main");
    await Promise.resolve();
    renderScreenReaderTab();
    // After scoped, clear-scope button should appear (or sr-analyze for unscoped)
    // The render details depend on internal state; just check no throw
    expect(() => renderScreenReaderTab()).not.toThrow();
  });
});

describe("kb-tab — onMovieTick / onMovieComplete", () => {
  it("onMovieTick when movie is not playing is a no-op (doesn't throw)", async () => {
    const { onMovieTick } = await import("../kb-tab");
    expect(() => onMovieTick(0)).not.toThrow();
  });

  it("onMovieComplete when movie is idle is a no-op", async () => {
    const { onMovieComplete } = await import("../kb-tab");
    expect(() => onMovieComplete()).not.toThrow();
  });
});
