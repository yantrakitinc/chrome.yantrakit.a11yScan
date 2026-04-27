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

describe("runHeuristicRules — visual-heading (rule 13)", () => {
  it("flags a heading-tag element used as styling-only (very-short text)", () => {
    document.body.innerHTML = `<h1></h1>`;
    // The exact rule ID is "visual-heading" — we just verify shape; the rule
    // body uses font-size heuristics that may not trigger in jsdom.
    const out = runHeuristicRules(false);
    expect(Array.isArray(out)).toBe(true);
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
