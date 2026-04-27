import { describe, it, expect } from "vitest";
import { findMatchIn } from "../mock-interceptor";
import type { iMockEndpoint } from "@shared/types";

function mock(p: Partial<iMockEndpoint>): iMockEndpoint {
  return { urlPattern: "/api", status: 200, body: { ok: true }, ...p };
}

describe("findMatchIn — substring patterns", () => {
  it("matches when URL contains the pattern", () => {
    const m = mock({ urlPattern: "/api/users" });
    expect(findMatchIn([m], "https://x.com/api/users/42", "GET")).toBe(m);
  });

  it("does not match when URL does not contain pattern", () => {
    expect(findMatchIn([mock({ urlPattern: "/api/users" })], "https://x.com/auth", "GET")).toBeUndefined();
  });

  it("matches partial substrings (the pattern can appear anywhere)", () => {
    const m = mock({ urlPattern: "users" });
    expect(findMatchIn([m], "https://x.com/api/users/42", "GET")).toBe(m);
  });
});

describe("findMatchIn — regex patterns (slash-delimited)", () => {
  it("treats /pattern/ as a regex", () => {
    const m = mock({ urlPattern: "/users\\/\\d+/" });
    expect(findMatchIn([m], "https://x.com/api/users/42", "GET")).toBe(m);
    expect(findMatchIn([m], "https://x.com/api/users/abc", "GET")).toBeUndefined();
  });

  it("falls back to substring match when the regex is malformed (does not throw)", () => {
    // /[unbalanced/ is not a valid regex — should match as substring instead
    const m = mock({ urlPattern: "/[unbalanced/" });
    expect(() => findMatchIn([m], "https://x.com/foo", "GET")).not.toThrow();
    expect(findMatchIn([m], "https://x.com/[unbalanced/path", "GET")).toBe(m);
  });

  it("a single literal slash is treated as substring, not regex", () => {
    // Length 1 — does not satisfy the >=2 + start-and-end-with-slash regex requirement
    const m = mock({ urlPattern: "/" });
    expect(findMatchIn([m], "https://x.com/anything", "GET")).toBe(m);
  });
});

describe("findMatchIn — method filtering", () => {
  it("matches when no method is specified on the mock (any method)", () => {
    const m = mock({ urlPattern: "/api", method: undefined });
    expect(findMatchIn([m], "https://x.com/api", "POST")).toBe(m);
    expect(findMatchIn([m], "https://x.com/api", "DELETE")).toBe(m);
  });

  it("matches case-insensitively on method", () => {
    const m = mock({ urlPattern: "/api", method: "post" });
    expect(findMatchIn([m], "https://x.com/api", "POST")).toBe(m);
    expect(findMatchIn([m], "https://x.com/api", "post")).toBe(m);
  });

  it("filters by method when specified", () => {
    const m = mock({ urlPattern: "/api", method: "POST" });
    expect(findMatchIn([m], "https://x.com/api", "GET")).toBeUndefined();
    expect(findMatchIn([m], "https://x.com/api", "POST")).toBe(m);
  });
});

describe("findMatchIn — selection", () => {
  it("returns the FIRST matching mock when multiple match", () => {
    const a = mock({ urlPattern: "/api", body: { which: "a" } });
    const b = mock({ urlPattern: "/api", body: { which: "b" } });
    expect(findMatchIn([a, b], "https://x.com/api/x", "GET")).toBe(a);
  });

  it("returns undefined when no mock matches", () => {
    expect(findMatchIn([], "https://x.com/api", "GET")).toBeUndefined();
  });
});
