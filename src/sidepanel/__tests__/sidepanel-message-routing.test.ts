// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let registeredListener: ((msg: unknown) => void) | null = null;

beforeEach(() => {
  registeredListener = null;
  document.body.innerHTML = `
    <div id="top-tabs">
      <button id="tab-scan" data-tab="scan" class="tab active" aria-selected="true" tabindex="0"></button>
      <button id="tab-sr" data-tab="sr" class="tab" aria-selected="false" tabindex="-1"></button>
      <button id="tab-kb" data-tab="kb" class="tab" aria-selected="false" tabindex="-1"></button>
      <button id="tab-ai" data-tab="ai" class="tab" aria-selected="false" tabindex="-1" disabled></button>
    </div>
    <div id="panel-scan" class="tab-panel active"></div>
    <div id="panel-sr" class="tab-panel" hidden></div>
    <div id="panel-kb" class="tab-panel" hidden></div>
    <div id="panel-ai" class="tab-panel" hidden></div>
    <div id="confirm-clear-bar" hidden>
      <button id="confirm-clear-cancel"></button>
      <button id="confirm-clear-yes"></button>
    </div>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage: { addListener: vi.fn((fn) => { registeredListener = fn; }) },
    },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
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

describe("sidepanel message routing — STATE_CLEARED + CRAWL_PROGRESS + MULTI_VIEWPORT_PROGRESS", () => {
  it("STATE_CLEARED resets scan + crawl + MV state", async () => {
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.crawlPhase = "complete";
    state.lastScanResult = { url: "x" } as never;
    state.crawlResults = { "x": {} as never };
    // Simulate: side panel registers a listener at module init via initMessageListener.
    // Since initMessageListener is called inside DOMContentLoaded which we can't
    // trigger easily, we manually invoke the reducer instead.
    const { reduceStateCleared } = await import("../sidepanel");
    Object.assign(state, reduceStateCleared(state));
    expect(state.scanPhase).toBe("idle");
    expect(state.crawlPhase).toBe("idle");
    expect(state.lastScanResult).toBeNull();
    expect(state.crawlResults).toBeNull();
  });

  it("CRAWL_PROGRESS with status='complete' captures results and clears wait info", async () => {
    const { reduceCrawlProgress, state } = await import("../sidepanel");
    state.crawlWaitInfo = { url: "x", waitType: "login", description: "x" };
    const out = reduceCrawlProgress(state, {
      status: "complete",
      pagesVisited: 5, pagesTotal: 5, currentUrl: "https://x.com/last",
      results: { "https://x.com/a": {} as never },
      failed: {},
    });
    expect(out.crawlPhase).toBe("complete");
    expect(out.crawlResults).toBeTruthy();
    expect(out.crawlWaitInfo).toBeNull();
  });

  it("CRAWL_PROGRESS with status='wait' preserves crawlWaitInfo and does NOT capture results", async () => {
    const { reduceCrawlProgress, state } = await import("../sidepanel");
    const wait = { url: "x", waitType: "login", description: "x" };
    state.crawlWaitInfo = wait;
    const out = reduceCrawlProgress(state, {
      status: "wait",
      results: { "x": {} as never }, // sent but should not be captured
    });
    expect(out.crawlPhase).toBe("wait");
    expect(out.crawlWaitInfo).toBe(wait);
    expect(out.crawlResults).toBeNull();
  });
});
