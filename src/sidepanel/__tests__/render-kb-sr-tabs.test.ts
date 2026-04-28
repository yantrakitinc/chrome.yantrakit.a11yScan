// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="panel-kb"></div><div id="panel-sr"></div>';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => undefined) },
    tabs: { sendMessage: vi.fn(async () => undefined) },
  };
  // jsdom doesn't implement speechSynthesis; sr-tab consults it on render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).speechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("renderKeyboardTab — initial render", () => {
  it("populates #panel-kb without throwing", async () => {
    const { renderKeyboardTab } = await import("../kb-tab");
    expect(() => renderKeyboardTab()).not.toThrow();
    expect(document.getElementById("panel-kb")?.innerHTML.length).toBeGreaterThan(50);
  });

  it("renders the Analyze button on idle state", async () => {
    const { renderKeyboardTab } = await import("../kb-tab");
    renderKeyboardTab();
    expect(document.getElementById("kb-analyze")).toBeTruthy();
  });

  it("shows 'Click Analyze' empty state before analyze", async () => {
    const { renderKeyboardTab } = await import("../kb-tab");
    renderKeyboardTab();
    expect(document.getElementById("panel-kb")?.innerHTML).toMatch(/Click Analyze/i);
  });
});

describe("renderScreenReaderTab — initial render", () => {
  it("populates #panel-sr without throwing", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    expect(() => renderScreenReaderTab()).not.toThrow();
    expect(document.getElementById("panel-sr")?.innerHTML.length).toBeGreaterThan(50);
  });

  it("renders the Analyze and Inspect buttons", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    expect(document.getElementById("sr-analyze")).toBeTruthy();
    expect(document.getElementById("sr-inspect")).toBeTruthy();
  });

  it("renders an empty list before analyze runs", async () => {
    const { renderScreenReaderTab } = await import("../sr-tab");
    renderScreenReaderTab();
    expect(document.getElementById("sr-list")).toBeTruthy();
  });
});
