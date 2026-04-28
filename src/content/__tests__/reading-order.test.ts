// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { analyzeReadingOrder } from "../reading-order";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("analyzeReadingOrder — DOM walk", () => {
  it("returns empty for an empty document body", () => {
    expect(analyzeReadingOrder()).toEqual([]);
  });

  it("walks elements in document order", () => {
    document.body.innerHTML = `
      <h1>Title</h1>
      <p>First paragraph.</p>
      <a href="#">A link</a>
    `;
    const items = analyzeReadingOrder();
    const roles = items.map((i) => i.role);
    expect(roles[0]).toBe("heading");
    expect(items.find((i) => i.role === "link")).toBeTruthy();
  });

  it("assigns sequential indexes starting at 1", () => {
    document.body.innerHTML = `<h1>A</h1><h2>B</h2><h3>C</h3>`;
    const items = analyzeReadingOrder();
    expect(items.map((i) => i.index)).toEqual([1, 2, 3]);
  });

  it("captures heading levels for h1–h6", () => {
    document.body.innerHTML = `<h1>A</h1><h3>B</h3><h6>C</h6>`;
    const items = analyzeReadingOrder().filter((i) => i.role === "heading");
    expect(items.map((i) => i.level)).toEqual([1, 3, 6]);
  });

  it("captures aria-level for non-heading-tag headings", () => {
    document.body.innerHTML = `<div role="heading" aria-level="4">x</div>`;
    const items = analyzeReadingOrder();
    const heading = items.find((i) => i.role === "heading");
    expect(heading?.level).toBe(4);
  });
});

describe("analyzeReadingOrder — accessible-name resolution", () => {
  it("uses aria-label as the name with source aria-label", () => {
    document.body.innerHTML = `<button aria-label="Close">×</button>`;
    const btn = analyzeReadingOrder().find((i) => i.role === "button")!;
    expect(btn.accessibleName).toBe("Close");
    expect(btn.nameSource).toBe("aria-label");
  });

  it("resolves aria-labelledby to the referenced element's text", () => {
    document.body.innerHTML = `<span id="t">Label</span><button aria-labelledby="t"></button>`;
    const btn = analyzeReadingOrder().find((i) => i.role === "button")!;
    expect(btn.accessibleName).toBe("Label");
    expect(btn.nameSource).toBe("aria-labelledby");
  });

  it("uses alt for images", () => {
    document.body.innerHTML = `<img src="x" alt="Logo" />`;
    const img = analyzeReadingOrder().find((i) => i.role === "img")!;
    expect(img.accessibleName).toBe("Logo");
    expect(img.nameSource).toBe("alt");
  });

  it("uses <label for> for inputs", () => {
    document.body.innerHTML = `<label for="email">Email</label><input id="email" type="email" />`;
    const input = analyzeReadingOrder().find((i) => i.role === "textbox" && (i as { selector: string }).selector.includes("email"));
    expect(input?.accessibleName).toBe("Email");
    expect(input?.nameSource).toBe("label");
  });

  it("falls back to text content with source 'contents'", () => {
    document.body.innerHTML = `<button>Submit</button>`;
    const btn = analyzeReadingOrder().find((i) => i.role === "button")!;
    expect(btn.accessibleName).toBe("Submit");
    expect(btn.nameSource).toBe("contents");
  });

  it("uses .sr-only descendant text when present", () => {
    document.body.innerHTML = `<a href="#"><span class="sr-only">Skip link</span><svg aria-hidden="true"></svg></a>`;
    const link = analyzeReadingOrder().find((i) => i.role === "link")!;
    expect(link.accessibleName).toBe("Skip link");
    expect(link.nameSource).toBe("sr-only");
  });

  it("CSS.escape's input ids when matching label[for]", () => {
    document.body.innerHTML = `<label for="user.email">Email</label><input id="user.email" type="email" />`;
    const input = analyzeReadingOrder().find((i) => i.role === "textbox");
    expect(input?.accessibleName).toBe("Email");
  });
});

