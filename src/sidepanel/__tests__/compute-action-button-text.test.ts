// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { computeActionButtonText } from "../scan-tab";

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
