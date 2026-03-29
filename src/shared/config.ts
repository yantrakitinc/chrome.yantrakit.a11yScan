import type { iRemoteConfig } from './types';

/**
 * Site URL for the A11y Scan website.
 * Update this when migrating to a new domain.
 */
export const SITE_URL = 'https://a11yscan.yantrakit.com';

const GIST_URL =
  'https://gist.githubusercontent.com/yantrakitinc/1cde179b72bdedc56daf217bdb32017b/raw/a11yscan-config.json';

const CACHE_KEY = 'a11yscan_config';
const CACHE_TIMESTAMP_KEY = 'a11yscan_config_timestamp';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: iRemoteConfig = {
  version: '0.0.0',
  wcagVersion: '2.2',
  wcagLevel: 'AA',
  rules: {},
  scanOptions: {
    resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
  },
};

/**
 * Fetches config from the remote Gist URL.
 * Returns null if the fetch fails.
 */
async function fetchRemoteConfig(): Promise<iRemoteConfig | null> {
  try {
    const response = await fetch(GIST_URL);
    if (!response.ok) return null;
    const data = await response.json();
    return data as iRemoteConfig;
  } catch {
    return null;
  }
}

/**
 * Reads cached config from chrome.storage.local.
 * Returns null if no cache exists.
 */
async function getCachedConfig(): Promise<iRemoteConfig | null> {
  const result = await chrome.storage.local.get([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
  if (result[CACHE_KEY]) {
    return result[CACHE_KEY] as iRemoteConfig;
  }
  return null;
}

/**
 * Checks if the cached config is still fresh (less than 24 hours old).
 */
async function isCacheFresh(): Promise<boolean> {
  const result = await chrome.storage.local.get(CACHE_TIMESTAMP_KEY);
  const timestamp = result[CACHE_TIMESTAMP_KEY] as number | undefined;
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_MAX_AGE_MS;
}

/**
 * Saves config to chrome.storage.local with a timestamp.
 */
async function cacheConfig(config: iRemoteConfig): Promise<void> {
  await chrome.storage.local.set({
    [CACHE_KEY]: config,
    [CACHE_TIMESTAMP_KEY]: Date.now(),
  });
}

/**
 * Gets the current config, fetching from remote if cache is stale.
 * Falls back to cached config, then to built-in defaults.
 */
export async function getConfig(): Promise<iRemoteConfig> {
  const fresh = await isCacheFresh();

  if (fresh) {
    const cached = await getCachedConfig();
    if (cached) return cached;
  }

  const remote = await fetchRemoteConfig();
  if (remote) {
    await cacheConfig(remote);
    return remote;
  }

  const cached = await getCachedConfig();
  if (cached) return cached;

  return DEFAULT_CONFIG;
}

/**
 * Forces an immediate re-fetch of the remote config, bypassing cache age check.
 */
export async function forceUpdateConfig(): Promise<iRemoteConfig> {
  const remote = await fetchRemoteConfig();
  if (remote) {
    await cacheConfig(remote);
    return remote;
  }

  const cached = await getCachedConfig();
  if (cached) return cached;

  return DEFAULT_CONFIG;
}
