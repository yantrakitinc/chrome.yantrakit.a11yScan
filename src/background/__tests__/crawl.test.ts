import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isUrlGated, stripFragment, handleCrawlMessage, matchPageRule, applyTestConfigOverrides, pushLinksToQueue } from "../crawl";
import type { iMessage } from "@shared/messages";

describe("isUrlGated", () => {
  it("returns false when no gating config given", () => {
    expect(isUrlGated("https://x.com/admin", undefined)).toBe(false);
  });

  it("returns false for mode=none even with patterns", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "none", patterns: ["https://x.com/admin"] })).toBe(false);
  });

  it("returns false for empty patterns array", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "list", patterns: [] })).toBe(false);
  });

  it("mode=list matches exact URL only", () => {
    const cfg = { mode: "list", patterns: ["https://x.com/admin"] };
    expect(isUrlGated("https://x.com/admin", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/admin/users", cfg)).toBe(false);
    expect(isUrlGated("https://x.com/ADMIN", cfg)).toBe(false);
  });

  it("mode=prefix matches startsWith", () => {
    const cfg = { mode: "prefix", patterns: ["https://x.com/admin"] };
    expect(isUrlGated("https://x.com/admin", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/admin/users", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/public", cfg)).toBe(false);
  });

  it("mode=regex matches with RegExp test", () => {
    const cfg = { mode: "regex", patterns: ["^https://x\\.com/(admin|account)/"] };
    expect(isUrlGated("https://x.com/admin/", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/account/edit", cfg)).toBe(true);
    expect(isUrlGated("https://x.com/public", cfg)).toBe(false);
  });

  it("mode=regex with an invalid pattern returns false instead of throwing", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "regex", patterns: ["[unbalanced"] })).toBe(false);
  });

  it("returns false for unknown mode", () => {
    expect(isUrlGated("https://x.com/admin", { mode: "garbage", patterns: ["https://x.com/admin"] })).toBe(false);
  });

  it("matches if any pattern in the list matches", () => {
    const cfg = { mode: "prefix", patterns: ["https://x.com/admin", "https://x.com/account"] };
    expect(isUrlGated("https://x.com/account/billing", cfg)).toBe(true);
  });
});

describe("handleCrawlMessage — routing", () => {
  const sendMessageCalls: unknown[] = [];

  beforeEach(() => {
    sendMessageCalls.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      tabs: { query: vi.fn(async () => []) }, // empty so startCrawl bails fast
      runtime: { sendMessage: vi.fn((m) => { sendMessageCalls.push(m); }) },
      storage: { local: { remove: vi.fn(async () => undefined), set: vi.fn(async () => undefined) } },
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).chrome;
  });

  it("PAUSE_CRAWL responds with success and broadcasts state", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "PAUSE_CRAWL" } as iMessage, (r) => responses.push(r));
    expect(responses[0]).toEqual({ success: true });
    expect(sendMessageCalls.some((m) => (m as { type: string }).type === "CRAWL_PROGRESS")).toBe(true);
  });

  it("CANCEL_CRAWL clears storage and responds success", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "CANCEL_CRAWL" } as iMessage, (r) => responses.push(r));
    expect(responses[0]).toEqual({ success: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).chrome.storage.local.remove).toHaveBeenCalled();
  });

  it("GET_CRAWL_STATE responds with current state", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "GET_CRAWL_STATE" } as iMessage, (r) => responses.push(r));
    const out = responses[0] as { type: string; payload: { status: string } };
    expect(out.type).toBe("CRAWL_PROGRESS");
    expect(typeof out.payload.status).toBe("string");
  });

  it("RESUME_CRAWL responds with success", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "RESUME_CRAWL" } as iMessage, (r) => responses.push(r));
    expect(responses[0]).toEqual({ success: true });
  });

  it("USER_CONTINUE responds with success", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "USER_CONTINUE" } as iMessage, (r) => responses.push(r));
    expect(responses[0]).toEqual({ success: true });
  });

  it("unknown message types respond with an error envelope", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage({ type: "GARBAGE" } as unknown as iMessage, (r) => responses.push(r));
    expect(responses[0]).toEqual({ error: "Unknown crawl message" });
  });

  it("START_CRAWL acknowledges immediately even though startCrawl runs async", async () => {
    const responses: unknown[] = [];
    await handleCrawlMessage(
      { type: "START_CRAWL", payload: { mode: "follow", timeout: 30000, delay: 1000, scope: "", urlList: [], pageRules: [] } } as iMessage,
      (r) => responses.push(r),
    );
    expect(responses[0]).toEqual({ success: true });
  });
});

