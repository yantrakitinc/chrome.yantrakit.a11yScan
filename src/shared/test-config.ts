/**
 * Test configuration schema for A11y Scan.
 * Allows users to define scan parameters via JSON config files.
 * Extension works standalone with smart defaults; config is optional.
 */

/** Scan mode: single page, list of URLs, sitemap, or auto-discover links. */
export type iScanMode = 'single' | 'url-list' | 'sitemap' | 'discover';

/** WCAG version supported by the scanner. */
export type iWcagVersion = '2.0' | '2.1' | '2.2';

/** WCAG conformance level. */
export type iWcagLevel = 'A' | 'AA' | 'AAA';

/** Rule filter mode: run all rules, include only listed, or exclude listed. */
export type iRuleFilterMode = 'all' | 'include' | 'exclude';

/** Authentication config for pages behind login. */
export interface iAuthConfig {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
}

/** Viewport preset with label and width. */
export interface iViewportPreset {
  label: string;
  width: number;
}

/** Enriched export toggles — controls what extra context is collected. */
export interface iEnrichmentOptions {
  domContext: boolean;
  cssComputedStyles: boolean;
  frameworkHints: boolean;
  filePathGuesses: boolean;
}

/** Rule filter configuration. */
export interface iRuleFilter {
  mode: iRuleFilterMode;
  ruleIds: string[];
}

/** Pages configuration for multi-page scans. */
export interface iPagesConfig {
  urls: string[];
  sitemapUrl: string;
  autoDiscover: boolean;
  maxPages: number;
}

/** Timing configuration for scan delays. */
export interface iTimingConfig {
  pageLoadTimeout: number;
  scanTimeout: number;
  delayBetweenPages: number;
}

/** Wait type for page rules. */
export type iPageRuleWaitType = 'login' | 'interaction' | 'deferred-content';

/** A rule that tells the crawler to pause at matching URLs. */
export interface iPageRule {
  urlPattern: string;
  waitType: iPageRuleWaitType;
  description?: string;
}

/**
 * Full test configuration schema.
 * All fields are optional — the extension applies smart defaults for any missing field.
 */
export interface iTestConfig {
  name: string;
  scanMode: iScanMode;
  pages: iPagesConfig;
  wcagVersion: iWcagVersion;
  wcagLevel: iWcagLevel;
  viewports: iViewportPreset[];
  timing: iTimingConfig;
  auth: iAuthConfig | null;
  rules: iRuleFilter;
  enrichment: iEnrichmentOptions;
  pageRules: iPageRule[];
  mocks: iMockEndpoint[];
}

/** HTTP method for mock endpoints. */
export type iMockMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** A mock API endpoint — intercepts matching requests and returns canned data. */
export interface iMockEndpoint {
  urlPattern: string;
  method: iMockMethod;
  status: number;
  responseBody: unknown;
  responseHeaders?: Record<string, string>;
  description?: string;
}

/** Default viewport presets. */
export const DEFAULT_VIEWPORTS: iViewportPreset[] = [
  { label: 'Mobile', width: 375 },
  { label: 'Tablet', width: 768 },
  { label: 'Desktop', width: 1280 },
];

/** Default timing values (milliseconds). */
export const DEFAULT_TIMING: iTimingConfig = {
  pageLoadTimeout: 10000,
  scanTimeout: 30000,
  delayBetweenPages: 500,
};

/** Default enrichment options — all enabled. */
export const DEFAULT_ENRICHMENT: iEnrichmentOptions = {
  domContext: true,
  cssComputedStyles: true,
  frameworkHints: true,
  filePathGuesses: true,
};

/** Default pages config. */
export const DEFAULT_PAGES: iPagesConfig = {
  urls: [],
  sitemapUrl: '',
  autoDiscover: false,
  maxPages: 50,
};

/** Default rule filter — run all rules. */
export const DEFAULT_RULES: iRuleFilter = {
  mode: 'all',
  ruleIds: [],
};

/**
 * Returns a complete iTestConfig with smart defaults for any missing fields.
 */
export function createDefaultConfig(name = 'Default'): iTestConfig {
  return {
    name,
    scanMode: 'single',
    pages: { ...DEFAULT_PAGES },
    wcagVersion: '2.2',
    wcagLevel: 'AA',
    viewports: DEFAULT_VIEWPORTS.map((v) => ({ ...v })),
    timing: { ...DEFAULT_TIMING },
    auth: null,
    rules: { ...DEFAULT_RULES, ruleIds: [] },
    enrichment: { ...DEFAULT_ENRICHMENT },
    pageRules: [],
    mocks: [],
  };
}

/** Validation error with field path and message. */
export interface iValidationError {
  field: string;
  message: string;
}

const VALID_SCAN_MODES: iScanMode[] = ['single', 'url-list', 'sitemap', 'discover'];
const VALID_WCAG_VERSIONS: iWcagVersion[] = ['2.0', '2.1', '2.2'];
const VALID_WCAG_LEVELS: iWcagLevel[] = ['A', 'AA', 'AAA'];
const VALID_RULE_FILTER_MODES: iRuleFilterMode[] = ['all', 'include', 'exclude'];

