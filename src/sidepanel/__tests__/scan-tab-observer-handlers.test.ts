// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let sentMessages: { type: string; payload?: unknown }[];

beforeEach(() => {
  sentMessages = [];
  document.body.innerHTML = `<div id="panel-scan"></div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
        if (m.type === "OBSERVER_GET_HISTORY") {
          return {
            type: "OBSERVER_HISTORY",
            payload: [
              { id: "1", url: "https://x.com/a", title: "A", timestamp: "2026-01-01", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" },
              { id: "2", url: "https://x.com/b", title: "B", timestamp: "2026-01-02", source: "auto", violations: [], passes: [], violationCount: 2, viewportBucket: "desktop" },
            ],
          };
        }
        if (m.type === "OBSERVER_EXPORT_HISTORY") {
          return {
            type: "OBSERVER_HISTORY",
            payload: [{ id: "1", url: "https://x.com/a", title: "A", timestamp: "2026-01-01", source: "auto", violations: [], passes: [], violationCount: 0, viewportBucket: "desktop" }],
          };
        }
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
  // URL.createObjectURL/revokeObjectURL polyfill for export download
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).revokeObjectURL = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

async function setupObserveSubtab() {
  // Observer mode is hidden in the UI but the observer subtab + handlers
  // exist in the codebase. To exercise them we set state.observer = true
  // via direct mutation, then render with scanSubTab = "observe".
  const { renderScanTab } = await import("../scan-tab");
  const { state } = await import("../sidepanel");
  const { scanTabState } = await import("../scan-tab/state");
  scanTabState.observerEntries = [];
  scanTabState.observerLoaded = false;
  scanTabState.observerFilter = "";
  state.observer = true;
  state.scanPhase = "results";
  state.lastScanResult = {
    url: "https://x.com",
    timestamp: "2026-01-01",
    violations: [],
    passes: [],
    incomplete: [],
    summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
    pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
    scanDurationMs: 0,
  };
  state.scanSubTab = "observe";
  renderScanTab();
  // Allow the OBSERVER_GET_HISTORY round-trip to land + targeted DOM update.
  await new Promise((r) => setTimeout(r, 30));
}

describe("observer handlers — domain filter input", () => {
  it("typing in #observer-domain-filter narrows the rendered list (targeted DOM update)", async () => {
    await setupObserveSubtab();
    const filter = document.getElementById("observer-domain-filter") as HTMLInputElement;
    filter.value = "/a";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const list = document.getElementById("observer-list-content");
    expect(list?.textContent).toContain("/a");
    // The /b row should not appear since the filter excludes it
    expect(list?.textContent).not.toContain("/b");
  });
});

describe("observer handlers — clear-observer button", () => {
  it("clicking #clear-observer sends OBSERVER_CLEAR_HISTORY", async () => {
    await setupObserveSubtab();
    sentMessages.length = 0;
    document.getElementById("clear-observer")?.click();
    await new Promise((r) => setTimeout(r, 5));
    // OBSERVER_CLEAR_HISTORY message fires immediately. Side effects on
    // observerEntries depend on the background-side cleared flag which the
    // mock doesn't track, so we just verify the message went out.
    expect(sentMessages.some((m) => m.type === "OBSERVER_CLEAR_HISTORY")).toBe(true);
  });
});

describe("observer handlers — export-observer button", () => {
  it("clicking #export-observer sends OBSERVER_EXPORT_HISTORY + triggers download", async () => {
    await setupObserveSubtab();
    sentMessages.length = 0;
    document.getElementById("export-observer")?.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(sentMessages.some((m) => m.type === "OBSERVER_EXPORT_HISTORY")).toBe(true);
    // URL.createObjectURL was called for the JSON blob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis.URL as any).createObjectURL).toHaveBeenCalled();
  });
});
