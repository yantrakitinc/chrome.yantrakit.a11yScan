import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * observer.ts integration test.
 * Mocks chrome.storage.local + chrome.tabs.sendMessage + chrome.scripting +
 * chrome.runtime.sendMessage to drive the full onTabUpdated path and the
 * full message handler switch.
 */

let storage: Record<string, unknown>;
let runtimeSent: { type: string; payload?: unknown }[];
let scriptingExecuted: number;
let tabSendMessageStub: (id: number, msg: { type: string }) => Promise<unknown>;

beforeEach(() => {
  storage = {};
  runtimeSent = [];
  scriptingExecuted = 0;
  // default: scan returns a SCAN_RESULT
  tabSendMessageStub = async (_id, msg) => {
    if (msg.type === "RUN_SCAN") {
      return {
        type: "SCAN_RESULT",
        payload: {
          violations: [{ id: "color-contrast", nodes: [{ target: ["a"] }, { target: ["b"] }] }],
          passes: [],
        },
      };
    }
    return undefined;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in storage ? { [key]: storage[key] } : {})),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(storage, obj); }),
      },
    },
    scripting: { executeScript: vi.fn(async () => { scriptingExecuted++; }) },
    tabs: { sendMessage: vi.fn(async (id: number, m: { type: string }) => tabSendMessageStub(id, m)) },
    runtime: { sendMessage: vi.fn((m: { type: string; payload?: unknown }) => { runtimeSent.push(m); }) },
  };
  // jsdom-like fallback for window.screen (background runs in service worker — no window)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { screen: { width: 1024 } };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
  vi.resetModules();
});

const STATE_KEY = "observer_state";
const HISTORY_KEY = "observer_history";

describe("observer.onTabUpdated", () => {
  it("does nothing when observer is disabled", async () => {
    const { onTabUpdated } = await import("../observer");
    await onTabUpdated(1, { id: 1, url: "https://example.com" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
    expect(runtimeSent.length).toBe(0);
  });

  it("does nothing when crawlActive is true", async () => {
    const { onTabUpdated, setCrawlActive } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    setCrawlActive(true);
    await onTabUpdated(1, { id: 1, url: "https://example.com" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
    setCrawlActive(false);
  });

  it("does nothing when URL is not scannable (chrome:// scheme)", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    await onTabUpdated(1, { id: 1, url: "chrome://extensions" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
  });

  it("does nothing when URL is missing", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    await onTabUpdated(1, { id: 1 } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
  });

  it("filters out URL not in includeDomains", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["only-this.com"], excludeDomains: [], maxHistoryEntries: 100 } };
    await onTabUpdated(1, { id: 1, url: "https://example.com" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
  });

  it("filters out URL in excludeDomains", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: [], excludeDomains: ["example.com"], maxHistoryEntries: 100 } };
    await onTabUpdated(1, { id: 1, url: "https://example.com/page" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(0);
  });

  it("happy path: scans, persists history, broadcasts OBSERVER_SCAN_COMPLETE", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    await onTabUpdated(1, { id: 1, url: "https://example.com/page", title: "P" } as chrome.tabs.Tab);
    expect(scriptingExecuted).toBe(1);
    // history should be persisted
    expect(Array.isArray(storage[HISTORY_KEY])).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = storage[HISTORY_KEY] as any[];
    expect(history.length).toBe(1);
    expect(history[0].url).toBe("https://example.com/page");
    expect(history[0].source).toBe("auto");
    expect(history[0].violationCount).toBe(2); // 1 violation × 2 nodes
    // notification sent to sidepanel
    const types = runtimeSent.map((m) => m.type);
    expect(types).toContain("OBSERVER_SCAN_COMPLETE");
  });

  it("throttles a second scan to the same URL within throttleSeconds", async () => {
    const { onTabUpdated } = await import("../observer");
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 60, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    const tab = { id: 1, url: "https://example.com/page", title: "P" } as chrome.tabs.Tab;
    await onTabUpdated(1, tab);
    expect(scriptingExecuted).toBe(1);
    await onTabUpdated(1, tab);
    // Second call should be throttled — no second scan
    expect(scriptingExecuted).toBe(1);
  });

  it("caps history at maxHistoryEntries", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 2 } };
    storage[HISTORY_KEY] = [
      { id: "old1", url: "x", title: "x", timestamp: "z", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" },
      { id: "old2", url: "y", title: "y", timestamp: "z", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" },
    ];
    const { onTabUpdated } = await import("../observer");
    await onTabUpdated(1, { id: 1, url: "https://example.com/new" } as chrome.tabs.Tab);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = storage[HISTORY_KEY] as any[];
    expect(history.length).toBe(2);
    // newest entry should be at the front
    expect(history[0].url).toBe("https://example.com/new");
  });

  it("swallows errors when content-script injection fails", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.scripting.executeScript = vi.fn(async () => { throw new Error("blocked"); });
    const { onTabUpdated } = await import("../observer");
    await expect(onTabUpdated(1, { id: 1, url: "https://example.com/page" } as chrome.tabs.Tab)).resolves.toBeUndefined();
    // No history recorded on failure
    expect(storage[HISTORY_KEY]).toBeUndefined();
  });

  it("when scan returns a non-SCAN_RESULT shape, does NOT persist history", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    tabSendMessageStub = async () => undefined; // no result
    const { onTabUpdated } = await import("../observer");
    await onTabUpdated(1, { id: 1, url: "https://example.com/page" } as chrome.tabs.Tab);
    expect(storage[HISTORY_KEY]).toBeUndefined();
  });
});

