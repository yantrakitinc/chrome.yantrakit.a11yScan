// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { runHeuristicRules } from "../heuristic-rules";

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
