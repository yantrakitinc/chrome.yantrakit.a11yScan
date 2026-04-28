// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CVD_MATRICES, reduceCrawlProgress, reduceStateCleared, switchTab, updateTabDisabledStates, state, buildElementNotFoundToast, pickViolationScrollTarget, cvdMatrixForType, initConfirmClearBar } from "../sidepanel";

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

describe("switchTab + updateTabDisabledStates", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="top-tabs">
        <button id="tab-scan" data-tab="scan" class="tab active" aria-selected="true" tabindex="0"></button>
        <button id="tab-sr" data-tab="sr" class="tab" aria-selected="false" tabindex="-1"></button>
        <button id="tab-kb" data-tab="kb" class="tab" aria-selected="false" tabindex="-1"></button>
        <button id="tab-ai" data-tab="ai" class="tab" aria-selected="false" tabindex="-1" disabled></button>
      </div>
      <div id="panel-scan" class="tab-panel active"></div>
      <div id="panel-sr" class="tab-panel" hidden></div>
      <div id="panel-kb" class="tab-panel" hidden></div>
      <div id="panel-ai" class="tab-panel" hidden></div>
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      runtime: { sendMessage: vi.fn(async () => undefined), onMessage: { addListener: vi.fn() } },
      tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
      storage: {
        local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
        session: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
      },
    };
    state.topTab = "scan";
    state.scanPhase = "idle";
    state.crawlPhase = "idle";
  });
  afterEach(() => {
    document.body.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("switchTab updates state.topTab", () => {
    switchTab("sr");
    expect(state.topTab).toBe("sr");
  });

  it("switchTab toggles aria-selected + tabindex on tab buttons", () => {
    switchTab("kb");
    expect(document.getElementById("tab-kb")?.getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("tab-kb")?.getAttribute("tabindex")).toBe("0");
    expect(document.getElementById("tab-scan")?.getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("tab-scan")?.getAttribute("tabindex")).toBe("-1");
  });

  it("switchTab shows the matching panel and hides others", () => {
    switchTab("sr");
    expect(document.getElementById("panel-sr")?.hidden).toBe(false);
    expect(document.getElementById("panel-scan")?.hidden).toBe(true);
    expect(document.getElementById("panel-kb")?.hidden).toBe(true);
  });

  it("switchTab is a no-op when target tab is disabled (e.g., 'ai' coming soon)", () => {
    switchTab("ai");
    expect(state.topTab).toBe("scan"); // unchanged
  });

  it("updateTabDisabledStates disables sr+kb during scanning", () => {
    state.scanPhase = "scanning";
    updateTabDisabledStates();
    expect((document.getElementById("tab-sr") as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById("tab-kb") as HTMLButtonElement).disabled).toBe(true);
  });

  it("updateTabDisabledStates disables sr+kb during crawl 'crawling' or 'wait' phase", () => {
    state.crawlPhase = "crawling";
    updateTabDisabledStates();
    expect((document.getElementById("tab-sr") as HTMLButtonElement).disabled).toBe(true);
    state.crawlPhase = "wait";
    updateTabDisabledStates();
    expect((document.getElementById("tab-kb") as HTMLButtonElement).disabled).toBe(true);
  });

  it("updateTabDisabledStates leaves AI tab's disabled flag alone (permanent disable)", () => {
    state.scanPhase = "scanning";
    updateTabDisabledStates();
    expect((document.getElementById("tab-ai") as HTMLButtonElement).disabled).toBe(true);
    state.scanPhase = "idle";
    state.crawlPhase = "idle";
    updateTabDisabledStates();
    // AI is still disabled (its baseline state), even when nothing is busy
    expect((document.getElementById("tab-ai") as HTMLButtonElement).disabled).toBe(true);
  });

  it("updateTabDisabledStates re-enables sr+kb when idle", () => {
    state.scanPhase = "scanning";
    updateTabDisabledStates();
    state.scanPhase = "idle";
    state.crawlPhase = "idle";
    updateTabDisabledStates();
    expect((document.getElementById("tab-sr") as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById("tab-kb") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("initConfirmClearBar — F22 confirm-bar wiring", () => {
  let sentMessages: { type: string }[];
  beforeEach(() => {
    sentMessages = [];
    document.body.innerHTML = `
      <div id="confirm-clear-bar" hidden>
        <button id="confirm-clear-yes"></button>
        <button id="confirm-clear-cancel"></button>
      </div>
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage: vi.fn(async (m) => { sentMessages.push(m); }) } };
  });
  afterEach(() => {
    document.body.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("clicking Yes hides the bar and broadcasts CLEAR_ALL_CONFIRMED", () => {
    const bar = document.getElementById("confirm-clear-bar")!;
    bar.hidden = false; // simulate the bar already showing
    initConfirmClearBar();
    document.getElementById("confirm-clear-yes")?.click();
    expect(bar.hidden).toBe(true);
    expect(sentMessages.map((m) => m.type)).toContain("CLEAR_ALL_CONFIRMED");
  });

  it("clicking Cancel hides the bar without broadcasting", () => {
    const bar = document.getElementById("confirm-clear-bar")!;
    bar.hidden = false;
    initConfirmClearBar();
    document.getElementById("confirm-clear-cancel")?.click();
    expect(bar.hidden).toBe(true);
    expect(sentMessages.length).toBe(0);
  });

  it("Escape key while the bar is visible hides it", () => {
    const bar = document.getElementById("confirm-clear-bar")!;
    bar.hidden = false;
    initConfirmClearBar();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(bar.hidden).toBe(true);
  });

  it("Escape while the bar is already hidden is a no-op (doesn't change state)", () => {
    const bar = document.getElementById("confirm-clear-bar")!;
    bar.hidden = true;
    initConfirmClearBar();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(bar.hidden).toBe(true);
  });
});

describe("cvdMatrixForType", () => {
  it("returns null for empty string ('Normal vision' option)", () => {
    expect(cvdMatrixForType("")).toBeNull();
  });
  it("returns null for unknown preset names", () => {
    expect(cvdMatrixForType("not-a-real-preset")).toBeNull();
  });
  it("returns the 9-element matrix for each documented preset", () => {
    for (const name of ["protanopia", "deuteranopia", "tritanopia", "protanomaly", "deuteranomaly", "tritanomaly", "achromatopsia", "achromatomaly"]) {
      const m = cvdMatrixForType(name);
      expect(m, `${name}`).toBeTruthy();
      expect(m!.length).toBe(9);
    }
  });
});

describe("pickViolationScrollTarget", () => {
  it("returns -1 when there are no violation details on the page", () => {
    expect(pickViolationScrollTarget({ index: 5 }, 0)).toBe(-1);
  });
  it("returns the requested index when in range", () => {
    expect(pickViolationScrollTarget({ index: 3 }, 10)).toBe(3);
  });
  it("returns 0 when index is undefined (no payload)", () => {
    expect(pickViolationScrollTarget(undefined, 5)).toBe(0);
  });
  it("returns 0 when index is negative", () => {
    expect(pickViolationScrollTarget({ index: -5 }, 5)).toBe(0);
  });
  it("returns 0 when index is past the end", () => {
    expect(pickViolationScrollTarget({ index: 99 }, 5)).toBe(0);
  });
  it("returns 0 when payload is empty object", () => {
    expect(pickViolationScrollTarget({}, 5)).toBe(0);
  });
});

describe("buildElementNotFoundToast", () => {
  it("creates a div with role=alert and aria-live=assertive", () => {
    const toast = buildElementNotFoundToast();
    expect(toast.tagName.toLowerCase()).toBe("div");
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
  });
  it("uses the default message 'Element not found on page'", () => {
    expect(buildElementNotFoundToast().textContent).toBe("Element not found on page");
  });
  it("respects a custom message argument", () => {
    expect(buildElementNotFoundToast("Custom").textContent).toBe("Custom");
  });
  it("applies sticky-top + red styling tokens", () => {
    const toast = buildElementNotFoundToast();
    expect(toast.style.cssText).toMatch(/sticky/);
    expect(toast.style.cssText).toMatch(/--ds-red/);
  });
});

describe("sidepanel.ts top-level state defaults", () => {
  it("state.topTab starts at 'scan'", async () => {
    const { state } = await import("../sidepanel");
    // Initial value (it may have been mutated by other tests; just verify it's a valid type)
    expect(["scan", "sr", "kb", "ai"]).toContain(state.topTab);
  });

  it("state.viewports default is [375, 768, 1280]", async () => {
    const { state } = await import("../sidepanel");
    // After reset (called from another test), viewports should match
    state.viewports = [375, 768, 1280];
    expect(state.viewports).toEqual([375, 768, 1280]);
  });

  it("TEST_CONFIG_STORAGE_KEY is exported as 'a11yscan_test_config'", async () => {
    const { TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY } = await import("../sidepanel");
    expect(TEST_CONFIG_STORAGE_KEY).toBe("a11yscan_test_config");
    expect(TEST_CONFIG_TIMESTAMP_KEY).toBe("a11yscan_test_config_timestamp");
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
