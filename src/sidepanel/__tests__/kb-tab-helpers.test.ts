// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { kbRoleClassFor, renderKbRowHtml, renderFocusGapsHtml, renderFocusIndicatorsHtml, renderKeyboardTrapsHtml, renderSkipLinksHtml } from "../kb-tab";
import type { iTabOrderElement, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";

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

describe("renderFocusGapsHtml", () => {
  it("renders 'No focus gaps detected.' when empty", () => {
    expect(renderFocusGapsHtml([])).toMatch(/No focus gaps detected/);
  });
  it("opens the details element when gaps exist", () => {
    expect(renderFocusGapsHtml([{ selector: "#x", role: "div", reason: "no tabindex" }])).toMatch(/<details open/);
    expect(renderFocusGapsHtml([])).not.toMatch(/<details open/);
  });
  it("renders one row per gap with selector + reason", () => {
    const out = renderFocusGapsHtml([
      { selector: "#a", role: "div", reason: "aria-hidden" },
      { selector: "#b", role: "span", reason: "tabindex=-1" },
    ]);
    expect((out.match(/class="kb-gap/g) ?? []).length).toBe(2);
    expect(out).toMatch(/aria-hidden/);
    expect(out).toMatch(/tabindex=-1/);
  });
  it("escapes html-injection in selector and reason", () => {
    const out = renderFocusGapsHtml([{ selector: "<x>", role: "x", reason: "<script>" }]);
    expect(out).not.toMatch(/<script>/);
    expect(out).toMatch(/&lt;x&gt;/);
    expect(out).toMatch(/&lt;script&gt;/);
  });
});

describe("renderFocusIndicatorsHtml", () => {
  it("renders 'Run Analyze' empty state when array is empty", () => {
    expect(renderFocusIndicatorsHtml([])).toMatch(/Run Analyze to check focus indicators/);
  });
  it("renders the all-pass message when every indicator hasIndicator=true", () => {
    const out = renderFocusIndicatorsHtml([
      { selector: "#a", hasIndicator: true },
      { selector: "#b", hasIndicator: true },
    ] as iFocusIndicator[]);
    expect(out).toMatch(/All focusable elements have visible focus indicators/);
  });
  it("only lists indicators that have hasIndicator=false", () => {
    const out = renderFocusIndicatorsHtml([
      { selector: "#a", hasIndicator: true },
      { selector: "#b", hasIndicator: false },
    ] as iFocusIndicator[]);
    expect(out).toMatch(/data-selector="#b"/);
    expect(out).not.toMatch(/data-selector="#a"/);
  });
  it("opens details when ≥1 missing indicator", () => {
    expect(renderFocusIndicatorsHtml([{ selector: "#x", hasIndicator: false }] as iFocusIndicator[])).toMatch(/<details open/);
  });
});

describe("renderKeyboardTrapsHtml", () => {
  it("renders 'Run Analyze' empty state when tabOrderEmpty=true", () => {
    expect(renderKeyboardTrapsHtml([], true)).toMatch(/Run Analyze to detect keyboard traps/);
  });
  it("renders 'No keyboard traps detected.' when traps=[] and analyze ran", () => {
    expect(renderKeyboardTrapsHtml([], false)).toMatch(/No keyboard traps detected/);
  });
  it("renders one row per trap with selector + description", () => {
    const out = renderKeyboardTrapsHtml([
      { selector: "#trap1", description: "tab loops" },
      { selector: "#trap2", description: "no escape" },
    ] as iKeyboardTrap[], false);
    expect((out.match(/class="kb-trap/g) ?? []).length).toBe(2);
    expect(out).toMatch(/tab loops/);
    expect(out).toMatch(/no escape/);
  });
});

describe("renderSkipLinksHtml", () => {
  it("renders 'Run Analyze' empty state when tabOrderEmpty=true", () => {
    expect(renderSkipLinksHtml([], true)).toMatch(/Run Analyze to detect skip links/);
  });
  it("renders the no-skip-link warning when links=[] and analyze ran", () => {
    expect(renderSkipLinksHtml([], false)).toMatch(/No skip links found/);
  });
  it("uses sky color when target exists, red when not", () => {
    const ok = renderSkipLinksHtml([{ selector: "#a", target: "#main", targetExists: true }] as iSkipLink[], false);
    const bad = renderSkipLinksHtml([{ selector: "#b", target: "#missing", targetExists: false }] as iSkipLink[], false);
    expect(ok).toMatch(/--ds-sky-200/);
    expect(ok).toMatch(/✓ exists/);
    expect(bad).toMatch(/--ds-red-200/);
    expect(bad).toMatch(/✗ target not found/);
  });
});
