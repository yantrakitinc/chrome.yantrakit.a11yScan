// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  computeActionButtonText, manualReviewKey, formatDateStamp, computeReportSummary,
  severityOrder, urlToDomainSlug, renderViolation, renderAriaWidget,
  renderEmptyState, renderSubTabsHtml, renderManualReviewHtml, renderAriaResultsHtml, renderResults,
  renderCrawlResultsHtml, renderObserverListInnerHtml,
  renderScanProgressHtml, renderCrawlProgressHtml, renderPageRuleWaitHtml,
} from "../scan-tab";
import type { iScanResult, iAriaWidget, iPageElements, iObserverEntry } from "@shared/types";

type S = Parameters<typeof computeActionButtonText>[0];

function s(overrides: Partial<S> = {}): S {
  return {
    crawlPhase: "idle",
    scanPhase: "idle",
    observer: false,
    crawl: false,
    mv: false,
    ...overrides,
  };
}

describe("computeActionButtonText — busy phases dominate everything else", () => {
  it("returns 'Crawling…' while crawlPhase=crawling regardless of mode flags", () => {
    expect(computeActionButtonText(s({ crawlPhase: "crawling", crawl: true, mv: true }))).toMatch(/Crawling/);
  });
  it("returns 'Crawling…' while crawlPhase=wait", () => {
    expect(computeActionButtonText(s({ crawlPhase: "wait" }))).toMatch(/Crawling/);
  });
  it("returns 'Scanning…' while scanPhase=scanning", () => {
    expect(computeActionButtonText(s({ scanPhase: "scanning", crawl: true }))).toMatch(/Scanning/);
  });
});

describe("computeActionButtonText — paused phase", () => {
  it("returns 'Scan This Page' when paused + observer is on", () => {
    expect(computeActionButtonText(s({ crawlPhase: "paused", observer: true }))).toBe("Scan This Page");
  });
  it("returns 'Scan Page' when paused + observer is off", () => {
    expect(computeActionButtonText(s({ crawlPhase: "paused", observer: false }))).toBe("Scan Page");
  });
});

describe("computeActionButtonText — idle / results, mode precedence", () => {
  it("crawl > observer > mv > default — crawl wins", () => {
    expect(computeActionButtonText(s({ crawl: true, observer: true, mv: true }))).toBe("Start Crawl");
  });
  it("observer wins over mv when crawl is off", () => {
    expect(computeActionButtonText(s({ observer: true, mv: true }))).toBe("Scan This Page");
  });
  it("mv wins over default when observer + crawl are off", () => {
    expect(computeActionButtonText(s({ mv: true }))).toBe("Scan All Viewports");
  });
  it("falls back to 'Scan Page' with no flags set", () => {
    expect(computeActionButtonText(s())).toBe("Scan Page");
  });
});

describe("computeActionButtonText — results phase parity with idle", () => {
  it("results + crawl on → 'Start Crawl'", () => {
    expect(computeActionButtonText(s({ scanPhase: "results", crawl: true }))).toBe("Start Crawl");
  });
  it("results + observer on → 'Scan This Page'", () => {
    expect(computeActionButtonText(s({ scanPhase: "results", observer: true }))).toBe("Scan This Page");
  });
  it("results + mv on → 'Scan All Viewports'", () => {
    expect(computeActionButtonText(s({ scanPhase: "results", mv: true }))).toBe("Scan All Viewports");
  });
  it("crawlPhase=complete is treated like results for label purposes", () => {
    expect(computeActionButtonText(s({ crawlPhase: "complete", mv: true }))).toBe("Scan All Viewports");
  });
});

