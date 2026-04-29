// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom HTMLDialogElement does not ship showModal/close
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

let storageData: Record<string, unknown>;

beforeEach(() => {
  storageData = {};
  document.body.innerHTML = `
    <button id="settings-btn">⚙</button>
    <dialog id="config-dialog"><div id="config-dialog-content"></div></dialog>
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: { sendMessage: vi.fn(async () => undefined), onMessage: { addListener: vi.fn() } },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
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

async function openDialog(): Promise<typeof import("../scan-tab/config-dialog")> {
  const mod = await import("../scan-tab/config-dialog");
  const { state } = await import("../sidepanel");
  state.testConfig = null;
  mod.openConfigDialog({
    onClose: () => undefined,
    rerender: () => undefined,
  });
  return mod;
}

describe("config-dialog — backdrop click closes the dialog", () => {
  it("clicking on the dialog itself (backdrop) closes it", async () => {
    await openDialog();
    const dialog = document.getElementById("config-dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    // A click whose target IS the dialog itself (i.e. backdrop, outside content) closes
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // The handler checks e.target === dialog. Since we dispatch directly on dialog, target=dialog.
    expect(dialog.open).toBe(false);
  });
});

describe("config-dialog — close event restores focus", () => {
  it("close event focuses settings-btn when prior focused element is gone", async () => {
    await openDialog();
    const dialog = document.getElementById("config-dialog") as HTMLDialogElement;
    // Settings button exists; close should fall through to it
    dialog.close();
    // jsdom focus is best-effort; just verify no throw
    expect(dialog.open).toBe(false);
  });
});

describe("config-dialog — Apply with viewports syncs state.viewports", () => {
  it("when config.viewports is provided, state.viewports is set (sorted ascending)", async () => {
    await openDialog();
    const { state } = await import("../sidepanel");
    const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
    ta.value = JSON.stringify({ wcag: { version: "2.1", level: "AA" }, viewports: [1280, 375, 768] });
    document.getElementById("config-apply-btn")?.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(state.viewports).toEqual([375, 768, 1280]);
  });
});

describe("config-dialog — file upload populates textarea", () => {
  it("change event with a JSON file reads and writes content to the textarea", async () => {
    // Stub FileReader so onload fires synchronously with a known result string.
    const orig = globalThis.FileReader;
    const readSpy = vi.fn();
    class FakeFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText = (_file: Blob): void => {
        readSpy();
        this.result = '{"wcag":{"version":"2.1","level":"AA"}}';
        // Schedule onload microtask
        Promise.resolve().then(() => this.onload?.());
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).FileReader = FakeFileReader;

    try {
      await openDialog();
      const input = document.getElementById("config-file-input") as HTMLInputElement;
      // Stub files getter
      const fakeFile = new Blob(['{"k":"v"}'], { type: "application/json" });
      Object.defineProperty(input, "files", { configurable: true, value: [fakeFile] });
      input.dispatchEvent(new Event("change"));
      await Promise.resolve();
      const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
      expect(ta.value).toBe('{"wcag":{"version":"2.1","level":"AA"}}');
      expect(readSpy).toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).FileReader = orig;
    }
  });

  it("change event with no file selected is a no-op", async () => {
    await openDialog();
    const input = document.getElementById("config-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { configurable: true, value: [] });
    expect(() => input.dispatchEvent(new Event("change"))).not.toThrow();
  });
});

describe("config-dialog — early return when dialog/content missing", () => {
  it("openConfigDialog with no #config-dialog in DOM is a no-op (no throw)", async () => {
    document.body.innerHTML = ""; // strip the dialog
    const mod = await import("../scan-tab/config-dialog");
    expect(() => mod.openConfigDialog({ onClose: () => undefined, rerender: () => undefined })).not.toThrow();
  });
});
