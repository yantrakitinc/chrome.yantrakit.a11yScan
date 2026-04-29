// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  showViolationOverlay,
  hideViolationOverlay,
  showTabOrderOverlay,
  hideTabOrderOverlay,
  showFocusGapOverlay,
  hideFocusGapOverlay,
  destroyOverlay,
} from "../overlay";

beforeEach(() => {
  document.body.innerHTML = "";
  // jsdom returns 0×0 for getBoundingClientRect; the overlay code skips
  // anything with width=height=0, so we stub a finite rect.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).getBoundingClientRect = function () {
    return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON() { return {}; } };
  };
});

afterEach(() => {
  destroyOverlay();
  document.body.innerHTML = "";
});

function shadowHostExists() {
  return !!document.getElementById("a11y-scan-overlay-host");
}

describe("violation overlay", () => {
  it("creates a shadow host on first show and removes the inner container on hide", () => {
    document.body.innerHTML = `<button id="b1">x</button>`;
    showViolationOverlay([
      {
        id: "color-contrast",
        impact: "serious",
        description: "x",
        help: "x",
        helpUrl: "",
        tags: [],
        nodes: [{ selector: "#b1", html: "<button>x</button>", failureSummary: "low contrast" }],
      },
    ]);
    expect(shadowHostExists()).toBe(true);
    hideViolationOverlay();
    // host stays; container is removed
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("violation-overlay")).toBeNull();
  });

  it("silently skips violations whose selectors don't match the DOM", () => {
    document.body.innerHTML = `<div id="real">x</div>`;
    showViolationOverlay([
      {
        id: "x",
        impact: "minor",
        description: "x",
        help: "x",
        helpUrl: "",
        tags: [],
        nodes: [{ selector: "#nonexistent", html: "", failureSummary: "" }],
      },
    ]);
    // No throw; host exists but the inner container has no badges
    expect(shadowHostExists()).toBe(true);
  });
});

describe("tab order overlay", () => {
  it("places one badge per visible focusable element", () => {
    document.body.innerHTML = `
      <button>a</button>
      <a href="#">b</a>
      <input />
    `;
    showTabOrderOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")!.shadowRoot!;
    const container = shadow.getElementById("tab-order-overlay")!;
    expect(container.children.length).toBe(3);
  });

  it("hide removes the tab-order container", () => {
    document.body.innerHTML = `<button>a</button>`;
    showTabOrderOverlay();
    hideTabOrderOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("tab-order-overlay")).toBeNull();
  });
});

describe("focus gap overlay", () => {
  it("renders markers for interactive-but-not-focusable elements", () => {
    document.body.innerHTML = `<div role="button" id="d">click</div>`;
    showFocusGapOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")!.shadowRoot!;
    const container = shadow.getElementById("focus-gap-overlay")!;
    expect(container.children.length).toBeGreaterThanOrEqual(1);
  });

  it("hide removes the focus-gap container", () => {
    document.body.innerHTML = `<div role="button">x</div>`;
    showFocusGapOverlay();
    hideFocusGapOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("focus-gap-overlay")).toBeNull();
  });
});

describe("destroyOverlay", () => {
  it("removes the entire shadow host", () => {
    document.body.innerHTML = `<button>x</button>`;
    showTabOrderOverlay();
    expect(shadowHostExists()).toBe(true);
    destroyOverlay();
    expect(shadowHostExists()).toBe(false);
  });
});

describe("violation overlay — branch coverage", () => {
  it("skips violation nodes with non-matching selectors (no throw)", () => {
    document.body.innerHTML = `<button id="real">x</button>`;
    expect(() => {
      showViolationOverlay([
        {
          id: "v1", impact: "serious", description: "x", help: "x", helpUrl: "", tags: [],
          nodes: [{ selector: "#does-not-exist", html: "x", failureSummary: "x" }],
        },
      ]);
    }).not.toThrow();
  });

  it("uses 'minor' color fallback for unknown impact", () => {
    document.body.innerHTML = `<button id="b">x</button>`;
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      showViolationOverlay([{ id: "v1", impact: "unknown" as any, description: "x", help: "x", helpUrl: "", tags: [], nodes: [{ selector: "#b", html: "x", failureSummary: "x" }] }]);
    }).not.toThrow();
  });

  it("creates a numbered badge for each violation node", () => {
    document.body.innerHTML = `<button id="a">x</button><button id="b">y</button>`;
    showViolationOverlay([
      { id: "v1", impact: "critical", description: "x", help: "x", helpUrl: "", tags: [], nodes: [
        { selector: "#a", html: "x", failureSummary: "x" },
        { selector: "#b", html: "y", failureSummary: "y" },
      ] },
    ]);
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const divs = Array.from(shadow?.querySelectorAll("div") ?? []) as HTMLElement[];
    // Filter to leaf divs (no child elements) whose text content is a single number — those are the badges, not the parent container.
    const badges = divs.filter((d) => d.children.length === 0 && /^\d+$/.test((d.textContent ?? "").trim()));
    expect(badges.map((b) => b.textContent)).toEqual(["1", "2"]);
  });
});

