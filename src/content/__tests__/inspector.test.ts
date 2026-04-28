// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { inspectorAccessibleName, inspectorIsFocusable } from "../inspector";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

function elFromHtml(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return doc.body.firstElementChild!.firstElementChild! as HTMLElement;
}

describe("inspectorAccessibleName", () => {
  it("prefers aria-label over title and text content", () => {
    expect(inspectorAccessibleName(elFromHtml('<button aria-label="Close" title="X">×</button>'))).toBe("Close");
  });
  it("falls back to title when no aria-label", () => {
    expect(inspectorAccessibleName(elFromHtml('<button title="Help">?</button>'))).toBe("Help");
  });
  it("falls back to trimmed text content (truncated at 80 chars)", () => {
    const long = "a".repeat(120);
    expect(inspectorAccessibleName(elFromHtml(`<button>${long}</button>`)).length).toBe(80);
  });
  it("returns empty string when nothing available", () => {
    expect(inspectorAccessibleName(elFromHtml('<button></button>'))).toBe("");
  });
  it("trims whitespace from text content", () => {
    expect(inspectorAccessibleName(elFromHtml('<button>  hi  </button>'))).toBe("hi");
  });
});

describe("inspector — mouse-move/click integration via simulated events", () => {
  // Polyfill what jsdom doesn't ship: elementFromPoint, getBoundingClientRect that returns finite rect.
  function setupDomPolyfills(target: Element) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return { top: 10, left: 10, right: 100, bottom: 30, width: 90, height: 20, x: 10, y: 10, toJSON() { return {}; } };
    };
  }

  it("after enterInspectMode, a mousemove + Escape sequence does not throw", async () => {
    const { enterInspectMode } = await import("../inspector");
    document.body.innerHTML = `<button id="b">x</button>`;
    setupDomPolyfills(document.getElementById("b")!);
    enterInspectMode();
    expect(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }).not.toThrow();
  });

  it("clicking within inspect mode broadcasts INSPECT_ELEMENT", async () => {
    const sentMessages: { type: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: (m: { type: string }) => { sentMessages.push(m); } } };
    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    document.body.innerHTML = `<button id="b">x</button>`;
    setupDomPolyfills(document.getElementById("b")!);
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("click", { clientX: 50, clientY: 20, bubbles: true }));
    expect(sentMessages.some((m) => m.type === "INSPECT_ELEMENT")).toBe(true);
    exitInspectMode();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });
});

describe("inspectorIsFocusable", () => {
  it("returns true for native focusable tags (a/button/input/select/textarea)", () => {
    expect(inspectorIsFocusable(elFromHtml('<a href="#">x</a>'))).toBe(true);
    expect(inspectorIsFocusable(elFromHtml('<button>x</button>'))).toBe(true);
    expect(inspectorIsFocusable(elFromHtml('<input/>'))).toBe(true);
    expect(inspectorIsFocusable(elFromHtml('<select></select>'))).toBe(true);
    expect(inspectorIsFocusable(elFromHtml('<textarea></textarea>'))).toBe(true);
  });
  it("returns false for native focusable tag with disabled attribute", () => {
    expect(inspectorIsFocusable(elFromHtml('<button disabled>x</button>'))).toBe(false);
  });
  it("returns true for any element with tabindex=0", () => {
    expect(inspectorIsFocusable(elFromHtml('<div tabindex="0">x</div>'))).toBe(true);
  });
  it("returns false for div without tabindex", () => {
    expect(inspectorIsFocusable(elFromHtml('<div>x</div>'))).toBe(false);
  });
  it("returns false for tabindex=-1", () => {
    expect(inspectorIsFocusable(elFromHtml('<div tabindex="-1">x</div>'))).toBe(false);
  });
});

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

describe("inspector — tooltip rendering branches", () => {
  // Drive each tooltip branch by varying target geometry + element attributes.
  // Each branch is reached by mocking getBoundingClientRect to position the
  // target where only one of the 4 placement strategies (above/below/right/left)
  // satisfies the viewport constraints.
  function setupChromeStub(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: () => undefined } };
  }

  it("tooltip renders ARIA-attributes block when target has aria-* attrs", async () => {
    setupChromeStub();
    document.body.innerHTML = `<button id="b" aria-label="Close" aria-pressed="true">x</button>`;
    const target = document.getElementById("b")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 300, left: 100, right: 200, bottom: 320, width: 100, height: 20, x: 100, y: 300, toJSON() { return {}; } });
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 310, bubbles: true }));
    const tooltip = document.body.querySelector("div[style*='font-size:11px'][style*='color:#8888aa']");
    expect(tooltip).toBeTruthy();
    expect(document.body.innerHTML).toMatch(/ARIA/);
    expect(document.body.innerHTML).toMatch(/aria-label/);
    expect(document.body.innerHTML).toMatch(/aria-pressed/);
    exitInspectMode();
  });

  it("tooltip renders '<none>' fallback when accessibleName is empty", async () => {
    setupChromeStub();
    document.body.innerHTML = `<div id="d" tabindex="0"></div>`;
    const target = document.getElementById("d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 300, left: 100, right: 200, bottom: 320, width: 100, height: 20, x: 100, y: 300, toJSON() { return {}; } });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 310, bubbles: true }));
    expect(document.body.innerHTML).toMatch(/&lt;none&gt;/);
    exitInspectMode();
  });

  it("tooltip renders 'tabindex' line when target has explicit tabindex", async () => {
    setupChromeStub();
    document.body.innerHTML = `<div id="d" tabindex="3" aria-label="x"></div>`;
    const target = document.getElementById("d")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 300, left: 100, right: 200, bottom: 320, width: 100, height: 20, x: 100, y: 300, toJSON() { return {}; } });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 310, bubbles: true }));
    expect(document.body.innerHTML).toMatch(/tabindex: 3/);
    exitInspectMode();
  });

  it("tooltip placement falls through to below when above doesn't fit", async () => {
    setupChromeStub();
    document.body.innerHTML = `<button id="b" aria-label="x">x</button>`;
    const target = document.getElementById("b")!;
    // Top-of-viewport target — above won't fit (rect.top - tooltipHeight - margin < margin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 5, left: 10, right: 100, bottom: 25, width: 90, height: 20, x: 10, y: 5, toJSON() { return {}; } });
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 20, bubbles: true }));
    const tooltip = document.querySelector("body > div:last-child") as HTMLDivElement;
    expect(tooltip).toBeTruthy();
    // After top branch: top should be rect.bottom + 8 = 33px
    const topPx = parseInt(tooltip.style.top);
    expect(topPx).toBeGreaterThan(8); // not clamped to margin (which would mean the 'above' branch fired)
    exitInspectMode();
  });
});
