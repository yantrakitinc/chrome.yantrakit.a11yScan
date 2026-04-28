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

describe("scan-tab handlers — highlight + manual review", () => {
  function pageScan() {
    return {
      url: "https://x.com", timestamp: "2026-01-01",
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

  it("clicking a Highlight button sends a HIGHLIGHT_ELEMENT message with the selector", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "results";
    renderScanTab();
    const btn = document.querySelector<HTMLButtonElement>(".highlight-btn");
    btn?.click();
    await Promise.resolve();
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("HIGHLIGHT_ELEMENT");
  });

  it("clicking a Manual Review button updates state.manualReview for that criterion", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.scanSubTab = "manual";
    state.manualReview = {};
    renderScanTab();
    // Pick the first manual review criterion and click Pass
    const passBtn = document.querySelector<HTMLButtonElement>(".manual-btn[data-status='pass']");
    expect(passBtn).toBeTruthy();
    const id = passBtn!.dataset.id!;
    passBtn?.click();
    expect(state.manualReview[id]).toBe("pass");
  });
});

describe("scan-tab handlers — crawl controls", () => {
  function withCrawling() {
    return async () => {
      const { renderScanTab } = await import("../scan-tab");
      const { state } = await import("../sidepanel");
      state.crawl = true;
      state.crawlPhase = "crawling";
      state.crawlProgress = { pagesVisited: 1, pagesTotal: 5, currentUrl: "https://x.com/a" };
      renderScanTab();
    };
  }

  it("pause-crawl button sends PAUSE_CRAWL", async () => {
    await withCrawling()();
    document.getElementById("pause-crawl")?.click();
    await Promise.resolve();
    expect(sentMessages.map((m) => m.type)).toContain("PAUSE_CRAWL");
  });

  it("cancel-crawl button sends CANCEL_CRAWL and resets crawlPhase to idle", async () => {
    await withCrawling()();
    const { state } = await import("../sidepanel");
    document.getElementById("cancel-crawl")?.click();
    await Promise.resolve();
    expect(state.crawlPhase).toBe("idle");
    expect(sentMessages.map((m) => m.type)).toContain("CANCEL_CRAWL");
  });

  it("resume-crawl button (paused phase) sends RESUME_CRAWL", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.crawlPhase = "paused";
    state.crawlProgress = { pagesVisited: 1, pagesTotal: 5, currentUrl: "https://x.com/a" };
    renderScanTab();
    document.getElementById("resume-crawl")?.click();
    await Promise.resolve();
    expect(sentMessages.map((m) => m.type)).toContain("RESUME_CRAWL");
  });

  it("continue-crawl (page-rule wait) sends USER_CONTINUE and clears crawlWaitInfo", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.crawlPhase = "wait";
    state.crawlWaitInfo = { url: "https://x.com/login", waitType: "login", description: "Sign in" };
    renderScanTab();
    document.getElementById("continue-crawl")?.click();
    await Promise.resolve();
    expect(sentMessages.map((m) => m.type)).toContain("USER_CONTINUE");
    expect(state.crawlWaitInfo).toBeNull();
  });
});

describe("scan-tab handlers — overlay toggle + crawl view mode", () => {
  function pageScan() {
    return {
      url: "https://x.com", timestamp: "2026-01-01",
      violations: [{ id: "x", impact: "serious" as const, description: "x", help: "x", helpUrl: "", tags: [],
        nodes: [{ selector: "#a", html: "", failureSummary: "" }] }],
      passes: [], incomplete: [],
      summary: { critical: 0, serious: 1, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 0,
    };
  }

  it("toggle-violations click flips state.violationsOverlayOn and sends overlay messages", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "results";
    state.lastScanResult = pageScan();
    state.violationsOverlayOn = false;
    renderScanTab();
    document.getElementById("toggle-violations")?.click();
    await Promise.resolve();
    expect(state.violationsOverlayOn).toBe(true);
    expect(sentMessages.map((m) => m.type)).toContain("SHOW_VIOLATION_OVERLAY");
  });
});

describe("scan-tab handlers — scan-btn dispatch", () => {
  function pageScan() {
    return {
      url: "https://x.com", timestamp: "2026-01-01",
      violations: [], passes: [], incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 0,
    };
  }

  it("scan-btn exists after renderScanTab in idle phase", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.scanPhase = "idle";
    state.crawl = false;
    state.mv = false;
    state.accordionExpanded = true;
    renderScanTab();
    expect(document.getElementById("scan-btn")).toBeTruthy();
  });
});

describe("scan-tab handlers — viewport editor", () => {
  it("vp-edit click flips viewportEditing on (UI shows the inline editor)", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.mv = true;
    state.viewports = [375, 768, 1280];
    state.accordionExpanded = true;
    renderScanTab();
    const editBtn = document.getElementById("vp-edit");
    editBtn?.click();
    // After re-render, the chip row is replaced with the inline editor (vp-input)
    expect(document.querySelector(".vp-input")).toBeTruthy();
  });

  it("vp-add click appends a new viewport to state.viewports", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.mv = true;
    state.viewports = [375, 768];
    state.accordionExpanded = true;
    renderScanTab();
    document.getElementById("vp-edit")?.click(); // enter editing mode
    document.getElementById("vp-add")?.click();
    expect(state.viewports.length).toBe(3);
  });

  it("vp-remove click deletes a viewport from state.viewports", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.mv = true;
    state.viewports = [375, 768, 1280];
    state.accordionExpanded = true;
    renderScanTab();
    document.getElementById("vp-edit")?.click();
    const remove = document.querySelector<HTMLButtonElement>(".vp-remove");
    remove?.click();
    expect(state.viewports.length).toBe(2);
  });
});
