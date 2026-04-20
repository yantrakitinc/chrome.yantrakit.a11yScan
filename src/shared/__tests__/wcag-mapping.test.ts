import { describe, it, expect } from "vitest";
import { filterCriteria, getManualReviewCriteria, mapRuleToWcag, WCAG_CRITERIA } from "../wcag-mapping";

describe("WCAG_CRITERIA", () => {
  it("has at least 80 criteria (A + AA + AAA)", () => {
    expect(WCAG_CRITERIA.length).toBeGreaterThanOrEqual(80);
  });

  it("includes AAA-level criteria", () => {
    const aaa = WCAG_CRITERIA.filter((c) => c.level === "AAA");
    expect(aaa.length).toBeGreaterThanOrEqual(20);
  });

  it("every criterion has required fields", () => {
    for (const c of WCAG_CRITERIA) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(["A", "AA", "AAA"]).toContain(c.level);
      expect(["perceivable", "operable", "understandable", "robust"]).toContain(c.principle);
      expect(["full", "partial", "manual"]).toContain(c.automation);
      expect(c.versions.length).toBeGreaterThan(0);
    }
  });

  it("has exactly 2 'full' automation criteria", () => {
    const full = WCAG_CRITERIA.filter((c) => c.automation === "full");
    expect(full.length).toBe(2);
    expect(full.map((c) => c.id)).toContain("2.4.2");
    expect(full.map((c) => c.id)).toContain("3.1.1");
  });
});

describe("filterCriteria", () => {
  it("WCAG 2.2 AA returns criteria up to 2.2 and AA", () => {
    const result = filterCriteria("2.2", "AA");
    expect(result.length).toBeGreaterThan(30);
    expect(result.every((c) => c.level !== "AAA")).toBe(true);
  });

  it("WCAG 2.0 A returns only 2.0 Level A criteria", () => {
    const result = filterCriteria("2.0", "A");
    expect(result.every((c) => c.level === "A")).toBe(true);
    expect(result.every((c) => c.versions.includes("2.0"))).toBe(true);
  });

  it("WCAG 2.2 AAA returns all criteria", () => {
    const result = filterCriteria("2.2", "AAA");
    expect(result.length).toBe(WCAG_CRITERIA.length);
  });
});

describe("getManualReviewCriteria", () => {
  it("excludes 'full' automation criteria", () => {
    const result = getManualReviewCriteria("2.2", "AA");
    expect(result.every((c) => c.automation !== "full")).toBe(true);
  });

  it("includes both 'partial' and 'manual' criteria", () => {
    const result = getManualReviewCriteria("2.2", "AA");
    const types = new Set(result.map((c) => c.automation));
    expect(types.has("partial")).toBe(true);
    expect(types.has("manual")).toBe(true);
  });
});

describe("mapRuleToWcag", () => {
  it("maps color-contrast to 1.4.3", () => {
    const result = mapRuleToWcag("color-contrast");
    expect(result).toContain("1.4.3");
  });

  it("maps document-title to 2.4.2", () => {
    const result = mapRuleToWcag("document-title");
    expect(result).toContain("2.4.2");
  });

  it("returns empty for unknown rule", () => {
    const result = mapRuleToWcag("nonexistent-rule");
    expect(result).toEqual([]);
  });

  it("maps link-name to both 2.4.4 and 4.1.2", () => {
    const result = mapRuleToWcag("link-name");
    expect(result).toContain("2.4.4");
    expect(result).toContain("4.1.2");
  });
});
