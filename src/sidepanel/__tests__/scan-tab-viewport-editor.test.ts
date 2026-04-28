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
      sendMessage: vi.fn(async (m: { type: string; payload?: unknown }) => { sentMessages.push(m); return undefined; }),
      onMessage: { addListener: vi.fn() },
    },
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

async function setupMvEditor() {
  const { renderScanTab } = await import("../scan-tab");
  const { state } = await import("../sidepanel");
  const { scanTabState } = await import("../scan-tab/state");
  scanTabState.viewportEditing = true;
  state.mv = true;
  state.viewports = [375, 768, 1280];
  state.accordionExpanded = true;
  renderScanTab();
}

describe("viewport editor — vp-edit / vp-done toggle", () => {
  it("vp-edit click flips scanTabState.viewportEditing → true", async () => {
    const { renderScanTab } = await import("../scan-tab");
    const { state } = await import("../sidepanel");
    const { scanTabState } = await import("../scan-tab/state");
    scanTabState.viewportEditing = false;
    state.mv = true;
    state.viewports = [375, 768];
    state.accordionExpanded = true;
    renderScanTab();
    document.getElementById("vp-edit")?.click();
    expect(scanTabState.viewportEditing).toBe(true);
  });

  it("vp-done click flips scanTabState.viewportEditing → false", async () => {
    await setupMvEditor();
    const { scanTabState } = await import("../scan-tab/state");
    document.getElementById("vp-done")?.click();
    expect(scanTabState.viewportEditing).toBe(false);
  });
});

describe("viewport editor — vp-add adds a new viewport at +200px", () => {
  it("clicking vp-add expands the list", async () => {
    await setupMvEditor();
    const { state } = await import("../sidepanel");
    const before = state.viewports.length;
    document.getElementById("vp-add")?.click();
    expect(state.viewports.length).toBe(before + 1);
  });
});

describe("viewport editor — vp-remove removes by index", () => {
  it("clicking the first .vp-remove drops the smallest viewport", async () => {
    await setupMvEditor();
    const { state } = await import("../sidepanel");
    const beforeFirst = state.viewports[0];
    document.querySelector<HTMLButtonElement>(".vp-remove")?.click();
    expect(state.viewports[0]).not.toBe(beforeFirst);
  });
});

describe("viewport editor — vp-input edits a viewport in place", () => {
  it("changing a vp-input value updates state.viewports (sorted + deduped)", async () => {
    await setupMvEditor();
    const { state } = await import("../sidepanel");
    const input = document.querySelector<HTMLInputElement>(".vp-input");
    expect(input).toBeTruthy();
    input!.value = "500";
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    // 500 should now be in the list (replacing the smallest, which was 375)
    expect(state.viewports).toContain(500);
  });

  it("vp-input value below 320 is clamped to 320", async () => {
    await setupMvEditor();
    const { state } = await import("../sidepanel");
    const input = document.querySelector<HTMLInputElement>(".vp-input");
    input!.value = "200";
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(state.viewports).toContain(320);
  });
});
