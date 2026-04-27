// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isScannableUrl, matchesDomain, extractDomain, getViewportBucket, escHtml, buildElementSelector } from "../utils";

// jsdom doesn't include CSS.escape; polyfill the spec algorithm so
// buildElementSelector tests can exercise the same code path real browsers do.
// Minimal implementation per https://drafts.csswg.org/cssom/#serialize-an-identifier
if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = {
    escape(value: string): string {
      let out = "";
      for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c === 0) { out += "�"; continue; }
        if (
          (c >= 0x0001 && c <= 0x001f) || c === 0x007f ||
          (i === 0 && c >= 0x0030 && c <= 0x0039) ||
          (i === 1 && c >= 0x0030 && c <= 0x0039 && value.charCodeAt(0) === 0x002d)
        ) { out += "\\" + c.toString(16) + " "; continue; }
        if (i === 0 && c === 0x002d && value.length === 1) { out += "\\" + value.charAt(i); continue; }
        if (
          c >= 0x0080 || c === 0x002d || c === 0x005f ||
          (c >= 0x0030 && c <= 0x0039) ||
          (c >= 0x0041 && c <= 0x005a) ||
          (c >= 0x0061 && c <= 0x007a)
        ) { out += value.charAt(i); continue; }
        out += "\\" + value.charAt(i);
      }
      return out;
    },
  };
}

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

describe("buildElementSelector", () => {
  function elFromHtml(html: string): Element {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    return doc.body.firstElementChild!.firstElementChild!;
  }

  it("returns #id when element has an id", () => {
    expect(buildElementSelector(elFromHtml('<button id="submit">x</button>'))).toBe("#submit");
  });

  it("CSS.escape's an id that starts with a digit", () => {
    const sel = buildElementSelector(elFromHtml('<div id="42x">x</div>'));
    // CSS.escape turns leading digits into a unicode escape; the result must
    // round-trip through querySelector without throwing.
    const doc = new DOMParser().parseFromString(`<div id="42x"></div>`, "text/html");
    expect(() => doc.querySelector(sel)).not.toThrow();
    expect(doc.querySelector(sel)).toBeTruthy();
  });

  it("CSS.escape's an id with special characters (quotes, brackets)", () => {
    const sel = buildElementSelector(elFromHtml('<div id=\'q"x[1]\'>x</div>'));
    const doc = new DOMParser().parseFromString(`<div id='q"x[1]'></div>`, "text/html");
    expect(() => doc.querySelector(sel)).not.toThrow();
    expect(doc.querySelector(sel)).toBeTruthy();
  });

  it("falls back to tag name when no id and no classes", () => {
    expect(buildElementSelector(elFromHtml("<p>hi</p>"))).toBe("p");
  });

  it("uses tag.class1.class2 when no id but classes are present", () => {
    expect(buildElementSelector(elFromHtml('<div class="a b c">x</div>'))).toBe("div.a.b");
  });

  it("filters out Tailwind variants (containing :, [, @, !)", () => {
    expect(buildElementSelector(elFromHtml('<div class="hover:bg-red md:flex bg-white">x</div>'))).toBe("div.bg-white");
  });

  it("CSS.escape's class names with special chars", () => {
    const sel = buildElementSelector(elFromHtml('<div class="a\\.b">x</div>'));
    expect(sel).toBe("div.a\\\\\\.b");
  });

  it("limits to two classes max", () => {
    const sel = buildElementSelector(elFromHtml('<div class="a b c d e">x</div>'));
    expect(sel.split(".").length).toBe(3);
  });
});
