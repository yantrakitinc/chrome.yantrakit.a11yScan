import { describe, it, expect } from "vitest";
import { OBSERVER_STORAGE_KEYS, DEFAULT_OBSERVER_SETTINGS } from "../types";

describe("OBSERVER_STORAGE_KEYS", () => {
  it("has correct key names matching codebase", () => {
    expect(OBSERVER_STORAGE_KEYS.state).toBe("observer_state");
    expect(OBSERVER_STORAGE_KEYS.history).toBe("observer_history");
  });
});

describe("DEFAULT_OBSERVER_SETTINGS", () => {
  it("has wildcard include by default", () => {
    expect(DEFAULT_OBSERVER_SETTINGS.includeDomains).toEqual(["*"]);
  });
  it("has empty exclude by default", () => {
    expect(DEFAULT_OBSERVER_SETTINGS.excludeDomains).toEqual([]);
  });
  it("has 30 second throttle", () => {
    expect(DEFAULT_OBSERVER_SETTINGS.throttleSeconds).toBe(30);
  });
  it("has 500 max history entries", () => {
    expect(DEFAULT_OBSERVER_SETTINGS.maxHistoryEntries).toBe(500);
  });
});
