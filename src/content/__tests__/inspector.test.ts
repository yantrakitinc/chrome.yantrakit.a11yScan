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

  it("tooltip placement falls through to right when above + below both don't fit", async () => {
    setupChromeStub();
    document.body.innerHTML = `<button id="b" aria-label="x">x</button>`;
    const target = document.getElementById("b")!;
    // Tall element — above doesn't fit (top too small) AND below doesn't fit (bottom too close to vh).
    // But the right side has room.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 400, writable: true, configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 10, right: 50, bottom: 350, width: 40, height: 250, x: 10, y: 100, toJSON() { return {}; } });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 30, clientY: 200, bubbles: true }));
    const tooltip = document.querySelector("body > div:last-child") as HTMLDivElement;
    expect(tooltip).toBeTruthy();
    // Right placement: left = rect.right + MARGIN = 58
    const leftPx = parseInt(tooltip.style.left);
    expect(leftPx).toBeGreaterThanOrEqual(58 - 1);
    exitInspectMode();
  });

  it("tooltip placement falls through to left when above + below + right don't fit", async () => {
    setupChromeStub();
    document.body.innerHTML = `<button id="b" aria-label="x">x</button>`;
    const target = document.getElementById("b")!;
    // Element jammed against the right edge of a narrow viewport.
    Object.defineProperty(window, "innerWidth", { value: 400, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 400, writable: true, configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 350, right: 390, bottom: 350, width: 40, height: 250, x: 350, y: 100, toJSON() { return {}; } });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 370, clientY: 200, bubbles: true }));
    const tooltip = document.querySelector("body > div:last-child") as HTMLDivElement;
    expect(tooltip).toBeTruthy();
    // Left placement falls through; left clamped to MARGIN minimum
    expect(parseInt(tooltip.style.left)).toBeGreaterThanOrEqual(8);
    exitInspectMode();
  });
});

describe("inspector — pin/unpin click behavior", () => {
  it("clicking the same element twice pins then unpins (tooltip removed)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: () => undefined } };
    document.body.innerHTML = `<button id="b" aria-label="x">x</button>`;
    const target = document.getElementById("b")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 100, right: 200, bottom: 130, width: 100, height: 30, x: 100, y: 100, toJSON() { return {}; } });
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();

    // First mousemove + click → pinned
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 110, bubbles: true }));
    document.dispatchEvent(new MouseEvent("click", { clientX: 110, clientY: 110, bubbles: true, cancelable: true }));
    let tooltip = document.querySelector("body > div:last-child") as HTMLDivElement;
    expect(tooltip).toBeTruthy();

    // Second click on same target → unpin → removeTooltip
    document.dispatchEvent(new MouseEvent("click", { clientX: 110, clientY: 110, bubbles: true, cancelable: true }));
    // After unpin: no tooltip <div> remains in body (only the button)
    const remainingDivs = document.body.querySelectorAll("div");
    expect(remainingDivs.length).toBe(0);

    exitInspectMode();
  });

  it("when pinned, mousemove on a different element doesn't change the tooltip", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: () => undefined } };
    document.body.innerHTML = `<button id="b" aria-label="b">b</button><button id="c" aria-label="c">c</button>`;
    const a = document.getElementById("b")!;
    const c = document.getElementById("c")!;
    // First, point at b
    let returnElement: Element = a;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => returnElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 100, right: 200, bottom: 130, width: 100, height: 30, x: 100, y: 100, toJSON() { return {}; } });
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 110, bubbles: true }));
    document.dispatchEvent(new MouseEvent("click", { clientX: 110, clientY: 110, bubbles: true, cancelable: true }));
    // Now move to c
    returnElement = c;
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 110, clientY: 110, bubbles: true }));
    // Tooltip's data should still reflect b's aria-label (since pinned)
    expect(document.body.innerHTML).toMatch(/aria-label[^=]*=[^"]*"b"/);

    exitInspectMode();
  });
});

describe("inspector — sendMessage failure swallowed", () => {
  it("when chrome.runtime.sendMessage throws on click, inspect mode keeps working", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: () => { throw new Error("sidepanel closed"); } } };
    document.body.innerHTML = `<button id="b">x</button>`;
    const target = document.getElementById("b")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 100, right: 200, bottom: 130, width: 100, height: 30, x: 100, y: 100, toJSON() { return {}; } });

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    expect(() => {
      document.dispatchEvent(new MouseEvent("click", { clientX: 110, clientY: 110, bubbles: true, cancelable: true }));
    }).not.toThrow();
    exitInspectMode();
  });
});

describe("inspector — collectInspectorData violation matching", () => {
  it("includes matching violations when scan results have a node selector matching the target", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: () => undefined } };
    const { setLastScanViolations } = await import("../scan-state");
    setLastScanViolations([
      {
        id: "color-contrast",
        impact: "serious",
        description: "x", help: "x", helpUrl: "", tags: [],
        nodes: [{ selector: "#b", html: "x", failureSummary: "Background and foreground colors have a contrast ratio of 1.5" }],
      },
    ]);
    document.body.innerHTML = `<button id="b" aria-label="x">x</button>`;
    const target = document.getElementById("b")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).elementFromPoint = () => target;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = () => ({ top: 100, left: 100, right: 200, bottom: 130, width: 100, height: 30, x: 100, y: 100, toJSON() { return {}; } });
    Object.defineProperty(window, "innerWidth", { value: 1280, writable: true, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true });

    const sentMessages: { type: string; payload?: { violations?: unknown[] } }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: (m: { type: string; payload?: { violations?: unknown[] } }) => { sentMessages.push(m); } } };

    const { enterInspectMode, exitInspectMode } = await import("../inspector");
    enterInspectMode();
    document.dispatchEvent(new MouseEvent("click", { clientX: 110, clientY: 110, bubbles: true, cancelable: true }));
    const inspectMsg = sentMessages.find((m) => m.type === "INSPECT_ELEMENT");
    expect(inspectMsg?.payload?.violations?.length).toBe(1);

    setLastScanViolations([]);
    exitInspectMode();
  });
});