describe("analyzeReadingOrder — states", () => {
  it("reports expanded/collapsed from aria-expanded", () => {
    document.body.innerHTML = `<button aria-expanded="true">x</button>`;
    expect(analyzeReadingOrder()[0].states).toContain("expanded");
    document.body.innerHTML = `<button aria-expanded="false">x</button>`;
    expect(analyzeReadingOrder()[0].states).toContain("collapsed");
  });

  it("reports checked / selected / pressed", () => {
    document.body.innerHTML = `
      <div role="checkbox" aria-checked="true">a</div>
      <div role="tab" aria-selected="true">b</div>
      <button aria-pressed="true">c</button>
    `;
    const out = analyzeReadingOrder();
    const allStates = out.flatMap((i) => i.states);
    expect(allStates).toContain("checked");
    expect(allStates).toContain("selected");
    expect(allStates).toContain("pressed");
  });

  it("reports required for required inputs (HTML attr or aria-required)", () => {
    document.body.innerHTML = `<input required /><input aria-required="true" />`;
    const inputs = analyzeReadingOrder();
    expect(inputs.every((i) => i.states.includes("required"))).toBe(true);
  });

  it("reports disabled for disabled or aria-disabled elements", () => {
    document.body.innerHTML = `<button disabled>x</button><button aria-disabled="true">y</button>`;
    const btns = analyzeReadingOrder();
    expect(btns.every((b) => b.states.includes("disabled"))).toBe(true);
  });
});

describe("analyzeReadingOrder — scope and visibility", () => {
  it("scopes to a subtree when scopeSelector is provided", () => {
    document.body.innerHTML = `
      <div id="a"><h1>Outside</h1></div>
      <div id="b"><h1>Inside</h1></div>
    `;
    const out = analyzeReadingOrder("#b");
    expect(out.length).toBe(1);
    expect(out[0].accessibleName).toBe("Inside");
  });

  it("returns empty when scopeSelector matches nothing", () => {
    document.body.innerHTML = `<h1>x</h1>`;
    expect(analyzeReadingOrder("#missing")).toEqual([]);
  });

  it("skips an aria-hidden subtree", () => {
    document.body.innerHTML = `
      <h1>Visible</h1>
      <div aria-hidden="true"><h2>Hidden</h2></div>
    `;
    const items = analyzeReadingOrder();
    expect(items.find((i) => i.accessibleName === "Hidden")).toBeUndefined();
    expect(items.find((i) => i.accessibleName === "Visible")).toBeTruthy();
  });

  it("skips an element whose computed display is 'none'", () => {
    document.body.innerHTML = `
      <h1>Visible</h1>
      <div style="display:none"><h2>Gone</h2></div>
    `;
    const items = analyzeReadingOrder();
    expect(items.find((i) => i.accessibleName === "Gone")).toBeUndefined();
    expect(items.find((i) => i.accessibleName === "Visible")).toBeTruthy();
  });

  it("skips an element whose computed visibility is 'hidden'", () => {
    document.body.innerHTML = `
      <h1>Visible</h1>
      <div style="visibility:hidden"><h2>Gone</h2></div>
    `;
    const items = analyzeReadingOrder();
    expect(items.find((i) => i.accessibleName === "Gone")).toBeUndefined();
  });
});

