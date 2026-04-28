// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

let storageData: Record<string, unknown>;
let sessionData: Record<string, unknown>;
let sentMessages: { type: string; payload?: unknown }[];

beforeEach(() => {
  storageData = {};
  sessionData = {};
  sentMessages = [];
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
    <select id="cvd-select"><option value="">None</option><option value="protanopia">Protanopia</option></select>
    <div id="confirm-clear-bar" hidden>
      <button id="confirm-clear-yes"></button>
      <button id="confirm-clear-cancel"></button>
    </div>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => { sentMessages.push(m); return undefined; }),
      onMessage: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: vi.fn((key: any, cb?: (r: any) => void) => {
          const k = typeof key === "string" ? key : Array.isArray(key) ? key[0] : Object.keys(key || {})[0];
          const out = k && k in storageData ? { [k]: storageData[k] } : {};
          if (cb) cb(out);
          return Promise.resolve(out);
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(storageData, obj); }),
        remove: vi.fn(async () => undefined),
      },
      session: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: vi.fn((key: any, cb?: (r: any) => void) => {
          const k = typeof key === "string" ? key : Array.isArray(key) ? key[0] : Object.keys(key || {})[0];
          const out = k && k in sessionData ? { [k]: sessionData[k] } : {};
          if (cb) cb(out);
          return Promise.resolve(out);
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(sessionData, obj); }),
      },
    },
  };
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe("sidepanel — DOMContentLoaded init flow", () => {
  it("DOMContentLoaded runs initTabs/initCvd/initConfirmClearBar/initMessageListener and restores config", async () => {
    storageData["a11yscan_test_config"] = { wcag: { version: "2.1", level: "AA" }, viewports: [320, 768] };
    const { state } = await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    // testConfig was restored
    expect(state.testConfig).toBeTruthy();
    // viewports were synced from testConfig (sorted ascending)
    expect(state.viewports).toEqual([320, 768]);
    // observer is force-disabled by init regardless of stored value
    expect(state.observer).toBe(false);
  });
});

describe("sidepanel — initTabs keyboard navigation", () => {
  it("ArrowRight on the focused tab moves focus to the next enabled tab", async () => {
    await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    const scanTab = document.getElementById("tab-scan") as HTMLButtonElement;
    scanTab.focus();
    scanTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    // Next enabled tab is sr (kb is enabled too — but sr comes first)
    expect(document.activeElement?.id).toBe("tab-sr");
  });

  it("ArrowLeft from the first tab wraps to the last enabled tab", async () => {
    await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    const scanTab = document.getElementById("tab-scan") as HTMLButtonElement;
    scanTab.focus();
    scanTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    // Wraps to last enabled (kb, since ai is disabled)
    expect(document.activeElement?.id).toBe("tab-kb");
  });

  it("Home jumps to the first enabled tab; End jumps to the last", async () => {
    await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    const kbTab = document.getElementById("tab-kb") as HTMLButtonElement;
    kbTab.focus();
    kbTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.activeElement?.id).toBe("tab-scan");
    document.getElementById("tab-scan")?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement?.id).toBe("tab-kb");
  });

  it("clicking a tab calls switchTab and updates state.topTab", async () => {
    const { state } = await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    document.getElementById("tab-sr")?.click();
    expect(state.topTab).toBe("sr");
  });
});

describe("sidepanel — initCvd select dispatches APPLY_CVD_FILTER", () => {
  it("changing the cvd-select value sends APPLY_CVD_FILTER with the matrix", async () => {
    await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    const select = document.getElementById("cvd-select") as HTMLSelectElement;
    select.value = "protanopia";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const msg = sentMessages.find((m) => m.type === "APPLY_CVD_FILTER");
    expect(msg).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((msg!.payload as any).matrix).toBeTruthy();
  });

  it("changing back to '' (none) sends APPLY_CVD_FILTER with matrix=null", async () => {
    await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    const select = document.getElementById("cvd-select") as HTMLSelectElement;
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const msg = sentMessages.find((m) => m.type === "APPLY_CVD_FILTER");
    expect(msg).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((msg!.payload as any).matrix).toBeNull();
  });
});

describe("sidepanel — initConfirmClearBar (Yes / Cancel / Escape)", () => {
  it("Yes hides the bar and broadcasts CLEAR_ALL_CONFIRMED", async () => {
    const { initConfirmClearBar } = await import("../sidepanel");
    initConfirmClearBar();
    const bar = document.getElementById("confirm-clear-bar") as HTMLDivElement;
    bar.hidden = false;
    document.getElementById("confirm-clear-yes")?.click();
    expect(bar.hidden).toBe(true);
    expect(sentMessages.some((m) => m.type === "CLEAR_ALL_CONFIRMED")).toBe(true);
  });

  it("Cancel hides the bar without broadcasting", async () => {
    const { initConfirmClearBar } = await import("../sidepanel");
    initConfirmClearBar();
    const bar = document.getElementById("confirm-clear-bar") as HTMLDivElement;
    bar.hidden = false;
    sentMessages.length = 0;
    document.getElementById("confirm-clear-cancel")?.click();
    expect(bar.hidden).toBe(true);
    expect(sentMessages.some((m) => m.type === "CLEAR_ALL_CONFIRMED")).toBe(false);
  });

  it("Escape on a visible bar hides it", async () => {
    const { initConfirmClearBar } = await import("../sidepanel");
    initConfirmClearBar();
    const bar = document.getElementById("confirm-clear-bar") as HTMLDivElement;
    bar.hidden = false;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(bar.hidden).toBe(true);
  });
});

describe("sidepanel — restoreTopTab from session storage", () => {
  it("when session has a stored top-tab, switchTab is called with that tab", async () => {
    sessionData["a11yscan_top_tab"] = "kb";
    const { state } = await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    expect(state.topTab).toBe("kb");
  });

  it("when session has 'ai' (disabled), defaults to scan tab", async () => {
    sessionData["a11yscan_top_tab"] = "ai";
    const { state } = await import("../sidepanel");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 5));
    expect(state.topTab).not.toBe("ai");
  });
});
