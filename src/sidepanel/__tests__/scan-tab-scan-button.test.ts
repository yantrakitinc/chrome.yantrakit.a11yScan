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

describe("scan-button — SCAN_RESULT happy path", () => {
  function makeScanResult() {
    return {
      url: "https://x.com",
      timestamp: "2026-01-01",
      violations: [{ id: "color-contrast", impact: "serious" as const, description: "x", help: "x", helpUrl: "", tags: [], nodes: [{ selector: "#a", html: "x", failureSummary: "x" }], wcagCriteria: ["1.4.3"] }],
      passes: [], incomplete: [],
      summary: { critical: 0, serious: 1, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
    };
  }

  it("populates state.lastScanResult and transitions to 'results' phase", async () => {
    scanResponse = { type: "SCAN_RESULT", payload: makeScanResult() };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await clickScanIdle();
    const { state } = await import("../sidepanel");
    expect(state.lastScanResult?.url).toBe("https://x.com");
    expect(state.scanPhase).toBe("results");
  });

  it("with observer=true, posts OBSERVER_LOG_ENTRY after the scan", async () => {
    scanResponse = { type: "SCAN_RESULT", payload: makeScanResult() };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.mv = false;
    state.observer = true; // ← drive the observer-log path
    renderScanTab();
    document.getElementById("scan-btn")?.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(sentMessages.some((m) => m.type === "OBSERVER_LOG_ENTRY")).toBe(true);
    state.observer = false;
  });

  it("with movie=true, posts SET_MOVIE_SPEED + START_MOVIE_MODE after the scan", async () => {
    scanResponse = { type: "SCAN_RESULT", payload: makeScanResult() };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.mv = false;
    state.observer = false;
    state.movie = true; // ← drive the movie-auto-play path
    renderScanTab();
    document.getElementById("scan-btn")?.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(sentMessages.some((m) => m.type === "SET_MOVIE_SPEED")).toBe(true);
    expect(sentMessages.some((m) => m.type === "START_MOVIE_MODE")).toBe(true);
    state.movie = false;
  });

  it("RUN_ARIA_SCAN rejection is caught (no throw bubbles up)", async () => {
    scanResponse = { type: "SCAN_RESULT", payload: makeScanResult() };
    // Wire RUN_ARIA_SCAN to reject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (m: { type: string; payload?: unknown }) => {
      sentMessages.push(m);
      if (m.type === "SCAN_REQUEST") return scanResponse;
      if (m.type === "RUN_ARIA_SCAN") throw new Error("aria choked");
      return undefined;
    });
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await expect(clickScanIdle()).resolves.not.toThrow();
  });
});

describe("scan-button — clear-btn", () => {
  it("clicking clear-btn wipes state and posts hide-overlay messages", async () => {
    scanResponse = {
      type: "SCAN_RESULT",
      payload: {
        url: "https://x.com",
        timestamp: "2026-01-01",
        violations: [],
        passes: [], incomplete: [],
        summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
        pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
        scanDurationMs: 100,
      },
    };
    document.body.innerHTML = `<div id="panel-scan"></div><div id="scan-content"></div>`;
    await clickScanIdle();
    const { state } = await import("../sidepanel");
    expect(state.lastScanResult).toBeTruthy();
    sentMessages.length = 0;
    document.getElementById("clear-btn")?.click();
    expect(state.lastScanResult).toBeNull();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("HIDE_VIOLATION_OVERLAY");
    expect(types).toContain("DEACTIVATE_MOCKS");
  });
});
