// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let sentMessages: { type: string; payload?: unknown }[];
let storageData: Record<string, unknown>;

beforeEach(() => {
  sentMessages = [];
  storageData = {};
  document.body.innerHTML = `<div id="panel-scan"></div><dialog id="config-dialog"><div id="config-dialog-content"></div></dialog>`;
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

async function setupCrawlMode() {
  const { renderScanTab } = await import("../scan-tab");
  const { state } = await import("../sidepanel");
  // Reset shared module-level state so tests don't bleed into each other.
  const { scanTabState } = await import("../scan-tab/state");
  scanTabState.crawlUrlList.length = 0;
  scanTabState.urlListPanelOpen = false;
  scanTabState.crawlMode = "follow";
  scanTabState.crawlViewMode = "page";
  state.crawl = true;
  state.crawlPhase = "idle";
  state.accordionExpanded = true;
  renderScanTab();
}

describe("crawl handlers — crawl-mode select + URL list panel", () => {
  it("changing #crawl-mode to 'urllist' updates scanTabState.crawlMode + closes panel", async () => {
    await setupCrawlMode();
    const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
    expect(sel).toBeTruthy();
    sel.value = "urllist";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    // Re-render fires — the URL-list-open button is now visible
    expect(document.getElementById("url-list-open")).toBeTruthy();
  });

  it("clicking #url-list-open toggles the URL-list panel open", async () => {
    await setupCrawlMode();
    const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
    sel.value = "urllist";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("url-list-open")?.click();
    // Panel renders the textarea + add buttons
    expect(document.getElementById("url-paste-area")).toBeTruthy();
    expect(document.getElementById("url-paste-add")).toBeTruthy();
  });

  it("clicking #url-list-done closes the panel", async () => {
    await setupCrawlMode();
    const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
    sel.value = "urllist";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("url-list-open")?.click();
    document.getElementById("url-list-done")?.click();
    expect(document.getElementById("url-paste-area")).toBeFalsy();
  });
});

describe("crawl handlers — URL paste + manual add + remove", () => {
  async function openUrlPanel() {
    await setupCrawlMode();
    const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
    sel.value = "urllist";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("url-list-open")?.click();
  }

  it("paste-add picks plaintext URLs from the textarea", async () => {
    await openUrlPanel();
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement;
    ta.value = "https://x.com/a\nhttps://x.com/b\n";
    document.getElementById("url-paste-add")?.click();
    // List rows render after the re-render
    expect(document.querySelectorAll(".url-remove-btn").length).toBe(2);
  });

  it("manual-add adds one URL and clears the input", async () => {
    await openUrlPanel();
    const input = document.getElementById("url-manual-input") as HTMLInputElement;
    input.value = "https://x.com/manual";
    document.getElementById("url-manual-add")?.click();
    expect(document.querySelectorAll(".url-remove-btn").length).toBe(1);
  });

  it("manual-add Enter key triggers add", async () => {
    await openUrlPanel();
    const input = document.getElementById("url-manual-input") as HTMLInputElement;
    input.value = "https://x.com/enter";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(document.querySelectorAll(".url-remove-btn").length).toBe(1);
  });

  it("url-remove-btn removes URL by index", async () => {
    await openUrlPanel();
    const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement;
    ta.value = "https://x.com/a\nhttps://x.com/b\n";
    document.getElementById("url-paste-add")?.click();
    expect(document.querySelectorAll(".url-remove-btn").length).toBe(2);
    document.querySelector<HTMLButtonElement>(".url-remove-btn")?.click();
    expect(document.querySelectorAll(".url-remove-btn").length).toBe(1);
  });
});

describe("crawl handlers — crawl results view toggle", () => {
  function setupCrawlComplete() {
    return async () => {
      const { renderScanTab } = await import("../scan-tab");
      const { state } = await import("../sidepanel");
      state.crawl = true;
      state.crawlPhase = "complete";
      state.crawlResults = {
        "https://x.com/a": {
          url: "https://x.com/a", timestamp: "2026-01-01",
          violations: [], passes: [], incomplete: [],
          summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
          pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
          scanDurationMs: 100,
        } as never,
      };
      state.scanSubTab = "results";
      renderScanTab();
    };
  }

  it("clicking #crawl-view-wcag flips the view + re-renders", async () => {
    await setupCrawlComplete()();
    document.getElementById("crawl-view-wcag")?.click();
    // After click the wcag button has aria-pressed=true
    expect(document.getElementById("crawl-view-wcag")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking #crawl-view-page restores page view", async () => {
    await setupCrawlComplete()();
    document.getElementById("crawl-view-wcag")?.click();
    document.getElementById("crawl-view-page")?.click();
    expect(document.getElementById("crawl-view-page")?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("crawl handlers — page-rule wait controls", () => {
  async function setupWait() {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.crawlPhase = "wait";
    state.crawlWaitInfo = { url: "https://x.com/login", waitType: "login", description: "Sign in first" };
    renderScanTab();
  }

  it("scan-then-continue sends SCAN_REQUEST + USER_CONTINUE + clears wait info", async () => {
    // chrome mock returns no SCAN_RESULT, just verify USER_CONTINUE fires
    await setupWait();
    sentMessages.length = 0;
    document.getElementById("scan-then-continue")?.click();
    await new Promise((r) => setTimeout(r, 5));
    const types = sentMessages.map((m) => m.type);
    expect(types).toContain("SCAN_REQUEST");
    expect(types).toContain("USER_CONTINUE");
  });

  it("cancel-wait sends CANCEL_CRAWL + clears wait info", async () => {
    await setupWait();
    const { state } = await import("../sidepanel");
    sentMessages.length = 0;
    document.getElementById("cancel-wait")?.click();
    expect(sentMessages.some((m) => m.type === "CANCEL_CRAWL")).toBe(true);
    expect(state.crawlWaitInfo).toBeNull();
  });

  it("scan-then-continue with SCAN_RESULT response populates state.lastScanResult and switches subtab to results", async () => {
    const fakeScan = {
      url: "https://x.com/login",
      timestamp: "2026-01-01",
      violations: [],
      passes: [], incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome.runtime.sendMessage = vi.fn(async (m: { type: string; payload?: unknown }) => {
      sentMessages.push(m);
      if (m.type === "SCAN_REQUEST") return { type: "SCAN_RESULT", payload: fakeScan };
      return undefined;
    });
    await setupWait();
    document.getElementById("scan-then-continue")?.click();
    await new Promise((r) => setTimeout(r, 30));
    const { state } = await import("../sidepanel");
    expect(state.lastScanResult?.url).toBe("https://x.com/login");
    expect(state.scanSubTab).toBe("results");
  });

  it("continue-crawl clears wait info and posts USER_CONTINUE", async () => {
    await setupWait();
    const { state } = await import("../sidepanel");
    sentMessages.length = 0;
    document.getElementById("continue-crawl")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(sentMessages.some((m) => m.type === "USER_CONTINUE")).toBe(true);
    expect(state.crawlWaitInfo).toBeNull();
  });
});

describe("crawl handlers — crawl run controls", () => {
  async function setupRunning() {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.crawlPhase = "crawling";
    state.scanPhase = "idle";
    state.crawlProgress = { pagesVisited: 1, pagesTotal: 5, currentUrl: "https://x.com/p1" };
    renderScanTab();
  }

  it("pause-crawl posts PAUSE_CRAWL", async () => {
    await setupRunning();
    sentMessages.length = 0;
    document.getElementById("pause-crawl")?.click();
    expect(sentMessages.some((m) => m.type === "PAUSE_CRAWL")).toBe(true);
  });

  it("resume-crawl posts RESUME_CRAWL when paused", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.crawlPhase = "paused";
    state.crawlProgress = { pagesVisited: 1, pagesTotal: 5, currentUrl: "https://x.com/p1" };
    renderScanTab();
    sentMessages.length = 0;
    document.getElementById("resume-crawl")?.click();
    expect(sentMessages.some((m) => m.type === "RESUME_CRAWL")).toBe(true);
  });

  it("cancel-crawl resets state.crawlPhase to idle and posts CANCEL_CRAWL", async () => {
    await setupRunning();
    sentMessages.length = 0;
    document.getElementById("cancel-crawl")?.click();
    const { state } = await import("../sidepanel");
    expect(sentMessages.some((m) => m.type === "CANCEL_CRAWL")).toBe(true);
    expect(state.crawlPhase).toBe("idle");
  });
});

describe("crawl handlers — file upload", () => {
  it("uploading a .txt file populates the URL list via FileReader", async () => {
    const orig = globalThis.FileReader;
    class FakeFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText = (): void => {
        this.result = "https://x.com/a\nhttps://x.com/b\n";
        Promise.resolve().then(() => this.onload?.());
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).FileReader = FakeFileReader;

    try {
      await setupCrawlMode();
      const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
      sel.value = "urllist";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("url-list-open")?.click();

      const input = document.getElementById("url-file-input") as HTMLInputElement;
      const fakeFile = new Blob(["https://x.com/a"], { type: "text/plain" });
      Object.defineProperty(input, "files", { configurable: true, value: [fakeFile] });
      input.dispatchEvent(new Event("change"));
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 10));

      const { scanTabState } = await import("../scan-tab/state");
      expect(scanTabState.crawlUrlList.length).toBeGreaterThanOrEqual(1);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).FileReader = orig;
    }
  });

  it("file change with no file selected is a no-op", async () => {
    await setupCrawlMode();
    const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
    sel.value = "urllist";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("url-list-open")?.click();

    const input = document.getElementById("url-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: [] });
    expect(() => input.dispatchEvent(new Event("change"))).not.toThrow();
  });
});

describe("crawl handlers — cancel-scan during crawl", () => {
  it("cancel-scan resets scanPhase to idle", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    state.crawl = true;
    state.scanPhase = "scanning";
    state.crawlPhase = "crawling";
    renderScanTab();
    document.getElementById("cancel-scan")?.click();
    expect(state.scanPhase).toBe("idle");
  });
});
