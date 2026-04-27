// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findMatchIn, activateMocks, deactivateMocks } from "../mock-interceptor";
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

describe("activateMocks / deactivateMocks — fetch interception", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    // Replace with a tracking stub so we can tell when the patch falls through.
    (window as unknown as { fetch: typeof fetch }).fetch = (async () => {
      return new Response("PASSTHROUGH", { status: 418 });
    }) as typeof fetch;
  });

  afterEach(() => {
    deactivateMocks();
    (window as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it("returns the mock body for a matching URL", async () => {
    activateMocks([{ urlPattern: "/api/users", status: 200, body: { ok: true, list: [1, 2] } }]);
    const res = await fetch("https://x.com/api/users");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, list: [1, 2] });
  });

  it("falls through to the original fetch for a non-matching URL", async () => {
    activateMocks([{ urlPattern: "/api/users", status: 200, body: {} }]);
    const res = await fetch("https://x.com/other");
    expect(res.status).toBe(418);
  });

  it("applies status from the mock", async () => {
    activateMocks([{ urlPattern: "/x", status: 404, body: { msg: "gone" } }]);
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(404);
  });

  it("defaults missing status to 200 (per schema default)", async () => {
    activateMocks([{ urlPattern: "/x", body: {} } as iMockEndpoint]);
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(200);
  });

  it("filters by method when method is set on the mock", async () => {
    activateMocks([{ urlPattern: "/x", method: "POST", status: 201, body: {} }]);
    const get = await fetch("https://x.com/x");
    expect(get.status).toBe(418); // passes through
    const post = await fetch("https://x.com/x", { method: "POST" });
    expect(post.status).toBe(201);
  });

  it("merges custom headers with Content-Type: application/json", async () => {
    activateMocks([{ urlPattern: "/h", status: 200, body: {}, headers: { "X-Custom": "yes" } }]);
    const res = await fetch("https://x.com/h");
    expect(res.headers.get("X-Custom")).toBe("yes");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("deactivateMocks restores the original fetch", async () => {
    activateMocks([{ urlPattern: "/x", status: 200, body: {} }]);
    deactivateMocks();
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(418); // back to passthrough stub
  });

  it("activating again replaces the previous mocks (no double-patch)", async () => {
    activateMocks([{ urlPattern: "/a", status: 201, body: {} }]);
    activateMocks([{ urlPattern: "/b", status: 202, body: {} }]);
    const aRes = await fetch("https://x.com/a"); // /a no longer mocked
    expect(aRes.status).toBe(418);
    const bRes = await fetch("https://x.com/b");
    expect(bRes.status).toBe(202);
  });
});
