import { describe, it, expect } from "vitest";
import type { iMessage } from "../messages";

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
        scanTimeout: 30000,
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
});
