import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isUrlGated, stripFragment, handleCrawlMessage } from "../crawl";
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
