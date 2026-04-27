// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getTabOrder, getFocusGaps, detectSkipLinks } from "../tab-order";

// jsdom lacks CSS.escape — needed by buildElementSelector inside getTabOrder.
if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("getTabOrder", () => {
  it("returns focusable elements in DOM order with sequential indexes", () => {
    document.body.innerHTML = `
      <button id="b1">one</button>
      <a href="#" id="a1">two</a>
      <input id="i1" />
    `;
    const order = getTabOrder();
    expect(order.map((o) => o.index)).toEqual([1, 2, 3]);
    expect(order.map((o) => o.selector)).toEqual(["#b1", "#a1", "#i1"]);
  });

  it("ignores disabled buttons", () => {
    document.body.innerHTML = `<button id="b1">one</button><button id="b2" disabled>two</button>`;
    expect(getTabOrder().map((o) => o.selector)).toEqual(["#b1"]);
  });

  it("ignores hidden inputs", () => {
    document.body.innerHTML = `<input id="i1" /><input type="hidden" id="i2" />`;
    expect(getTabOrder().map((o) => o.selector)).toEqual(["#i1"]);
  });

  it("respects positive tabindex ordering", () => {
    document.body.innerHTML = `
      <button id="b3" tabindex="3">three</button>
      <button id="b1" tabindex="1">one</button>
      <button id="b2" tabindex="2">two</button>
      <button id="b0">natural</button>
    `;
    const order = getTabOrder();
    // positive tabindex goes first ascending, then natural DOM order
    expect(order.map((o) => o.selector)).toEqual(["#b1", "#b2", "#b3", "#b0"]);
  });

  it("excludes elements with tabindex=-1", () => {
    document.body.innerHTML = `<button id="b1">one</button><button id="b2" tabindex="-1">skip</button>`;
    expect(getTabOrder().map((o) => o.selector)).toEqual(["#b1"]);
  });

  it("captures aria-label as the accessible name", () => {
    document.body.innerHTML = `<button id="b1" aria-label="Close dialog">×</button>`;
    expect(getTabOrder()[0].accessibleName).toBe("Close dialog");
  });

  it("falls back to text content when no aria-label", () => {
    document.body.innerHTML = `<button id="b1">Submit</button>`;
    expect(getTabOrder()[0].accessibleName).toBe("Submit");
  });
});

describe("getFocusGaps", () => {
  it("flags a div with role=button but no tabindex as a focus gap", () => {
    document.body.innerHTML = `<div role="button" id="fake">click me</div>`;
    const gaps = getFocusGaps();
    expect(gaps.length).toBe(1);
    expect(gaps[0].selector).toBe("#fake");
  });

  it("does not flag a real button as a focus gap", () => {
    document.body.innerHTML = `<button id="b1">click</button>`;
    expect(getFocusGaps()).toEqual([]);
  });

  it("flags a disabled button with the disabled reason", () => {
    document.body.innerHTML = `<button id="b1" disabled>x</button>`;
    const gaps = getFocusGaps();
    expect(gaps.length).toBe(1);
    expect(gaps[0].reason).toMatch(/disabled/i);
  });

  it("flags a tabindex=-1 element with the tabindex reason", () => {
    document.body.innerHTML = `<a href="#" id="a1" tabindex="-1">x</a>`;
    const gaps = getFocusGaps();
    expect(gaps.length).toBe(1);
    expect(gaps[0].reason).toMatch(/tabindex/i);
  });
});

describe("detectSkipLinks", () => {
  it("finds a 'skip to content' anchor pointing at an existing target", () => {
    document.body.innerHTML = `
      <a href="#main" id="skip">Skip to main content</a>
      <main id="main">…</main>
    `;
    const links = detectSkipLinks();
    expect(links.length).toBe(1);
    expect(links[0].target).toBe("#main");
    expect(links[0].targetExists).toBe(true);
  });

  it("flags a skip link whose target id doesn't exist", () => {
    document.body.innerHTML = `<a href="#missing" id="skip">Skip to nowhere</a>`;
    const links = detectSkipLinks();
    expect(links.length).toBe(1);
    expect(links[0].targetExists).toBe(false);
  });

  it("ignores ordinary anchor links without skip-pattern text", () => {
    document.body.innerHTML = `<a href="#section">Read section</a>`;
    expect(detectSkipLinks()).toEqual([]);
  });

  it("recognises 'jump to' phrasing", () => {
    document.body.innerHTML = `<a href="#main" id="j">Jump to main</a><main id="main"></main>`;
    expect(detectSkipLinks().length).toBe(1);
  });

  it("uses aria-label when text content lacks the skip phrase", () => {
    document.body.innerHTML = `<a href="#main" aria-label="Skip nav"><span aria-hidden="true">→</span></a><main id="main"></main>`;
    expect(detectSkipLinks().length).toBe(1);
  });
});
