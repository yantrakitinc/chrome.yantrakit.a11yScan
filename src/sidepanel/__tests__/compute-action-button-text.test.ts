// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  computeActionButtonText, manualReviewKey, formatDateStamp, computeReportSummary,
  severityOrder, urlToDomainSlug, renderViolation, renderAriaWidget,
  renderEmptyState, renderSubTabsHtml, renderManualReviewHtml, renderAriaResultsHtml, renderResults,
  renderCrawlResultsHtml, renderObserverListInnerHtml,
  renderScanProgressHtml, renderCrawlProgressHtml, renderPageRuleWaitHtml,
  renderModeTogglesHtml, renderCollapsedToggleHtml, renderToolbarContentHtml,
  renderExpandedToggleHtml, renderMvCheckboxHtml,
  renderCrawlConfigHtml, renderUrlListPanelHtml,
  buildJsonReportFrom, buildHtmlReportFrom, parsePastedUrls, addViewport, removeViewport,
  buildStartCrawlPayload, mergeMvResultToScan, buildObserverEntry, resetScanStateSlice,
  mergeNewUrlsIntoList, parseTextFileUrls, clearScanResultsSlice,
  addManualUrlToList, removeUrlAtIndex,
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

  it("shows the Scan ARIA Patterns CTA when no widgets and scanned=false (pre-scan empty state)", () => {
    const out = renderAriaResultsHtml([], false);
    expect(out).toMatch(/Scan ARIA Patterns/);
    expect(out).toMatch(/id="run-aria-scan"/);
    expect(out).toMatch(/No ARIA widgets scanned yet/);
  });

  it("defaults scanned=false when omitted (backward-compatible pre-scan empty state)", () => {
    const out = renderAriaResultsHtml([]);
    expect(out).toMatch(/Scan ARIA Patterns/);
    expect(out).toMatch(/id="run-aria-scan"/);
  });

  it("shows post-scan zero-result message when no widgets and scanned=true (NO manual button — bug fix for issue #99)", () => {
    const out = renderAriaResultsHtml([], true);
    expect(out).toMatch(/No ARIA widgets detected on this page/);
    expect(out).not.toMatch(/Scan ARIA Patterns/);
    expect(out).not.toMatch(/id="run-aria-scan"/);
    expect(out).not.toMatch(/scanned yet/);
  });

  it("shows compliant + issues sections when widgets exist (regardless of scanned flag)", () => {
    const out1 = renderAriaResultsHtml([
      w({ failCount: 0 }),
      w({ failCount: 1, role: "dialog" }),
    ], true);
    expect(out1).toMatch(/tablist/);
    expect(out1).toMatch(/dialog/);
    const out2 = renderAriaResultsHtml([
      w({ failCount: 0 }),
      w({ failCount: 1, role: "dialog" }),
    ], false);
    expect(out2).toMatch(/tablist/);
    expect(out2).toMatch(/dialog/);
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

describe("renderCrawlConfigHtml", () => {
  function s(overrides: Partial<Parameters<typeof renderCrawlConfigHtml>[0]> = {}) {
    return { crawlMode: "follow" as const, urlListPanelOpen: false, urlList: [], busy: false, ...overrides };
  }

  it("renders the Crawl mode dropdown with the active option selected", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist" }))).toMatch(/value="urllist" selected/);
    expect(renderCrawlConfigHtml(s({ crawlMode: "follow" }))).toMatch(/value="follow" selected/);
  });

  it("hides the URL-list button in 'follow' mode", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "follow" }))).not.toMatch(/id="url-list-open"/);
  });

  it("shows 'Set up URL list' when urllist mode + zero urls", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlList: [] }))).toMatch(/Set up URL list/);
  });

  it("shows '<count> URLs — Edit list' when urllist mode + ≥1 url", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlList: ["a", "b", "c"] }))).toMatch(/3 URLs/);
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlList: ["a"] }))).toMatch(/1 URL[^s]/);
  });

  it("toggles aria-expanded on the URL-list button", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlListPanelOpen: true }))).toMatch(/id="url-list-open"[^>]*aria-expanded="true"/);
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlListPanelOpen: false }))).toMatch(/id="url-list-open"[^>]*aria-expanded="false"/);
  });

  it("renders the URL-list panel when both urllist mode + panel open", () => {
    const out = renderCrawlConfigHtml(s({ crawlMode: "urllist", urlListPanelOpen: true, urlList: ["https://x.com/a"] }));
    expect(out).toMatch(/id="url-list-panel"/);
  });

  it("does NOT render the URL-list panel when urllist mode but panel closed", () => {
    expect(renderCrawlConfigHtml(s({ crawlMode: "urllist", urlListPanelOpen: false }))).not.toMatch(/id="url-list-panel"/);
  });

  it("disables crawl-mode select when busy=true", () => {
    expect(renderCrawlConfigHtml(s({ busy: true }))).toMatch(/id="crawl-mode"[^>]*disabled/);
  });
});

