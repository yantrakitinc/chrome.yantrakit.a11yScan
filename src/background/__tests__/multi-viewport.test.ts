import { describe, it, expect } from "vitest";
import { diffResults } from "../multi-viewport";
import type { iScanResult, iViolation } from "@shared/types";

function v(id: string, impact: iViolation["impact"] = "serious"): iViolation {
  return {
    id,
    impact,
    description: id,
    help: id,
    helpUrl: "",
    tags: [],
    nodes: [],
  };
}

function scan(violations: iViolation[]): iScanResult {
  return {
    url: "https://example.com",
    timestamp: "2026-01-01T00:00:00Z",
    violations,
    passes: [],
    incomplete: [],
    summary: { critical: 0, serious: violations.length, moderate: 0, minor: 0, passes: 0, incomplete: 0 },
    pageElements: {
      hasVideo: false, hasAudio: false, hasForms: false, hasImages: false,
      hasLinks: false, hasHeadings: false, hasIframes: false, hasTables: false,
      hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimited: false,
    },
    scanDurationMs: 0,
  };
}

describe("diffResults — sharing classification", () => {
  it("classifies a violation present at every viewport as shared", () => {
    const out = diffResults(
      { 375: scan([v("color-contrast")]), 768: scan([v("color-contrast")]), 1280: scan([v("color-contrast")]) },
      [375, 768, 1280],
    );
    expect(out.shared.map((s) => s.id)).toEqual(["color-contrast"]);
    expect(out.viewportSpecific).toEqual([]);
  });

  it("classifies a violation present at a subset of viewports as viewport-specific", () => {
    const out = diffResults(
      { 375: scan([v("region")]), 768: scan([]), 1280: scan([v("region")]) },
      [375, 768, 1280],
    );
    expect(out.shared).toEqual([]);
    expect(out.viewportSpecific.map((s) => ({ id: s.id, viewports: s.viewports }))).toEqual([
      { id: "region", viewports: [375, 1280] },
    ]);
  });

  it("preserves first-seen violation node data when duplicating to shared output", () => {
    const out = diffResults(
      { 375: scan([{ ...v("img-alt"), description: "first" }]), 768: scan([{ ...v("img-alt"), description: "second" }]) },
      [375, 768],
    );
    expect(out.shared[0].description).toBe("first");
  });
});

describe("diffResults — failed-viewport handling (regression)", () => {
  it("treats a violation present in every SUCCEEDED viewport as shared even when one viewport's scan failed", () => {
    // 768 has no entry — that scan failed. region is at 375 + 1280, the two
    // succeeded viewports. It should be shared, not viewport-specific.
    const out = diffResults(
      { 375: scan([v("region")]), 1280: scan([v("region")]) },
      [375, 768, 1280],
    );
    expect(out.shared.map((s) => s.id)).toEqual(["region"]);
    expect(out.viewportSpecific).toEqual([]);
  });

  it("returns empty shared/viewportSpecific when no viewport produced a result", () => {
    const out = diffResults({}, [375, 768]);
    expect(out.shared).toEqual([]);
    expect(out.viewportSpecific).toEqual([]);
  });
});

describe("diffResults — collation across rules", () => {
  it("returns a row per unique rule id, not per (rule × viewport)", () => {
    const out = diffResults(
      {
        375: scan([v("a"), v("b")]),
        768: scan([v("b"), v("c")]),
      },
      [375, 768],
    );
    const ids = [...out.shared.map((s) => s.id), ...out.viewportSpecific.map((s) => s.id)].sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("returns no rows when every viewport reported zero violations", () => {
    const out = diffResults({ 375: scan([]), 768: scan([]) }, [375, 768]);
    expect(out.shared).toEqual([]);
    expect(out.viewportSpecific).toEqual([]);
  });
});
