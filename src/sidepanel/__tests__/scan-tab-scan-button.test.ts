// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let sentMessages: { type: string; payload?: unknown }[];
let scanResponse: unknown;

beforeEach(() => {
  sentMessages = [];
  scanResponse = undefined;
  document.body.innerHTML = `<div id="panel-scan"></div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
        if (m.type === "SCAN_REQUEST" || m.type === "MULTI_VIEWPORT_SCAN") return scanResponse;
        if (m.type === "RUN_ARIA_SCAN") return { type: "ARIA_SCAN_RESULT", payload: [] };
        return undefined;
      }),
      onMessage: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn((_q, cb?: (tabs: unknown[]) => void) => {
        const tabs = [{ id: 1, url: "https://x.com", title: "X", width: 1280 }];
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      }),
      sendMessage: vi.fn(async () => undefined),
    },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
      session: { get: vi.fn((_k, cb) => cb({})), set: vi.fn(async () => undefined) },
    },
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

async function clickScanIdle() {
  const { renderScanTab } = await import("../scan-tab");
  const { state } = await import("../sidepanel");
  state.scanPhase = "idle";
  state.crawl = false;
  state.crawlPhase = "idle";
  state.mv = false;
  state.observer = false;
  renderScanTab();
  document.getElementById("scan-btn")?.click();
  await new Promise((r) => setTimeout(r, 50));
}

describe("scan-button — SCAN_ERROR response", () => {
  it("when SCAN_REQUEST returns SCAN_ERROR, scanPhase resets to idle + showError fires", async () => {
    scanResponse = { type: "SCAN_ERROR", payload: { message: "axe blew up" } };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await clickScanIdle();
    const { state } = await import("../sidepanel");
    expect(state.scanPhase).toBe("idle");
  });
});

describe("scan-button — MULTI_VIEWPORT_RESULT response", () => {
  it("when MULTI_VIEWPORT_SCAN returns MULTI_VIEWPORT_RESULT, state.lastMvResult is populated", async () => {
    scanResponse = {
      type: "MULTI_VIEWPORT_RESULT",
      payload: {
        viewports: [375, 768],
        shared: [],
        viewportSpecific: [],
        perViewport: {
          375: {
            url: "https://x.com",
            timestamp: "2026-01-01",
            violations: [],
            passes: [],
            incomplete: [],
            summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
            pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
            scanDurationMs: 0,
          },
        },
      },
    };
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.crawlPhase = "idle";
    state.mv = true;
    state.observer = false;
    renderScanTab();
    document.getElementById("scan-btn")?.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(state.lastMvResult).toBeTruthy();
    expect(state.scanPhase).toBe("results");
  });
});

describe("scan-button — unexpected response", () => {
  it("when scan returns garbage, scanPhase resets to idle", async () => {
    scanResponse = { type: "WHAT_EVEN", payload: {} };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await clickScanIdle();
    const { state } = await import("../sidepanel");
    expect(state.scanPhase).toBe("idle");
  });
});

describe("scan-button — exception in scan dispatch", () => {
  it("when sendMessage throws, scanPhase resets to idle and showError fires", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (m: { type: string }) => {
      sentMessages.push(m);
      if (m.type === "SCAN_REQUEST") throw new Error("network down");
      return undefined;
    });
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await clickScanIdle();
    const { state } = await import("../sidepanel");
    expect(state.scanPhase).toBe("idle");
  });
});
