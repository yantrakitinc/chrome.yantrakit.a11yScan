// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { elementToSpeechText, roleClassFor } from "../sr-tab";
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
