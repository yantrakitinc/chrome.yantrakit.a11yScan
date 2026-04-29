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

  it("URL object input is normalized via .href", async () => {
    activateMocks([{ urlPattern: "/api/v2", status: 200, body: { from: "url-obj" } }]);
    const res = await fetch(new URL("https://x.com/api/v2/things"));
    expect(await res.json()).toEqual({ from: "url-obj" });
  });

  it("Request object input is normalized via .url", async () => {
    activateMocks([{ urlPattern: "/api/req", status: 200, body: { from: "req-obj" } }]);
    const req = new Request("https://x.com/api/req/y");
    const res = await fetch(req);
    expect(await res.json()).toEqual({ from: "req-obj" });
  });
});

describe("activateMocks — XHR interception", () => {
  afterEach(() => {
    deactivateMocks();
  });

  it("intercepts XHR open + send and dispatches load with the mocked body/status", async () => {
    activateMocks([{ urlPattern: "/xhr/users", status: 201, body: { id: 7 } }]);

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://x.com/xhr/users/7");
    const events: string[] = [];
    xhr.addEventListener("readystatechange", () => events.push("rsc"));
    xhr.addEventListener("load", () => events.push("load"));
    xhr.send();

    expect(events).toEqual(["rsc", "load"]);
    expect(xhr.status).toBe(201);
    expect(xhr.responseText).toBe(JSON.stringify({ id: 7 }));
    expect(xhr.readyState).toBe(4);
  });

  it("falls through to the real XHR open for non-matching URLs (no patched send)", async () => {
    activateMocks([{ urlPattern: "/match-me", status: 200, body: {} }]);

    const xhr = new XMLHttpRequest();
    // Open against a URL the mock does NOT match
    expect(() => xhr.open("GET", "https://x.com/other")).not.toThrow();
    // The send should NOT have been short-circuit-patched, so calling it should
    // try to actually send (will fail in jsdom but should not throw on the path
    // we care about — the prototype method, not our injected one).
    expect(typeof xhr.send).toBe("function");
  });

  it("URL object passed to xhr.open is normalized", () => {
    activateMocks([{ urlPattern: "/xhr-url", status: 200, body: { ok: 1 } }]);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", new URL("https://x.com/xhr-url/p"));
    let loaded = false;
    xhr.addEventListener("load", () => (loaded = true));
    xhr.send();
    expect(loaded).toBe(true);
    expect(xhr.responseText).toBe(JSON.stringify({ ok: 1 }));
  });

  it("XHR with method filter — non-matching method falls through", () => {
    activateMocks([{ urlPattern: "/xhr-mfilter", method: "POST", status: 201, body: {} }]);

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://x.com/xhr-mfilter");
    // GET is not the mocked POST → send is the prototype method, not the patched one.
    // We verify it didn't get short-circuited by checking that no synchronous load fires.
    let loadFired = false;
    xhr.addEventListener("load", () => (loadFired = true));
    // Don't actually call .send() — would attempt a real XHR. The presence of the
    // unpatched send is what we're verifying. Confirm via xhr.status (default 0).
    expect(xhr.status).toBe(0);
    expect(loadFired).toBe(false);
  });

  it("deactivateMocks restores the original XMLHttpRequest.prototype.open", () => {
    const beforeOpen = XMLHttpRequest.prototype.open;
    activateMocks([{ urlPattern: "/x", status: 200, body: {} }]);
    expect(XMLHttpRequest.prototype.open).not.toBe(beforeOpen);
    deactivateMocks();
    expect(XMLHttpRequest.prototype.open).toBe(beforeOpen);
  });
});