describe("analyzeReadingOrder — aria-owns reordering", () => {
  it("appends aria-owns referenced elements after natural children in walk order", () => {
    // The container owns #b1 (a button declared elsewhere); the button should
    // appear in the result even though it is not a child of the container, AND
    // it should walk after the natural children.
    document.body.innerHTML = `
      <div id="container" aria-owns="owned-btn">
        <span>first</span>
      </div>
      <button id="owned-btn">Owned</button>
    `;
    const items = analyzeReadingOrder();
    const ownedIdx = items.findIndex((i) => i.accessibleName === "Owned");
    const firstIdx = items.findIndex((i) => i.accessibleName === "first");
    expect(ownedIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeGreaterThan(-1);
    expect(ownedIdx).toBeGreaterThan(firstIdx);
  });

  it("ignores aria-owns ids that don't resolve", () => {
    document.body.innerHTML = `<div id="c" aria-owns="missing-id"><p>hi</p></div>`;
    expect(() => analyzeReadingOrder()).not.toThrow();
    expect(analyzeReadingOrder().find((i) => i.accessibleName === "hi")).toBeTruthy();
  });
});

describe("analyzeReadingOrder — semantic role fall-through", () => {
  it("does not include text-only elements that have child elements (the !text branch)", () => {
    // <p> has a <span> child, so the 'text-only with content' check fails (children > 0).
    // The <p> itself isn't included; only the <span> child (which is text-only with no
    // descendants) is.
    document.body.innerHTML = `<p><span>inner</span></p>`;
    const items = analyzeReadingOrder();
    const innerSpan = items.find((i) => i.accessibleName === "inner");
    expect(innerSpan).toBeTruthy();
    expect(innerSpan!.role).toBe("text");
  });

  it("does not include an empty p/span/div (no text)", () => {
    document.body.innerHTML = `<div></div><p></p><span></span>`;
    const items = analyzeReadingOrder();
    expect(items.length).toBe(0);
  });
});

describe("analyzeReadingOrder — accessible-name title + clip-hidden source", () => {
  it("falls back to title attribute with nameSource='title'", () => {
    document.body.innerHTML = `<a href="#" title="Help link"><svg aria-hidden="true"></svg></a>`;
    const link = analyzeReadingOrder().find((i) => i.role === "link")!;
    expect(link.accessibleName).toBe("Help link");
    expect(link.nameSource).toBe("title");
  });

  it("uses clip-rect inline-styled descendant as sr-only fallback", () => {
    // No .sr-only class — visually-hidden via clip rect inline style.
    document.body.innerHTML = `
      <a href="#"><span style="clip:rect(0px,0px,0px,0px);position:absolute">VH text</span><svg aria-hidden="true"></svg></a>
    `;
    const link = analyzeReadingOrder().find((i) => i.role === "link")!;
    expect(link.accessibleName).toBe("VH text");
    expect(link.nameSource).toBe("sr-only");
  });

  it("uses clip-path inset(50%) inline-styled descendant as sr-only fallback", () => {
    document.body.innerHTML = `
      <a href="#"><span style="clip-path:inset(50%);position:absolute">VH path</span><svg aria-hidden="true"></svg></a>
    `;
    const link = analyzeReadingOrder().find((i) => i.role === "link")!;
    expect(link.accessibleName).toBe("VH path");
    expect(link.nameSource).toBe("sr-only");
  });
});

describe("analyzeReadingOrder — additional state branches", () => {
  it("reports 'current' for any aria-current value", () => {
    document.body.innerHTML = `<a href="#" aria-current="page">Now</a>`;
    expect(analyzeReadingOrder()[0].states).toContain("current");
  });
});

describe("analyzeReadingOrder — getSelector branches", () => {
  it("uses :nth-of-type when multiple same-tag siblings have no id", () => {
    // Three buttons under a parent with an id (so the recursion stops at the
    // parent's #id and the button gets a :nth-of-type qualifier).
    document.body.innerHTML = `
      <section id="section">
        <button>One</button>
        <button>Two</button>
        <button>Three</button>
      </section>
    `;
    const items = analyzeReadingOrder();
    const buttons = items.filter((i) => i.role === "button");
    expect(buttons.length).toBe(3);
    // Each selector should reference :nth-of-type indices 1..3
    expect(buttons.some((b) => /:nth-of-type\(2\)/.test(b.selector))).toBe(true);
  });
});
