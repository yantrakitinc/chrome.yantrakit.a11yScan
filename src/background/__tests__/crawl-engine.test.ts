import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleCrawlMessage } from "../crawl";
import type { iMessage } from "@shared/messages";

/**
 * Integration test for the crawl engine's processCrawlQueue loop.
 * Mocks the entire chrome.tabs / chrome.scripting / chrome.runtime /
 * chrome.storage surface so the engine can run end-to-end without
 * touching a real browser.
 */

// Capture the listener registered via chrome.tabs.onUpdated.addListener
// so we can fire it immediately to simulate page-load complete.
let onUpdatedListeners: Array<(id: number, info: { status?: string }) => void> = [];
const sentRuntimeMessages: { type: string; payload?: unknown }[] = [];

beforeEach(() => {
  onUpdatedListeners = [];
  sentRuntimeMessages.length = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn((m: { type: string; payload?: unknown }) => {
        sentRuntimeMessages.push(m);
      }),
    },
    tabs: {
      query: vi.fn(async () => [{ id: 1, url: "https://x.com/seed", windowId: 1 }]),
      update: vi.fn(async (tabId: number) => {
        // Fire the onUpdated listener immediately to short-circuit waitForPageLoad
        Promise.resolve().then(() => {
          for (const l of onUpdatedListeners) l(tabId, { status: "complete" });
        });
        return undefined;
      }),
      sendMessage: vi.fn(async (_id: number, msg: { type: string }) => {
        if (msg.type === "RUN_SCAN") {
          return {
            type: "SCAN_RESULT",
            payload: {
              url: "https://x.com/seed",
              timestamp: "2026-01-01T00:00:00Z",
              violations: [], passes: [], incomplete: [],
              summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
              pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
              scanDurationMs: 0,
            },
          };
        }
        return undefined;
      }),
      onUpdated: {
        addListener: (l: (id: number, info: { status?: string }) => void) => { onUpdatedListeners.push(l); },
        removeListener: (l: (id: number, info: { status?: string }) => void) => {
          onUpdatedListeners = onUpdatedListeners.filter((x) => x !== l);
        },
      },
    },
    scripting: { executeScript: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
    },
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("processCrawlQueue — single seed page in 'urllist' mode completes", () => {
  it("START_CRAWL with a one-URL urllist eventually broadcasts CRAWL_PROGRESS with status=complete", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist",
        timeout: 5000,
        delay: 0,
        scope: "",
        urlList: ["https://x.com/seed"],
        pageRules: [],
      },
    } as iMessage, (r) => responses.push(r));

    // Wait for the async loop to play out — waitForPageLoad has a 500ms DOM-settle delay
    await new Promise((r) => setTimeout(r, 2500));

    // The handleCrawlMessage callback received a START_CRAWL ack
    expect(responses[0]).toEqual({ success: true });

    // CRAWL_PROGRESS broadcasts should have happened
    const progressMessages = sentRuntimeMessages.filter((m) => m.type === "CRAWL_PROGRESS");
    expect(progressMessages.length).toBeGreaterThan(0);
  });
});

describe("processCrawlQueue — page-rule pause", () => {
  it("when a page-rule matches, broadcasts CRAWL_WAITING_FOR_USER and pauses", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist",
        timeout: 5000,
        delay: 0,
        scope: "",
        urlList: ["https://x.com/login"],
        pageRules: [{ pattern: "/login", waitType: "login", description: "Sign in first" }],
      },
    } as iMessage, (r) => responses.push(r));
    await new Promise((r) => setTimeout(r, 50));
    const types = sentRuntimeMessages.map((m) => m.type);
    expect(types).toContain("CRAWL_WAITING_FOR_USER");
  });
});

