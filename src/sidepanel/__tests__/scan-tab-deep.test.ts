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
