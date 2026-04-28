// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { elementToSpeechText, roleClassFor, renderSrRowHtml } from "../sr-tab";
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
