import { describe, it, expect } from "vitest";
import { ARIA_PATTERNS } from "../aria-patterns";

describe("ARIA_PATTERNS", () => {
  it("has 12 widget patterns", () => {
    expect(ARIA_PATTERNS.length).toBe(12);
  });

  it("includes all documented widget types", () => {
    const roles = ARIA_PATTERNS.map((p) => p.role);
    expect(roles).toContain("tablist");
    expect(roles).toContain("menu");
    expect(roles).toContain("menubar");
    expect(roles).toContain("dialog");
    expect(roles).toContain("alertdialog");
    expect(roles).toContain("combobox");
    expect(roles).toContain("slider");
    expect(roles).toContain("tree");
    expect(roles).toContain("radiogroup");
    expect(roles).toContain("checkbox");
    expect(roles).toContain("switch");
    expect(roles).toContain("accordion");
  });

  it("every pattern has at least one check", () => {
    for (const pattern of ARIA_PATTERNS) {
      expect(pattern.checks.length).toBeGreaterThan(0);
    }
  });

  it("every pattern has a CSS selector", () => {
    for (const pattern of ARIA_PATTERNS) {
      expect(pattern.selector).toBeTruthy();
    }
  });

  it("every check has a name and validate function", () => {
    for (const pattern of ARIA_PATTERNS) {
      for (const check of pattern.checks) {
        expect(check.name).toBeTruthy();
        expect(typeof check.validate).toBe("function");
      }
    }
  });
});