describe("pushLinksToQueue", () => {
  it("appends new links to the queue, skipping already-visited URLs", () => {
    const out = pushLinksToQueue(
      ["https://x.com/seed"],
      ["https://x.com/visited"],
      ["https://x.com/new", "https://x.com/visited", "https://x.com/another"],
    );
    expect(out).toContain("https://x.com/seed");
    expect(out).toContain("https://x.com/another");
    expect(out).not.toContain("https://x.com/visited");
  });

  it("skips URLs already in the queue", () => {
    const out = pushLinksToQueue(
      ["https://x.com/a"],
      [],
      ["https://x.com/a", "https://x.com/b"],
    );
    expect(out.filter((u) => u === "https://x.com/a").length).toBe(1);
    expect(out).toContain("https://x.com/b");
  });

  it("reverses incoming order so the first link in the page pops first (depth-first)", () => {
    // queue is a LIFO stack — to make link[0] pop first, we push in reverse.
    const out = pushLinksToQueue([], [], ["a", "b", "c"]);
    // Inputs reversed → pushed [c, b, a] → a will be popped first
    expect(out).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input queue or links arrays", () => {
    const queue = ["x"];
    const links = ["a", "b"];
    pushLinksToQueue(queue, [], links);
    expect(queue).toEqual(["x"]);
    expect(links).toEqual(["a", "b"]);
  });

  it("returns a copy of the input queue when no new links", () => {
    const queue = ["a", "b"];
    const out = pushLinksToQueue(queue, [], []);
    expect(out).toEqual(["a", "b"]);
    expect(out).not.toBe(queue);
  });
});

describe("matchPageRule", () => {
  it("returns null when pageRules is undefined or empty", () => {
    expect(matchPageRule("https://x.com/admin", undefined)).toBeNull();
    expect(matchPageRule("https://x.com/admin", [])).toBeNull();
  });

  it("matches via substring when pattern is a literal", () => {
    const rule = { pattern: "/login", waitType: "login", description: "Sign in" };
    expect(matchPageRule("https://x.com/login", [rule])).toBe(rule);
    expect(matchPageRule("https://x.com/admin", [rule])).toBeNull();
  });

  it("matches via regex when pattern is a regex literal", () => {
    const rule = { pattern: "^https://x\\.com/account/", waitType: "interaction", description: "" };
    expect(matchPageRule("https://x.com/account/billing", [rule])).toBe(rule);
    expect(matchPageRule("https://x.com/about", [rule])).toBeNull();
  });

  it("falls back to substring match when regex is malformed", () => {
    const rule = { pattern: "[unbalanced", waitType: "login", description: "" };
    expect(matchPageRule("https://x.com/path/[unbalanced/q", [rule])).toBe(rule);
    expect(matchPageRule("https://x.com/safe", [rule])).toBeNull();
  });

  it("returns the FIRST matching rule when multiple match", () => {
    const a = { pattern: "/admin", waitType: "login", description: "a" };
    const b = { pattern: "/admin", waitType: "interaction", description: "b" };
    expect(matchPageRule("https://x.com/admin", [a, b])).toBe(a);
  });
});

describe("applyTestConfigOverrides", () => {
  function base() {
    return {
      wcagVersion: "2.2",
      wcagLevel: "AA",
      rules: { "color-contrast": { enabled: true }, "region": { enabled: true } },
    };
  }

  it("returns the input config when testConfig is null", () => {
    const out = applyTestConfigOverrides(base(), null);
    expect(out.wcagVersion).toBe("2.2");
    expect(out.wcagLevel).toBe("AA");
    expect(Object.keys(out.rules!).sort()).toEqual(["color-contrast", "region"]);
  });

  it("overrides wcag version + level when present in testConfig", () => {
    const out = applyTestConfigOverrides(base(), { wcag: { version: "2.1", level: "AAA" } });
    expect(out.wcagVersion).toBe("2.1");
    expect(out.wcagLevel).toBe("AAA");
  });

  it("rules.include — enables only the listed rules, disables everything else", () => {
    const out = applyTestConfigOverrides(base(), { rules: { include: ["color-contrast"] } });
    expect(out.rules!["color-contrast"].enabled).toBe(true);
    expect(out.rules!["region"].enabled).toBe(false);
  });

  it("rules.exclude — keeps base rules but disables the listed ones", () => {
    const out = applyTestConfigOverrides(base(), { rules: { exclude: ["region"] } });
    expect(out.rules!["color-contrast"].enabled).toBe(true);
    expect(out.rules!["region"].enabled).toBe(false);
  });

  it("does NOT mutate the input config", () => {
    const input = base();
    applyTestConfigOverrides(input, { wcag: { version: "2.0" }, rules: { exclude: ["region"] } });
    expect(input.wcagVersion).toBe("2.2");
    expect(input.rules!["region"].enabled).toBe(true);
  });

  it("handles a config with no rules object (treats as empty)", () => {
    const out = applyTestConfigOverrides({ wcagVersion: "2.2", wcagLevel: "AA" }, { rules: { include: ["x"] } });
    expect(out.rules).toEqual({ x: { enabled: true } });
  });
});

describe("stripFragment", () => {
  it("removes a hash fragment", () => {
    expect(stripFragment("https://x.com/page#section")).toBe("https://x.com/page");
  });

  it("preserves trailing slash semantics", () => {
    expect(stripFragment("https://x.com/page/#section")).toBe("https://x.com/page/");
  });

  it("preserves query string", () => {
    expect(stripFragment("https://x.com/page?a=1#section")).toBe("https://x.com/page?a=1");
  });

  it("returns input unchanged when there is no fragment", () => {
    expect(stripFragment("https://x.com/page")).toBe("https://x.com/page");
  });

  it("collapses /page#a and /page#b to the same canonical form", () => {
    expect(stripFragment("https://x.com/page#a")).toBe(stripFragment("https://x.com/page#b"));
  });

  it("returns the raw input when URL parsing fails", () => {
    expect(stripFragment("not a url")).toBe("not a url");
  });
});
