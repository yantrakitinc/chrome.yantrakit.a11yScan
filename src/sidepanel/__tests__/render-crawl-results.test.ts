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

describe("renderResults — Multi-Viewport state branches", () => {
  function violation(id: string, impact: "serious" | "minor" = "serious") {
    return {
      id, impact, description: id, help: "", helpUrl: "", tags: [],
      nodes: [{ selector: "#" + id, html: "", failureSummary: "" }],
      wcagCriteria: ["1.4.3"],
    };
  }

  it("with mvResult and mvFilter=null, the All chip renders with selected (amber-100) bg", () => {
    const scan = makeScan({ violations: [violation("v1")] });
    const mvResult = {
      viewports: [375, 768, 1280],
      shared: [],
      viewportSpecific: [],
      perViewport: { 375: scan, 768: scan, 1280: scan },
    };
    const html = renderResults(scan, mvResult, null);
    // The 'All' chip is selected when mvFilter is null
    expect(html).toMatch(/data-mvfilter="all" aria-pressed="true"/);
    expect(html).toMatch(/data-mvfilter="375" aria-pressed="false"/);
  });

  it("with mvFilter=768 (a specific viewport), only that chip is pressed", () => {
    const scan = makeScan({ violations: [violation("v1")] });
    const mvResult = {
      viewports: [375, 768, 1280],
      shared: [],
      viewportSpecific: [],
      perViewport: { 375: scan, 768: scan, 1280: scan },
    };
    const html = renderResults(scan, mvResult, 768);
    expect(html).toMatch(/data-mvfilter="all" aria-pressed="false"/);
    expect(html).toMatch(/data-mvfilter="768" aria-pressed="true"/);
    expect(html).toMatch(/data-mvfilter="375" aria-pressed="false"/);
  });

  it("when mvFilter selects a viewport with no perViewport entry, displayViolations is empty", () => {
    const scan = makeScan({ violations: [violation("v1")] });
    const mvResult = {
      viewports: [375, 768],
      shared: [],
      viewportSpecific: [],
      perViewport: { 375: scan }, // 768 missing
    };
    const html = renderResults(scan, mvResult, 768);
    // No violation row from v1 should be rendered (filter excludes it)
    expect(html).not.toMatch(/sr-details/);
  });

  it("violation tagged in viewportSpecific gets a viewport badge", () => {
    const v = violation("vp-only");
    const scan = makeScan({ violations: [v] });
    const mvResult = {
      viewports: [375, 768],
      shared: [],
      viewportSpecific: [{ id: "vp-only", viewports: [768] }],
      perViewport: { 375: scan, 768: scan },
    };
    const html = renderResults(scan, mvResult, null);
    // The 768px badge should appear next to the violation
    expect(html).toMatch(/>768px</);
  });
});

describe("renderCrawlResultsHtml — pluralization branches", () => {
  it("violationCount === 1 renders 'issue' (singular)", () => {
    const results = {
      "https://x.com/a": makeScan({
        violations: [{ id: "v1", impact: "serious" as const, description: "x", help: "", helpUrl: "", tags: [], nodes: [{ selector: "#a", html: "", failureSummary: "" }], wcagCriteria: ["1.4.3"] }],
      }),
    };
    const html = renderCrawlResultsHtml(results, {}, "page");
    expect(html).toMatch(/1 issue\b/);
    expect(html).not.toMatch(/1 issues/);
  });

  it("uniquePages.length === 1 renders 'page' (singular)", () => {
    const results = {
      "https://x.com/single": makeScan({
        violations: [{ id: "v1", impact: "serious" as const, description: "x", help: "", helpUrl: "", tags: [], nodes: [{ selector: "#a", html: "", failureSummary: "" }], wcagCriteria: ["1.4.3"] }],
      }),
    };
    const html = renderCrawlResultsHtml(results, {}, "wcag");
    expect(html).toMatch(/1 page\b/);
    expect(html).not.toMatch(/1 pages/);
  });
});

describe("renderCrawlResultsHtml — crawl view toggle aria-pressed", () => {
  it("crawlViewMode='page' marks By page chip pressed", () => {
    const html = renderCrawlResultsHtml({}, {}, "page");
    expect(html).toMatch(/id="crawl-view-page" aria-pressed="true"/);
    expect(html).toMatch(/id="crawl-view-wcag" aria-pressed="false"/);
  });

  it("crawlViewMode='wcag' marks By WCAG chip pressed", () => {
    const html = renderCrawlResultsHtml({}, {}, "wcag");
    expect(html).toMatch(/id="crawl-view-page" aria-pressed="false"/);
    expect(html).toMatch(/id="crawl-view-wcag" aria-pressed="true"/);
  });
});
