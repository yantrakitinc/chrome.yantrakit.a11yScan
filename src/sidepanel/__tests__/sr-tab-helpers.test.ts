// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { elementToSpeechText, roleClassFor, renderSrRowHtml, srStatusLabelHtml, composeContainerSpeechText } from "../sr-tab";
import type { iScreenReaderElement } from "@shared/types";

function el(overrides: Partial<iScreenReaderElement> = {}): iScreenReaderElement {
  return {
    index: 1,
    selector: "#x",
    role: "button",
    accessibleName: "Submit",
    nameSource: "contents",
    states: [],
    ...overrides,
  };
}

describe("elementToSpeechText", () => {
  it("formats role + name when no states are present", () => {
    expect(elementToSpeechText(el())).toBe("button, Submit");
  });

  it("appends comma-separated states when present", () => {
    expect(elementToSpeechText(el({ states: ["pressed", "expanded"] }))).toBe("button, Submit, pressed, expanded");
  });

  it("handles empty accessible name (still yields 'role, ')", () => {
    expect(elementToSpeechText(el({ accessibleName: "" }))).toBe("button, ");
  });

  it("works for landmarks with role + name", () => {
    expect(elementToSpeechText(el({ role: "navigation", accessibleName: "Main nav", states: [] }))).toBe("navigation, Main nav");
  });
});

describe("roleClassFor", () => {
  it("returns specific class for link / button / heading / img / textbox", () => {
    expect(roleClassFor("link")).toBe("ds-badge--role-link");
    expect(roleClassFor("button")).toBe("ds-badge--role-button");
    expect(roleClassFor("heading")).toBe("ds-badge--role-heading");
    expect(roleClassFor("img")).toBe("ds-badge--role-img");
    expect(roleClassFor("textbox")).toBe("ds-badge--role-textbox");
  });

  it("groups every documented landmark to ds-badge--role-landmark", () => {
    for (const r of ["navigation", "banner", "contentinfo", "main", "region", "complementary"]) {
      expect(roleClassFor(r)).toBe("ds-badge--role-landmark");
    }
  });

  it("falls back to ds-badge--role-default for unknown roles", () => {
    expect(roleClassFor("widget")).toBe("ds-badge--role-default");
    expect(roleClassFor("")).toBe("ds-badge--role-default");
  });
});

