// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let sentMessages: { type: string }[];

beforeEach(() => {
  sentMessages = [];
  document.body.innerHTML = `
    <div id="panel-scan"></div>
    <dialog id="config-dialog"><div id="config-dialog-content"></div></dialog>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m) => { sentMessages.push(m); return undefined; }),
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

describe("scan-tab handlers — accordion + collapse", () => {
  it("clicking accordion-toggle flips state.accordionExpanded and re-renders", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    renderScanTab();
    const before = document.getElementById("collapse-btn"); // present when expanded
    expect(before).toBeTruthy();
    // Click collapse
    document.getElementById("collapse-btn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(state.accordionExpanded).toBe(false);
  });

  it("clicking a mode toggle (data-mode='crawl') flips state.crawl + re-renders", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = false;
    state.accordionExpanded = true;
    renderScanTab();
    const crawlBtn = document.querySelector<HTMLButtonElement>(".mode-btn[data-mode='crawl']");
    crawlBtn?.click();
    expect(state.crawl).toBe(true);
  });

  it("Reset button clears all toggles and restores defaults", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.observer = true;
    state.movie = true;
    state.mv = true;
    state.viewports = [320, 480, 640];
    state.wcagVersion = "2.0";
    state.wcagLevel = "AAA";
    state.accordionExpanded = true;
    renderScanTab();
    document.getElementById("reset-btn")?.click();
    expect(state.crawl).toBe(false);
    expect(state.observer).toBe(false);
    expect(state.movie).toBe(false);
    expect(state.mv).toBe(false);
    expect(state.viewports).toEqual([375, 768, 1280]);
    expect(state.wcagVersion).toBe("2.2");
    expect(state.wcagLevel).toBe("AA");
  });

  it("Multi-Viewport checkbox toggles state.mv", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.mv = false;
    state.accordionExpanded = true;
    renderScanTab();
    const mvCheck = document.getElementById("mv-check") as HTMLInputElement | null;
    if (mvCheck) {
      mvCheck.dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.mv).toBe(true);
    }
  });

  it("WCAG version dropdown change updates state.wcagVersion", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.wcagVersion = "2.2";
    state.accordionExpanded = true;
    renderScanTab();
    const select = document.getElementById("wcag-version") as HTMLSelectElement | null;
    if (select) {
      select.value = "2.0";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.wcagVersion).toBe("2.0");
    }
  });

  it("WCAG level dropdown change updates state.wcagLevel", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.wcagLevel = "AA";
    state.accordionExpanded = true;
    renderScanTab();
    const select = document.getElementById("wcag-level") as HTMLSelectElement | null;
    if (select) {
      select.value = "AAA";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.wcagLevel).toBe("AAA");
    }
  });
});

describe("scan-tab handlers — sub-tab navigation", () => {
  it("clicking a sub-tab updates state.scanSubTab", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = {
      url: "https://x.com", timestamp: "2026-01-01", violations: [], passes: [], incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 0,
    };
    state.scanSubTab = "results";
    renderScanTab();
    const manualTab = document.getElementById("subtab-manual") as HTMLButtonElement | null;
    manualTab?.click();
    expect(state.scanSubTab).toBe("manual");
  });
});
