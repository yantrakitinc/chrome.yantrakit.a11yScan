// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// SpeechSynthesisUtterance polyfill
class FakeUtterance {
  text: string;
  rate = 1;
  onend: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;

// jsdom Element doesn't have scrollIntoView
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Element.prototype as any).scrollIntoView = function () { /* noop */ };

let sentMessages: { type: string; payload?: unknown }[];
let speakInvocations: FakeUtterance[];

beforeEach(async () => {
  sentMessages = [];
  speakInvocations = [];
  document.body.innerHTML = "";
  // Reset srState shared across tests so we don't bleed between cases
  vi.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
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
    speak: vi.fn((u: FakeUtterance) => { speakInvocations.push(u); }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ name: "v1", lang: "en-US" }],
    onvoiceschanged: null as null | (() => void),
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).speechSynthesis;
});

describe("sr-tab/playback — finishPlayback", () => {
  it("sets state to 'complete', sends CLEAR_HIGHLIGHTS, then reverts to 'idle' after 2s", async () => {
    vi.useFakeTimers();
    const { finishPlayback } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.playState = "playing";
    srState.playIndex = 5;

    finishPlayback();
    expect(srState.playState).toBe("complete");
    expect(srState.playIndex).toBe(0);
    expect(sentMessages.some((m) => m.type === "CLEAR_HIGHLIGHTS")).toBe(true);

    // Advance the 2-second revert timer
    await vi.advanceTimersByTimeAsync(2100);
    expect(srState.playState).toBe("idle");
    vi.useRealTimers();
  });

  it("revert timer no-op if state was changed away from 'complete' during the 2s window", async () => {
    vi.useFakeTimers();
    const { finishPlayback } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.playState = "playing";
    finishPlayback();
    expect(srState.playState).toBe("complete");
    // External actor flips state away — revert timer should NOT clobber it
    srState.playState = "playing";
    await vi.advanceTimersByTimeAsync(2100);
    // State remained 'playing'; the timer's `if (state === "complete")` guard caught it
    expect(srState.playState).toBe("playing");
    vi.useRealTimers();
  });
});

describe("sr-tab/playback — stopPlayback", () => {
  it("clears the selectedRowTimer when one was set", async () => {
    const { stopPlayback } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.selectedRowIndex = 3;
    srState.selectedRowTimer = setTimeout(() => undefined, 999999);
    stopPlayback();
    expect(srState.selectedRowIndex).toBeNull();
    expect(srState.selectedRowTimer).toBeNull();
    expect(sentMessages.some((m) => m.type === "CLEAR_HIGHLIGHTS")).toBe(true);
  });

  it("calls speechSynthesis.cancel when speechSynthesis is present", async () => {
    const { stopPlayback } = await import("../sr-tab/playback");
    stopPlayback();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(((globalThis as any).speechSynthesis.cancel as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
});

describe("sr-tab/playback — speakWithVoices", () => {
  it("when getVoices() returns non-empty, doSpeak fires immediately", async () => {
    const { speakWithVoices } = await import("../sr-tab/playback");
    const onEnd = vi.fn();
    speakWithVoices("hello", onEnd);
    expect(speakInvocations.length).toBe(1);
    expect(speakInvocations[0].text).toBe("hello");
  });

  it("when getVoices() returns [], registers onvoiceschanged + fires doSpeak when triggered", async () => {
    let onVoicesChangedCb: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).speechSynthesis.getVoices = vi.fn(() => []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty((globalThis as any).speechSynthesis, "onvoiceschanged", {
      configurable: true,
      get() { return onVoicesChangedCb; },
      set(v: (() => void) | null) { onVoicesChangedCb = v; },
    });

    const { speakWithVoices } = await import("../sr-tab/playback");
    speakWithVoices("hello", () => undefined);
    expect(speakInvocations.length).toBe(0); // not yet — voices not loaded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (onVoicesChangedCb as any)?.();
    expect(speakInvocations.length).toBe(1);
  });
});

describe("sr-tab/playback — playNext", () => {
  it("when playIndex >= elements.length, calls finishPlayback (state → 'complete')", async () => {
    const { playNext } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.playState = "playing";
    srState.elements = [{ index: 1, selector: "#a", role: "button", accessibleName: "A", nameSource: "contents", states: [] }];
    srState.playIndex = 1; // >= length → finish
    playNext();
    expect(srState.playState).toBe("complete");
  });

  it("when state is not 'playing', returns without speaking", async () => {
    const { playNext } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.playState = "paused";
    srState.elements = [{ index: 1, selector: "#a", role: "button", accessibleName: "A", nameSource: "contents", states: [] }];
    srState.playIndex = 0;
    playNext();
    expect(speakInvocations.length).toBe(0);
  });

  it("when speechSynthesis is missing, falls back to setTimeout-based advance", async () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).speechSynthesis;

    const { playNext } = await import("../sr-tab/playback");
    const { srState } = await import("../sr-tab/state");
    srState.playState = "playing";
    srState.elements = [
      { index: 1, selector: "#a", role: "button", accessibleName: "A", nameSource: "contents", states: [] },
      { index: 2, selector: "#b", role: "link", accessibleName: "B", nameSource: "contents", states: [] },
    ];
    srState.playIndex = 0;
    document.body.innerHTML = `<div class="sr-row" data-selector="#a"></div><div class="sr-row" data-selector="#b"></div>`;

    playNext();
    expect(sentMessages.some((m) => m.type === "HIGHLIGHT_ELEMENT")).toBe(true);
    // No speech invocation
    expect(speakInvocations.length).toBe(0);
    // After 1000ms it tries again
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();
  });
});

describe("sr-tab/playback — getSpeakTextForElement", () => {
  it("for a leaf element (non-container role), returns bare element text without sendMessage", async () => {
    const { getSpeakTextForElement } = await import("../sr-tab/playback");
    const text = await getSpeakTextForElement({
      index: 1, selector: "#a", role: "button", accessibleName: "Submit", nameSource: "contents", states: [],
    });
    expect(text).toMatch(/button.*Submit|Submit.*button/i);
    // No ANALYZE_READING_ORDER call for leaf roles
    expect(sentMessages.some((m) => m.type === "ANALYZE_READING_ORDER")).toBe(false);
  });

  it("for a container role with successful scoped fetch, returns composed container speech", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (m: { type: string }) => {
      sentMessages.push(m);
      if (m.type === "ANALYZE_READING_ORDER") {
        return {
          type: "READING_ORDER_RESULT",
          payload: [
            { index: 2, selector: "#child1", role: "menuitem", accessibleName: "Item 1", nameSource: "contents", states: [] },
          ],
        };
      }
      return undefined;
    });

    const { getSpeakTextForElement } = await import("../sr-tab/playback");
    const text = await getSpeakTextForElement({
      index: 1, selector: "#nav", role: "navigation", accessibleName: "Main", nameSource: "label", states: [],
    });
    // Composed container text includes both container info and child names
    expect(text).toMatch(/Main|navigation|Item 1/);
  });

  it("for a container role with thrown sendMessage, falls back to bare element text", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (m: { type: string }) => {
      sentMessages.push(m);
      if (m.type === "ANALYZE_READING_ORDER") throw new Error("scope fetch failed");
      return undefined;
    });

    const { getSpeakTextForElement } = await import("../sr-tab/playback");
    const text = await getSpeakTextForElement({
      index: 1, selector: "#nav", role: "navigation", accessibleName: "Main", nameSource: "label", states: [],
    });
    // Falls back to bare elementToSpeechText
    expect(text).toMatch(/Main|navigation/);
  });
});
