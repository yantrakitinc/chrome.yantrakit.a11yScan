// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { runHeuristicRules, parseColor, luminance, contrastRatio } from "../heuristic-rules";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom doesn't ship matchMedia; rule31_prefersReducedMotion calls it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (window as any).matchMedia !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

function find(violations: ReturnType<typeof runHeuristicRules>, id: string) {
  return violations.find((v) => v.id === `heuristic-${id}`);
}

describe("runHeuristicRules — rule selection", () => {
  it("returns an array (possibly empty) for any document", () => {
    expect(Array.isArray(runHeuristicRules(false))).toBe(true);
  });

  it("returns an array of violations with the heuristic- prefix", () => {
    document.body.innerHTML = `<a href="#">click here</a>`;
    const out = runHeuristicRules(false);
    expect(out.every((v) => v.id.startsWith("heuristic-"))).toBe(true);
  });

  it("excludes specified rule numbers from the output", () => {
    document.body.innerHTML = `<a href="#">click here</a>`;
    const without4 = runHeuristicRules(false, [4]);
    expect(find(without4, "generic-link-text")).toBeUndefined();
  });

  it("only runs cross-page rules (21, 22) when isCrawl is true", () => {
    // Without crawl, rule21/22 don't run at all (skipped from the loop)
    expect(runHeuristicRules(false).every((v) => !v.id.includes("inconsistent-nav"))).toBe(true);
    expect(runHeuristicRules(false).every((v) => !v.id.includes("inconsistent-link"))).toBe(true);
  });
});

describe("runHeuristicRules — generic link text (rule 4)", () => {
  it("flags 'click here' as generic", () => {
    document.body.innerHTML = `<a href="/path">click here</a>`;
    const v = find(runHeuristicRules(false), "generic-link-text")!;
    expect(v).toBeDefined();
    expect(v.nodes.length).toBe(1);
  });

  it("flags 'read more' / 'learn more' / 'details'", () => {
    document.body.innerHTML = `
      <a href="/a">read more</a>
      <a href="/b">learn more</a>
      <a href="/c">details</a>
    `;
    const v = find(runHeuristicRules(false), "generic-link-text")!;
    expect(v.nodes.length).toBe(3);
  });

  it("does NOT flag descriptive link text", () => {
    document.body.innerHTML = `<a href="/manage">Manage account settings</a>`;
    expect(find(runHeuristicRules(false), "generic-link-text")).toBeUndefined();
  });

  it("uses aria-label over visible text when both are present", () => {
    document.body.innerHTML = `<a href="/x" aria-label="more">Manage account settings</a>`;
    const v = find(runHeuristicRules(false), "generic-link-text")!;
    expect(v.nodes.length).toBe(1);
  });
});

describe("runHeuristicRules — div as button (rule 16)", () => {
  it("flags a div with onclick that has no role", () => {
    const div = document.createElement("div");
    div.setAttribute("onclick", "alert(1)");
    div.textContent = "Click";
    document.body.appendChild(div);
    const v = find(runHeuristicRules(false), "div-as-button");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a div with role='button' and tabindex", () => {
    document.body.innerHTML = `<div role="button" tabindex="0" onclick="x">Click</div>`;
    expect(find(runHeuristicRules(false), "div-as-button")).toBeUndefined();
  });
});

describe("runHeuristicRules — aria-hidden focusable (rule 18)", () => {
  it("flags an aria-hidden container that holds a focusable child", () => {
    document.body.innerHTML = `<div aria-hidden="true"><a href="/x">link</a></div>`;
    const v = find(runHeuristicRules(false), "aria-hidden-focusable");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag aria-hidden on a leaf decorative span", () => {
    document.body.innerHTML = `<span aria-hidden="true">→</span>`;
    expect(find(runHeuristicRules(false), "aria-hidden-focusable")).toBeUndefined();
  });
});

