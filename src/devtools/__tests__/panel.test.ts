// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, loadData } from "../panel";
import type { iPanelData } from "../panel";

beforeEach(() => {
  document.body.innerHTML = `<div id="content"></div><div id="status"></div>`;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("devtools/panel — render", () => {
  it("renders error state when data.error is set", () => {
    render({
      selector: "", role: "", accessibleName: "", ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
      error: "Could not inspect element.",
    });
    const content = document.getElementById("content")!;
    expect(content.innerHTML).toMatch(/Could not inspect element/);
    expect(content.innerHTML).toMatch(/color:#b91c1c/);
  });

  it("renders selector / role / accessibleName / tabindex / focusable", () => {
    const data: iPanelData = {
      selector: "#submit",
      role: "button",
      accessibleName: "Submit",
      ariaAttributes: {},
      tabindex: 0,
      isFocusable: true,
      violations: [],
    };
    render(data);
    const html = document.getElementById("content")!.innerHTML;
    expect(html).toMatch(/#submit/);
    expect(html).toMatch(/button/);
    expect(html).toMatch(/Submit/);
    expect(html).toMatch(/focusable-yes/);
    // tabindex: 0 should display the value
    expect(html).toMatch(/Tabindex/);
  });

  it("renders '<none>' when accessibleName is empty", () => {
    render({
      selector: "div", role: "div", accessibleName: "",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    });
    expect(document.getElementById("content")!.innerHTML).toMatch(/<none>/);
  });

  it("renders '—' when tabindex is null", () => {
    render({
      selector: "p", role: "paragraph", accessibleName: "x",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    });
    expect(document.getElementById("content")!.innerHTML).toMatch(/—/);
  });

  it("renders 'Not focusable' for isFocusable=false (focusable-no class)", () => {
    render({
      selector: "p", role: "paragraph", accessibleName: "x",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    });
    const html = document.getElementById("content")!.innerHTML;
    expect(html).toMatch(/focusable-no/);
    expect(html).toMatch(/Not focusable/);
  });

  it("renders ARIA attributes block when ariaAttributes has entries", () => {
    render({
      selector: "#x", role: "button", accessibleName: "Close",
      ariaAttributes: { "aria-label": "Close", "aria-pressed": "true" },
      tabindex: 0, isFocusable: true, violations: [],
    });
    const html = document.getElementById("content")!.innerHTML;
    expect(html).toMatch(/aria-label="Close"/);
    expect(html).toMatch(/aria-pressed="true"/);
    expect(html).toMatch(/ARIA Attributes/);
  });

  it("does NOT render ARIA Attributes section when ariaAttributes is empty", () => {
    render({
      selector: "div", role: "div", accessibleName: "x",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    });
    expect(document.getElementById("content")!.innerHTML).not.toMatch(/ARIA Attributes/);
  });

  it("renders 'No violations found' when violations array is empty", () => {
    render({
      selector: "#x", role: "button", accessibleName: "Submit",
      ariaAttributes: {}, tabindex: 0, isFocusable: true, violations: [],
    });
    expect(document.getElementById("content")!.innerHTML).toMatch(/No violations found/);
  });

  it("renders one violation row per entry with rule + impact + message", () => {
    render({
      selector: "#x", role: "button", accessibleName: "Submit",
      ariaAttributes: {}, tabindex: 0, isFocusable: true,
      violations: [
        { ruleId: "color-contrast", impact: "serious", message: "Background and text contrast 1.5:1" },
        { ruleId: "image-alt", impact: "critical", message: "" },
      ],
    });
    const html = document.getElementById("content")!.innerHTML;
    expect(html).toMatch(/color-contrast/);
    expect(html).toMatch(/\[serious\]/);
    expect(html).toMatch(/Background and text contrast 1\.5:1/);
    expect(html).toMatch(/image-alt/);
    expect(html).toMatch(/\[critical\]/);
    // Header includes count
    expect(html).toMatch(/Violations \(2\)/);
  });

  it("renders Refresh button and clicking it calls chrome.devtools.inspectedWindow.eval", () => {
    const evalMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      devtools: { inspectedWindow: { eval: evalMock } },
    };

    render({
      selector: "#x", role: "button", accessibleName: "x",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    });
    const btn = document.getElementById("btn-refresh") as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    btn!.click();
    expect(evalMock).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("returns silently when #content element is missing", () => {
    document.body.innerHTML = ""; // strip
    expect(() => render({
      selector: "x", role: "x", accessibleName: "x",
      ariaAttributes: {}, tabindex: null, isFocusable: false, violations: [],
    })).not.toThrow();
  });
});

describe("devtools/panel — loadData", () => {
  it("sets statusEl text to 'Loading…' and calls chrome.devtools.inspectedWindow.eval", () => {
    let capturedExpression = "";
    type EvalCallback = (result: iPanelData | null, exception: { isException: boolean }) => void;
    let capturedCallback: EvalCallback | null = null;
    const evalMock = vi.fn((expr: string, cb: EvalCallback) => {
      capturedExpression = expr;
      capturedCallback = cb;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { devtools: { inspectedWindow: { eval: evalMock } } };

    loadData();

    expect(document.getElementById("status")!.textContent).toBe("Loading…");
    expect(evalMock).toHaveBeenCalled();
    // The expression evaluates `$0` (DevTools selected element)
    expect(capturedExpression).toMatch(/\$0/);
    expect(capturedExpression).toMatch(/__a11yScanViolations/);

    // Drive the success callback
    capturedCallback!({
      selector: "#x", role: "button", accessibleName: "y",
      ariaAttributes: {}, tabindex: null, isFocusable: true, violations: [],
    }, { isException: false });
    expect(document.getElementById("status")!.textContent).toBe("");
    expect(document.getElementById("content")!.innerHTML).toMatch(/#x/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("renders error state when chrome.devtools.inspectedWindow.eval reports isException", () => {
    type EvalCallback = (result: iPanelData | null, exception: { isException: boolean }) => void;
    let capturedCallback: EvalCallback | null = null;
    const evalMock = vi.fn((_expr: string, cb: EvalCallback) => {
      capturedCallback = cb;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { devtools: { inspectedWindow: { eval: evalMock } } };

    loadData();
    capturedCallback!(null, { isException: true });
    expect(document.getElementById("content")!.innerHTML).toMatch(/Could not inspect element/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("renders error state when result is null/undefined", () => {
    type EvalCallback = (result: iPanelData | null, exception: { isException: boolean }) => void;
    let capturedCallback: EvalCallback | null = null;
    const evalMock = vi.fn((_expr: string, cb: EvalCallback) => {
      capturedCallback = cb;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { devtools: { inspectedWindow: { eval: evalMock } } };

    loadData();
    capturedCallback!(null, { isException: false });
    expect(document.getElementById("content")!.innerHTML).toMatch(/Could not inspect element/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("does not throw when #status is missing", () => {
    document.body.innerHTML = `<div id="content"></div>`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { devtools: { inspectedWindow: { eval: vi.fn() } } };
    expect(() => loadData()).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });
});
