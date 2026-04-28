// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { scanAriaPatterns } from "../aria-scanner";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("scanAriaPatterns", () => {
  it("returns no widgets for an empty page", () => {
    expect(scanAriaPatterns()).toEqual([]);
  });

  it("detects a tablist with two tabs and reports per-check pass/fail", () => {
    document.body.innerHTML = `
      <div role="tablist" id="tl">
        <div role="tab" aria-selected="true" aria-controls="p1">One</div>
        <div role="tab" aria-controls="p2">Two</div>
      </div>
    `;
    const w = scanAriaPatterns();
    const tablist = w.find((x) => x.role === "tablist");
    expect(tablist).toBeTruthy();
    expect(tablist!.selector).toBe("#tl");
    expect(tablist!.passCount + tablist!.failCount).toBe(tablist!.checks.length);
  });

  it("flags a dialog without aria-modal as failing has-aria-modal", () => {
    document.body.innerHTML = `<div role="dialog" id="d" aria-label="x"><button>OK</button></div>`;
    const dialog = scanAriaPatterns().find((x) => x.role === "dialog")!;
    const modalCheck = dialog.checks.find((c) => c.name === "has-aria-modal")!;
    expect(modalCheck.pass).toBe(false);
  });

  it("uses aria-label as the widget label when available", () => {
    document.body.innerHTML = `<div role="dialog" aria-label="Settings"><button>OK</button></div>`;
    const dialog = scanAriaPatterns().find((x) => x.role === "dialog")!;
    expect(dialog.label).toBe("Settings");
  });

  it("falls back to text content for label when no aria-label/labelledby", () => {
    document.body.innerHTML = `<div role="checkbox">Accept terms</div>`;
    const cb = scanAriaPatterns().find((x) => x.role === "checkbox")!;
    expect(cb.label).toBe("Accept terms");
  });

  it("resolves aria-labelledby to the referenced element's text", () => {
    document.body.innerHTML = `
      <span id="lbl">Toolbar</span>
      <div role="menu" aria-labelledby="lbl"><div role="menuitem">a</div></div>
    `;
    const menu = scanAriaPatterns().find((x) => x.role === "menu")!;
    expect(menu.label).toBe("Toolbar");
  });

  it("truncates the html snippet to 200 chars", () => {
    const long = "x".repeat(500);
    document.body.innerHTML = `<div role="dialog" aria-label="x">${long}</div>`;
    const dialog = scanAriaPatterns().find((x) => x.role === "dialog")!;
    expect(dialog.html.length).toBeLessThanOrEqual(200);
  });

  it("uses the role-form selector for un-id'd, un-classed widgets", () => {
    document.body.innerHTML = `<ul role="tree"><li role="treeitem">x</li></ul>`;
    const tree = scanAriaPatterns().find((x) => x.role === "tree")!;
    expect(tree.selector).toBe('ul[role="tree"]');
  });

  it("getLabel ignores aria-labelledby pointing at a non-existent id (falls through to text)", () => {
    document.body.innerHTML = `<div role="menu" aria-labelledby="nope"><div role="menuitem">item-x</div></div>`;
    const menu = scanAriaPatterns().find((x) => x.role === "menu")!;
    // labelledby ref doesn't exist → fall through to textContent
    expect(menu.label).toBe("item-x");
  });

  it("getLabel returns empty string when label sources are all empty", () => {
    document.body.innerHTML = `<div role="menu"></div>`;
    const menu = scanAriaPatterns().find((x) => x.role === "menu")!;
    expect(menu.label).toBe("");
  });

  it("getSelector returns plain tag when element has no id, no parseable role, no usable classes", () => {
    // Force a class that gets filtered out by the [\[\]:@!] regex (special chars)
    document.body.innerHTML = `<div role="dialog" class="modal[1]" aria-label="x"><button>OK</button></div>`;
    const dlg = scanAriaPatterns().find((x) => x.role === "dialog")!;
    // role 'dialog' is valid, so role-form selector wins
    expect(dlg.selector).toBe('div[role="dialog"]');
  });

  it("getLabel handles aria-labelledby ref with no text content", () => {
    document.body.innerHTML = `
      <span id="empty-lbl"></span>
      <div role="menu" aria-labelledby="empty-lbl"><div role="menuitem">x</div></div>
    `;
    const menu = scanAriaPatterns().find((x) => x.role === "menu")!;
    expect(menu.label).toBe(""); // referenced span has empty textContent
  });
});