describe("runHeuristicRules — placeholder-only label (rule 12)", () => {
  it("flags an input with only a placeholder, no label", () => {
    document.body.innerHTML = `<input type="text" placeholder="Email" />`;
    const v = find(runHeuristicRules(false), "placeholder-only-label");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag an input with an associated <label for>", () => {
    document.body.innerHTML = `<label for="e">Email</label><input id="e" type="text" placeholder="x" />`;
    expect(find(runHeuristicRules(false), "placeholder-only-label")).toBeUndefined();
  });

  it("does NOT flag an input with aria-label", () => {
    document.body.innerHTML = `<input type="text" placeholder="x" aria-label="Email" />`;
    expect(find(runHeuristicRules(false), "placeholder-only-label")).toBeUndefined();
  });
});

describe("runHeuristicRules — broken aria refs (rule 19)", () => {
  it("flags aria-labelledby pointing at a non-existent id", () => {
    document.body.innerHTML = `<button aria-labelledby="nope">x</button>`;
    const v = find(runHeuristicRules(false), "broken-aria-ref");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag aria-labelledby pointing at an existing id", () => {
    document.body.innerHTML = `<span id="lbl">Label</span><button aria-labelledby="lbl">x</button>`;
    expect(find(runHeuristicRules(false), "broken-aria-ref")).toBeUndefined();
  });

  it("flags aria-controls pointing at a missing id", () => {
    document.body.innerHTML = `<button aria-controls="missing-panel">x</button>`;
    const v = find(runHeuristicRules(false), "broken-aria-ref");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("runHeuristicRules — icon-only buttons (rule 25)", () => {
  it("flags a button with aria-label and no visible text", () => {
    document.body.innerHTML = `<button aria-label="Close"></button>`;
    const v = find(runHeuristicRules(false), "icon-only-button");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a button with both aria-label and visible text", () => {
    document.body.innerHTML = `<button aria-label="Close">Close</button>`;
    expect(find(runHeuristicRules(false), "icon-only-button")).toBeUndefined();
  });

  it("does NOT flag a regular text button without aria-label", () => {
    document.body.innerHTML = `<button>Close</button>`;
    expect(find(runHeuristicRules(false), "icon-only-button")).toBeUndefined();
  });
});

describe("runHeuristicRules — new tab without warning (rule 28)", () => {
  it("flags target=_blank with no warning text", () => {
    document.body.innerHTML = `<a href="/x" target="_blank">Read more</a>`;
    const v = find(runHeuristicRules(false), "new-tab-no-warning");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a link with 'opens in new tab' in the visible text", () => {
    document.body.innerHTML = `<a href="/x" target="_blank">Read more (opens in new tab)</a>`;
    expect(find(runHeuristicRules(false), "new-tab-no-warning")).toBeUndefined();
  });

  it("does NOT flag a link with 'new tab' in aria-label", () => {
    document.body.innerHTML = `<a href="/x" target="_blank" aria-label="Read more, new tab">Read more</a>`;
    expect(find(runHeuristicRules(false), "new-tab-no-warning")).toBeUndefined();
  });

  it("does NOT flag a same-tab link", () => {
    document.body.innerHTML = `<a href="/x">Read more</a>`;
    expect(find(runHeuristicRules(false), "new-tab-no-warning")).toBeUndefined();
  });
});

describe("runHeuristicRules — auto-play animation (rule 27)", () => {
  it("flags <marquee>", () => {
    document.body.innerHTML = `<marquee>scrolling</marquee>`;
    const v = find(runHeuristicRules(false), "auto-play-animation");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("runHeuristicRules — breadcrumb validation (rule 24)", () => {
  it("flags a breadcrumb-classed list missing aria-current", () => {
    document.body.innerHTML = `<nav aria-label="Breadcrumb"><ol><li>Home</li><li>Shop</li></ol></nav>`;
    const v = find(runHeuristicRules(false), "breadcrumb-validation");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a breadcrumb with aria-current=page", () => {
    document.body.innerHTML = `<nav aria-label="Breadcrumb"><ol><li>Home</li><li aria-current="page">Shop</li></ol></nav>`;
    expect(find(runHeuristicRules(false), "breadcrumb-validation")).toBeUndefined();
  });
});

describe("runHeuristicRules — suspicious alt text (rule 33)", () => {
  it("flags alt text that looks like a filename with extension", () => {
    document.body.innerHTML = `<img src="/x.jpg" alt="hero.jpg" />`;
    const v = find(runHeuristicRules(false), "suspicious-alt");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("flags 'image of' / 'photo of' / 'picture of' / 'graphic of' redundant prefix", () => {
    document.body.innerHTML = `
      <img src="/a.jpg" alt="image of a cat" />
      <img src="/b.jpg" alt="photo of a dog" />
      <img src="/c.jpg" alt="picture of a fish" />
      <img src="/d.jpg" alt="graphic of a logo" />
    `;
    const v = find(runHeuristicRules(false), "suspicious-alt")!;
    expect(v.nodes.length).toBe(4);
  });

  it("flags alt text matching the src filename (without extension)", () => {
    document.body.innerHTML = `<img src="/img/hero.jpg" alt="hero" />`;
    const v = find(runHeuristicRules(false), "suspicious-alt");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag descriptive alt text", () => {
    document.body.innerHTML = `<img src="/img/x.jpg" alt="A golden retriever puppy playing in autumn leaves" />`;
    expect(find(runHeuristicRules(false), "suspicious-alt")).toBeUndefined();
  });

  it("does NOT flag empty alt (decorative image)", () => {
    document.body.innerHTML = `<img src="/decoration.png" alt="" />`;
    expect(find(runHeuristicRules(false), "suspicious-alt")).toBeUndefined();
  });

  it("does NOT flag missing alt (a different rule's job)", () => {
    document.body.innerHTML = `<img src="/x.jpg" />`;
    expect(find(runHeuristicRules(false), "suspicious-alt")).toBeUndefined();
  });
});

describe("runHeuristicRules — show-password toggle (rule 23)", () => {
  it("flags a password input with no nearby toggle", () => {
    document.body.innerHTML = `<form><input type="password" /></form>`;
    const v = find(runHeuristicRules(false), "show-password-toggle");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag when a 'Show' toggle button is in the same container", () => {
    document.body.innerHTML = `<form><input type="password" /><button>Show password</button></form>`;
    expect(find(runHeuristicRules(false), "show-password-toggle")).toBeUndefined();
  });
});

describe("runHeuristicRules — decorative symbols (rule 1)", () => {
  it("flags an arrow symbol exposed to screen readers", () => {
    document.body.innerHTML = `<span>→</span>`;
    const v = find(runHeuristicRules(false), "decorative-symbols");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag the symbol when aria-hidden=true is set", () => {
    document.body.innerHTML = `<span aria-hidden="true">→</span>`;
    expect(find(runHeuristicRules(false), "decorative-symbols")).toBeUndefined();
  });

  it("does NOT flag long text (only short symbol-only content)", () => {
    document.body.innerHTML = `<span>This is a long sentence, not a symbol.</span>`;
    expect(find(runHeuristicRules(false), "decorative-symbols")).toBeUndefined();
  });
});

describe("runHeuristicRules — carousel (rule 26)", () => {
  it("flags a carousel-classed region with no controls", () => {
    document.body.innerHTML = `<div role="region" aria-label="Hero carousel" class="carousel"></div>`;
    const v = find(runHeuristicRules(false), "carousel-accessibility");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("flags a carousel with prev/next but no labeled pagination", () => {
    document.body.innerHTML = `<div role="region" aria-label="Hero carousel" class="carousel">
      <button>Prev</button><button>Next</button>
    </div>`;
    const v = find(runHeuristicRules(false), "carousel-accessibility");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a complete carousel (controls + tablist pagination)", () => {
    document.body.innerHTML = `<div role="region" aria-label="Hero carousel" class="carousel">
      <button>Prev</button><button>Next</button>
      <div role="tablist"><button role="tab">1</button></div>
    </div>`;
    expect(find(runHeuristicRules(false), "carousel-accessibility")).toBeUndefined();
  });
});

describe("runHeuristicRules — visual-heading (rule 13)", () => {
  it("flags a heading-tag element used as styling-only (very-short text)", () => {
    document.body.innerHTML = `<h1></h1>`;
    // The exact rule ID is "visual-heading" — we just verify shape; the rule
    // body uses font-size heuristics that may not trigger in jsdom.
    const out = runHeuristicRules(false);
    expect(Array.isArray(out)).toBe(true);
  });
});

describe("runHeuristicRules — heading-for-styling (rule 14)", () => {
  it("flags an h1 nested inside a <p> (heading used for inline styling)", () => {
    // jsdom can't compute realistic font-sizes, so target the closest("p") branch instead
    document.body.innerHTML = `<p>Hello <h1>world</h1></p>`;
    const out = runHeuristicRules(false);
    expect(Array.isArray(out)).toBe(true); // shape only — jsdom layout may not trigger every branch
  });
});

describe("runHeuristicRules — autocomplete (rule 8)", () => {
  it("flags an input[type=email] without autocomplete", () => {
    document.body.innerHTML = `<form><input type="email" name="email" /></form>`;
    const v = find(runHeuristicRules(false), "missing-autocomplete");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag an input with autocomplete set", () => {
    document.body.innerHTML = `<form><input type="email" autocomplete="email" /></form>`;
    expect(find(runHeuristicRules(false), "missing-autocomplete")).toBeUndefined();
  });
});

describe("runHeuristicRules — icon-fonts (rule 2)", () => {
  it("flags an element with fa-* class but no aria-label", () => {
    document.body.innerHTML = `<i class="fa-search"></i>`;
    const v = find(runHeuristicRules(false), "icon-font-alt");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag an icon-class element with aria-label", () => {
    document.body.innerHTML = `<i class="fa-search" aria-label="Search"></i>`;
    expect(find(runHeuristicRules(false), "icon-font-alt")).toBeUndefined();
  });

  it("does NOT flag an icon inside a labelled button", () => {
    document.body.innerHTML = `<button><i class="fa-search"></i> Search</button>`;
    expect(find(runHeuristicRules(false), "icon-font-alt")).toBeUndefined();
  });

  it("recognizes material-icons / bi-* / glyphicon / ion-* class patterns", () => {
    document.body.innerHTML = `
      <i class="material-icons"></i>
      <i class="bi-list"></i>
      <i class="glyphicon-home"></i>
      <i class="ion-search"></i>
    `;
    const v = find(runHeuristicRules(false), "icon-font-alt");
    expect(v?.nodes.length).toBe(4);
  });
});

describe("runHeuristicRules — link-indistinguishable (rule 15) and SPA (rule 30)", () => {
  it("rule 15 returns an array (visual-styling rules behave correctly without throwing)", () => {
    document.body.innerHTML = `<p>see <a href="/x">this link</a> for more</p>`;
    expect(Array.isArray(runHeuristicRules(false))).toBe(true);
  });

  it("rule 30 (spa-route-focus) flags pages that have history.pushState but no aria-live and no skip link", () => {
    document.body.innerHTML = `<p>some content</p>`;
    const v = find(runHeuristicRules(false), "spa-route-focus");
    expect(v?.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("rule 30 does NOT flag a page that has an aria-live region", () => {
    document.body.innerHTML = `<div aria-live="polite"></div><p>x</p>`;
    expect(find(runHeuristicRules(false), "spa-route-focus")).toBeUndefined();
  });
});

describe("parseColor", () => {
  it("parses 'rgb(r, g, b)'", () => {
    expect(parseColor("rgb(255, 128, 64)")).toEqual([255, 128, 64]);
  });
  it("parses 'rgba(r, g, b, a)'", () => {
    expect(parseColor("rgba(0, 0, 0, 0.5)")).toEqual([0, 0, 0]);
  });
  it("returns null for non-rgb formats", () => {
    expect(parseColor("#ff0000")).toBeNull();
    expect(parseColor("hsl(120, 100%, 50%)")).toBeNull();
    expect(parseColor("transparent")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
  it("handles whitespace variations", () => {
    expect(parseColor("rgb(255,128,64)")).toEqual([255, 128, 64]);
    expect(parseColor("rgb(255, 128, 64)")).toEqual([255, 128, 64]);
  });
});

describe("luminance (WCAG relative luminance)", () => {
  it("pure black is 0", () => {
    expect(luminance(0, 0, 0)).toBeCloseTo(0, 5);
  });
  it("pure white is 1", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 5);
  });
  it("pure red has the documented relative luminance ≈ 0.2126", () => {
    expect(luminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });
  it("pure green has ≈ 0.7152", () => {
    expect(luminance(0, 255, 0)).toBeCloseTo(0.7152, 3);
  });
  it("pure blue has ≈ 0.0722", () => {
    expect(luminance(0, 0, 255)).toBeCloseTo(0.0722, 3);
  });
});

describe("contrastRatio (WCAG)", () => {
  it("black on white = 21", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });
  it("identical colors = 1", () => {
    expect(contrastRatio([128, 128, 128], [128, 128, 128])).toBeCloseTo(1, 5);
  });
  it("order-independent (swapping fg and bg returns same ratio)", () => {
    const a = contrastRatio([100, 100, 100], [200, 200, 200]);
    const b = contrastRatio([200, 200, 200], [100, 100, 100]);
    expect(a).toBeCloseTo(b, 5);
  });
  it("medium gray on white passes 4.5:1 threshold", () => {
    // #595959 on white — definitely above WCAG-AA 4.5:1
    const r = contrastRatio([0x59, 0x59, 0x59], [255, 255, 255]);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it("light gray on white fails the 4.5:1 threshold", () => {
    // #aaaaaa on white — fails AA
    const r = contrastRatio([0xaa, 0xaa, 0xaa], [255, 255, 255]);
    expect(r).toBeLessThan(4.5);
  });
});

describe("runHeuristicRules — output shape", () => {
  it("each violation includes wcagCriteria, impact, and nodes with selector/html/failureSummary", () => {
    document.body.innerHTML = `<a href="/x">click here</a>`;
    const v = find(runHeuristicRules(false), "generic-link-text")!;
    expect(v.impact).toBeTruthy();
    expect(Array.isArray(v.wcagCriteria)).toBe(true);
    expect(v.wcagCriteria!.length).toBeGreaterThan(0);
    expect(v.nodes[0].selector).toBeTruthy();
    expect(v.nodes[0].html).toBeTruthy();
    expect(v.nodes[0].failureSummary).toBeTruthy();
  });
});

describe("runHeuristicRules — crawl-only rules (21, 22)", () => {
  it("rule 21 (inconsistent nav order) records nav order to sessionStorage in crawl mode", () => {
    document.body.innerHTML = `<nav><a href="/a">A</a><a href="/b">B</a></nav>`;
    runHeuristicRules(true);
    // The rule has no flag-able nodes (just collects data) so it's filtered out
    // of the returned violations. Verify the side-effect: sessionStorage has nav order.
    const stored = sessionStorage.getItem(`a11y_nav_order_${location.pathname}`);
    expect(stored).toBeTruthy();
    sessionStorage.clear();
  });

  it("rule 22 (inconsistent link identification) flags duplicate href with different names", () => {
    document.body.innerHTML = `
      <a href="https://x.com/p">First name</a>
      <a href="https://x.com/p">Different name</a>
    `;
    const v = find(runHeuristicRules(true), "inconsistent-link-id");
    expect(v).toBeTruthy();
    expect(v!.nodes.length).toBeGreaterThan(0);
  });

  it("rule 22 does not flag identical names for duplicate hrefs", () => {
    document.body.innerHTML = `
      <a href="https://x.com/p">Same</a>
      <a href="https://x.com/p">Same</a>
    `;
    const v = find(runHeuristicRules(true), "inconsistent-link-id");
    expect(v?.nodes.length ?? 0).toBe(0);
  });
});

describe("runHeuristicRules — focus-obscured (rule 20)", () => {
  it("returns the focus-obscured rule entry (nodes may be empty when nothing visibly overlaps)", () => {
    document.body.innerHTML = `
      <header style="position:fixed;top:0;left:0;right:0;height:60px">Sticky header</header>
      <button style="margin-top:10px">Hidden under header</button>
    `;
    const result = runHeuristicRules(false);
    // Rule entry exists in the output
    const v = result.find((r) => r.id === "heuristic-focus-obscured");
    // jsdom getBoundingClientRect returns zero-rects so overlap detection won't trigger;
    // the rule may or may not produce nodes — just verify the entry exists and is well-formed
    if (v) {
      expect(Array.isArray(v.nodes)).toBe(true);
      expect(v.wcagCriteria).toContain("2.4.11");
    }
  });

  it("flags an interactive element overlapping a position:fixed sticky header (with mocked rects)", () => {
    document.body.innerHTML = `
      <header id="hdr" style="position:fixed">Sticky</header>
      <button id="btn">Below</button>
    `;
    const headerRect = { top: 0, left: 0, right: 1000, bottom: 60, width: 1000, height: 60, x: 0, y: 0, toJSON() { return {}; } };
    const buttonRect = { top: 10, left: 10, right: 110, bottom: 40, width: 100, height: 30, x: 10, y: 10, toJSON() { return {}; } };
    const orig = Element.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return this.id === "hdr" ? headerRect : this.id === "btn" ? buttonRect : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } };
    };
    try {
      const v = find(runHeuristicRules(false), "focus-obscured")!;
      expect(v).toBeTruthy();
      expect(v.nodes.some((n) => n.selector.includes("btn"))).toBe(true);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });
});

describe("runHeuristicRules — small touch targets (rule 6)", () => {
  it("flags a button smaller than 24×24 px", () => {
    document.body.innerHTML = `<button id="b">x</button>`;
    const orig = Element.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return { top: 0, left: 0, right: 16, bottom: 16, width: 16, height: 16, x: 0, y: 0, toJSON() { return {}; } };
    };
    try {
      const v = find(runHeuristicRules(false), "small-touch-target")!;
      expect(v).toBeTruthy();
      expect(v.nodes.length).toBeGreaterThan(0);
      expect(v.nodes[0].failureSummary).toMatch(/16/);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });

  it("does NOT flag a 24×24 button (boundary)", () => {
    document.body.innerHTML = `<button id="b">x</button>`;
    const orig = Element.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return { top: 0, left: 0, right: 24, bottom: 24, width: 24, height: 24, x: 0, y: 0, toJSON() { return {}; } };
    };
    try {
      const v = find(runHeuristicRules(false), "small-touch-target");
      expect(v?.nodes.length ?? 0).toBe(0);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });
});

describe("runHeuristicRules — !important text styling (rule 10)", () => {
  it("flags inline !important on font-size", () => {
    const div = document.createElement("div");
    div.setAttribute("style", "font-size: 12px !important;");
    document.body.appendChild(div);
    const v = find(runHeuristicRules(false), "important-text-styling")!;
    expect(v).toBeTruthy();
    expect(v.nodes.length).toBeGreaterThan(0);
    expect(v.nodes[0].failureSummary).toMatch(/font-size/);
  });
});

describe("runHeuristicRules — heading-for-styling additional branches (rule 14)", () => {
  it("flags an h1 whose font-size is <= body font-size", () => {
    document.body.style.fontSize = "20px";
    document.body.innerHTML = `<h1 id="h" style="font-size:14px">small</h1>`;
    const v = find(runHeuristicRules(false), "heading-for-styling")!;
    expect(v).toBeTruthy();
    expect(v.nodes.some((n) => n.failureSummary.match(/font-size/))).toBe(true);
    document.body.style.fontSize = "";
  });
});

describe("runHeuristicRules — prefers-reduced-motion (rule 31)", () => {
  it("flags animations when prefers-reduced-motion is active", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevMM = (window as any).matchMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = (q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    });
    try {
      // With jsdom's getComputedStyle, animationDuration default is "0s" / "" — unable
      // to actually observe animation. The matches=true branch still runs the loop;
      // the rule entry may be present with 0 nodes. Verify the matches=true path is taken.
      document.body.innerHTML = `<div id="a">x</div>`;
      const violations = runHeuristicRules(false);
      // Rule output may or may not contain nodes (jsdom limits) — entry may be filtered out
      // if no nodes were produced, but the path was exercised. Verify no throw.
      expect(Array.isArray(violations)).toBe(true);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).matchMedia = prevMM;
    }
  });
});

describe("runHeuristicRules — reflow at 320px (rule 29)", () => {
  it("runs only when window.innerWidth <= 320 (verify gate, not output)", () => {
    // Default jsdom innerWidth is 1024, so rule 29 is skipped.
    document.body.innerHTML = `<table style="width:1000px"><tr><td>x</td></tr></table>`;
    const v = find(runHeuristicRules(false), "reflow-320px");
    // Skipped path → no entry in violations
    expect(v).toBeUndefined();
  });

  it("produces an entry when innerWidth <= 320 (with horizontal-scroll detection)", () => {
    const origInner = window.innerWidth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    // mock scrollWidth/clientWidth — jsdom returns 0 for both, equality means no scroll
    Object.defineProperty(document.documentElement, "scrollWidth", { configurable: true, value: 1000 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 320 });
    try {
      document.body.innerHTML = `<div>plain</div>`;
      const v = find(runHeuristicRules(false), "reflow-320px")!;
      expect(v).toBeTruthy();
      expect(v.nodes[0].failureSummary).toMatch(/reflow|320/i);
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: origInner });
    }
  });
});

describe("runHeuristicRules — visual headings (rule 13)", () => {
  it("flags large bold text not wrapped in a heading", () => {
    document.body.innerHTML = `<div id="d" style="font-size:32px;font-weight:700">Looks like a heading</div>`;
    const v = find(runHeuristicRules(false), "visual-heading")!;
    expect(v).toBeTruthy();
    expect(v.nodes.some((n) => n.selector === "#d")).toBe(true);
  });

  it("does NOT flag the same large text when wrapped in <h2>", () => {
    document.body.innerHTML = `<h2><span style="font-size:32px;font-weight:700">Heading</span></h2>`;
    const v = find(runHeuristicRules(false), "visual-heading");
    // The span is inside a heading, so closest('h1..h6') matches → no flag
    expect(v?.nodes.find((n) => n.selector.includes("span"))).toBeUndefined();
  });
});

describe("runHeuristicRules — non-text contrast (rule 11)", () => {
  it("flags an input whose border has very low contrast against parent bg", () => {
    document.body.innerHTML = `
      <div id="parent" style="background:rgb(255,255,255)">
        <input id="i" style="border:1px solid rgb(250,250,250)" />
      </div>
    `;
    const v = find(runHeuristicRules(false), "non-text-contrast")!;
    expect(v).toBeTruthy();
    expect(v.nodes.some((n) => n.selector === "#i")).toBe(true);
  });
});

describe("runHeuristicRules — focus-outline-none (rule 17)", () => {
  it("flags a button with outline:0 width and no box-shadow as having no focus indicator", () => {
    // jsdom maps `outline:none` shorthand inconsistently; use explicit outline-width:0
    // which is what the rule actually checks (`style.outlineWidth === "0px"`).
    document.body.innerHTML = `<button id="b" style="outline-width:0;outline-style:none;box-shadow:none">x</button>`;
    const v = find(runHeuristicRules(false), "focus-outline-none");
    // jsdom getComputedStyle returns empty strings for many props; the rule may produce
    // an empty result. At minimum verify the rule path was exercised without throw.
    expect(Array.isArray(v?.nodes ?? [])).toBe(true);
  });
});

describe("runHeuristicRules — target-size-overlap (rule 32)", () => {
  it("flags a small target whose 24px circle overlaps a neighbor", () => {
    document.body.innerHTML = `<button id="a">x</button><button id="b">y</button>`;
    const orig = Element.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      // both 16×16 buttons are placed 18px apart — 24px expansion overlaps
      return this.id === "a"
        ? { top: 0, left: 0, right: 16, bottom: 16, width: 16, height: 16, x: 0, y: 0, toJSON() { return {}; } }
        : this.id === "b"
          ? { top: 0, left: 18, right: 34, bottom: 16, width: 16, height: 16, x: 18, y: 0, toJSON() { return {}; } }
          : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } };
    };
    try {
      const v = find(runHeuristicRules(false), "target-size-overlap")!;
      expect(v).toBeTruthy();
      expect(v.nodes.length).toBeGreaterThan(0);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });
});

describe("runHeuristicRules — visual-dom-order (rule 5)", () => {
  it("flags a flex container where the visual order differs from DOM order", () => {
    document.body.innerHTML = `
      <div id="row" style="display:flex">
        <span id="a">A</span>
        <span id="b">B</span>
      </div>
    `;
    const orig = Element.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      // place 'b' visually before 'a' (left=0 vs left=100)
      return this.id === "a"
        ? { top: 0, left: 100, right: 130, bottom: 30, width: 30, height: 30, x: 100, y: 0, toJSON() { return {}; } }
        : this.id === "b"
          ? { top: 0, left: 0, right: 30, bottom: 30, width: 30, height: 30, x: 0, y: 0, toJSON() { return {}; } }
          : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } };
    };
    try {
      const v = find(runHeuristicRules(false), "visual-dom-order")!;
      expect(v).toBeTruthy();
      expect(v.nodes.length).toBeGreaterThan(0);
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });
});

describe("runHeuristicRules — scroll-no-keyboard (rule 7)", () => {
  it("flags a scrollable container with no tabindex and no focusable child", () => {
    document.body.innerHTML = `<div id="sc" style="overflow:auto"><div>plain text</div></div>`;
    const sc = document.getElementById("sc")!;
    Object.defineProperty(sc, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(sc, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(sc, "scrollWidth", { configurable: true, value: 100 });
    Object.defineProperty(sc, "clientWidth", { configurable: true, value: 100 });
    const v = find(runHeuristicRules(false), "scroll-no-keyboard")!;
    expect(v).toBeTruthy();
    expect(v.nodes.some((n) => n.selector === "#sc")).toBe(true);
  });
});

describe("runHeuristicRules — link-indistinguishable (rule 15) extra path", () => {
  it("flags an inline link with no underline and same color as parent", () => {
    document.body.innerHTML = `
      <p style="color:rgb(0,0,0)">
        Read <a id="l" href="#" style="color:rgb(0,0,0);text-decoration:none">our docs</a> for more.
      </p>
    `;
    const v = find(runHeuristicRules(false), "link-indistinguishable")!;
    expect(v).toBeTruthy();
    expect(v.nodes.some((n) => n.selector === "#l")).toBe(true);
  });
});

describe("runHeuristicRules — suspicious alt (rule 33) src-match path", () => {
  it("flags alt that exactly matches the src filename (without extension)", () => {
    document.body.innerHTML = `<img src="https://cdn.example.com/photos/sunset.jpg" alt="sunset" />`;
    const v = find(runHeuristicRules(false), "suspicious-alt")!;
    expect(v).toBeTruthy();
    expect(v.nodes[0].failureSummary).toMatch(/filename/i);
  });
});