/**
 * Validates a test config object. Returns an array of validation errors.
 * Empty array means the config is valid.
 */
export function validateTestConfig(config: unknown): iValidationError[] {
  const errors: iValidationError[] = [];

  if (!config || typeof config !== 'object') {
    errors.push({ field: 'root', message: 'Config must be a non-null object' });
    return errors;
  }

  const c = config as Record<string, unknown>;

  // name
  if (c.name !== undefined && typeof c.name !== 'string') {
    errors.push({ field: 'name', message: 'Must be a string' });
  }
  if (typeof c.name === 'string' && c.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Must not be empty' });
  }

  // scanMode
  if (c.scanMode !== undefined && !VALID_SCAN_MODES.includes(c.scanMode as iScanMode)) {
    errors.push({ field: 'scanMode', message: `Must be one of: ${VALID_SCAN_MODES.join(', ')}` });
  }

  // wcagVersion
  if (c.wcagVersion !== undefined && !VALID_WCAG_VERSIONS.includes(c.wcagVersion as iWcagVersion)) {
    errors.push({ field: 'wcagVersion', message: `Must be one of: ${VALID_WCAG_VERSIONS.join(', ')}` });
  }

  // wcagLevel
  if (c.wcagLevel !== undefined && !VALID_WCAG_LEVELS.includes(c.wcagLevel as iWcagLevel)) {
    errors.push({ field: 'wcagLevel', message: `Must be one of: ${VALID_WCAG_LEVELS.join(', ')}` });
  }

  // pages
  if (c.pages !== undefined) {
    if (!c.pages || typeof c.pages !== 'object') {
      errors.push({ field: 'pages', message: 'Must be an object' });
    } else {
      const p = c.pages as Record<string, unknown>;
      if (p.urls !== undefined && !Array.isArray(p.urls)) {
        errors.push({ field: 'pages.urls', message: 'Must be an array of strings' });
      }
      if (Array.isArray(p.urls) && p.urls.some((u: unknown) => typeof u !== 'string')) {
        errors.push({ field: 'pages.urls', message: 'All entries must be strings' });
      }
      if (p.sitemapUrl !== undefined && typeof p.sitemapUrl !== 'string') {
        errors.push({ field: 'pages.sitemapUrl', message: 'Must be a string' });
      }
      if (p.autoDiscover !== undefined && typeof p.autoDiscover !== 'boolean') {
        errors.push({ field: 'pages.autoDiscover', message: 'Must be a boolean' });
      }
      if (p.maxPages !== undefined) {
        if (typeof p.maxPages !== 'number' || !Number.isInteger(p.maxPages) || p.maxPages < 1) {
          errors.push({ field: 'pages.maxPages', message: 'Must be a positive integer' });
        }
      }
    }
  }

  // viewports
  if (c.viewports !== undefined) {
    if (!Array.isArray(c.viewports)) {
      errors.push({ field: 'viewports', message: 'Must be an array' });
    } else {
      for (let i = 0; i < c.viewports.length; i++) {
        const vp = c.viewports[i] as Record<string, unknown>;
        if (!vp || typeof vp !== 'object') {
          errors.push({ field: `viewports[${i}]`, message: 'Must be an object' });
          continue;
        }
        if (typeof vp.label !== 'string' || vp.label.trim().length === 0) {
          errors.push({ field: `viewports[${i}].label`, message: 'Must be a non-empty string' });
        }
        if (typeof vp.width !== 'number' || vp.width < 200 || vp.width > 5120) {
          errors.push({ field: `viewports[${i}].width`, message: 'Must be a number between 200 and 5120' });
        }
      }
    }
  }

  // timing
  if (c.timing !== undefined) {
    if (!c.timing || typeof c.timing !== 'object') {
      errors.push({ field: 'timing', message: 'Must be an object' });
    } else {
      const t = c.timing as Record<string, unknown>;
      for (const key of ['pageLoadTimeout', 'scanTimeout', 'delayBetweenPages'] as const) {
        if (t[key] !== undefined) {
          if (typeof t[key] !== 'number' || (t[key] as number) < 0) {
            errors.push({ field: `timing.${key}`, message: 'Must be a non-negative number' });
          }
        }
      }
    }
  }

  // auth
  if (c.auth !== undefined && c.auth !== null) {
    if (typeof c.auth !== 'object') {
      errors.push({ field: 'auth', message: 'Must be an object or null' });
    } else {
      const a = c.auth as Record<string, unknown>;
      for (const key of ['loginUrl', 'usernameSelector', 'passwordSelector', 'submitSelector', 'username', 'password'] as const) {
        if (typeof a[key] !== 'string') {
          errors.push({ field: `auth.${key}`, message: 'Must be a string' });
        }
      }
    }
  }

  // rules
  if (c.rules !== undefined) {
    if (!c.rules || typeof c.rules !== 'object') {
      errors.push({ field: 'rules', message: 'Must be an object' });
    } else {
      const r = c.rules as Record<string, unknown>;
      if (r.mode !== undefined && !VALID_RULE_FILTER_MODES.includes(r.mode as iRuleFilterMode)) {
        errors.push({ field: 'rules.mode', message: `Must be one of: ${VALID_RULE_FILTER_MODES.join(', ')}` });
      }
      if (r.ruleIds !== undefined && !Array.isArray(r.ruleIds)) {
        errors.push({ field: 'rules.ruleIds', message: 'Must be an array of strings' });
      }
      if (Array.isArray(r.ruleIds) && r.ruleIds.some((id: unknown) => typeof id !== 'string')) {
        errors.push({ field: 'rules.ruleIds', message: 'All entries must be strings' });
      }
    }
  }

  // enrichment
  if (c.enrichment !== undefined) {
    if (!c.enrichment || typeof c.enrichment !== 'object') {
      errors.push({ field: 'enrichment', message: 'Must be an object' });
    } else {
      const e = c.enrichment as Record<string, unknown>;
      for (const key of ['domContext', 'cssComputedStyles', 'frameworkHints', 'filePathGuesses'] as const) {
        if (e[key] !== undefined && typeof e[key] !== 'boolean') {
          errors.push({ field: `enrichment.${key}`, message: 'Must be a boolean' });
        }
      }
    }
  }

  // pageRules
  if (c.pageRules !== undefined) {
    if (!Array.isArray(c.pageRules)) {
      errors.push({ field: 'pageRules', message: 'Must be an array' });
    } else {
      const validWaitTypes = ['login', 'interaction', 'deferred-content'];
      for (let i = 0; i < c.pageRules.length; i++) {
        const rule = c.pageRules[i] as Record<string, unknown>;
        if (!rule || typeof rule !== 'object') {
          errors.push({ field: `pageRules[${i}]`, message: 'Must be an object' });
          continue;
        }
        if (typeof rule.urlPattern !== 'string' || rule.urlPattern.trim().length === 0) {
          errors.push({ field: `pageRules[${i}].urlPattern`, message: 'Must be a non-empty string' });
        }
        if (!validWaitTypes.includes(rule.waitType as string)) {
          errors.push({ field: `pageRules[${i}].waitType`, message: `Must be one of: ${validWaitTypes.join(', ')}` });
        }
        if (rule.description !== undefined && typeof rule.description !== 'string') {
          errors.push({ field: `pageRules[${i}].description`, message: 'Must be a string' });
        }
      }
    }
  }

  // mocks
  if (c.mocks !== undefined) {
    if (!Array.isArray(c.mocks)) {
      errors.push({ field: 'mocks', message: 'Must be an array' });
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (let i = 0; i < c.mocks.length; i++) {
        const mock = c.mocks[i] as Record<string, unknown>;
        if (!mock || typeof mock !== 'object') {
          errors.push({ field: `mocks[${i}]`, message: 'Must be an object' });
          continue;
        }
        if (typeof mock.urlPattern !== 'string' || mock.urlPattern.trim().length === 0) {
          errors.push({ field: `mocks[${i}].urlPattern`, message: 'Must be a non-empty string' });
        }
        if (!validMethods.includes(mock.method as string)) {
          errors.push({ field: `mocks[${i}].method`, message: `Must be one of: ${validMethods.join(', ')}` });
        }
        if (typeof mock.status !== 'number' || mock.status < 100 || mock.status > 599) {
          errors.push({ field: `mocks[${i}].status`, message: 'Must be a number between 100 and 599' });
        }
      }
    }
  }

  return errors;
}

