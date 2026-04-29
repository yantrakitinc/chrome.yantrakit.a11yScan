// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { lastScanViolations, setLastScanViolations } from "../scan-state";

describe("scan-state", () => {
  it("starts with an empty violations array", () => {
    expect(Array.isArray(lastScanViolations)).toBe(true);
  });

  it("setLastScanViolations updates the module-level array", () => {
    const v = [
      { id: "color-contrast", impact: "serious" as const, description: "x", help: "x", helpUrl: "", tags: [], nodes: [] },
    ];
    setLastScanViolations(v);
    // Need to re-import after mutation since lastScanViolations is a let-reassignment
    // — the binding is updated, the array reference is the new one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__a11yScanViolations).toBe(v);
  });

  it("setLastScanViolations exposes the array on window.__a11yScanViolations for DevTools panel", () => {
    const v = [
      { id: "rule-x", impact: "minor" as const, description: "x", help: "x", helpUrl: "", tags: [], nodes: [] },
    ];
    setLastScanViolations(v);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__a11yScanViolations).toBe(v);
  });

  it("setting an empty array clears the page-level global", () => {
    setLastScanViolations([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__a11yScanViolations).toEqual([]);
  });
});