describe("observer.handleObserverMessage", () => {
  async function dispatch(type: string, payload?: unknown): Promise<unknown> {
    const { handleObserverMessage } = await import("../observer");
    let captured: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleObserverMessage({ type, payload } as any, (resp) => { captured = resp; });
    return captured;
  }

  it("OBSERVER_ENABLE flips state.enabled to true", async () => {
    const out = await dispatch("OBSERVER_ENABLE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).type).toBe("OBSERVER_STATE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).payload.enabled).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((storage[STATE_KEY] as any).enabled).toBe(true);
  });

  it("OBSERVER_DISABLE flips state.enabled to false", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 100 } };
    const out = await dispatch("OBSERVER_DISABLE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).payload.enabled).toBe(false);
  });

  it("OBSERVER_GET_STATE returns the persisted state", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 5, includeDomains: ["a"], excludeDomains: [], maxHistoryEntries: 10 } };
    const out = await dispatch("OBSERVER_GET_STATE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).payload.settings.throttleSeconds).toBe(5);
  });

  it("OBSERVER_UPDATE_SETTINGS merges into state.settings", async () => {
    const out = await dispatch("OBSERVER_UPDATE_SETTINGS", { throttleSeconds: 999 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).payload.settings.throttleSeconds).toBe(999);
  });

  it("OBSERVER_GET_HISTORY returns the stored history", async () => {
    storage[HISTORY_KEY] = [{ id: "x", url: "u", title: "t", timestamp: "z", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" }];
    const out = await dispatch("OBSERVER_GET_HISTORY");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).type).toBe("OBSERVER_HISTORY");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).payload.length).toBe(1);
  });

  it("OBSERVER_CLEAR_HISTORY empties the history", async () => {
    storage[HISTORY_KEY] = [{ id: "x", url: "u", title: "t", timestamp: "z", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" }];
    const out = await dispatch("OBSERVER_CLEAR_HISTORY");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((storage[HISTORY_KEY] as any[]).length).toBe(0);
  });

  it("OBSERVER_EXPORT_HISTORY mirrors GET_HISTORY shape", async () => {
    storage[HISTORY_KEY] = [];
    const out = await dispatch("OBSERVER_EXPORT_HISTORY");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).type).toBe("OBSERVER_HISTORY");
  });

  it("OBSERVER_LOG_ENTRY prepends an entry and respects maxHistoryEntries", async () => {
    storage[STATE_KEY] = { enabled: true, settings: { throttleSeconds: 0, includeDomains: ["*"], excludeDomains: [], maxHistoryEntries: 1 } };
    storage[HISTORY_KEY] = [{ id: "old", url: "u", title: "t", timestamp: "z", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" }];
    const out = await dispatch("OBSERVER_LOG_ENTRY", { id: "new", url: "u2", title: "t2", timestamp: "z", source: "manual", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = storage[HISTORY_KEY] as any[];
    expect(history.length).toBe(1);
    expect(history[0].id).toBe("new");
  });

  it("unknown message type returns an error response", async () => {
    const out = await dispatch("OBSERVER_BOGUS");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).error).toMatch(/unknown/i);
  });
});