describe("manualReviewKey", () => {
  it("returns origin + pathname-prefixed key for a normal http URL", () => {
    expect(manualReviewKey("https://example.com/about")).toBe("manualReview_https://example.com/about");
  });
  it("strips fragments — same key for /page and /page#section", () => {
    expect(manualReviewKey("https://x.com/p#a")).toBe(manualReviewKey("https://x.com/p#b"));
  });
  it("strips query strings — same key for /search?q=a and /search?q=b", () => {
    expect(manualReviewKey("https://x.com/s?q=a")).toBe(manualReviewKey("https://x.com/s?q=b"));
  });
  it("differs between origins for the same pathname", () => {
    expect(manualReviewKey("https://a.com/x")).not.toBe(manualReviewKey("https://b.com/x"));
  });
  it("returns null when the input is not a parseable URL", () => {
    expect(manualReviewKey("not a url")).toBeNull();
    expect(manualReviewKey("")).toBeNull();
  });
});

describe("formatDateStamp", () => {
  it("zero-pads single-digit month/day/hour/minute", () => {
    // 2026-04-09 03:07 local time
    expect(formatDateStamp(new Date(2026, 3, 9, 3, 7))).toBe("2026-04-09_03-07");
  });
  it("renders two-digit values without extra padding", () => {
    expect(formatDateStamp(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31_23-59");
  });
});

describe("severityOrder", () => {
  it("orders critical < serious < moderate < minor", () => {
    expect(severityOrder("critical")).toBeLessThan(severityOrder("serious"));
    expect(severityOrder("serious")).toBeLessThan(severityOrder("moderate"));
    expect(severityOrder("moderate")).toBeLessThan(severityOrder("minor"));
  });
  it("returns 4 for an unknown impact value", () => {
    expect(severityOrder("unknown")).toBe(4);
    expect(severityOrder("")).toBe(4);
  });
  it("sorts a list of impacts critical-first when used as a comparator key", () => {
    const impacts = ["minor", "critical", "moderate", "serious"];
    const sorted = [...impacts].sort((a, b) => severityOrder(a) - severityOrder(b));
    expect(sorted).toEqual(["critical", "serious", "moderate", "minor"]);
  });
});

describe("urlToDomainSlug", () => {
  it("turns dots into hyphens in the hostname", () => {
    expect(urlToDomainSlug("https://www.example.com/page")).toBe("www-example-com");
  });
  it("ignores path / query / fragment", () => {
    expect(urlToDomainSlug("https://example.com/a?b=1#c")).toBe("example-com");
  });
  it("returns 'unknown' on unparseable URL", () => {
    expect(urlToDomainSlug("not a url")).toBe("unknown");
    expect(urlToDomainSlug("")).toBe("unknown");
  });
});

describe("renderViolation", () => {
  function v(overrides: Partial<iScanResult["violations"][0]> = {}): iScanResult["violations"][0] {
    return {
      id: "color-contrast",
      impact: "serious",
      description: "Contrast",
      help: "Improve contrast",
      helpUrl: "https://example.com/help",
      tags: ["wcag2aa"],
      nodes: [{ selector: "#x", html: "<div>x</div>", failureSummary: "Low contrast" }],
      wcagCriteria: ["1.4.3"],
      ...overrides,
    };
  }

  it("includes the WCAG criterion list in the summary", () => {
    expect(renderViolation(v())).toMatch(/1\.4\.3/);
  });
  it("falls back to the rule id when no wcagCriteria are present", () => {
    expect(renderViolation(v({ wcagCriteria: undefined }))).toMatch(/color-contrast/);
  });
  it("surfaces the impact severity as a class on the details element", () => {
    expect(renderViolation(v({ impact: "critical" }))).toMatch(/severity-critical/);
  });
  it("escapes html-injection in node selector and failureSummary", () => {
    const out = renderViolation(v({ nodes: [{ selector: "<svg/>", html: "x", failureSummary: "<script>alert(1)</script>" }] }));
    expect(out).not.toMatch(/<script>alert/);
    expect(out).toMatch(/&lt;svg\/&gt;/);
    expect(out).toMatch(/&lt;script&gt;alert/);
  });
  it("renders viewport-specific badges when widths are passed", () => {
    expect(renderViolation(v(), [375, 768])).toMatch(/375px[\s\S]*768px/);
  });
  it("renders no viewport badges when widths is null", () => {
    expect(renderViolation(v(), null)).not.toMatch(/375px/);
  });
  it("includes a Highlight button per node with data-selector", () => {
    const out = renderViolation(v({ nodes: [
      { selector: ".a", html: "x", failureSummary: "y" },
      { selector: ".b", html: "x", failureSummary: "y" },
    ] }));
    expect((out.match(/data-selector="\.a"/g) ?? []).length).toBe(1);
    expect((out.match(/data-selector="\.b"/g) ?? []).length).toBe(1);
  });
});

describe("renderAriaWidget", () => {
  function w(overrides: Partial<iAriaWidget> = {}): iAriaWidget {
    return {
      role: "tablist",
      selector: "#tabs",
      label: "Section tabs",
      html: "<div role=\"tablist\"></div>",
      checks: [
        { name: "has-tab-children", pass: true, message: "Found 3 tabs" },
        { name: "tabs-have-selected", pass: false, message: "No tab has aria-selected" },
      ],
      passCount: 1,
      failCount: 1,
      ...overrides,
    };
  }

  it("opens by default for failing widgets", () => {
    expect(renderAriaWidget(w(), false)).toMatch(/<details open/);
  });
  it("does not open by default for passing widgets", () => {
    expect(renderAriaWidget(w(), true)).toMatch(/<details (?!open)/);
  });
  it("uses green accent for pass and red accent for fail", () => {
    expect(renderAriaWidget(w(), true)).toMatch(/--ds-green/);
    expect(renderAriaWidget(w(), false)).toMatch(/--ds-red/);
  });
  it("escapes role / label / message html-injection", () => {
    const out = renderAriaWidget(w({
      role: "<x>",
      label: "<svg/>",
      checks: [{ name: "n", pass: false, message: "<script>" }],
    }), false);
    expect(out).not.toMatch(/<script>/);
    expect(out).toMatch(/&lt;x&gt;/);
    expect(out).toMatch(/&lt;svg\/&gt;/);
  });
  it("includes a Highlight-on-page button with the widget selector", () => {
    expect(renderAriaWidget(w({ selector: "#mytabs" }), false)).toMatch(/data-selector="#mytabs"/);
  });
});

describe("renderEmptyState", () => {
  it("returns a non-empty string with the 'Get started' headline", () => {
    const out = renderEmptyState();
    expect(out).toMatch(/Get started/);
  });
  it("describes the three scan modes (Crawl / Observer / Movie)", () => {
    const out = renderEmptyState();
    expect(out).toMatch(/Crawl/);
    expect(out).toMatch(/Observer/);
    expect(out).toMatch(/Movie/);
  });
});

describe("renderSubTabsHtml", () => {
  it("includes Results / Manual / ARIA tabs always", () => {
    const out = renderSubTabsHtml({ observer: false, activeSubTab: "results" });
    expect(out).toMatch(/Results/);
    expect(out).toMatch(/Manual/);
    expect(out).toMatch(/ARIA/);
    expect(out).not.toMatch(/Observe</);
  });
  it("appends an Observe tab when observer is on", () => {
    const out = renderSubTabsHtml({ observer: true, activeSubTab: "results" });
    expect(out).toMatch(/Observe/);
  });
  it("marks the active sub-tab with aria-selected=true and tabindex=0", () => {
    const out = renderSubTabsHtml({ observer: false, activeSubTab: "manual" });
    expect(out).toMatch(/id="subtab-manual" aria-selected="true"[^>]*tabindex="0"/);
    expect(out).toMatch(/id="subtab-results" aria-selected="false"[^>]*tabindex="-1"/);
  });
});

describe("renderManualReviewHtml", () => {
  function pageElements(overrides: Partial<iPageElements> = {}): iPageElements {
    return {
      hasVideo: false, hasAudio: false, hasForms: false, hasImages: false,
      hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false,
      hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false,
      ...overrides,
    };
  }

  it("renders one row per visible criterion", () => {
    const out = renderManualReviewHtml({ wcagVersion: "2.2", wcagLevel: "AA", pageElements: null, manualReview: {} });
    const rows = out.match(/data-criterion="/g);
    expect(rows && rows.length).toBeGreaterThan(0);
  });

  it("filters out criteria with relevantWhen=hasVideo when hasVideo=false", () => {
    const withVideo = renderManualReviewHtml({ wcagVersion: "2.2", wcagLevel: "AA", pageElements: pageElements({ hasVideo: true }), manualReview: {} });
    const withoutVideo = renderManualReviewHtml({ wcagVersion: "2.2", wcagLevel: "AA", pageElements: pageElements({ hasVideo: false }), manualReview: {} });
    // "1.2.4" Captions (Live) is relevantWhen=hasVideo
    expect(withVideo).toMatch(/data-criterion="1\.2\.4"/);
    expect(withoutVideo).not.toMatch(/data-criterion="1\.2\.4"/);
  });

  it("marks Pass button aria-pressed=true when status is pass", () => {
    const out = renderManualReviewHtml({ wcagVersion: "2.2", wcagLevel: "AA", pageElements: null, manualReview: { "1.4.3": "pass" } });
    expect(out).toMatch(/data-id="1\.4\.3" data-status="pass" aria-pressed="true"/);
  });

  it("counts reviewed criteria in the header", () => {
    const out = renderManualReviewHtml({
      wcagVersion: "2.2", wcagLevel: "AA", pageElements: null,
      manualReview: { "1.4.3": "pass", "2.4.3": "fail", "3.3.1": null },
    });
    expect(out).toMatch(/2 of \d+ reviewed/);
  });
});

describe("renderAriaResultsHtml", () => {
  function w(overrides: Partial<iAriaWidget> = {}): iAriaWidget {
    return {
      role: "tablist",
      selector: "#tabs",
      label: "Section",
      html: "<div></div>",
      checks: [{ name: "n", pass: true, message: "ok" }],
      passCount: 1,
      failCount: 0,
      ...overrides,
    };
  }

  it("shows the Scan ARIA Patterns CTA when no widgets", () => {
    const out = renderAriaResultsHtml([]);
    expect(out).toMatch(/Scan ARIA Patterns/);
    expect(out).toMatch(/id="run-aria-scan"/);
  });

  it("shows compliant + issues sections when widgets exist", () => {
    const out = renderAriaResultsHtml([
      w({ failCount: 0 }),
      w({ failCount: 1, role: "dialog" }),
    ]);
    expect(out).toMatch(/tablist/);
    expect(out).toMatch(/dialog/);
  });
});

describe("renderResults — single-page render shape", () => {
  function scan(overrides: Partial<iScanResult> = {}): iScanResult {
    return {
      url: "https://example.com",
      timestamp: "2026-01-01T00:00:00Z",
      violations: [],
      passes: [],
      incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: {
        hasVideo: false, hasAudio: false, hasForms: false, hasImages: false,
        hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false,
        hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false,
      },
      scanDurationMs: 100,
      ...overrides,
    };
  }

  it("renders a stats grid with 4 cells", () => {
    const out = renderResults(scan());
    expect(out).toMatch(/scan-stats-grid--4/);
  });

  it("shows passRate=100 when there are no violations + no passes", () => {
    expect(renderResults(scan())).toMatch(/100%/);
  });

  it("sorts violations critical-first", () => {
    const out = renderResults(scan({
      violations: [
        { id: "minor-rule", impact: "minor", description: "", help: "", helpUrl: "", tags: [], nodes: [{ selector: "#a", html: "", failureSummary: "" }] },
        { id: "critical-rule", impact: "critical", description: "", help: "", helpUrl: "", tags: [], nodes: [{ selector: "#b", html: "", failureSummary: "" }] },
      ],
    }));
    expect(out.indexOf("critical-rule")).toBeLessThan(out.indexOf("minor-rule"));
  });

  it("counts violation NODES (not rules) in the stats", () => {
    const out = renderResults(scan({
      violations: [
        { id: "x", impact: "serious", description: "", help: "", helpUrl: "", tags: [], nodes: [
          { selector: "#a", html: "", failureSummary: "" },
          { selector: "#b", html: "", failureSummary: "" },
          { selector: "#c", html: "", failureSummary: "" },
        ] },
      ],
    }));
    // 3 violation nodes
    expect(out).toMatch(/>3<\/div>[\s\S]*?Violations/);
  });
});

describe("renderCrawlResultsHtml", () => {
  function pageScan(url: string, violations: iScanResult["violations"] = []): iScanResult {
    return {
      url, timestamp: "2026-01-01", violations, passes: [], incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 0,
    };
  }

  it("renders one card per page in 'page' view", () => {
    const out = renderCrawlResultsHtml({
      "https://x.com/a": pageScan("https://x.com/a"),
      "https://x.com/b": pageScan("https://x.com/b"),
    }, {}, "page");
    expect((out.match(/https:\/\/x\.com\/a/g) ?? []).length).toBeGreaterThan(0);
    expect((out.match(/https:\/\/x\.com\/b/g) ?? []).length).toBeGreaterThan(0);
  });

  it("shows the failed-page error message in 'page' view", () => {
    const out = renderCrawlResultsHtml({}, { "https://x.com/fail": "Page load timeout" }, "page");
    expect(out).toMatch(/Page load timeout/);
  });

  it("aggregates violation node counts in the summary stats", () => {
    const out = renderCrawlResultsHtml({
      "https://x.com/a": pageScan("https://x.com/a", [{
        id: "x", impact: "serious", description: "", help: "", helpUrl: "", tags: [],
        nodes: [{ selector: "#a", html: "", failureSummary: "" }, { selector: "#b", html: "", failureSummary: "" }],
      }]),
    }, {}, "page");
    // 2 nodes total
    expect(out).toMatch(/>2<\/div>[\s\S]*?Violations/);
  });

  it("'wcag' view shows the no-violations empty message when none exist", () => {
    const out = renderCrawlResultsHtml({ "https://x.com/a": pageScan("https://x.com/a") }, {}, "wcag");
    expect(out).toMatch(/No violations found/);
  });
});

describe("renderObserverListInnerHtml", () => {
  function entry(overrides: Partial<iObserverEntry> = {}): iObserverEntry {
    return {
      id: "1", url: "https://x.com/a", title: "Page A",
      timestamp: "2026-01-01T00:00:00Z", source: "auto",
      violations: [], passes: [], violationCount: 0, viewportBucket: "≥1281px",
      ...overrides,
    };
  }

  it("renders the empty-state message when no entries", () => {
    expect(renderObserverListInnerHtml([], "")).toMatch(/Observer history will appear here/);
  });

  it("renders one row per entry, with the violation count", () => {
    const out = renderObserverListInnerHtml([entry({ violationCount: 5 })], "");
    expect(out).toMatch(/Page A/);
    expect(out).toMatch(/>5<\/span>/);
  });

  it("filters by URL substring (case-insensitive on title)", () => {
    const entries = [
      entry({ url: "https://example.com/x", title: "Example" }),
      entry({ url: "https://other.com/y", title: "Other" }),
    ];
    expect(renderObserverListInnerHtml(entries, "example")).toMatch(/Example/);
    expect(renderObserverListInnerHtml(entries, "example")).not.toMatch(/Other/);
  });

  it("renders the no-match message when filter excludes everything", () => {
    expect(renderObserverListInnerHtml([entry()], "no-match")).toMatch(/No entries match/);
  });
});

describe("renderScanProgressHtml", () => {
  it("shows 'analyzing page…' when not in MV scan", () => {
    expect(renderScanProgressHtml({ mv: false, mvProgress: null, viewports: [375] })).toMatch(/analyzing page/);
  });
  it("shows 'viewport 2/3' when MV progress is set", () => {
    expect(renderScanProgressHtml({ mv: true, mvProgress: { current: 2, total: 3 }, viewports: [375, 768, 1280] })).toMatch(/viewport 2\/3/);
  });
  it("shows 'viewport 1/N' when mv is on but mvProgress is null (start of scan)", () => {
    expect(renderScanProgressHtml({ mv: true, mvProgress: null, viewports: [375, 768] })).toMatch(/viewport 1\/2/);
  });
});

describe("renderCrawlProgressHtml", () => {
  it("shows N/M pages and percent fill when totals known", () => {
    const out = renderCrawlProgressHtml({ pagesVisited: 3, pagesTotal: 10, currentUrl: "https://x.com/p" }, "crawling");
    expect(out).toMatch(/3\/10 pages/);
    expect(out).toMatch(/width:30%/);
  });
  it("shows pause button when crawling, resume button when paused", () => {
    expect(renderCrawlProgressHtml({ pagesVisited: 1, pagesTotal: 0, currentUrl: "" }, "crawling")).toMatch(/pause-crawl/);
    expect(renderCrawlProgressHtml({ pagesVisited: 1, pagesTotal: 0, currentUrl: "" }, "paused")).toMatch(/resume-crawl/);
  });
  it("escapes HTML in the current URL", () => {
    const out = renderCrawlProgressHtml({ pagesVisited: 1, pagesTotal: 1, currentUrl: "https://x.com/<script>" }, "crawling");
    expect(out).not.toMatch(/<script>/);
    expect(out).toMatch(/&lt;script&gt;/);
  });
});

describe("renderPageRuleWaitHtml", () => {
  it("renders the description and URL when info is provided", () => {
    const out = renderPageRuleWaitHtml({ url: "https://x.com/login", description: "Please sign in" });
    expect(out).toMatch(/Please sign in/);
    expect(out).toMatch(/https:\/\/x\.com\/login/);
  });

  it("renders even when info is null (no description / no URL fields)", () => {
    const out = renderPageRuleWaitHtml(null);
    expect(out).toMatch(/Page rule triggered/);
  });

  it("escapes HTML in description and URL", () => {
    const out = renderPageRuleWaitHtml({ url: "https://x.com/<a>", description: "<script>alert(1)</script>" });
    expect(out).not.toMatch(/<script>alert\(1\)/);
    expect(out).toMatch(/&lt;script&gt;/);
  });
});

describe("computeReportSummary", () => {
  function v(nodeCount: number) { return { nodes: new Array(nodeCount).fill({}) }; }

  it("counts violations × nodes (not violation rules)", () => {
    const out = computeReportSummary([v(3), v(2)], [], []);
    expect(out.violationCount).toBe(5);
  });

  it("computes pass-rate as passes / (passes + violations) %", () => {
    const out = computeReportSummary([v(1)], [{}, {}, {}], []);
    expect(out.passRate).toBe(75); // 3 passes / (1 violation rule + 3 passes) = 75%
  });

  it("returns passRate=100 when there are zero rules total", () => {
    expect(computeReportSummary([], [], []).passRate).toBe(100);
  });

  it("counts incomplete entries verbatim", () => {
    expect(computeReportSummary([], [], [{}, {}]).incompleteCount).toBe(2);
  });

  it("rounds passRate to the nearest integer", () => {
    // 1 violation, 2 passes — 2/3 = 66.667% → rounds to 67
    expect(computeReportSummary([v(1)], [{}, {}], []).passRate).toBe(67);
  });
});