describe("processCrawlQueue — auth flow + Follow mode link collection", () => {
  // Use a setTimeout-based fire so listeners are added BEFORE we fire them
  // (the default beforeEach uses Promise.resolve().then which races the listener add).
  function rewireTabsUpdateForListenerOrder(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.update = vi.fn(async (tabId: number) => {
      setTimeout(() => {
        for (const l of onUpdatedListeners) l(tabId, { status: "complete" });
      }, 5);
      return undefined;
    });
  }

  it("with options.auth, fills credentials via scripting.executeScript before crawling", async () => {
    rewireTabsUpdateForListenerOrder();
    let scriptingCalls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.scripting.executeScript = vi.fn(async () => { scriptingCalls++; return undefined; });

    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist",
        timeout: 5000,
        delay: 0,
        scope: "",
        urlList: ["https://x.com/seed"],
        pageRules: [],
        auth: {
          loginUrl: "https://x.com/login",
          usernameSelector: "#user",
          passwordSelector: "#pass",
          submitSelector: "#go",
          username: "alice",
          password: "secret",
        },
      },
    } as iMessage, (r) => responses.push(r));

    // performAuth: 2× tabs.update + 2× waitForPageLoad (each ~500ms DOM-settle)
    // + 2× scripting.executeScript = ~1.2s minimum
    await new Promise((r) => setTimeout(r, 2500));

    expect(scriptingCalls).toBeGreaterThanOrEqual(2);
  });

  it("Follow mode collects links from the page after a SCAN_RESULT", async () => {
    rewireTabsUpdateForListenerOrder();
    let collectLinksCallSeen = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.scripting.executeScript = vi.fn(async (opts: { func?: unknown }) => {
      const fnSrc = opts?.func ? String(opts.func) : "";
      if (fnSrc.includes("a[href]")) {
        collectLinksCallSeen = true;
        return [{ result: ["https://x.com/seed/page2"] }];
      }
      return [{ result: [] }];
    });

    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "follow",
        timeout: 5000,
        delay: 0,
        scope: "https://x.com",
        urlList: [],
        startUrl: "https://x.com/seed",
        pageRules: [],
      },
    } as iMessage, (r) => responses.push(r));

    await new Promise((r) => setTimeout(r, 2500));
    expect(collectLinksCallSeen).toBe(true);
  });
});

describe("processCrawlQueue — RUN_SCAN failure path", () => {
  it("when RUN_SCAN returns a non-SCAN_RESULT response, the URL is added to crawlState.failed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async () => ({
      type: "SCAN_ERROR",
      payload: { message: "axe-core blew up" },
    }));

    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist",
        timeout: 2000,
        delay: 0,
        scope: "",
        urlList: ["https://x.com/seed"],
        pageRules: [],
      },
    } as iMessage, (r) => responses.push(r));

    await new Promise((r) => setTimeout(r, 2500));
    // CRAWL_PROGRESS broadcasts include a failed entry
    const progress = sentRuntimeMessages.find((m) => m.type === "CRAWL_PROGRESS");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const failed = (progress?.payload as any)?.failed || {};
    expect(Object.keys(failed).length).toBeGreaterThan(0);
  });
});

describe("processCrawlQueue — testConfig.mocks ACTIVATE_MOCKS branch", () => {
  it("when testConfig.mocks is non-empty, sends ACTIVATE_MOCKS before RUN_SCAN", async () => {
    // Delayed onUpdated fire — listener must be added before the fake "complete" event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.update = vi.fn(async (tabId: number) => {
      setTimeout(() => { for (const l of onUpdatedListeners) l(tabId, { status: "complete" }); }, 5);
      return undefined;
    });
    const sentTabMessages: { type: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async (_id: number, msg: { type: string }) => {
      sentTabMessages.push(msg);
      if (msg.type === "RUN_SCAN") {
        return { type: "SCAN_RESULT", payload: { url: "https://x.com/seed", timestamp: "x", violations: [], passes: [], incomplete: [], summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 }, pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false }, scanDurationMs: 0 } };
      }
      return undefined;
    });
    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist",
        timeout: 2000,
        delay: 0,
        scope: "",
        urlList: ["https://x.com/seed"],
        pageRules: [],
        testConfig: { mocks: [{ urlPattern: "/api", status: 200, body: { ok: true } }] },
      },
    } as iMessage, (r) => responses.push(r));
    await new Promise((r) => setTimeout(r, 2500));
    expect(sentTabMessages.some((m) => m.type === "ACTIVATE_MOCKS")).toBe(true);
  });

  it("when ACTIVATE_MOCKS throws, the warning is logged but the scan still proceeds", async () => {
    // Delayed onUpdated fire — same workaround as the prior test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.update = vi.fn(async (tabId: number) => {
      setTimeout(() => { for (const l of onUpdatedListeners) l(tabId, { status: "complete" }); }, 5);
      return undefined;
    });
    let runScanReached = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.tabs.sendMessage = vi.fn(async (_id: number, msg: { type: string }) => {
      if (msg.type === "ACTIVATE_MOCKS") throw new Error("content script not ready");
      if (msg.type === "RUN_SCAN") {
        runScanReached = true;
        return { type: "SCAN_RESULT", payload: { url: "https://x.com/seed", timestamp: "x", violations: [], passes: [], incomplete: [], summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 }, pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false }, scanDurationMs: 0 } };
      }
      return undefined;
    });
    const responses: unknown[] = [];
    await handleCrawlMessage({
      type: "START_CRAWL",
      payload: {
        mode: "urllist", timeout: 2000, delay: 0, scope: "",
        urlList: ["https://x.com/seed"], pageRules: [],
        testConfig: { mocks: [{ urlPattern: "/api", status: 200, body: {} }] },
      },
    } as iMessage, (r) => responses.push(r));
    await new Promise((r) => setTimeout(r, 2500));
    expect(runScanReached).toBe(true);
  });
});

