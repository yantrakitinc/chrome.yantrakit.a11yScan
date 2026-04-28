// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { CVD_MATRICES, reduceCrawlProgress, reduceStateCleared } from "../sidepanel";

describe("CVD_MATRICES — color-vision-deficiency simulation matrices (F08)", () => {
  it("includes the 8 documented CVD presets", () => {
    expect(Object.keys(CVD_MATRICES).sort()).toEqual([
      "achromatomaly",
      "achromatopsia",
      "deuteranomaly",
      "deuteranopia",
      "protanomaly",
      "protanopia",
      "tritanomaly",
      "tritanopia",
    ]);
  });

  it("every matrix is a 9-element array (3×3 RGB transform)", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      expect(matrix.length, `matrix ${name} length`).toBe(9);
    }
  });

  it("every entry is a finite number", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      for (const v of matrix) {
        expect(Number.isFinite(v), `matrix ${name} has finite entries`).toBe(true);
      }
    }
  });

  it("achromatopsia rows are identical (gray-scale: each output channel uses the same recipe)", () => {
    const m = CVD_MATRICES.achromatopsia;
    expect(m.slice(0, 3)).toEqual(m.slice(3, 6));
    expect(m.slice(3, 6)).toEqual(m.slice(6, 9));
  });

  it("each row's RGB coefficients sum to 1 (or very close — luminance-preserving)", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      for (let r = 0; r < 3; r++) {
        const row = matrix.slice(r * 3, r * 3 + 3);
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum, `${name} row ${r} sum=${sum}`).toBeCloseTo(1, 1);
      }
    }
  });
});

describe("reduceCrawlProgress", () => {
  function base() {
    return {
      crawlPhase: "idle" as const,
      crawlProgress: { pagesVisited: 0, pagesTotal: 0, currentUrl: "" },
      crawlResults: null,
      crawlFailed: null,
      crawlWaitInfo: null,
    };
  }

  it("threads pagesVisited / pagesTotal / currentUrl from payload", () => {
    const out = reduceCrawlProgress(base(), { status: "crawling", pagesVisited: 3, pagesTotal: 10, currentUrl: "https://x.com/p" });
    expect(out.crawlPhase).toBe("crawling");
    expect(out.crawlProgress).toEqual({ pagesVisited: 3, pagesTotal: 10, currentUrl: "https://x.com/p" });
  });

  it("captures results + failed only on 'complete' or 'paused' (F12-AC1)", () => {
    const results = { "https://x.com/a": {} as never };
    const failed = { "https://x.com/b": "timeout" };
    const onComplete = reduceCrawlProgress(base(), { status: "complete", results, failed });
    expect(onComplete.crawlResults).toBe(results);
    expect(onComplete.crawlFailed).toBe(failed);
    const onPaused = reduceCrawlProgress(base(), { status: "paused", results, failed });
    expect(onPaused.crawlResults).toBe(results);
    const onCrawling = reduceCrawlProgress(base(), { status: "crawling", results, failed });
    expect(onCrawling.crawlResults).toBeNull();
  });

  it("clears crawlWaitInfo whenever status is NOT 'wait'", () => {
    const prev = { ...base(), crawlWaitInfo: { url: "x", waitType: "login", description: "x" } };
    expect(reduceCrawlProgress(prev, { status: "crawling" }).crawlWaitInfo).toBeNull();
    expect(reduceCrawlProgress(prev, { status: "complete" }).crawlWaitInfo).toBeNull();
  });

  it("preserves crawlWaitInfo when status IS 'wait'", () => {
    const wait = { url: "x", waitType: "login", description: "x" };
    const prev = { ...base(), crawlWaitInfo: wait };
    expect(reduceCrawlProgress(prev, { status: "wait" }).crawlWaitInfo).toBe(wait);
  });

  it("defaults missing payload fields to 0 / empty string", () => {
    const out = reduceCrawlProgress(base(), { status: "crawling" });
    expect(out.crawlProgress).toEqual({ pagesVisited: 0, pagesTotal: 0, currentUrl: "" });
  });
});

describe("reduceStateCleared", () => {
  it("resets all scan/crawl/MV/observer cached state and re-expands accordion", () => {
    const out = reduceStateCleared({
      scanPhase: "results",
      crawlPhase: "complete",
      lastScanResult: {} as never,
      lastMvResult: {} as never,
      mvViewportFilter: 768,
      mvProgress: { current: 2, total: 3 },
      crawlResults: { "x": {} as never },
      crawlFailed: { "y": "z" },
      accordionExpanded: false,
    });
    expect(out.scanPhase).toBe("idle");
    expect(out.crawlPhase).toBe("idle");
    expect(out.lastScanResult).toBeNull();
    expect(out.lastMvResult).toBeNull();
    expect(out.mvViewportFilter).toBeNull();
    expect(out.mvProgress).toBeNull();
    expect(out.crawlResults).toBeNull();
    expect(out.crawlFailed).toBeNull();
    expect(out.accordionExpanded).toBe(true);
  });
});
