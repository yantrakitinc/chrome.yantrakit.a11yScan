// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { flashActiveItem } from "../scan-tab/handlers/dom-utils";

describe("flashActiveItem", () => {
  it("null target is a no-op (no throw)", () => {
    expect(() => flashActiveItem(null)).not.toThrow();
  });

  it("adds ds-flash-active class to the target element synchronously", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    flashActiveItem(div);
    expect(div.classList.contains("ds-flash-active")).toBe(true);
  });

  it("calling flashActiveItem twice on the same target clears the prior timer (no double-class-flicker)", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    flashActiveItem(div);
    // Second call exercises the `if (existing) clearTimeout(existing)` branch.
    expect(() => flashActiveItem(div)).not.toThrow();
    expect(div.classList.contains("ds-flash-active")).toBe(true);
  });
});
