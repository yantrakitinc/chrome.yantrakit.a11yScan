// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { kbRoleClassFor, renderKbRowHtml } from "../kb-tab";
import type { iTabOrderElement } from "@shared/types";

function el(overrides: Partial<iTabOrderElement> = {}): iTabOrderElement {
  return {
    index: 1,
    selector: "#submit",
    role: "button",
    accessibleName: "Submit",
    tabindex: null,
    hasFocusIndicator: true,
    ...overrides,
  };
}

describe("kbRoleClassFor", () => {
  it("returns specific class for button / link / textbox", () => {
    expect(kbRoleClassFor("button")).toBe("ds-badge--role-button");
    expect(kbRoleClassFor("link")).toBe("ds-badge--role-link");
    expect(kbRoleClassFor("textbox")).toBe("ds-badge--role-textbox");
  });
  it("falls back to default for any other role", () => {
    expect(kbRoleClassFor("heading")).toBe("ds-badge--role-default");
    expect(kbRoleClassFor("")).toBe("ds-badge--role-default");
  });
});

describe("renderKbRowHtml", () => {
  it("includes the index number, role, and accessible name", () => {
    const out = renderKbRowHtml(el({ index: 7, role: "link", accessibleName: "Sign in" }), 0, false);
    expect(out).toMatch(/<span class="ds-row__index-circle">7</);
    expect(out).toMatch(/Sign in/);
    expect(out).toMatch(/ds-badge--role-link/);
  });

  it("adds ds-row--active class when isActive is true", () => {
    expect(renderKbRowHtml(el(), 0, true)).toMatch(/ds-row--active/);
    expect(renderKbRowHtml(el(), 0, false)).not.toMatch(/ds-row--active/);
  });

  it("uses red focus-indicator color when hasFocusIndicator is false", () => {
    const out = renderKbRowHtml(el({ hasFocusIndicator: false }), 0, false);
    expect(out).toMatch(/--ds-red-700/);
    expect(out).toMatch(/Missing visible focus indicator/);
  });

  it("uses green focus-indicator color when hasFocusIndicator is true", () => {
    const out = renderKbRowHtml(el({ hasFocusIndicator: true }), 0, false);
    expect(out).toMatch(/--ds-green-700/);
    expect(out).toMatch(/Has visible focus indicator/);
  });

  it("escapes html-injection in role / accessibleName / selector", () => {
    const out = renderKbRowHtml(el({ role: "<x>", accessibleName: "<svg/>", selector: "#a\"b" }), 0, false);
    expect(out).not.toMatch(/<x>/);
    expect(out).toMatch(/&lt;x&gt;/);
    expect(out).toMatch(/&lt;svg\/&gt;/);
    expect(out).toMatch(/#a&quot;b/);
  });

  it("emits the data-index attribute matching the idx argument", () => {
    expect(renderKbRowHtml(el(), 5, false)).toMatch(/data-index="5"/);
  });
});