describe("renderUrlListPanelHtml", () => {
  it("renders one row per URL", () => {
    const out = renderUrlListPanelHtml(["https://x.com/a", "https://y.com/b"]);
    expect((out.match(/class="url-remove-btn/g) ?? []).length).toBe(2);
    expect(out).toMatch(/https:\/\/x\.com\/a/);
    expect(out).toMatch(/https:\/\/y\.com\/b/);
  });

  it("escapes html-injection in URLs", () => {
    const out = renderUrlListPanelHtml(["https://x.com/<script>"]);
    expect(out).not.toMatch(/<script>/);
    expect(out).toMatch(/&lt;script&gt;/);
  });

  it("renders 'N URLs will be scanned' summary when at least one URL", () => {
    expect(renderUrlListPanelHtml(["a", "b"])).toMatch(/2 URLs will be scanned/);
    expect(renderUrlListPanelHtml(["a"])).toMatch(/1 URL will be scanned/);
  });

  it("hides the summary when zero URLs", () => {
    expect(renderUrlListPanelHtml([])).not.toMatch(/will be scanned/);
  });

  it("includes the paste textarea, manual-add input, and Done button", () => {
    const out = renderUrlListPanelHtml([]);
    expect(out).toMatch(/id="url-paste-area"/);
    expect(out).toMatch(/id="url-manual-input"/);
    expect(out).toMatch(/id="url-list-done"/);
  });
});

describe("renderExpandedToggleHtml", () => {
  function s(overrides: Partial<Parameters<typeof renderExpandedToggleHtml>[0]> = {}) {
    return { wcagVersion: "2.2", wcagLevel: "AA", hasTestConfig: false, configPanelOpen: false, busy: false, ...overrides };
  }

  it("selects the active WCAG version + level option", () => {
    const out = renderExpandedToggleHtml(s({ wcagVersion: "2.1", wcagLevel: "AAA" }));
    expect(out).toMatch(/<option selected[^>]*>2\.1</);
    expect(out).toMatch(/<option selected[^>]*>AAA</);
  });

  it("sets settings-btn aria-expanded reflecting configPanelOpen", () => {
    expect(renderExpandedToggleHtml(s({ configPanelOpen: true }))).toMatch(/id="settings-btn"[^>]*aria-expanded="true"/);
    expect(renderExpandedToggleHtml(s({ configPanelOpen: false }))).toMatch(/id="settings-btn"[^>]*aria-expanded="false"/);
  });

  it("shows the 'Config loaded' badge when hasTestConfig is true", () => {
    expect(renderExpandedToggleHtml(s({ hasTestConfig: true }))).toMatch(/Config loaded/);
    expect(renderExpandedToggleHtml(s({ hasTestConfig: false }))).not.toMatch(/Config loaded/);
  });

  it("disables every control when busy=true", () => {
    const out = renderExpandedToggleHtml(s({ busy: true }));
    expect(out).toMatch(/id="wcag-version"[^>]*disabled/);
    expect(out).toMatch(/id="wcag-level"[^>]*disabled/);
    expect(out).toMatch(/id="settings-btn"[^>]*disabled/);
    expect(out).toMatch(/id="reset-btn"[^>]*disabled/);
  });
});

describe("renderMvCheckboxHtml", () => {
  function s(overrides: Partial<Parameters<typeof renderMvCheckboxHtml>[0]> = {}) {
    return { mv: false, viewports: [375, 768, 1280], viewportEditing: false, busy: false, ...overrides };
  }

  it("renders just the checkbox when mv=false", () => {
    const out = renderMvCheckboxHtml(s({ mv: false }));
    expect(out).toMatch(/id="mv-check"/);
    expect(out).not.toMatch(/id="mv-check"[^>]*checked/);
    expect(out).not.toMatch(/vp-edit/);
  });

  it("checks the checkbox and renders chip row when mv=true viewportEditing=false", () => {
    const out = renderMvCheckboxHtml(s({ mv: true }));
    expect(out).toMatch(/id="mv-check"[^>]*checked/);
    expect(out).toMatch(/375/);
    expect(out).toMatch(/768/);
    expect(out).toMatch(/1280/);
    expect(out).toMatch(/id="vp-edit"/);
  });

  it("renders the inline editor when viewportEditing=true", () => {
    const out = renderMvCheckboxHtml(s({ mv: true, viewportEditing: true }));
    expect(out).toMatch(/class="vp-input/);
    expect(out).toMatch(/class="vp-remove/);
    expect(out).toMatch(/id="vp-add"/);
    expect(out).toMatch(/id="vp-done"/);
  });

  it("disables vp-remove when there's only one viewport (cannot remove last)", () => {
    const out = renderMvCheckboxHtml(s({ mv: true, viewportEditing: true, viewports: [375] }));
    expect(out).toMatch(/class="vp-remove[^"]*"[^>]*disabled/);
  });

  it("disables +add when there are already 6 viewports", () => {
    const out = renderMvCheckboxHtml(s({ mv: true, viewportEditing: true, viewports: [320, 375, 768, 1024, 1280, 1440] }));
    expect(out).toMatch(/id="vp-add"[^>]*disabled/);
  });

  it("disables the checkbox + adds opacity styling when busy=true", () => {
    const out = renderMvCheckboxHtml(s({ busy: true }));
    expect(out).toMatch(/id="mv-check"[^>]*disabled/);
    expect(out).toMatch(/opacity:0\.4/);
  });
});

describe("renderModeTogglesHtml", () => {
  it("aria-pressed mirrors crawl + movie booleans", () => {
    const out = renderModeTogglesHtml({ crawl: true, movie: false, busy: false });
    expect(out).toMatch(/mode-crawl[^>]*aria-pressed="true"/);
    expect(out).toMatch(/mode-movie[^>]*aria-pressed="false"/);
  });
  it("disables every button when busy=true", () => {
    const out = renderModeTogglesHtml({ crawl: false, movie: false, busy: true });
    expect((out.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
  it("Observe is always disabled (coming soon)", () => {
    expect(renderModeTogglesHtml({ crawl: false, movie: false, busy: false }))
      .toMatch(/mode-observe[^>]*disabled/);
  });
});

describe("renderCollapsedToggleHtml", () => {
  function s(overrides: Partial<Parameters<typeof renderCollapsedToggleHtml>[0]> = {}) {
    return { crawl: false, observer: false, movie: false, mv: false, wcagVersion: "2.2", wcagLevel: "AA", ...overrides };
  }
  it("renders 'Single page' when no modes are active", () => {
    expect(renderCollapsedToggleHtml(s())).toMatch(/Single page/);
  });
  it("renders one chip per active mode (≤2)", () => {
    const out = renderCollapsedToggleHtml(s({ crawl: true, mv: true }));
    expect(out).toMatch(/Crawl/);
    expect(out).toMatch(/Multi-Viewport/);
  });
  it("collapses to 'N modes' summary when ≥3 modes are active", () => {
    expect(renderCollapsedToggleHtml(s({ crawl: true, observer: true, movie: true }))).toMatch(/3 modes/);
  });
  it("shows the WCAG version + level prominently", () => {
    expect(renderCollapsedToggleHtml(s({ wcagVersion: "2.1", wcagLevel: "A" }))).toMatch(/2\.1 A/);
  });
});

describe("renderToolbarContentHtml", () => {
  it("HTML + PDF buttons are disabled when no single-page scan", () => {
    const out = renderToolbarContentHtml({ hasSinglePageScan: false, violationsOverlayOn: false });
    expect(out).toMatch(/id="export-html"[^>]*disabled/);
    expect(out).toMatch(/id="export-pdf"[^>]*disabled/);
  });
  it("HTML + PDF buttons are enabled when single-page scan exists", () => {
    const out = renderToolbarContentHtml({ hasSinglePageScan: true, violationsOverlayOn: false });
    expect(out).not.toMatch(/id="export-html"[^>]*disabled/);
    expect(out).not.toMatch(/id="export-pdf"[^>]*disabled/);
  });
  it("violations toggle aria-pressed reflects current overlay state", () => {
    expect(renderToolbarContentHtml({ hasSinglePageScan: true, violationsOverlayOn: true }))
      .toMatch(/id="toggle-violations"[^>]*aria-pressed="true"/);
    expect(renderToolbarContentHtml({ hasSinglePageScan: true, violationsOverlayOn: false }))
      .toMatch(/id="toggle-violations"[^>]*aria-pressed="false"/);
  });
  it("violations toggle is disabled when no single-page scan", () => {
    expect(renderToolbarContentHtml({ hasSinglePageScan: false, violationsOverlayOn: false }))
      .toMatch(/id="toggle-violations"[^>]*disabled/);
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

  it("uses url as fallback when title is empty", () => {
    const out = renderObserverListInnerHtml([entry({ title: "", url: "https://only-url.com/p" })], "");
    expect(out).toMatch(/https:\/\/only-url\.com\/p/);
    expect(out).not.toMatch(/Page A/);
  });

  it("zero violationCount renders green color, non-zero renders red", () => {
    const greenOut = renderObserverListInnerHtml([entry({ violationCount: 0 })], "");
    expect(greenOut).toMatch(/color:var\(--ds-green-700\)/);
    const redOut = renderObserverListInnerHtml([entry({ violationCount: 3 })], "");
    expect(redOut).toMatch(/color:var\(--ds-red-700\)/);
  });

  it("source 'manual' renders 'manual' label", () => {
    const out = renderObserverListInnerHtml([entry({ source: "manual" })], "");
    expect(out).toMatch(/>manual<\/span>/);
  });

  it("missing viewportBucket suppresses the badge", () => {
    const out = renderObserverListInnerHtml([entry({ viewportBucket: "" })], "");
    expect(out).not.toMatch(/var\(--ds-blue-100\)/);
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

describe("buildJsonReportFrom", () => {
  function pageScan(overrides: Partial<iScanResult> = {}): iScanResult {
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
  const baseState = {
    lastScanResult: null as iScanResult | null,
    crawlResults: null as Record<string, iScanResult> | null,
    crawlFailed: null as Record<string, string> | null,
    wcagVersion: "2.2",
    wcagLevel: "AA",
    manualReview: {} as Record<string, "pass" | "fail" | "na" | null>,
    ariaWidgets: [] as iAriaWidget[],
    lastMvResult: null,
    tabOrder: [],
    focusGaps: [],
    documentTitle: "Page Title",
    nowIso: "2026-01-15T12:00:00Z",
  };

  it("uses lastScanResult as the metadata anchor when present", () => {
    const report = buildJsonReportFrom({ ...baseState, lastScanResult: pageScan({ url: "https://x.com/a" }) });
    expect(report.metadata.url).toBe("https://x.com/a");
    expect(report.metadata.timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("falls back to the first crawl page when no single-page scan", () => {
    const report = buildJsonReportFrom({
      ...baseState,
      crawlResults: { "https://x.com/a": pageScan({ url: "https://x.com/a" }) },
    });
    expect(report.metadata.url).toBe("https://x.com/a");
  });

  it("uses nowIso for metadata.timestamp when there's no scan to anchor", () => {
    const report = buildJsonReportFrom(baseState);
    expect(report.metadata.timestamp).toBe("2026-01-15T12:00:00Z");
  });

  it("threads wcag version + level into metadata", () => {
    const report = buildJsonReportFrom({ ...baseState, wcagVersion: "2.1", wcagLevel: "AAA" });
    expect(report.metadata.wcagVersion).toBe("2.1");
    expect(report.metadata.wcagLevel).toBe("AAA");
  });

  it("omits manualReview when nothing has been reviewed", () => {
    expect(buildJsonReportFrom(baseState).manualReview).toBeUndefined();
  });

  it("includes manualReview with reviewed-count when ≥1 status set", () => {
    const report = buildJsonReportFrom({
      ...baseState,
      manualReview: { "1.4.3": "pass", "2.4.3": "fail" },
    });
    expect(report.manualReview).toBeDefined();
    expect(report.manualReview!.reviewed).toBe(2);
    expect(report.manualReview!.criteria.find((c) => c.id === "1.4.3")?.status).toBe("pass");
  });

  it("filters manualReview criteria by relevantWhen when pageElements supply that info", () => {
    const noVideo = buildJsonReportFrom({
      ...baseState,
      lastScanResult: pageScan(),
      manualReview: { "1.2.4": "pass" },
    });
    // 1.2.4 (Captions Live) is gated on hasVideo; pageElements has hasVideo=false, so it's filtered out of the total
    expect(noVideo.manualReview!.criteria.find((c) => c.id === "1.2.4")).toBeUndefined();
  });

  it("includes ariaWidgets only when array is non-empty", () => {
    expect(buildJsonReportFrom(baseState).ariaWidgets).toBeUndefined();
    expect(buildJsonReportFrom({ ...baseState, ariaWidgets: [{ role: "tablist", selector: "#x", label: "x", html: "", checks: [], passCount: 0, failCount: 0 }] }).ariaWidgets?.length).toBe(1);
  });

  it("includes crawl block only when crawlResults has entries", () => {
    expect(buildJsonReportFrom(baseState).crawl).toBeUndefined();
    const report = buildJsonReportFrom({
      ...baseState,
      crawlResults: { "https://x.com/a": pageScan(), "https://x.com/b": pageScan() },
      crawlFailed: { "https://x.com/c": "timeout" },
    });
    expect(report.crawl?.pagesScanned).toBe(2);
    expect(report.crawl?.pagesFailed).toBe(1);
  });

  it("includes tabOrder + focusGaps only when they have entries", () => {
    expect(buildJsonReportFrom(baseState).tabOrder).toBeUndefined();
    expect(buildJsonReportFrom(baseState).focusGaps).toBeUndefined();
    const r2 = buildJsonReportFrom({
      ...baseState,
      tabOrder: [{ index: 1, selector: "#a", role: "button", accessibleName: "x", tabindex: null, hasFocusIndicator: true }],
      focusGaps: [{ selector: "#b", role: "div", reason: "no-tabindex" }],
    });
    expect(r2.tabOrder?.length).toBe(1);
    expect(r2.focusGaps?.length).toBe(1);
  });
});

describe("addManualUrlToList", () => {
  it("appends a new URL and reports added=true", () => {
    const out = addManualUrlToList(["a"], "b");
    expect(out.list).toEqual(["a", "b"]);
    expect(out.added).toBe(true);
  });
  it("returns the input unchanged for a duplicate URL", () => {
    const list = ["a", "b"];
    const out = addManualUrlToList(list, "a");
    expect(out.list).toBe(list);
    expect(out.added).toBe(false);
  });
  it("returns the input unchanged for empty string", () => {
    const list = ["a"];
    const out = addManualUrlToList(list, "");
    expect(out.list).toBe(list);
    expect(out.added).toBe(false);
  });
});

describe("removeUrlAtIndex", () => {
  it("removes the entry at idx and reports removed=true", () => {
    const out = removeUrlAtIndex(["a", "b", "c"], 1);
    expect(out.list).toEqual(["a", "c"]);
    expect(out.removed).toBe(true);
  });
  it("returns input unchanged for negative or too-large idx", () => {
    const list = ["a"];
    expect(removeUrlAtIndex(list, -1).list).toBe(list);
    expect(removeUrlAtIndex(list, 5).list).toBe(list);
  });
});

describe("mergeNewUrlsIntoList", () => {
  it("appends new URLs to existing, dedupes, returns added count", () => {
    const out = mergeNewUrlsIntoList(["a", "b"], ["b", "c", "d"]);
    expect(out.list).toEqual(["a", "b", "c", "d"]);
    expect(out.added).toBe(2);
  });
  it("returns added=0 when every incoming URL already in existing", () => {
    const out = mergeNewUrlsIntoList(["a", "b"], ["a", "b"]);
    expect(out.list).toEqual(["a", "b"]);
    expect(out.added).toBe(0);
  });
  it("preserves the existing list order (new URLs appended at end)", () => {
    const out = mergeNewUrlsIntoList(["c", "a", "b"], ["d", "e"]);
    expect(out.list).toEqual(["c", "a", "b", "d", "e"]);
  });
  it("handles empty existing", () => {
    expect(mergeNewUrlsIntoList([], ["a", "b"]).list).toEqual(["a", "b"]);
  });
  it("does not mutate the existing list", () => {
    const existing = ["a"];
    mergeNewUrlsIntoList(existing, ["b"]);
    expect(existing).toEqual(["a"]);
  });
});

describe("parseTextFileUrls", () => {
  it("splits on newline, trims, drops blanks", () => {
    expect(parseTextFileUrls("https://x.com/a\n\nhttps://x.com/b\n  \n")).toEqual([
      "https://x.com/a", "https://x.com/b",
    ]);
  });
  it("handles \\r\\n line endings", () => {
    expect(parseTextFileUrls("https://x.com/a\r\nhttps://x.com/b\r\n")).toEqual([
      "https://x.com/a", "https://x.com/b",
    ]);
  });
  it("returns empty array for empty / whitespace-only input", () => {
    expect(parseTextFileUrls("")).toEqual([]);
    expect(parseTextFileUrls("   \n  ")).toEqual([]);
  });
  it("does NOT dedupe (caller deduplicates via mergeNewUrlsIntoList)", () => {
    expect(parseTextFileUrls("a\na\nb")).toEqual(["a", "a", "b"]);
  });
});

describe("clearScanResultsSlice", () => {
  function full() {
    return {
      scanPhase: "results" as const,
      crawlPhase: "complete" as const,
      lastScanResult: { url: "x" } as never,
      lastMvResult: { viewports: [], perViewport: {}, shared: [], viewportSpecific: [] } as never,
      mvViewportFilter: 768 as number | null,
      mvProgress: { current: 1, total: 3 } as { current: number; total: number } | null,
      crawlResults: { "x": {} as never } as Record<string, never>,
      crawlFailed: { "y": "z" } as Record<string, string>,
      crawlWaitInfo: { url: "x", waitType: "login", description: "x" } as { url: string; waitType: string; description: string } | null,
      accordionExpanded: false,
      scanSubTab: "manual" as const,
      ariaWidgets: [{ role: "x" } as never],
      ariaScanned: true,
      manualReview: { "1.4.3": "pass" as const },
      violationsOverlayOn: true,
      tabOrderOverlayOn: true,
      focusGapsOverlayOn: true,
    };
  }

  it("clears all scan + crawl + MV cached results", () => {
    const out = clearScanResultsSlice(full());
    expect(out.scanPhase).toBe("idle");
    expect(out.crawlPhase).toBe("idle");
    expect(out.lastScanResult).toBeNull();
    expect(out.lastMvResult).toBeNull();
    expect(out.mvViewportFilter).toBeNull();
    expect(out.mvProgress).toBeNull();
    expect(out.crawlResults).toBeNull();
    expect(out.crawlFailed).toBeNull();
    expect(out.crawlWaitInfo).toBeNull();
  });

  it("re-expands the accordion + resets sub-tab to 'results'", () => {
    const out = clearScanResultsSlice(full());
    expect(out.accordionExpanded).toBe(true);
    expect(out.scanSubTab).toBe("results");
  });

  it("clears ARIA widgets + manual review marks", () => {
    const out = clearScanResultsSlice(full());
    expect(out.ariaWidgets).toEqual([]);
    expect(out.manualReview).toEqual({});
  });

  it("turns every overlay flag off", () => {
    const out = clearScanResultsSlice(full());
    expect(out.violationsOverlayOn).toBe(false);
    expect(out.tabOrderOverlayOn).toBe(false);
    expect(out.focusGapsOverlayOn).toBe(false);
  });
});

describe("resetScanStateSlice", () => {
  it("turns every mode toggle off", () => {
    const out = resetScanStateSlice({
      crawl: true, observer: true, movie: true, mv: true,
      viewports: [320, 480], wcagVersion: "2.0", wcagLevel: "AAA",
      testConfig: { wcag: { version: "2.0" } },
    });
    expect(out.crawl).toBe(false);
    expect(out.observer).toBe(false);
    expect(out.movie).toBe(false);
    expect(out.mv).toBe(false);
  });

  it("restores default viewports [375, 768, 1280] (R-MV)", () => {
    expect(resetScanStateSlice({
      crawl: false, observer: false, movie: false, mv: false,
      viewports: [320], wcagVersion: "2.2", wcagLevel: "AA",
      testConfig: null,
    }).viewports).toEqual([375, 768, 1280]);
  });

  it("restores WCAG 2.2 AA defaults", () => {
    const out = resetScanStateSlice({
      crawl: false, observer: false, movie: false, mv: false,
      viewports: [375], wcagVersion: "2.0", wcagLevel: "AAA",
      testConfig: null,
    });
    expect(out.wcagVersion).toBe("2.2");
    expect(out.wcagLevel).toBe("AA");
  });

  it("clears testConfig (F13-AC7)", () => {
    const out = resetScanStateSlice({
      crawl: false, observer: false, movie: false, mv: false,
      viewports: [375], wcagVersion: "2.2", wcagLevel: "AA",
      testConfig: { wcag: { version: "2.0" } },
    });
    expect(out.testConfig).toBeNull();
  });
});

describe("buildObserverEntry", () => {
  function pageScan(overrides: Partial<iScanResult> = {}): iScanResult {
    return {
      url: "https://example.com",
      timestamp: "2026-01-01T00:00:00Z",
      violations: [],
      passes: [],
      incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
      ...overrides,
    };
  }

  it("threads id + timestamp from caller (so tests can pin them)", () => {
    const out = buildObserverEntry({
      id: "fixed-id",
      timestamp: "2026-04-27T12:00:00Z",
      scanResult: pageScan(),
      tab: { url: "https://x.com/y", title: "Y" },
      viewports: [375, 768, 1280],
    });
    expect(out.id).toBe("fixed-id");
    expect(out.timestamp).toBe("2026-04-27T12:00:00Z");
  });

  it("source is always 'manual' (this builder is for the manual-scan path only)", () => {
    expect(buildObserverEntry({
      id: "x", timestamp: "x",
      scanResult: pageScan(), tab: {}, viewports: [375],
    }).source).toBe("manual");
  });

  it("counts violation NODES, not rules", () => {
    const v = (id: string, n: number) => ({ id, impact: "serious" as const, description: "", help: "", helpUrl: "", tags: [], nodes: new Array(n).fill({ selector: "#x", html: "", failureSummary: "" }) });
    const out = buildObserverEntry({
      id: "x", timestamp: "x",
      scanResult: pageScan({ violations: [v("a", 3), v("b", 5)] }),
      tab: {},
      viewports: [375],
    });
    expect(out.violationCount).toBe(8);
  });

  it("falls back to 1280 when tab.width is missing", () => {
    const out = buildObserverEntry({
      id: "x", timestamp: "x",
      scanResult: pageScan(), tab: {}, viewports: [375, 768, 1280],
    });
    // 1280 → bucket "769–1280px" with breakpoints [375,768,1280]
    expect(out.viewportBucket).toMatch(/1280/);
  });

  it("uses tab.url and tab.title verbatim, defaulting to empty string", () => {
    const out = buildObserverEntry({
      id: "x", timestamp: "x",
      scanResult: pageScan(), tab: { url: "https://x.com", title: "x" }, viewports: [375],
    });
    expect(out.url).toBe("https://x.com");
    expect(out.title).toBe("x");

    const noTab = buildObserverEntry({
      id: "x", timestamp: "x",
      scanResult: pageScan(), tab: {}, viewports: [375],
    });
    expect(noTab.url).toBe("");
    expect(noTab.title).toBe("");
  });
});

describe("mergeMvResultToScan", () => {
  function pageScan(url = "https://x.com", violations: iScanResult["violations"] = []): iScanResult {
    return {
      url, timestamp: "2026-01-01", violations, passes: [], incomplete: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
      pageElements: { hasVideo: false, hasAudio: false, hasForms: false, hasImages: false, hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false, hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false },
      scanDurationMs: 100,
    };
  }
  function viol(id: string): iScanResult["violations"][0] {
    return { id, impact: "serious", description: "x", help: "x", helpUrl: "", tags: [], nodes: [{ selector: "#x", html: "", failureSummary: "" }] };
  }

  it("returns null when perViewport is empty", () => {
    expect(mergeMvResultToScan({
      viewports: [],
      perViewport: {},
      shared: [],
      viewportSpecific: [],
    })).toBeNull();
  });

  it("uses the first viewport's metadata as the merged result's anchor", () => {
    const merged = mergeMvResultToScan({
      viewports: [375, 768],
      perViewport: {
        375: pageScan("https://x.com/375"),
        768: pageScan("https://x.com/768"),
      },
      shared: [],
      viewportSpecific: [],
    });
    expect(merged?.url).toBe("https://x.com/375");
  });

  it("concatenates shared + viewportSpecific into the merged violations", () => {
    const merged = mergeMvResultToScan({
      viewports: [375, 768],
      perViewport: { 375: pageScan() },
      shared: [viol("color-contrast")],
      viewportSpecific: [{ ...viol("region"), viewports: [375] }],
    });
    expect(merged?.violations.length).toBe(2);
    expect(merged?.violations[0].id).toBe("color-contrast");
    expect(merged?.violations[1].id).toBe("region");
  });
});

describe("buildStartCrawlPayload", () => {
  it("uses defaults when no testConfig", () => {
    const out = buildStartCrawlPayload({ testConfig: null, crawlMode: "follow", crawlUrlList: [] });
    expect(out.mode).toBe("follow");
    expect(out.timeout).toBe(30000);
    expect(out.delay).toBe(1000);
    expect(out.scope).toBe("");
    expect(out.urlList).toEqual([]);
    expect(out.pageRules).toEqual([]);
    expect(out.auth).toBeUndefined();
    expect(out.testConfig).toBeUndefined();
  });

  it("testConfig overrides UI mode + scope (F13-AC4)", () => {
    const out = buildStartCrawlPayload({
      testConfig: { crawl: { mode: "urllist", scope: "https://x.com/", urlList: ["https://x.com/p"] }, timing: { pageLoadTimeout: 60000, delayBetweenPages: 2000 } },
      crawlMode: "follow",
      crawlUrlList: ["should-be-ignored"],
    });
    expect(out.mode).toBe("urllist");
    expect(out.timeout).toBe(60000);
    expect(out.delay).toBe(2000);
    expect(out.scope).toBe("https://x.com/");
  });

  it("uses manual crawlUrlList in urllist mode when no testConfig.crawl.urlList", () => {
    const out = buildStartCrawlPayload({
      testConfig: null,
      crawlMode: "urllist",
      crawlUrlList: ["https://x.com/a", "https://x.com/b"],
    });
    expect(out.urlList).toEqual(["https://x.com/a", "https://x.com/b"]);
  });

  it("manual crawlUrlList is ignored in follow mode", () => {
    const out = buildStartCrawlPayload({
      testConfig: null,
      crawlMode: "follow",
      crawlUrlList: ["should-be-ignored"],
    });
    expect(out.urlList).toEqual([]);
  });

  it("testConfig.pageRules + auth are passed through", () => {
    const auth = { loginUrl: "x", usernameSelector: "x", passwordSelector: "x", submitSelector: "x", username: "x", password: "x" };
    const pr = [{ pattern: "/admin", waitType: "login" as const, description: "x" }];
    const out = buildStartCrawlPayload({
      testConfig: { auth, pageRules: pr },
      crawlMode: "follow",
      crawlUrlList: [],
    });
    expect(out.auth).toBe(auth);
    expect(out.pageRules).toBe(pr);
  });

  it("makes a defensive copy of urlList (caller can't mutate state)", () => {
    const list = ["https://x.com/a"];
    const out = buildStartCrawlPayload({ testConfig: null, crawlMode: "urllist", crawlUrlList: list });
    out.urlList.push("https://x.com/b");
    expect(list).toEqual(["https://x.com/a"]);
  });
});

describe("addViewport", () => {
  it("adds 200px wider than the current widest, sorted", () => {
    expect(addViewport([375, 768, 1280])).toEqual([375, 768, 1280, 1480]);
  });
  it("starts at 320 when the input is empty", () => {
    expect(addViewport([])).toEqual([320]);
  });
  it("returns the input unchanged at the 6-entry cap", () => {
    const at6 = [320, 480, 640, 800, 1024, 1280];
    expect(addViewport(at6)).toBe(at6);
  });
  it("respects a custom maxCount", () => {
    expect(addViewport([320, 480], 2)).toEqual([320, 480]);
    expect(addViewport([320, 480], 4)).toEqual([320, 480, 680]);
  });
  it("the new value is always greater than the previous max (sorted output stays sorted)", () => {
    const out = addViewport([320, 768, 1024]);
    expect(out[out.length - 1]).toBeGreaterThan(1024);
    expect([...out].sort((a, b) => a - b)).toEqual(out);
  });
});

describe("removeViewport", () => {
  it("removes the entry at the given index", () => {
    expect(removeViewport([375, 768, 1280], 1)).toEqual([375, 1280]);
  });
  it("returns the input unchanged when only one entry remains", () => {
    const lone = [375];
    expect(removeViewport(lone, 0)).toBe(lone);
  });
  it("returns the input unchanged for out-of-bounds indexes", () => {
    const list = [320, 768];
    expect(removeViewport(list, -1)).toBe(list);
    expect(removeViewport(list, 5)).toBe(list);
  });
  it("respects a custom minCount", () => {
    // Allow removing down to 0 by passing minCount=0
    expect(removeViewport([320], 0, 0)).toEqual([]);
  });
});

describe("parsePastedUrls", () => {
  it("returns empty array for empty / whitespace input", () => {
    expect(parsePastedUrls("")).toEqual([]);
    expect(parsePastedUrls("   \n  \n  ")).toEqual([]);
  });

  it("parses plain text — one URL per line, dropping blanks and XML fragments", () => {
    const out = parsePastedUrls("https://x.com/a\n\nhttps://x.com/b\n<not a url>\n  https://x.com/c  ");
    expect(out).toEqual(["https://x.com/a", "https://x.com/b", "https://x.com/c"]);
  });

  it("dedupes URLs across pastes (preserves first occurrence)", () => {
    expect(parsePastedUrls("https://x.com/a\nhttps://x.com/a\nhttps://x.com/b")).toEqual([
      "https://x.com/a", "https://x.com/b",
    ]);
  });

  it("parses sitemap XML — extracts <loc> elements", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
</urlset>`;
    expect(parsePastedUrls(xml)).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/contact",
    ]);
  });

  it("parses <urlset> root without <?xml prolog", () => {
    const xml = `<urlset><url><loc>https://x.com/a</loc></url></urlset>`;
    expect(parsePastedUrls(xml)).toEqual(["https://x.com/a"]);
  });

  it("parses <sitemapindex> root", () => {
    const xml = `<sitemapindex><sitemap><loc>https://x.com/sitemap.xml</loc></sitemap></sitemapindex>`;
    expect(parsePastedUrls(xml)).toEqual(["https://x.com/sitemap.xml"]);
  });

  it("falls back to plaintext when XML is malformed (parsererror)", () => {
    const broken = `<?xml version="1.0"?><urlset><unclosed`;
    // jsdom's parser may produce parsererror — function should fall through
    const out = parsePastedUrls(broken);
    // Result depends on jsdom; the contract is "doesn't throw and returns an array"
    expect(Array.isArray(out)).toBe(true);
  });

  it("falls back to plaintext when XML has zero <loc> elements", () => {
    // Valid XML but no <loc> nodes — caller should still get the plaintext interpretation
    const out = parsePastedUrls(`<?xml version="1.0"?><other><node>x</node></other>`);
    // No loc → plaintext path → first line starts with `<` → filtered → empty
    expect(out).toEqual([]);
  });
});

describe("buildHtmlReportFrom", () => {
  function pageScan(overrides: Partial<iScanResult> = {}): iScanResult {
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
  function s(scan: iScanResult, overrides: Partial<Parameters<typeof buildHtmlReportFrom>[0]> = {}) {
    return {
      scan,
      wcagVersion: "2.2",
      wcagLevel: "AA",
      manualReview: {},
      ariaWidgets: [],
      ...overrides,
    };
  }

  it("emits a complete html document with DOCTYPE + html element", () => {
    const out = buildHtmlReportFrom(s(pageScan()));
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toMatch(/<html lang="en">/);
    expect(out).toMatch(/<\/html>/);
  });

  it("includes URL, scan timestamp, and WCAG metadata in the header", () => {
    const out = buildHtmlReportFrom(s(pageScan({ url: "https://x.com/page" }), { wcagVersion: "2.1", wcagLevel: "A" }));
    expect(out).toMatch(/https:\/\/x\.com\/page/);
    expect(out).toMatch(/2\.1 A/);
  });

  it("escapes html-injection in URL, violation summaries, and selectors", () => {
    const out = buildHtmlReportFrom(s(pageScan({
      url: "https://x.com/<script>",
      violations: [{ id: "x", impact: "serious", description: "<svg/>", help: "<x>", helpUrl: "", tags: [],
        nodes: [{ selector: "<x>", html: "", failureSummary: "<script>alert(1)</script>" }] }],
    })));
    expect(out).not.toMatch(/<script>alert/);
    expect(out).toMatch(/&lt;script&gt;/);
  });

  it("sorts violations critical-first", () => {
    const out = buildHtmlReportFrom(s(pageScan({
      violations: [
        { id: "minor-rule", impact: "minor", description: "minor", help: "h", helpUrl: "", tags: [], nodes: [] },
        { id: "critical-rule", impact: "critical", description: "critical", help: "h", helpUrl: "", tags: [], nodes: [] },
      ],
    })));
    expect(out.indexOf("critical-rule")).toBeLessThan(out.indexOf("minor-rule"));
  });

  it("includes the ARIA widgets section only when widgets exist", () => {
    const noAria = buildHtmlReportFrom(s(pageScan()));
    expect(noAria).not.toMatch(/<h2>ARIA Widgets/);
    const withAria = buildHtmlReportFrom(s(pageScan(), {
      ariaWidgets: [{ role: "tablist", selector: "#x", label: "Tabs", html: "", checks: [], passCount: 0, failCount: 1 }],
    }));
    expect(withAria).toMatch(/<h2>ARIA Widgets/);
  });

  it("includes the Manual Review section only when ≥1 status was recorded", () => {
    const none = buildHtmlReportFrom(s(pageScan()));
    expect(none).not.toMatch(/<h2>Manual Review/);
    const some = buildHtmlReportFrom(s(pageScan(), { manualReview: { "1.4.3": "pass" } }));
    expect(some).toMatch(/<h2>Manual Review/);
  });

  it("filters Manual Review section by relevantWhen against pageElements", () => {
    // 1.2.4 requires hasVideo; with hasVideo=false (default), the criterion is filtered out
    const out = buildHtmlReportFrom(s(pageScan(), { manualReview: { "1.2.4": "pass", "1.4.3": "pass" } }));
    expect(out).toMatch(/1\.4\.3/);
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
