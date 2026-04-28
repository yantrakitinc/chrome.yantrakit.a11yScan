import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { iMessage } from "../messages";
import { sendMessage, sendTabMessage } from "../messages";

describe("iMessage type coverage", () => {
  it("SCAN_REQUEST is a valid message", () => {
    const msg: iMessage = { type: "SCAN_REQUEST" };
    expect(msg.type).toBe("SCAN_REQUEST");
  });

  it("RUN_SCAN requires config payload", () => {
    const msg: iMessage = {
      type: "RUN_SCAN",
      payload: {
        config: {
          version: "0.0.0",
          wcagVersion: "2.2",
          wcagLevel: "AA",
          rules: {},
          scanOptions: { resultTypes: ["violations", "passes"] },
        },
      },
    };
    expect(msg.type).toBe("RUN_SCAN");
  });

  it("OBSERVER_ENABLE has no payload", () => {
    const msg: iMessage = { type: "OBSERVER_ENABLE" };
    expect(msg.type).toBe("OBSERVER_ENABLE");
  });

  it("HIGHLIGHT_ELEMENT requires selector", () => {
    const msg: iMessage = { type: "HIGHLIGHT_ELEMENT", payload: { selector: "#main" } };
    expect(msg.type).toBe("HIGHLIGHT_ELEMENT");
  });

  it("APPLY_CVD_FILTER accepts null matrix", () => {
    const msg: iMessage = { type: "APPLY_CVD_FILTER", payload: { matrix: null } };
    expect(msg.type).toBe("APPLY_CVD_FILTER");
  });

  it("APPLY_CVD_FILTER accepts number array", () => {
    const msg: iMessage = { type: "APPLY_CVD_FILTER", payload: { matrix: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758] } };
    expect(msg.type).toBe("APPLY_CVD_FILTER");
  });

  it("NAVIGATE has target payload", () => {
    const msg: iMessage = { type: "NAVIGATE", payload: { target: "settings" } };
    expect(msg.type).toBe("NAVIGATE");
  });

  it("STATE_CLEARED has no payload", () => {
    const msg: iMessage = { type: "STATE_CLEARED" };
    expect(msg.type).toBe("STATE_CLEARED");
  });

  it("SET_MOVIE_SPEED requires speed", () => {
    const msg: iMessage = { type: "SET_MOVIE_SPEED", payload: { speed: 2 } };
    expect(msg.type).toBe("SET_MOVIE_SPEED");
  });

  it("MULTI_VIEWPORT_SCAN requires viewports", () => {
    const msg: iMessage = { type: "MULTI_VIEWPORT_SCAN", payload: { viewports: [375, 768, 1280] } };
    expect(msg.type).toBe("MULTI_VIEWPORT_SCAN");
  });

  it("ANALYZE_READING_ORDER accepts optional scope", () => {
    const msg1: iMessage = { type: "ANALYZE_READING_ORDER", payload: {} };
    const msg2: iMessage = { type: "ANALYZE_READING_ORDER", payload: { scopeSelector: "nav" } };
    expect(msg1.type).toBe("ANALYZE_READING_ORDER");
    expect(msg2.type).toBe("ANALYZE_READING_ORDER");
  });

  it("START_CRAWL requires full options", () => {
    const msg: iMessage = {
      type: "START_CRAWL",
      payload: {
        mode: "follow",
        timeout: 30000,
        delay: 1000,
        scope: "",
        urlList: [],
        pageRules: [],
      },
    };
    expect(msg.type).toBe("START_CRAWL");
  });

  // F16 new message types
  it("GET_FOCUS_INDICATORS has no payload", () => {
    const msg: iMessage = { type: "GET_FOCUS_INDICATORS" };
    expect(msg.type).toBe("GET_FOCUS_INDICATORS");
  });

  it("GET_KEYBOARD_TRAPS has no payload", () => {
    const msg: iMessage = { type: "GET_KEYBOARD_TRAPS" };
    expect(msg.type).toBe("GET_KEYBOARD_TRAPS");
  });

  it("GET_SKIP_LINKS has no payload", () => {
    const msg: iMessage = { type: "GET_SKIP_LINKS" };
    expect(msg.type).toBe("GET_SKIP_LINKS");
  });

  it("ENTER_INSPECT_MODE has no payload", () => {
    const msg: iMessage = { type: "ENTER_INSPECT_MODE" };
    expect(msg.type).toBe("ENTER_INSPECT_MODE");
  });

  it("EXIT_INSPECT_MODE has no payload", () => {
    const msg: iMessage = { type: "EXIT_INSPECT_MODE" };
    expect(msg.type).toBe("EXIT_INSPECT_MODE");
  });

  it("MOVIE_TICK carries currentIndex and total", () => {
    const msg: iMessage = { type: "MOVIE_TICK", payload: { currentIndex: 3, total: 10 } };
    expect(msg.type).toBe("MOVIE_TICK");
    expect(msg.payload.currentIndex).toBe(3);
    expect(msg.payload.total).toBe(10);
  });

  it("MOVIE_COMPLETE has no payload", () => {
    const msg: iMessage = { type: "MOVIE_COMPLETE" };
    expect(msg.type).toBe("MOVIE_COMPLETE");
  });

  it("INSPECT_ELEMENT carries iInspectorData payload", () => {
    const msg: iMessage = {
      type: "INSPECT_ELEMENT",
      payload: {
        selector: "#main",
        role: "main",
        accessibleName: "",
        ariaAttributes: {},
        tabindex: null,
        isFocusable: false,
        violations: [],
      },
    };
    expect(msg.type).toBe("INSPECT_ELEMENT");
    expect(msg.payload.selector).toBe("#main");
  });
});

describe("sendMessage / sendTabMessage", () => {
  let mockRuntime: { sendMessage: ReturnType<typeof vi.fn> };
  let mockTabs: { sendMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRuntime = { sendMessage: vi.fn(async (m) => ({ echoed: m })) };
    mockTabs = { sendMessage: vi.fn(async (id, m) => ({ tabId: id, echoed: m })) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: mockRuntime, tabs: mockTabs };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("sendMessage delegates to chrome.runtime.sendMessage", async () => {
    const result = await sendMessage({ type: "OBSERVER_ENABLE" });
    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({ type: "OBSERVER_ENABLE" });
    expect((result as { echoed: { type: string } }).echoed.type).toBe("OBSERVER_ENABLE");
  });

  it("sendTabMessage delegates to chrome.tabs.sendMessage with the tabId", async () => {
    const result = await sendTabMessage(42, { type: "RUN_ARIA_SCAN" });
    expect(mockTabs.sendMessage).toHaveBeenCalledWith(42, { type: "RUN_ARIA_SCAN" });
    expect((result as { tabId: number; echoed: { type: string } }).tabId).toBe(42);
  });
});
