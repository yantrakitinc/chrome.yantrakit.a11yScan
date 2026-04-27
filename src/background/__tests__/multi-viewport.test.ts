import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { diffResults, multiViewportScan } from "../multi-viewport";
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

describe("multiViewportScan — orchestration", () => {
  let chromeApi: ReturnType<typeof makeChromeStub>;
  let originalChrome: unknown;

  function makeChromeStub() {
    const updateCalls: { tabId: number; props: chrome.windows.UpdateInfo }[] = [];
    const sendMessageCalls: unknown[] = [];
    let scanCallCount = 0;
    return {
      tabs: {
        query: vi.fn(async () => [{ id: 99, windowId: 1 }]),
        sendMessage: vi.fn(async (_id: number, msg: { type: string }) => {
          if (msg.type === "RUN_SCAN") {
            scanCallCount++;
            return { type: "SCAN_RESULT", payload: scan([v(`width-${scanCallCount}`)]) };
          }
          return undefined;
        }),
      },
      windows: {
        get: vi.fn(async () => ({ width: 1024 })),
        update: vi.fn(async (id: number, props: chrome.windows.UpdateInfo) => { updateCalls.push({ tabId: id, props }); }),
      },
      runtime: {
        sendMessage: vi.fn((m: unknown) => { sendMessageCalls.push(m); }),
      },
      scripting: { executeScript: vi.fn(async () => undefined) },
      storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) } },
      _updateCalls: updateCalls,
      _sendMessageCalls: sendMessageCalls,
    };
  }

  beforeEach(() => {
    chromeApi = makeChromeStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalChrome = (globalThis as any).chrome;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = chromeApi;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = originalChrome;
    vi.restoreAllMocks();
  });

  it("calls sendResponse with MULTI_VIEWPORT_RESULT containing per-viewport results", async () => {
    const responses: unknown[] = [];
    let i = 0;
    chromeApi.tabs.sendMessage = vi.fn(async () => ({
      type: "SCAN_RESULT",
      payload: scan([v(`x-${i++}`)]),
    }));

    await multiViewportScan([375, 768, 1280], (r) => responses.push(r));

    expect(responses.length).toBe(1);
    const out = responses[0] as { type: string; payload: { viewports: number[]; perViewport: Record<number, unknown> } };
    expect(out.type).toBe("MULTI_VIEWPORT_RESULT");
    expect(out.payload.viewports).toEqual([375, 768, 1280]);
    expect(Object.keys(out.payload.perViewport).length).toBe(3);
  });

  it("resizes the window to each requested viewport then restores the original width", async () => {
    chromeApi.tabs.sendMessage = vi.fn(async () => ({ type: "SCAN_RESULT", payload: scan([]) }));
    await multiViewportScan([320, 768], () => undefined);
    const widths = chromeApi._updateCalls.map((c) => c.props.width);
    expect(widths).toEqual([320, 768, 1024]); // last entry restores original
  });

  it("emits MULTI_VIEWPORT_PROGRESS messages for each viewport", async () => {
    chromeApi.tabs.sendMessage = vi.fn(async () => ({ type: "SCAN_RESULT", payload: scan([]) }));
    await multiViewportScan([320, 768], () => undefined);
    const progress = chromeApi._sendMessageCalls.filter((m) => (m as { type: string }).type === "MULTI_VIEWPORT_PROGRESS");
    expect(progress.length).toBe(2);
  });

  it("returns an error response when no active tab", async () => {
    chromeApi.tabs.query = vi.fn(async () => []);
    const responses: unknown[] = [];
    await multiViewportScan([375], (r) => responses.push(r));
    expect((responses[0] as { type: string }).type).toBe("SCAN_ERROR");
  });

  it("continues when a single viewport scan throws — failure isolated to that viewport", async () => {
    let i = 0;
    chromeApi.tabs.sendMessage = vi.fn(async () => {
      i++;
      if (i === 2) throw new Error("scan failed at viewport 2");
      return { type: "SCAN_RESULT", payload: scan([]) };
    });
    const responses: unknown[] = [];
    await multiViewportScan([320, 768, 1280], (r) => responses.push(r));
    const out = responses[0] as { payload: { perViewport: Record<number, unknown> } };
    // 768 entry missing because that scan errored
    expect(Object.keys(out.payload.perViewport).sort()).toEqual(["1280", "320"]);
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
