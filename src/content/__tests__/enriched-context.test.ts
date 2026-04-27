// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { collectEnrichedContext } from "../enriched-context";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("collectEnrichedContext — selector lookup", () => {
  it("returns an empty object when none of the selectors match", () => {
    expect(collectEnrichedContext(["#missing"])).toEqual({});
  });

  it("populates one entry per matched selector", () => {
    document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
    const out = collectEnrichedContext(["#a", "#b", "#c"]);
    expect(Object.keys(out).sort()).toEqual(["#a", "#b"]);
  });
});

describe("collectEnrichedContext — DOM context", () => {
  it("captures parent tag name and sibling selectors", () => {
    document.body.innerHTML = `
      <section id="sec"><h2>Title</h2><p id="target"></p><span class="muted"></span></section>
    `;
    const out = collectEnrichedContext(["#target"]);
    expect(out["#target"].dom.parentTagName).toBe("section");
    expect(out["#target"].dom.siblingSelectors.length).toBeGreaterThanOrEqual(2);
  });

  it("finds the nearest landmark (semantic tag)", () => {
    document.body.innerHTML = `<nav><a id="link" href="#">x</a></nav>`;
    expect(collectEnrichedContext(["#link"])["#link"].dom.nearestLandmark).toBe("nav");
  });

  it("finds the nearest landmark via role attribute", () => {
    document.body.innerHTML = `<div role="navigation"><a id="link" href="#">x</a></div>`;
    expect(collectEnrichedContext(["#link"])["#link"].dom.nearestLandmark).toBe("navigation");
  });

  it("finds the nearest heading text from the closest semantic container", () => {
    document.body.innerHTML = `<section id="sec"><h2>Settings</h2><button id="btn">Save</button></section>`;
    const out = collectEnrichedContext(["#btn"]);
    expect(out["#btn"].dom.nearestHeading).toBe("Settings");
  });

  it("returns empty parentTagName when element has no parent (already in body)", () => {
    document.body.innerHTML = `<div id="x"></div>`;
    const out = collectEnrichedContext(["#x"]);
    expect(out["#x"].dom.parentTagName).toBe("body");
  });
});

describe("collectEnrichedContext — framework hints", () => {
  it("detects data-testid", () => {
    document.body.innerHTML = `<button id="b" data-testid="submit-btn">x</button>`;
    expect(collectEnrichedContext(["#b"])["#b"].framework.testId).toBe("submit-btn");
  });

  it("detects data-cy as testId", () => {
    document.body.innerHTML = `<button id="b" data-cy="cy-btn">x</button>`;
    expect(collectEnrichedContext(["#b"])["#b"].framework.testId).toBe("cy-btn");
  });

  it("detects Angular when ng-* attribute is present", () => {
    document.body.innerHTML = `<div id="a" ng-version="17.0.0"></div>`;
    expect(collectEnrichedContext(["#a"])["#a"].framework.detected).toBe("Angular");
  });

  it("returns null detected when no framework markers exist", () => {
    document.body.innerHTML = `<div id="x"></div>`;
    expect(collectEnrichedContext(["#x"])["#x"].framework.detected).toBeNull();
  });
});

describe("collectEnrichedContext — file path guesses", () => {
  it("infers a component path from a BEM class", () => {
    document.body.innerHTML = `<div id="card" class="card__body card__body--primary"></div>`;
    const guesses = collectEnrichedContext(["#card"])["#card"].filePathGuesses;
    expect(guesses.length).toBeGreaterThan(0);
    expect(guesses[0].guess).toBe("components/card");
  });

  it("uses data-component when present", () => {
    document.body.innerHTML = `<div id="x" data-component="UserMenu"></div>`;
    const guesses = collectEnrichedContext(["#x"])["#x"].filePathGuesses;
    expect(guesses.find((g) => g.guess === "components/UserMenu")).toBeTruthy();
  });

  it("returns an empty array when no class or data-component pattern is recognised", () => {
    document.body.innerHTML = `<div id="plain" class="bg-red-500"></div>`;
    expect(collectEnrichedContext(["#plain"])["#plain"].filePathGuesses).toEqual([]);
  });
});