/**
 * Merges a partial config (from user JSON) with defaults to produce a complete iTestConfig.
 * Validates first — returns null if validation fails.
 */
export function mergeWithDefaults(partial: unknown): { config: iTestConfig; errors: iValidationError[] } {
  const errors = validateTestConfig(partial);
  if (errors.length > 0) {
    return { config: createDefaultConfig(), errors };
  }

  const p = partial as Partial<iTestConfig>;
  const defaults = createDefaultConfig();

  return {
    config: {
      name: p.name ?? defaults.name,
      scanMode: p.scanMode ?? defaults.scanMode,
      pages: p.pages ? { ...defaults.pages, ...p.pages } : defaults.pages,
      wcagVersion: p.wcagVersion ?? defaults.wcagVersion,
      wcagLevel: p.wcagLevel ?? defaults.wcagLevel,
      viewports: p.viewports ?? defaults.viewports,
      timing: p.timing ? { ...defaults.timing, ...p.timing } : defaults.timing,
      auth: p.auth !== undefined ? p.auth : defaults.auth,
      rules: p.rules ? { ...defaults.rules, ...p.rules } : defaults.rules,
      enrichment: p.enrichment ? { ...defaults.enrichment, ...p.enrichment } : defaults.enrichment,
      pageRules: p.pageRules ?? defaults.pageRules,
      mocks: p.mocks ?? defaults.mocks,
    },
    errors: [],
  };
}
