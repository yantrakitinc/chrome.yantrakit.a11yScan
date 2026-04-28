/**
 * Remote configuration management.
 * Fetches and caches scan config from a GitHub Gist.
 */

import type { iRemoteConfig } from "./types";
import { logWarn } from "./log";

const CACHE_KEY = "a11yscan_config";
const CACHE_TIMESTAMP_KEY = "a11yscan_config_timestamp";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const GIST_URL =
  "https://gist.githubusercontent.com/yantrakitinc/1cde179b72bdedc56daf217bdb32017b/raw/a11yscan-config.json";

const DEFAULT_CONFIG: iRemoteConfig = {
  version: "0.0.0",
  wcagVersion: "2.2",
  wcagLevel: "AA",
  rules: {},
  scanOptions: {
    resultTypes: ["violations", "passes", "incomplete", "inapplicable"],
  },
};

/** Get cached config or fetch fresh, always merged with defaults */
export async function getConfig(): Promise<iRemoteConfig> {
  const cached = await getCachedConfig();
  if (cached) {
    // Re-merge with defaults in case cached version is missing new fields
    return {
      ...DEFAULT_CONFIG,
      ...cached,
      scanOptions: { ...DEFAULT_CONFIG.scanOptions, ...(cached.scanOptions || {}) },
    };
  }
  return fetchAndCacheConfig();
}

/** Force re-fetch config regardless of cache */
export async function forceUpdateConfig(): Promise<iRemoteConfig> {
  return fetchAndCacheConfig();
}

async function getCachedConfig(): Promise<iRemoteConfig | null> {
  // chrome.storage.local can reject if the extension context was invalidated
  // (rare — happens when the extension is reloaded mid-call). Treat any
  // failure here as a cache miss so the caller falls through to the fresh
  // fetch path instead of propagating the storage error to the user.
  let data: Record<string, unknown>;
  try {
    data = await chrome.storage.local.get([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
  } catch (err) {
    logWarn("config.getCachedConfig", "storage.local.get failed — treating as cache miss", err);
    return null;
  }
  const config = data[CACHE_KEY] as iRemoteConfig | undefined;
  const timestamp = data[CACHE_TIMESTAMP_KEY] as number | undefined;
  if (!config || !timestamp) return null;
  if (Date.now() - timestamp > CACHE_MAX_AGE_MS) return null;
  return config;
}

async function fetchAndCacheConfig(): Promise<iRemoteConfig> {
  try {
    const res = await fetch(GIST_URL);
    if (!res.ok) return DEFAULT_CONFIG;
    const remote = (await res.json()) as Partial<iRemoteConfig>;
    // Merge with defaults — remote values override, missing fields use defaults
    const config: iRemoteConfig = {
      ...DEFAULT_CONFIG,
      ...remote,
      scanOptions: {
        ...DEFAULT_CONFIG.scanOptions,
        ...(remote.scanOptions || {}),
      },
    };
    await chrome.storage.local.set({
      [CACHE_KEY]: config,
      [CACHE_TIMESTAMP_KEY]: Date.now(),
    });
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Build axe-core WCAG tags from version + level.
 * axe-core tag format: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22a, wcag22aa
 * Note: WCAG 2.0 uses "wcag2" prefix (NOT "wcag20") */
export function buildWcagTags(version: string, level: string): string[] {
  const tags: string[] = [];
  // axe-core tag prefixes — "2.0" maps to "2", not "20"
  const versionMap: Record<string, string> = { "2.0": "2", "2.1": "21", "2.2": "22" };
  const versions = ["2.0", "2.1", "2.2"];
  const levels = ["A", "AA", "AAA"];
  const levelIdx = levels.indexOf(level);
  const versionIdx = versions.indexOf(version);

  for (let v = 0; v <= versionIdx; v++) {
    for (let l = 0; l <= levelIdx; l++) {
      const ver = versionMap[versions[v]];
      const lev = levels[l].toLowerCase();
      tags.push(`wcag${ver}${lev}`);
    }
  }
  return tags;
}