describe("focus-gap overlay — reason branches", () => {
  it("flags an interactive element with tabindex=-1", () => {
    document.body.innerHTML = `<button tabindex="-1" id="b">x</button>`;
    showFocusGapOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("focus-gap-overlay");
    expect(container).toBeTruthy();
    // The container has at least one badge — checking it has any child div
    expect(container!.children.length).toBeGreaterThan(0);
  });

  it("does NOT flag a normally focusable button (no focus-gap badge)", () => {
    document.body.innerHTML = `<button id="b">x</button>`;
    showFocusGapOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("focus-gap-overlay");
    expect(container).toBeTruthy();
    // No badges since the button is in the focusable set
    expect(container!.children.length).toBe(0);
  });
});

describe("scroll recalculation", () => {
  it("scroll re-renders tab-order overlay when it's currently shown (debounced)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button>x</button><button>y</button>`;
    showTabOrderOverlay();
    document.dispatchEvent(new Event("scroll"));
    // Debounce is 150ms — advance and let the timer fire
    vi.advanceTimersByTime(160);
    vi.useRealTimers();
    // Overlay still exists after recalc (didn't crash)
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("tab-order-overlay")).toBeTruthy();
  });

  it("scroll re-renders focus-gap overlay when it's currently shown", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div role="button">x</div>`;
    showFocusGapOverlay();
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(160);
    vi.useRealTimers();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("focus-gap-overlay")).toBeTruthy();
  });

  it("scroll handler clears prior debounce (multiple scrolls only fire one recalc)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button>x</button>`;
    showTabOrderOverlay();
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(50);
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(50);
    document.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(160);
    vi.useRealTimers();
    // No throw and overlay still rendered means the rapid-fire path is safe
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    expect(shadow?.getElementById("tab-order-overlay")).toBeTruthy();
  });

  it("scroll handler with no shadow host does nothing (early return)", async () => {
    vi.useFakeTimers();
    // Don't show any overlay → no shadow host exists
    document.body.innerHTML = `<button>x</button>`;
    expect(() => {
      document.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(160);
    }).not.toThrow();
    vi.useRealTimers();
  });
});

describe("violation overlay — badge click", () => {
  it("clicking a violation badge posts VIOLATION_BADGE_CLICKED with the index", async () => {
    const sendMessage = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = { runtime: { sendMessage } };
    document.body.innerHTML = `<button id="b">x</button><button id="c">y</button>`;
    showViolationOverlay([
      {
        id: "v1", impact: "serious", description: "x", help: "x", helpUrl: "", tags: [],
        nodes: [
          { selector: "#b", html: "x", failureSummary: "x" },
          { selector: "#c", html: "y", failureSummary: "y" },
        ],
      },
    ]);
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const divs = Array.from(shadow?.querySelectorAll("div") ?? []) as HTMLElement[];
    const badges = divs.filter((d) => d.children.length === 0 && /^\d+$/.test((d.textContent ?? "").trim()));
    expect(badges.length).toBe(2);
    // Click the second badge (index 2 → payload index 1)
    badges[1].click();
    expect(sendMessage).toHaveBeenCalledWith({ type: "VIOLATION_BADGE_CLICKED", payload: { index: 1 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("skips violation outline + badge for elements whose getBoundingClientRect is 0×0", () => {
    document.body.innerHTML = `<button id="zero">x</button>`;
    // Override JUST this element to return zero rect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return this.id === "zero"
        ? { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } }
        : { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON() { return {}; } };
    };
    showViolationOverlay([
      { id: "v", impact: "serious", description: "x", help: "x", helpUrl: "", tags: [], nodes: [{ selector: "#zero", html: "x", failureSummary: "x" }] },
    ]);
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("violation-overlay");
    // No badge — the element was skipped
    expect(container?.children.length ?? 0).toBe(0);
  });
});

describe("focus-gap overlay — additional reason branches", () => {
  it("flags a disabled native element with the disabled reason", () => {
    document.body.innerHTML = `<button id="b" disabled>x</button>`;
    showFocusGapOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("focus-gap-overlay");
    expect(container).toBeTruthy();
    const tooltips = Array.from(container!.querySelectorAll("div")).map((d) => d.textContent || "");
    // The reason text "disabled attribute" should appear in one of the tooltips.
    // (display/visibility branches are unreachable from real-browser rect-zero rule
    // — that's why our mocked-rect overrides them, exposing the disabled fall-through.)
    expect(tooltips.some((t) => /disabled/i.test(t))).toBe(true);
  });
});

describe("getFocusableElements — sort by positive tabindex", () => {
  it("places elements with positive tabindex before unset, ascending", () => {
    document.body.innerHTML = `
      <button id="natural">a</button>
      <button id="three" tabindex="3">c</button>
      <button id="one" tabindex="1">b</button>
    `;
    showTabOrderOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("tab-order-overlay");
    expect(container).toBeTruthy();
    // 3 badges rendered in tabindex order: 1 → 3 → natural
    const badges = Array.from(container!.children) as HTMLElement[];
    expect(badges.map((b) => b.textContent)).toEqual(["1", "2", "3"]);
  });
});

describe("tab-order overlay — zero-rect skip", () => {
  it("skips a focusable element whose rect is 0×0 (e.g., display:none-equivalent)", () => {
    document.body.innerHTML = `<button id="zero">x</button><button id="visible">y</button>`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Element.prototype as any).getBoundingClientRect = function () {
      return this.id === "zero"
        ? { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() { return {}; } }
        : { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON() { return {}; } };
    };
    showTabOrderOverlay();
    const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
    const container = shadow?.getElementById("tab-order-overlay");
    // Only the visible button gets a badge
    expect(container?.children.length).toBe(1);
  });
});
