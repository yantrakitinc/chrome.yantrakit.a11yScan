// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { computeActionButtonText, manualReviewKey, formatDateStamp, computeReportSummary } from "../scan-tab";

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
