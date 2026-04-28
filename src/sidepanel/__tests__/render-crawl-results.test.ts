// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderCrawlResultsHtml, renderResults } from "../scan-tab";
import type { iScanResult } from "@shared/types";

function makeScan(opts: Partial<iScanResult> = {}): iScanResult {
  return {
    url: opts.url ?? "https://x.com/page",
    timestamp: opts.timestamp ?? "2026-01-01",
    violations: opts.violations ?? [],
    passes: opts.passes ?? [],
    incomplete: opts.incomplete ?? [],
    summary: opts.summary ?? { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
    pageElements: opts.pageElements ?? { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
    scanDurationMs: opts.scanDurationMs ?? 100,
  };
}

describe("renderCrawlResultsHtml — by-page view", () => {
  it("renders one details row per crawled URL with the correct violation count", () => {
    const results = {
      "https://x.com/a": makeScan({
        url: "https://x.com/a",
        violations: [{ id: "color-contrast", impact: "serious" as const, description: "Contrast", help: "", helpUrl: "", tags: [], nodes: [{ selector: "#a", html: "", failureSummary: "" }, { selector: "#b", html: "", failureSummary: "" }], wcagCriteria: ["1.4.3"] }],
      }),
      "https://x.com/b": makeScan({ url: "https://x.com/b", violations: [], passes: [{ id: "html-lang", description: "", tags: [], nodes: [{ selector: "html", html: "" }], wcagCriteria: ["3.1.1"] }] }),
    };
    const html = renderCrawlResultsHtml(results, {}, "page");
    expect(html).toMatch(/https:\/\/x\.com\/a/);
    expect(html).toMatch(/https:\/\/x\.com\/b/);
    expect(html).toMatch(/2 issues/); // 2 nodes on /a
    expect(html).toMatch(/1 pass/); // 1 pass on /b
  });

  it("renders failed URLs with an error row even with no violations", () => {
    const html = renderCrawlResultsHtml({}, { "https://x.com/dead": "404 not found" }, "page");
    expect(html).toMatch(/404 not found/);
    expect(html).toMatch(/https:\/\/x\.com\/dead/);
  });
});

describe("renderCrawlResultsHtml — by-wcag view", () => {
  it("groups violations across pages by WCAG criterion", () => {
    const violation = (id: string, criterion: string) => ({
      id,
      impact: "serious" as const,
      description: id,
      help: "",
      helpUrl: "",
      tags: [],
      nodes: [{ selector: "#" + id, html: "", failureSummary: "" }],
      wcagCriteria: [criterion],
    });
    const results = {
      "https://x.com/a": makeScan({ violations: [violation("v1", "1.4.3")] }),
      "https://x.com/b": makeScan({ violations: [violation("v2", "1.4.3"), violation("v3", "2.1.1")] }),
    };
    const html = renderCrawlResultsHtml(results, {}, "wcag");
    // Both criteria appear
    expect(html).toMatch(/1\.4\.3/);
    expect(html).toMatch(/2\.1\.1/);
    // 1.4.3 appears across 2 pages
    expect(html).toMatch(/2 pages/);
  });

  it("'No violations found across all pages' empty state when wcag view has zero violations", () => {
    const results = {
      "https://x.com/clean": makeScan({ violations: [] }),
    };
    const html = renderCrawlResultsHtml(results, {}, "wcag");
    expect(html).toMatch(/No violations found across all pages/);
  });
});

describe("renderResults — passes section renders when scan has passes", () => {
  it("when result has passes, renders the passes <details> with each pass id and node count", () => {
    const result = makeScan({
      url: "https://x.com",
      violations: [],
      passes: [
        { id: "html-lang", description: "Has lang attr", tags: [], nodes: [{ selector: "html", html: "<html lang=\"en\">" }], wcagCriteria: ["3.1.1"] },
        { id: "image-alt", description: "Has alt text", tags: [], nodes: [{ selector: "img.a", html: "<img alt='x'>" }, { selector: "img.b", html: "<img alt='y'>" }], wcagCriteria: ["1.1.1"] },
      ],
    });
    const html = renderResults(result);
    expect(html).toMatch(/html-lang/);
    expect(html).toMatch(/image-alt/);
    expect(html).toMatch(/2 rules passed/);
  });
});
