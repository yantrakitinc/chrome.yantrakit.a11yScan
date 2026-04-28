// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom HTMLDialogElement does not ship showModal/close. Polyfill.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HTMLDialogElement = (globalThis as any).HTMLDialogElement;
if (HTMLDialogElement && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

let sentMessages: { type: string; payload?: unknown }[];
let storageData: Record<string, unknown>;

beforeEach(() => {
  sentMessages = [];
  storageData = {};
  document.body.innerHTML = `
    <div id="panel-scan"></div>
    <dialog id="config-dialog"><div id="config-dialog-content"></div></dialog>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => {
        sentMessages.push(m);
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
      local: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: vi.fn(async (_k: any) => storageData),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(storageData, obj); }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remove: vi.fn(async (keys: string | string[]) => {
          const ks = Array.isArray(keys) ? keys : [keys];
          for (const k of ks) delete storageData[k];
        }),
      },
      session: { get: vi.fn((_k, cb) => cb({})), set: vi.fn(async () => undefined) },
    },
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("scan-tab — settings button opens config dialog", () => {
  it("clicking #settings-btn opens the dialog and renders config UI", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.testConfig = null;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    const dlg = document.getElementById("config-dialog") as HTMLDialogElement;
    expect(dlg.open).toBe(true);
    expect(document.getElementById("config-textarea")).toBeTruthy();
    expect(document.getElementById("config-apply-btn")).toBeTruthy();
  });

  it("Apply with invalid JSON shows error and keeps dialog open", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.testConfig = null;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
    ta.value = "not json {{{";
    document.getElementById("config-apply-btn")?.click();
    await new Promise((r) => setTimeout(r, 5));
    const err = document.getElementById("config-error");
    expect(err?.style.display).toBe("block");
    expect((document.getElementById("config-dialog") as HTMLDialogElement).open).toBe(true);
  });

  it("Apply with valid config persists to storage and closes the dialog", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.testConfig = null;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
    ta.value = JSON.stringify({ wcag: { version: "2.1", level: "AA" } });
    document.getElementById("config-apply-btn")?.click();
    await new Promise((r) => setTimeout(r, 5));
    // testConfig should be set
    expect(state.testConfig).toBeTruthy();
    expect((document.getElementById("config-dialog") as HTMLDialogElement).open).toBe(false);
  });

  it("Apply with empty textarea shows 'Paste JSON config…' error", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.testConfig = null;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    document.getElementById("config-apply-btn")?.click();
    await new Promise((r) => setTimeout(r, 5));
    const err = document.getElementById("config-error");
    expect(err?.textContent).toMatch(/Paste JSON config/);
  });

  it("Close button closes the dialog", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    document.getElementById("config-close-btn")?.click();
    expect((document.getElementById("config-dialog") as HTMLDialogElement).open).toBe(false);
  });

  it("Clear Config button (visible when testConfig exists) clears state.testConfig", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.testConfig = { wcag: { version: "2.2", level: "AA" } } as never;
    renderScanTab();
    document.getElementById("settings-btn")?.click();
    document.getElementById("config-clear-btn")?.click();
    expect(state.testConfig).toBeNull();
    expect((document.getElementById("config-dialog") as HTMLDialogElement).open).toBe(false);
  });
});

describe("scan-tab — mode toggle clicks and message dispatch", () => {
  it("clicking mode-btn[data-mode='movie'] flips state.movie + persists movie_enabled to storage", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.accordionExpanded = true;
    state.movie = false;
    renderScanTab();
    document.querySelector<HTMLButtonElement>(".mode-btn[data-mode='movie']")?.click();
    expect(state.movie).toBe(true);
    expect(storageData["movie_enabled"]).toBe(true);
  });
});

describe("scan-tab — sub-tab keyboard navigation", () => {
  function pageScanWithSubtabs() {
    return {
      url: "https://x.com",
      timestamp: "2026-01-01",
      violations: [{
        id: "color-contrast", impact: "serious" as const, description: "x", help: "x", helpUrl: "", tags: [],
        nodes: [{ selector: "#a", html: "", failureSummary: "" }], wcagCriteria: ["1.4.3"],
      }],
      passes: [], incomplete: [],
      summary: { critical: 0, serious: 1, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
    };
  }

  it("ArrowRight on a sub-tab focuses the next sub-tab", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScanWithSubtabs();
    state.scanSubTab = "results";
    renderScanTab();
    const resultsTab = document.getElementById("subtab-results") as HTMLButtonElement;
    resultsTab.focus();
    resultsTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(state.scanSubTab).not.toBe("results");
  });

  it("Home on a sub-tab jumps focus to the first sub-tab", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScanWithSubtabs();
    state.scanSubTab = "manual";
    renderScanTab();
    const manualTab = document.getElementById("subtab-manual") as HTMLButtonElement;
    manualTab.focus();
    manualTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(state.scanSubTab).toBe("results");
  });
});

describe("scan-tab — Export buttons", () => {
  function pageScan() {
    return {
      url: "https://x.com",
      timestamp: "2026-01-01",
      violations: [{
        id: "color-contrast", impact: "serious" as const, description: "Contrast",
        help: "Improve contrast", helpUrl: "", tags: [],
        nodes: [{ selector: "#submit", html: "<button>x</button>", failureSummary: "low contrast" }],
        wcagCriteria: ["1.4.3"],
      }],
      passes: [], incomplete: [],
      summary: { critical: 0, serious: 1, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
    };
  }

  it("clicking #export-html when results exist triggers a Blob download (URL.createObjectURL)", async () => {
    const createSpy = vi.fn(() => "blob:fake");
    const revokeSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL as any).createObjectURL = createSpy;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis.URL as any).revokeObjectURL = revokeSpy;

    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "results";
    renderScanTab();

    document.getElementById("export-html")?.click();
    expect(createSpy).toHaveBeenCalled();
  });

  it("clicking #export-pdf when results exist opens a print window (popup blocked → 'Popup blocked' status)", async () => {
    // window.open returns null to simulate popup blocked
    const origOpen = window.open;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.open = vi.fn(() => null) as any;

    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "results";
    renderScanTab();

    document.getElementById("export-pdf")?.click();
    expect(document.getElementById("export-pdf")?.textContent).toMatch(/Popup blocked/);

    window.open = origOpen;
  });

  it("clicking #export-copy when results exist writes JSON to navigator.clipboard", async () => {
    const writeText = vi.fn(async () => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText }, configurable: true,
    });

    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "results";
    renderScanTab();

    document.getElementById("export-copy")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(writeText).toHaveBeenCalled();
    // Button text flips to "Copied!"
    expect(document.getElementById("export-copy")?.textContent).toMatch(/Copied/);
  });

  it("clicking #export-copy when clipboard fails shows 'Copy failed' status", async () => {
    const writeText = vi.fn(async () => { throw new Error("denied"); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText }, configurable: true,
    });

    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "results";
    renderScanTab();

    document.getElementById("export-copy")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.getElementById("export-copy")?.textContent).toMatch(/Copy failed/);
  });
});

describe("scan-tab — scan-btn click dispatches the right path", () => {
  it("scan-btn in idle phase with no crawl: posts SCAN_REQUEST", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.mv = false;
    renderScanTab();
    sentMessages.length = 0;
    document.getElementById("scan-btn")?.click();
    // Allow async send + result processing
    await new Promise((r) => setTimeout(r, 30));
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("SCAN_REQUEST");
  });

  it("scan-btn in idle phase with mv on: posts MULTI_VIEWPORT_SCAN", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.mv = true;
    renderScanTab();
    sentMessages.length = 0;
    document.getElementById("scan-btn")?.click();
    await new Promise((r) => setTimeout(r, 30));
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("MULTI_VIEWPORT_SCAN");
  });

  it("scan-btn (visible while idle) with crawl on: posts START_CRAWL", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = true;
    state.crawlPhase = "idle";
    renderScanTab();
    sentMessages.length = 0;
    // The action button is now scan-btn (always visible while idle, even in crawl mode)
    document.getElementById("scan-btn")?.click();
    await new Promise((r) => setTimeout(r, 30));
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("START_CRAWL");
  });
});
