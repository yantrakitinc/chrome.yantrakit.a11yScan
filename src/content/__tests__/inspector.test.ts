// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// chrome.runtime.sendMessage is called when the inspector clicks; stub it.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = { runtime: { sendMessage: () => undefined } };
  document.body.innerHTML = "";
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  document.body.innerHTML = "";
});

describe("inspector — enter/exit lifecycle", () => {
  it("enterInspectMode + exitInspectMode are idempotent and don't throw", async () => {
    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    expect(() => enterInspectMode()).not.toThrow();
    expect(() => enterInspectMode()).not.toThrow(); // second call — should be a no-op
    expect(() => exitInspectMode()).not.toThrow();
    expect(() => exitInspectMode()).not.toThrow();
  });

  it("Escape key while inspecting exits inspect mode (no error)", async () => {
    const { enterInspectMode } = await import("../inspector");
    enterInspectMode();
    const evt = new KeyboardEvent("keydown", { key: "Escape" });
    expect(() => document.dispatchEvent(evt)).not.toThrow();
  });
});
