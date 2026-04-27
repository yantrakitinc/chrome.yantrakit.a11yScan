import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub chrome.storage.local for getCachedConfig / fetchAndCacheConfig.
function makeChromeStorage() {
  const store: Record<string, unknown> = {};
  const local = {
    async get(keys: string | string[]) {
      const ks = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of ks) if (k in store) out[k] = store[k];
      return out;
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
    async remove(keys: string | string[]) {
      const ks = Array.isArray(keys) ? keys : [keys];
      for (const k of ks) delete store[k];
    },
  };
  return { storage: { local }, _store: store };
}

const CACHE_KEY = "a11yscan_config";
const CACHE_TS_KEY = "a11yscan_config_timestamp";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = makeChromeStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).fetch;
});

describe("getConfig — cache hit returns the cached value merged with defaults", () => {
  it("returns the cached config when timestamp is fresh", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome as ReturnType<typeof makeChromeStorage>;
    c._store[CACHE_KEY] = {
      version: "9.9.9",
      wcagVersion: "2.1",
      wcagLevel: "AAA",
      rules: { "color-contrast": { enabled: false } },
      scanOptions: { resultTypes: ["violations"] },
    };
    c._store[CACHE_TS_KEY] = Date.now();

    const cfg = await getConfig();
    expect(cfg.version).toBe("9.9.9");
    expect(cfg.wcagLevel).toBe("AAA");
    expect(cfg.rules["color-contrast"].enabled).toBe(false);
  });

  it("merges defaults under cached scanOptions when fields are missing", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome as ReturnType<typeof makeChromeStorage>;
    c._store[CACHE_KEY] = { version: "1.0.0", scanOptions: {} };
    c._store[CACHE_TS_KEY] = Date.now();

    const cfg = await getConfig();
    expect(cfg.scanOptions.resultTypes).toEqual(["violations", "passes", "incomplete", "inapplicable"]);
  });

  it("falls back to fetch when the cache is older than 24h", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome as ReturnType<typeof makeChromeStorage>;
    c._store[CACHE_KEY] = { version: "stale" };
    c._store[CACHE_TS_KEY] = Date.now() - ONE_DAY_MS - 1000;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      async json() { return { version: "fresh", wcagVersion: "2.2", wcagLevel: "AA" }; },
    }));

    const cfg = await getConfig();
    expect(cfg.version).toBe("fresh");
  });
});

describe("getConfig — fetch path", () => {
  it("returns DEFAULT_CONFIG when no cache exists and fetch fails", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () => { throw new Error("network down"); });
    const cfg = await getConfig();
    expect(cfg.version).toBe("0.0.0");
    expect(cfg.wcagVersion).toBe("2.2");
    expect(cfg.wcagLevel).toBe("AA");
  });

  it("returns DEFAULT_CONFIG when fetch returns non-ok response", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    const cfg = await getConfig();
    expect(cfg.version).toBe("0.0.0");
  });

  it("merges remote config over defaults and writes both cache keys", async () => {
    const { getConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      async json() { return { version: "2.0.0", wcagLevel: "AAA" }; },
    }));

    const cfg = await getConfig();
    expect(cfg.version).toBe("2.0.0");
    expect(cfg.wcagLevel).toBe("AAA");
    expect(cfg.wcagVersion).toBe("2.2"); // default

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome as ReturnType<typeof makeChromeStorage>;
    expect(c._store[CACHE_KEY]).toBeTruthy();
    expect(typeof c._store[CACHE_TS_KEY]).toBe("number");
  });
});

describe("forceUpdateConfig", () => {
  it("ignores the cache and always re-fetches", async () => {
    const { forceUpdateConfig } = await import("../config");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome as ReturnType<typeof makeChromeStorage>;
    c._store[CACHE_KEY] = { version: "stale" };
    c._store[CACHE_TS_KEY] = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      async json() { return { version: "forced" }; },
    }));

    const cfg = await forceUpdateConfig();
    expect(cfg.version).toBe("forced");
  });
});
