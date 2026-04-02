import { describe, it, expect } from 'vitest';
import {
  validateTestConfig,
  createDefaultConfig,
  mergeWithDefaults,
  DEFAULT_VIEWPORTS,
  DEFAULT_TIMING,
  DEFAULT_ENRICHMENT,
  DEFAULT_PAGES,
  DEFAULT_RULES,
} from '../test-config';

describe('createDefaultConfig', () => {
  it('returns a complete config with all defaults', () => {
    const config = createDefaultConfig();
    expect(config.name).toBe('Default');
    expect(config.scanMode).toBe('single');
    expect(config.wcagVersion).toBe('2.2');
    expect(config.wcagLevel).toBe('AA');
    expect(config.viewports).toHaveLength(3);
    expect(config.auth).toBeNull();
    expect(config.rules.mode).toBe('all');
    expect(config.enrichment.domContext).toBe(true);
  });

  it('accepts a custom name', () => {
    const config = createDefaultConfig('Noctis Lucis Caelum');
    expect(config.name).toBe('Noctis Lucis Caelum');
  });

  it('returns independent copies (no shared references)', () => {
    const a = createDefaultConfig();
    const b = createDefaultConfig();
    a.viewports.push({ label: 'Huge', width: 3840 });
    expect(b.viewports).toHaveLength(3);
  });
});

