import { describe, it, expect } from "vitest";
import { isUrlGated, stripFragment } from "../crawl";

describe("isUrlGated", () => {
  it("returns false when no gating config given", () => {
    expect(isUrlGated("https://x.com/admin", undefined)).toBe(false);
  });

  it("returns false for mode=none even with patterns", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "none", patterns: ["https://x.com/admin"] })).toBe(false);
  });

  it("returns false for empty patterns array", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "list", patterns: [] })).toBe(false);
  });

  it("mode=list matches exact URL only", () => {
    const cfg = { mode: "list", patterns: ["https://x.com/admin"] };
    expect(isUrlGated("https://x.com/admin", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/admin/users", cfg)).toBe(false);
    expect(isUrlGated("https://x.com/ADMIN", cfg)).toBe(false);
  });

  it("mode=prefix matches startsWith", () => {
    const cfg = { mode: "prefix", patterns: ["https://x.com/admin"] };
    expect(isUrlGated("https://x.com/admin", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/admin/users", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/public", cfg)).toBe(false);
  });

  it("mode=regex matches with RegExp test", () => {
    const cfg = { mode: "regex", patterns: ["^https://x\\.com/(admin|account)/"] };
    expect(isUrlGated("https://x.com/admin/", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/account/edit", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/public", cfg)).toBe(false);
  });

  it("mode=regex with an invalid pattern returns false instead of throwing", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "regex", patterns: ["[unbalanced"] })).toBe(false);
  });

  it("returns false for unknown mode", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "garbage", patterns: ["https://x.com/admin"] })).toBe(false);
  });

  it("matches if any pattern in the list matches", () => {
    const cfg = { mode: "prefix", patterns: ["https://x.com/admin", "https://x.com/account"] };
    expect(isUrlGated("https://x.com/account/billing", cfg)).toBe(true);
  });
});

describe("stripFragment", () => {
  it("removes a hash fragment", () => {
    expect(stripFragment("https://x.com/page#section")).toBe("https://x.com/page");
  });

  it("preserves trailing slash semantics", () => {
    expect(stripFragment("https://x.com/page/#section")).toBe("https://x.com/page/");
  });

  it("preserves query string", () => {
    expect(stripFragment("https://x.com/page?a=1#section")).toBe("https://x.com/page?a=1");
  });

  it("returns input unchanged when there is no fragment", () => {
    expect(stripFragment("https://x.com/page")).toBe("https://x.com/page");
  });

  it("collapses /page#a and /page#b to the same canonical form", () => {
    expect(stripFragment("https://x.com/page#a")).toBe(stripFragment("https://x.com/page#b"));
  });

  it("returns the raw input when URL parsing fails", () => {
    expect(stripFragment("not a url")).toBe("not a url");
  });
});
