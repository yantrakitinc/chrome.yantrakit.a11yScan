import { describe, it, expect } from "vitest";
import { isScannableUrl, matchesDomain, extractDomain, getViewportBucket, escHtml } from "../utils";

describe("isScannableUrl", () => {
  it("allows http URLs", () => {
    expect(isScannableUrl("http://example.com")).toBe(true);
  });
  it("allows https URLs", () => {
    expect(isScannableUrl("https://example.com/page")).toBe(true);
  });
  it("rejects chrome:// URLs", () => {
    expect(isScannableUrl("chrome://extensions")).toBe(false);
  });
  it("rejects chrome-extension:// URLs", () => {
    expect(isScannableUrl("chrome-extension://abc/popup.html")).toBe(false);
  });
  it("rejects file:// URLs", () => {
    expect(isScannableUrl("file:///home/user/index.html")).toBe(false);
  });
  it("rejects data: URLs", () => {
    expect(isScannableUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isScannableUrl("")).toBe(false);
  });
  it("rejects about: URLs", () => {
    expect(isScannableUrl("about:blank")).toBe(false);
  });
});

describe("matchesDomain", () => {
  it("matches exact domain", () => {
    expect(matchesDomain("https://example.com/page", ["example.com"])).toBe(true);
  });
  it("does not match different domain", () => {
    expect(matchesDomain("https://other.com", ["example.com"])).toBe(false);
  });
  it("matches wildcard *", () => {
    expect(matchesDomain("https://anything.com", ["*"])).toBe(true);
  });
  it("matches wildcard subdomain *.example.com", () => {
    expect(matchesDomain("https://sub.example.com", ["*.example.com"])).toBe(true);
  });
  it("wildcard *.example.com matches bare domain", () => {
    expect(matchesDomain("https://example.com", ["*.example.com"])).toBe(true);
  });
  it("returns false for empty patterns", () => {
    expect(matchesDomain("https://example.com", [])).toBe(false);
  });
  it("handles invalid URLs gracefully", () => {
    expect(matchesDomain("not-a-url", ["example.com"])).toBe(false);
  });
});

describe("extractDomain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("www.example.com");
  });
  it("returns input for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("not-a-url");
  });
});

describe("getViewportBucket", () => {
  const breakpoints = [375, 768, 1280];

  it("returns ≤375px for width 320", () => {
    expect(getViewportBucket(320, breakpoints)).toBe("≤375px");
  });
  it("returns ≤375px for width 375", () => {
    expect(getViewportBucket(375, breakpoints)).toBe("≤375px");
  });
  it("returns 376–768px for width 500", () => {
    expect(getViewportBucket(500, breakpoints)).toBe("376–768px");
  });
  it("returns 769–1280px for width 1024", () => {
    expect(getViewportBucket(1024, breakpoints)).toBe("769–1280px");
  });
  it("returns ≥1281px for width 1440", () => {
    expect(getViewportBucket(1440, breakpoints)).toBe("≥1281px");
  });
});

describe("escHtml", () => {
  it("escapes ampersand", () => {
    expect(escHtml("a & b")).toBe("a &amp; b");
  });
  it("escapes less-than", () => {
    expect(escHtml("a < b")).toBe("a &lt; b");
  });
  it("escapes greater-than", () => {
    expect(escHtml("a > b")).toBe("a &gt; b");
  });
  it("escapes double quote", () => {
    expect(escHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });
  it("escapes ampersand BEFORE other entities so &lt; becomes &amp;lt; not &lt; (no double-escape regression)", () => {
    expect(escHtml("&lt;")).toBe("&amp;lt;");
  });
  it("escapes a script-tag injection attempt to harmless text", () => {
    expect(escHtml('<script>alert("x")</script>')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
  it("returns empty string unchanged", () => {
    expect(escHtml("")).toBe("");
  });
  it("leaves single quotes alone (templates use double-quoted attrs)", () => {
    expect(escHtml("it's fine")).toBe("it's fine");
  });
});
