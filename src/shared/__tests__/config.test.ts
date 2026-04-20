import { describe, it, expect } from "vitest";
import { buildWcagTags } from "../config";

describe("buildWcagTags", () => {
  it("WCAG 2.0 A returns only wcag2a", () => {
    expect(buildWcagTags("2.0", "A")).toEqual(["wcag2a"]);
  });

  it("WCAG 2.0 AA returns wcag2a and wcag2aa", () => {
    expect(buildWcagTags("2.0", "AA")).toEqual(["wcag2a", "wcag2aa"]);
  });

  it("WCAG 2.1 AA returns 2.0 + 2.1 at A and AA", () => {
    const tags = buildWcagTags("2.1", "AA");
    expect(tags).toContain("wcag2a");
    expect(tags).toContain("wcag2aa");
    expect(tags).toContain("wcag21a");
    expect(tags).toContain("wcag21aa");
    expect(tags).not.toContain("wcag22a");
  });

  it("WCAG 2.2 AA returns all versions at A and AA", () => {
    const tags = buildWcagTags("2.2", "AA");
    expect(tags).toContain("wcag2a");
    expect(tags).toContain("wcag2aa");
    expect(tags).toContain("wcag21a");
    expect(tags).toContain("wcag21aa");
    expect(tags).toContain("wcag22a");
    expect(tags).toContain("wcag22aa");
    expect(tags).not.toContain("wcag2aaa");
  });

  it("WCAG 2.2 AAA returns all 9 tags", () => {
    const tags = buildWcagTags("2.2", "AAA");
    expect(tags.length).toBe(9);
  });
});