describe('validateTestConfig', () => {
  it('returns error for null input', () => {
    const errors = validateTestConfig(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('root');
  });

  it('returns error for non-object input', () => {
    expect(validateTestConfig('string')).toHaveLength(1);
    expect(validateTestConfig(42)).toHaveLength(1);
    expect(validateTestConfig(true)).toHaveLength(1);
  });

  it('returns no errors for empty object (all fields optional)', () => {
    const errors = validateTestConfig({});
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for a fully valid config', () => {
    const config = createDefaultConfig('Sephiroth Test Suite');
    const errors = validateTestConfig(config);
    expect(errors).toHaveLength(0);
  });

  it('validates name must be a non-empty string', () => {
    expect(validateTestConfig({ name: 123 })).toContainEqual(
      expect.objectContaining({ field: 'name', message: 'Must be a string' }),
    );
    expect(validateTestConfig({ name: '  ' })).toContainEqual(
      expect.objectContaining({ field: 'name', message: 'Must not be empty' }),
    );
  });

  it('validates scanMode enum', () => {
    expect(validateTestConfig({ scanMode: 'single' })).toHaveLength(0);
    expect(validateTestConfig({ scanMode: 'invalid' })).toContainEqual(
      expect.objectContaining({ field: 'scanMode' }),
    );
  });

  it('validates wcagVersion enum', () => {
    expect(validateTestConfig({ wcagVersion: '2.1' })).toHaveLength(0);
    expect(validateTestConfig({ wcagVersion: '3.0' })).toContainEqual(
      expect.objectContaining({ field: 'wcagVersion' }),
    );
  });

  it('validates wcagLevel enum', () => {
    expect(validateTestConfig({ wcagLevel: 'AAA' })).toHaveLength(0);
    expect(validateTestConfig({ wcagLevel: 'AAAA' })).toContainEqual(
      expect.objectContaining({ field: 'wcagLevel' }),
    );
  });

  it('validates pages object', () => {
    expect(validateTestConfig({ pages: 'not-object' })).toContainEqual(
      expect.objectContaining({ field: 'pages' }),
    );
    expect(validateTestConfig({ pages: { urls: 'not-array' } })).toContainEqual(
      expect.objectContaining({ field: 'pages.urls' }),
    );
    expect(validateTestConfig({ pages: { urls: [123] } })).toContainEqual(
      expect.objectContaining({ field: 'pages.urls', message: 'All entries must be strings' }),
    );
    expect(validateTestConfig({ pages: { maxPages: -1 } })).toContainEqual(
      expect.objectContaining({ field: 'pages.maxPages' }),
    );
    expect(validateTestConfig({ pages: { maxPages: 0 } })).toContainEqual(
      expect.objectContaining({ field: 'pages.maxPages' }),
    );
    expect(validateTestConfig({ pages: { autoDiscover: 'yes' } })).toContainEqual(
      expect.objectContaining({ field: 'pages.autoDiscover' }),
    );
  });

  it('validates viewports array', () => {
    expect(validateTestConfig({ viewports: 'not-array' })).toContainEqual(
      expect.objectContaining({ field: 'viewports' }),
    );
    expect(validateTestConfig({ viewports: [{ label: '', width: 375 }] })).toContainEqual(
      expect.objectContaining({ field: 'viewports[0].label' }),
    );
    expect(validateTestConfig({ viewports: [{ label: 'Tiny', width: 50 }] })).toContainEqual(
      expect.objectContaining({ field: 'viewports[0].width' }),
    );
    expect(validateTestConfig({ viewports: [{ label: 'Huge', width: 9999 }] })).toContainEqual(
      expect.objectContaining({ field: 'viewports[0].width' }),
    );
    expect(validateTestConfig({ viewports: [{ label: 'Mobile', width: 375 }] })).toHaveLength(0);
  });

  it('validates timing object', () => {
    expect(validateTestConfig({ timing: 'not-object' })).toContainEqual(
      expect.objectContaining({ field: 'timing' }),
    );
    expect(validateTestConfig({ timing: { pageLoadTimeout: -1 } })).toContainEqual(
      expect.objectContaining({ field: 'timing.pageLoadTimeout' }),
    );
    expect(validateTestConfig({ timing: { scanTimeout: 'fast' } })).toContainEqual(
      expect.objectContaining({ field: 'timing.scanTimeout' }),
    );
    expect(validateTestConfig({ timing: { delayBetweenPages: 500 } })).toHaveLength(0);
  });

  it('validates auth object', () => {
    expect(validateTestConfig({ auth: null })).toHaveLength(0);
    expect(validateTestConfig({ auth: 'not-object' })).toContainEqual(
      expect.objectContaining({ field: 'auth' }),
    );
    expect(validateTestConfig({ auth: { loginUrl: 123 } })).toContainEqual(
      expect.objectContaining({ field: 'auth.loginUrl' }),
    );
    const validAuth = {
      loginUrl: 'https://example.com/login',
      usernameSelector: '#email',
      passwordSelector: '#password',
      submitSelector: '#submit',
      username: 'cloud.strife@shinra.com',
      password: 'buster-sword-77',
    };
    expect(validateTestConfig({ auth: validAuth })).toHaveLength(0);
  });

  it('validates rules object', () => {
    expect(validateTestConfig({ rules: 'not-object' })).toContainEqual(
      expect.objectContaining({ field: 'rules' }),
    );
    expect(validateTestConfig({ rules: { mode: 'invalid' } })).toContainEqual(
      expect.objectContaining({ field: 'rules.mode' }),
    );
    expect(validateTestConfig({ rules: { ruleIds: 'not-array' } })).toContainEqual(
      expect.objectContaining({ field: 'rules.ruleIds' }),
    );
    expect(validateTestConfig({ rules: { ruleIds: [42] } })).toContainEqual(
      expect.objectContaining({ field: 'rules.ruleIds', message: 'All entries must be strings' }),
    );
    expect(validateTestConfig({ rules: { mode: 'include', ruleIds: ['color-contrast'] } })).toHaveLength(0);
  });

  it('validates enrichment object', () => {
    expect(validateTestConfig({ enrichment: 'not-object' })).toContainEqual(
      expect.objectContaining({ field: 'enrichment' }),
    );
    expect(validateTestConfig({ enrichment: { domContext: 'yes' } })).toContainEqual(
      expect.objectContaining({ field: 'enrichment.domContext' }),
    );
    expect(validateTestConfig({ enrichment: { domContext: true, cssComputedStyles: false } })).toHaveLength(0);
  });
});

describe('mergeWithDefaults', () => {
  it('returns defaults when given empty object', () => {
    const { config, errors } = mergeWithDefaults({});
    expect(errors).toHaveLength(0);
    expect(config.name).toBe('Default');
    expect(config.scanMode).toBe('single');
    expect(config.wcagVersion).toBe('2.2');
    expect(config.wcagLevel).toBe('AA');
    expect(config.viewports).toEqual(DEFAULT_VIEWPORTS);
    expect(config.timing).toEqual(DEFAULT_TIMING);
    expect(config.enrichment).toEqual(DEFAULT_ENRICHMENT);
    expect(config.pages).toEqual(DEFAULT_PAGES);
    expect(config.rules).toEqual(DEFAULT_RULES);
  });

  it('overrides only specified fields', () => {
    const { config, errors } = mergeWithDefaults({
      name: 'Gandalf Config',
      wcagLevel: 'AAA',
      viewports: [{ label: 'Phone', width: 320 }],
    });
    expect(errors).toHaveLength(0);
    expect(config.name).toBe('Gandalf Config');
    expect(config.wcagLevel).toBe('AAA');
    expect(config.wcagVersion).toBe('2.2');
    expect(config.viewports).toEqual([{ label: 'Phone', width: 320 }]);
    expect(config.timing).toEqual(DEFAULT_TIMING);
  });

  it('merges nested pages config', () => {
    const { config } = mergeWithDefaults({
      pages: { maxPages: 100 },
    });
    expect(config.pages.maxPages).toBe(100);
    expect(config.pages.urls).toEqual([]);
    expect(config.pages.autoDiscover).toBe(false);
  });

  it('merges nested timing config', () => {
    const { config } = mergeWithDefaults({
      timing: { scanTimeout: 60000 },
    });
    expect(config.timing.scanTimeout).toBe(60000);
    expect(config.timing.pageLoadTimeout).toBe(10000);
  });

  it('merges nested enrichment config', () => {
    const { config } = mergeWithDefaults({
      enrichment: { frameworkHints: false },
    });
    expect(config.enrichment.frameworkHints).toBe(false);
    expect(config.enrichment.domContext).toBe(true);
  });

  it('returns errors and defaults for invalid input', () => {
    const { config, errors } = mergeWithDefaults(null);
    expect(errors.length).toBeGreaterThan(0);
    expect(config.name).toBe('Default');
  });

  it('returns errors for invalid field values', () => {
    const { errors } = mergeWithDefaults({ wcagLevel: 'ZZZZ' });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'wcagLevel' }));
  });

  it('sets auth to null explicitly when provided', () => {
    const { config } = mergeWithDefaults({ auth: null });
    expect(config.auth).toBeNull();
  });

  it('preserves auth when provided', () => {
    const auth = {
      loginUrl: 'https://example.com',
      usernameSelector: '#user',
      passwordSelector: '#pass',
      submitSelector: '#go',
      username: 'link@hyrule.com',
      password: 'master-sword',
    };
    const { config } = mergeWithDefaults({ auth });
    expect(config.auth).toEqual(auth);
  });
});

describe('DEFAULT constants', () => {
  it('DEFAULT_VIEWPORTS has 3 entries', () => {
    expect(DEFAULT_VIEWPORTS).toHaveLength(3);
    expect(DEFAULT_VIEWPORTS[0].width).toBe(375);
    expect(DEFAULT_VIEWPORTS[1].width).toBe(768);
    expect(DEFAULT_VIEWPORTS[2].width).toBe(1280);
  });

  it('DEFAULT_TIMING has sane values', () => {
    expect(DEFAULT_TIMING.pageLoadTimeout).toBe(10000);
    expect(DEFAULT_TIMING.scanTimeout).toBe(30000);
    expect(DEFAULT_TIMING.delayBetweenPages).toBe(500);
  });

  it('DEFAULT_ENRICHMENT enables all options', () => {
    expect(DEFAULT_ENRICHMENT.domContext).toBe(true);
    expect(DEFAULT_ENRICHMENT.cssComputedStyles).toBe(true);
    expect(DEFAULT_ENRICHMENT.frameworkHints).toBe(true);
    expect(DEFAULT_ENRICHMENT.filePathGuesses).toBe(true);
  });
});