describe("renderSrRowHtml", () => {
  it("renders index, role badge, accessible name, source badge", () => {
    const out = renderSrRowHtml(el({ index: 4, role: "link", accessibleName: "Sign in", nameSource: "aria-label" }), false);
    expect(out).toMatch(/<span class="ds-row__index">4</);
    expect(out).toMatch(/ds-badge--role-link/);
    expect(out).toMatch(/Sign in/);
    expect(out).toMatch(/aria-label/);
  });

  it("renames nameSource='contents' to 'text' for the source badge", () => {
    const out = renderSrRowHtml(el({ nameSource: "contents" }), false);
    expect(out).toMatch(/>text</);
  });

  it("emits ds-row--active when highlighted", () => {
    expect(renderSrRowHtml(el(), true)).toMatch(/ds-row--active/);
    expect(renderSrRowHtml(el(), false)).not.toMatch(/ds-row--active/);
  });

  it("renders a state badge for each entry in states", () => {
    const out = renderSrRowHtml(el({ states: ["pressed", "expanded"] }), false);
    expect(out).toMatch(/ds-badge--state[^"]*">pressed</);
    expect(out).toMatch(/ds-badge--state[^"]*">expanded</);
  });

  it("escapes html-injection in role / accessibleName / selector", () => {
    const out = renderSrRowHtml(el({ role: "<x>", accessibleName: "<svg/>", selector: "#a\"b" }), false);
    expect(out).not.toMatch(/<x>/);
    expect(out).toMatch(/&lt;x&gt;/);
    expect(out).toMatch(/&lt;svg\/&gt;/);
    expect(out).toMatch(/#a&quot;b/);
  });

  it("emits the data-index attribute = el.index - 1 (0-based)", () => {
    expect(renderSrRowHtml(el({ index: 7 }), false)).toMatch(/data-index="6"/);
  });
});

describe("srStatusLabelHtml", () => {
  function s(overrides: Partial<Parameters<typeof srStatusLabelHtml>[0]> = {}) {
    return { playState: "idle" as const, playIndex: 0, singleSpeakIndex: null, elementCount: 5, scoped: false, ...overrides };
  }

  it("idle without scope: 'N elements in reading order'", () => {
    expect(srStatusLabelHtml(s())).toBe("5 elements in reading order");
  });
  it("idle with scope: 'N elements in scope'", () => {
    expect(srStatusLabelHtml(s({ scoped: true }))).toBe("5 elements in scope");
  });
  it("complete: green Complete pill", () => {
    expect(srStatusLabelHtml(s({ playState: "complete" }))).toMatch(/Complete/);
    expect(srStatusLabelHtml(s({ playState: "complete" }))).toMatch(/--ds-green-700/);
  });
  it("playing without singleSpeakIndex: 'Playing X of Y'", () => {
    expect(srStatusLabelHtml(s({ playState: "playing", playIndex: 2, elementCount: 10 }))).toMatch(/Playing 3 of 10/);
  });
  it("playing with singleSpeakIndex set: 'Speaking element X'", () => {
    expect(srStatusLabelHtml(s({ playState: "playing", singleSpeakIndex: 4 }))).toMatch(/Speaking element 5/);
  });
  it("paused without singleSpeakIndex: 'Paused at X of Y'", () => {
    expect(srStatusLabelHtml(s({ playState: "paused", playIndex: 2, elementCount: 10 }))).toMatch(/Paused at 3 of 10/);
  });
  it("paused with singleSpeakIndex set: 'Paused element X'", () => {
    expect(srStatusLabelHtml(s({ playState: "paused", singleSpeakIndex: 4 }))).toMatch(/Paused element 5/);
  });
});

describe("composeContainerSpeechText", () => {
  function mkEl(overrides: Partial<iScreenReaderElement> = {}): iScreenReaderElement {
    return { index: 1, selector: "#x", role: "list", accessibleName: "", nameSource: "contents", states: [], ...overrides };
  }

  it("returns the container's own speech when scoped contains only the container", () => {
    const c = mkEl({ selector: "#tabs", role: "tablist", accessibleName: "Tabs" });
    expect(composeContainerSpeechText(c, [c])).toBe("tablist, Tabs");
  });

  it("returns container's own speech when scoped is empty", () => {
    const c = mkEl({ role: "tablist", accessibleName: "Tabs" });
    expect(composeContainerSpeechText(c, [])).toBe("tablist, Tabs");
  });

  it("appends each child's speech, '.'-separated, with leading '. ' after container", () => {
    const c = mkEl({ selector: "#nav", role: "navigation", accessibleName: "Main" });
    const children = [
      mkEl({ selector: "#nav-home", role: "link", accessibleName: "Home" }),
      mkEl({ selector: "#nav-about", role: "link", accessibleName: "About" }),
    ];
    expect(composeContainerSpeechText(c, [c, ...children]))
      .toBe("navigation, Main. link, Home. link, About.");
  });

  it("filters out the container by matching selector — order of scoped doesn't matter", () => {
    const c = mkEl({ selector: "#nav", role: "navigation", accessibleName: "Main" });
    const child = mkEl({ selector: "#nav-home", role: "link", accessibleName: "Home" });
    // container is in the middle of scoped — still gets filtered
    expect(composeContainerSpeechText(c, [child, c])).toBe("navigation, Main. link, Home.");
  });

  it("includes states in child speech (round-trip with elementToSpeechText)", () => {
    const c = mkEl({ selector: "#tabs", role: "tablist", accessibleName: "" });
    const child = mkEl({ selector: "#tab1", role: "tab", accessibleName: "Home", states: ["selected"] });
    expect(composeContainerSpeechText(c, [c, child])).toMatch(/tab, Home, selected/);
  });
});
