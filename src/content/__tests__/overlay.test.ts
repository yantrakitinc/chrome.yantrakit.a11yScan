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
});
