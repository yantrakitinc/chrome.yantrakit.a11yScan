import { describe, it, expect } from "vitest";
import { filterCriteria, getManualReviewCriteria, mapRuleToWcag, mapAxeTagsToWcag, getWcagUrl, WCAG_CRITERIA, WCAG_SLUG_MAP } from "../wcag-mapping";

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

describe("getWcagUrl", () => {
  it("returns the slug-specific URL for a known criterion", () => {
    expect(getWcagUrl("1.4.3")).toBe("https://a11yscan.yantrakit.com/wcag/1-4-3-contrast-minimum");
  });
  it("returns the WCAG-2.2 criterion URL for 2.4.11", () => {
    expect(getWcagUrl("2.4.11")).toBe("https://a11yscan.yantrakit.com/wcag/2-4-11-focus-not-obscured");
  });
  it("falls back to the index page for an unknown criterion id", () => {
    expect(getWcagUrl("99.99.99")).toBe("https://a11yscan.yantrakit.com/wcag");
  });
  it("every WCAG criterion in the database has a slug entry", () => {
    for (const c of WCAG_CRITERIA) {
      expect(WCAG_SLUG_MAP[c.id], `missing slug for ${c.id}`).toBeTruthy();
    }
  });
});

describe("mapAxeTagsToWcag", () => {
  it("converts a basic single-digit criterion tag", () => {
    expect(mapAxeTagsToWcag(["wcag111"])).toEqual(["1.1.1"]);
  });

  it("converts a two-digit final segment for criteria like 1.4.10", () => {
    expect(mapAxeTagsToWcag(["wcag1410"])).toEqual(["1.4.10"]);
  });

  it("converts the WCAG 2.2 criteria 2.4.11 / 2.4.13", () => {
    expect(mapAxeTagsToWcag(["wcag2411"])).toEqual(["2.4.11"]);
    expect(mapAxeTagsToWcag(["wcag2413"])).toEqual(["2.4.13"]);
  });

  it("ignores level tags like wcag2aa / wcag21aa / wcag2a", () => {
    expect(mapAxeTagsToWcag(["wcag2aa", "wcag21aa", "wcag2a"])).toEqual([]);
  });

  it("ignores non-wcag tags (best-practice, ACT, section508)", () => {
    expect(mapAxeTagsToWcag(["best-practice", "ACT", "section508"])).toEqual([]);
  });

  it("returns multiple criteria when multiple wcag tags are present", () => {
    expect(mapAxeTagsToWcag(["wcag111", "wcag143", "wcag2aa"])).toEqual(["1.1.1", "1.4.3"]);
  });

  it("deduplicates repeated criteria", () => {
    expect(mapAxeTagsToWcag(["wcag111", "wcag111", "wcag111"])).toEqual(["1.1.1"]);
  });

  it("returns an empty array for an empty input", () => {
    expect(mapAxeTagsToWcag([])).toEqual([]);
  });

  it("ignores malformed wcag tags (letters in body, missing digits)", () => {
    expect(mapAxeTagsToWcag(["wcag", "wcag1", "wcag1a1", "wcagAAA"])).toEqual([]);
  });
});
