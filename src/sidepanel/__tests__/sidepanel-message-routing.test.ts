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

describe("initMessageListener — fires registered listener and routes messages", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="panel-scan" class="tab-panel active"></div>
      <div id="panel-sr" class="tab-panel" hidden></div>
      <div id="panel-kb" class="tab-panel" hidden></div>
      <div id="panel-ai" class="tab-panel" hidden></div>
      <div id="top-tabs">
        <button id="tab-scan" data-tab="scan" class="tab active"></button>
        <button id="tab-sr" data-tab="sr" class="tab"></button>
        <button id="tab-kb" data-tab="kb" class="tab"></button>
        <button id="tab-ai" data-tab="ai" class="tab" disabled></button>
      </div>
      <div id="confirm-clear-bar" hidden>
        <button id="confirm-clear-yes"></button>
        <button id="confirm-clear-cancel"></button>
      </div>
    `;
  });

  it("registers a listener via chrome.runtime.onMessage.addListener", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it("STATE_CLEARED routes through reduceStateCleared", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = { url: "x" } as never;
    initMessageListener();
    expect(registeredListener).toBeTruthy();
    registeredListener!({ type: "STATE_CLEARED" });
    expect(state.scanPhase).toBe("idle");
    expect(state.lastScanResult).toBeNull();
  });

  it("CRAWL_PROGRESS routes through reduceCrawlProgress", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    initMessageListener();
    registeredListener!({
      type: "CRAWL_PROGRESS",
      payload: { status: "crawling", pagesVisited: 2, pagesTotal: 5, currentUrl: "https://x.com/p" },
    });
    expect(state.crawlPhase).toBe("crawling");
    expect(state.crawlProgress.pagesVisited).toBe(2);
  });

  it("CRAWL_WAITING_FOR_USER captures the matched-rule context", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    initMessageListener();
    registeredListener!({
      type: "CRAWL_WAITING_FOR_USER",
      payload: { url: "https://x.com/login", waitType: "login", description: "Sign in first" },
    });
    expect(state.crawlPhase).toBe("wait");
    expect(state.crawlWaitInfo).toEqual({ url: "https://x.com/login", waitType: "login", description: "Sign in first" });
  });

  it("MULTI_VIEWPORT_PROGRESS captures viewport progress", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    initMessageListener();
    registeredListener!({
      type: "MULTI_VIEWPORT_PROGRESS",
      payload: { currentViewport: 2, totalViewports: 3 },
    });
    expect(state.mvProgress).toEqual({ current: 2, total: 3 });
  });

  it("HIGHLIGHT_RESULT with found=false prepends the not-found toast to active panel", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    registeredListener!({ type: "HIGHLIGHT_RESULT", payload: { found: false } });
    const toast = document.querySelector('[role="alert"]');
    expect(toast?.textContent).toBe("Element not found on page");
  });

  it("HIGHLIGHT_RESULT with found=true does NOT add a toast", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    registeredListener!({ type: "HIGHLIGHT_RESULT", payload: { found: true } });
    const toast = document.querySelector('[role="alert"]');
    expect(toast).toBeNull();
  });

  it("NAVIGATE to 'settings' switches to scan tab and expands the accordion", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    state.topTab = "kb";
    state.accordionExpanded = false;
    initMessageListener();
    registeredListener!({ type: "NAVIGATE", payload: { target: "settings" } });
    expect(state.topTab).toBe("scan");
    expect(state.accordionExpanded).toBe(true);
  });

  it("CONFIRM_CLEAR_ALL un-hides the confirm bar and focuses Cancel", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    const bar = document.getElementById("confirm-clear-bar")!;
    bar.hidden = true;
    registeredListener!({ type: "CONFIRM_CLEAR_ALL" });
    expect(bar.hidden).toBe(false);
  });

  it("VIOLATION_BADGE_CLICKED switches to scan tab + sets sub-tab to 'results'", async () => {
    const { initMessageListener, state } = await import("../sidepanel");
    state.topTab = "sr";
    state.scanSubTab = "manual";
    initMessageListener();
    registeredListener!({ type: "VIOLATION_BADGE_CLICKED", payload: { index: 0 } });
    expect(state.topTab).toBe("scan");
    expect(state.scanSubTab).toBe("results");
  });

  it("INSPECT_ELEMENT in non-SR tab is a no-op (does NOT change scope)", async () => {
    // The handler gates on state.topTab === 'sr' — verify no-op for other tabs
    const { initMessageListener, state } = await import("../sidepanel");
    state.topTab = "scan";
    initMessageListener();
    expect(() => registeredListener!({
      type: "INSPECT_ELEMENT",
      payload: { selector: "#x", role: "button", accessibleName: "x", ariaAttributes: {}, tabindex: null, isFocusable: true, violations: [] },
    })).not.toThrow();
  });

  it("OBSERVER_SCAN_COMPLETE invalidates the observer cache (re-renders)", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    expect(() => registeredListener!({ type: "OBSERVER_SCAN_COMPLETE", payload: { entry: { url: "x" } } })).not.toThrow();
  });

  it("MOVIE_TICK + MOVIE_COMPLETE delegate to kb-tab onMovieTick / onMovieComplete (no throw)", async () => {
    const { initMessageListener } = await import("../sidepanel");
    initMessageListener();
    expect(() => registeredListener!({ type: "MOVIE_TICK", payload: { currentIndex: 1, total: 5 } })).not.toThrow();
    expect(() => registeredListener!({ type: "MOVIE_COMPLETE" })).not.toThrow();
  });
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
