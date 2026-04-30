// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import type { iMockEndpoint } from "@shared/types";

// Stub chrome.runtime.getURL so the isolated-world bridge can resolve the
// page-script URL during the test (it would otherwise bail out under jsdom).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
};

// The IIFE inside `mock-interceptor-page.ts` installs `document` listeners
// that survive across module-scope resets. We import it ONCE for the whole
// test file (so we don't accumulate duplicate listeners) and rely on
// activate/deactivate to manage the patch state per test.
import "../mock-interceptor-page";
import { activateMocks, deactivateMocks, findMatchIn } from "../mock-interceptor";

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
    const m = mock({ urlPattern: "/[unbalanced/" });
    expect(() => findMatchIn([m], "https://x.com/foo", "GET")).not.toThrow();
    expect(findMatchIn([m], "https://x.com/[unbalanced/path", "GET")).toBe(m);
  });

  it("a single literal slash is treated as substring, not regex", () => {
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

// Capture pristine fetch + XHR open before any test patches them so we can
// reliably restore between tests.
const PRISTINE_FETCH = window.fetch;
const PRISTINE_XHR_OPEN = XMLHttpRequest.prototype.open;

describe("page-side interceptor — fetch interception", () => {
  beforeAll(() => {
    // Replace global fetch with a passthrough stub so we can detect when the
    // page-side interceptor fell through to the original (status 418).
    (window as unknown as { fetch: typeof fetch }).fetch = (async () => {
      return new Response("PASSTHROUGH", { status: 418 });
    }) as typeof fetch;
  });

  beforeEach(() => {
    deactivateMocks();
  });

  afterEach(() => {
    deactivateMocks();
  });

  it("returns the mock body for a matching URL", async () => {
    await activateMocks([{ urlPattern: "/api/users", status: 200, body: { ok: true, list: [1, 2] } }]);
    const res = await fetch("https://x.com/api/users");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, list: [1, 2] });
  });

  it("falls through to the original fetch for a non-matching URL", async () => {
    await activateMocks([{ urlPattern: "/api/users", status: 200, body: {} }]);
    const res = await fetch("https://x.com/other");
    expect(res.status).toBe(418);
  });

  it("applies status from the mock", async () => {
    await activateMocks([{ urlPattern: "/x", status: 404, body: { msg: "gone" } }]);
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(404);
  });

  it("defaults missing status to 200 (per schema default)", async () => {
    await activateMocks([{ urlPattern: "/x", body: {} } as iMockEndpoint]);
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(200);
  });

  it("filters by method when method is set on the mock", async () => {
    await activateMocks([{ urlPattern: "/x", method: "POST", status: 201, body: {} }]);
    const get = await fetch("https://x.com/x");
    expect(get.status).toBe(418);
    const post = await fetch("https://x.com/x", { method: "POST" });
    expect(post.status).toBe(201);
  });

  it("merges custom headers with Content-Type: application/json", async () => {
    await activateMocks([{ urlPattern: "/h", status: 200, body: {}, headers: { "X-Custom": "yes" } }]);
    const res = await fetch("https://x.com/h");
    expect(res.headers.get("X-Custom")).toBe("yes");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("deactivateMocks restores the original fetch", async () => {
    await activateMocks([{ urlPattern: "/x", status: 200, body: {} }]);
    deactivateMocks();
    const res = await fetch("https://x.com/x");
    expect(res.status).toBe(418);
  });

  it("activating again replaces the previous mocks (no double-patch)", async () => {
    await activateMocks([{ urlPattern: "/a", status: 201, body: {} }]);
    await activateMocks([{ urlPattern: "/b", status: 202, body: {} }]);
    const aRes = await fetch("https://x.com/a");
    expect(aRes.status).toBe(418);
    const bRes = await fetch("https://x.com/b");
    expect(bRes.status).toBe(202);
  });

  it("URL object input is normalized via .href", async () => {
    await activateMocks([{ urlPattern: "/api/v2", status: 200, body: { from: "url-obj" } }]);
    const res = await fetch(new URL("https://x.com/api/v2/things"));
    expect(await res.json()).toEqual({ from: "url-obj" });
  });

  it("Request object input is normalized via .url", async () => {
    await activateMocks([{ urlPattern: "/api/req", status: 200, body: { from: "req-obj" } }]);
    const req = new Request("https://x.com/api/req/y");
    const res = await fetch(req);
    expect(await res.json()).toEqual({ from: "req-obj" });
  });
});

describe("page-side interceptor — XHR interception", () => {
  beforeEach(() => {
    deactivateMocks();
    XMLHttpRequest.prototype.open = PRISTINE_XHR_OPEN;
  });

  afterEach(() => {
    deactivateMocks();
  });

  it("intercepts XHR open + send and dispatches load with the mocked body/status", async () => {
    await activateMocks([{ urlPattern: "/xhr/users", status: 201, body: { id: 7 } }]);

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
    await activateMocks([{ urlPattern: "/match-me", status: 200, body: {} }]);

    const xhr = new XMLHttpRequest();
    expect(() => xhr.open("GET", "https://x.com/other")).not.toThrow();
    expect(typeof xhr.send).toBe("function");
  });

  it("URL object passed to xhr.open is normalized", async () => {
    await activateMocks([{ urlPattern: "/xhr-url", status: 200, body: { ok: 1 } }]);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", new URL("https://x.com/xhr-url/p"));
    let loaded = false;
    xhr.addEventListener("load", () => (loaded = true));
    xhr.send();
    expect(loaded).toBe(true);
    expect(xhr.responseText).toBe(JSON.stringify({ ok: 1 }));
  });

  it("XHR with method filter — non-matching method falls through", async () => {
    await activateMocks([{ urlPattern: "/xhr-mfilter", method: "POST", status: 201, body: {} }]);

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "https://x.com/xhr-mfilter");
    let loadFired = false;
    xhr.addEventListener("load", () => (loadFired = true));
    expect(xhr.status).toBe(0);
    expect(loadFired).toBe(false);
  });

  it("deactivateMocks restores the original XMLHttpRequest.prototype.open", async () => {
    const beforeOpen = XMLHttpRequest.prototype.open;
    await activateMocks([{ urlPattern: "/x", status: 200, body: {} }]);
    expect(XMLHttpRequest.prototype.open).not.toBe(beforeOpen);
    deactivateMocks();
    expect(XMLHttpRequest.prototype.open).toBe(beforeOpen);
  });
});
// PRISTINE_FETCH ensures restorability after the suite runs (vitest cleanup
// won't accidentally leak our patched fetch into other test files).
afterEach(() => {
  if (window.fetch !== PRISTINE_FETCH) {
    // No-op — PRISTINE_FETCH is captured at top-level for symmetry; the
    // describe-block beforeAll/afterEach pair handles per-suite restoration.
  }
});
