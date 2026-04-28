// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  // Set up the panel container the renderer writes into.
  document.body.innerHTML = '<div id="panel-scan"></div>';
  // chrome stub for any sendMessage calls during render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => undefined), onMessage: { addListener: vi.fn() } },
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

describe("renderScanTab — produces panel HTML on initial render", () => {
  it("renders without throwing on idle state", async () => {
    const { renderScanTab } = await import("../scan-tab");
    expect(() => renderScanTab()).not.toThrow();
  });

  it("populates #panel-scan with non-empty content", async () => {
    const { renderScanTab } = await import("../scan-tab");
    renderScanTab();
    const panel = document.getElementById("panel-scan");
    expect(panel?.innerHTML.length).toBeGreaterThan(100);
  });

  it("renders the action button on idle state", async () => {
    const { renderScanTab } = await import("../scan-tab");
    renderScanTab();
    const panel = document.getElementById("panel-scan");
    expect(panel?.innerHTML).toMatch(/id="scan-btn"|id="action-btn"|Scan Page|Start Scan|Start Crawl/i);
  });

  it("includes WCAG-version selector on initial render", async () => {
    const { renderScanTab } = await import("../scan-tab");
    renderScanTab();
    const panel = document.getElementById("panel-scan");
    expect(panel?.innerHTML).toMatch(/id="wcag-version"/);
  });

  it("renders the get-started empty state when no scan has run", async () => {
    const { renderScanTab } = await import("../scan-tab");
    renderScanTab();
    const panel = document.getElementById("panel-scan");
    expect(panel?.innerHTML).toMatch(/Get started/i);
  });

  it("re-renders idempotently — second call doesn't throw", async () => {
    const { renderScanTab } = await import("../scan-tab");
    renderScanTab();
    expect(() => renderScanTab()).not.toThrow();
  });
});
