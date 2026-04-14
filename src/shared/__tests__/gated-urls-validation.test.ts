import { describe, it, expect } from 'vitest';
import { validateTestConfig } from '../test-config';

/**
 * Validates the auth.gatedUrls sub-object validation added in Phase 2.
 * These tests exercise the validator only — the runtime isGated helper
 * is tested in background/__tests__/crawl-helpers.test.ts.
 */

const validAuth = {
  loginUrl: 'https://example.com/login',
  usernameSelector: '#email',
  passwordSelector: '#password',
  submitSelector: '#submit',
  username: 'aerith@midgar.com',
  password: 'flower-basket',
};

describe('validateTestConfig — auth.gatedUrls', () => {
  // ── Green: valid gatedUrls ────────────────────────────────────────────────

  it('accepts auth without gatedUrls (optional field)', () => {
    const errors = validateTestConfig({ auth: validAuth });
    expect(errors).toHaveLength(0);
  });

  it('accepts gatedUrls with mode=none', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'none', patterns: [] } },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts gatedUrls with mode=list and string patterns', () => {
    const errors = validateTestConfig({
      auth: {
        ...validAuth,
        gatedUrls: { mode: 'list', patterns: ['https://example.com/admin'] },
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts gatedUrls with mode=prefix', () => {
    const errors = validateTestConfig({
      auth: {
        ...validAuth,
        gatedUrls: { mode: 'prefix', patterns: ['https://example.com/admin/'] },
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts gatedUrls with mode=regex and valid patterns', () => {
    const errors = validateTestConfig({
      auth: {
        ...validAuth,
        gatedUrls: { mode: 'regex', patterns: ['^https://example\\.com/admin'] },
      },
    });
    expect(errors).toHaveLength(0);
  });

  // ── Red: invalid gatedUrls ────────────────────────────────────────────────

  it('rejects gatedUrls that is not an object', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: 'bad' },
    });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'auth.gatedUrls', message: 'Must be an object' }),
    );
  });

  it('rejects invalid gatedUrls mode', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'magic', patterns: [] } },
    });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'auth.gatedUrls.mode' }),
    );
  });

  it('rejects non-array patterns', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'list', patterns: 'not-an-array' } },
    });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'auth.gatedUrls.patterns', message: 'Must be an array of strings' }),
    );
  });

  it('rejects non-string entries in patterns', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'list', patterns: [123] } },
    });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'auth.gatedUrls.patterns', message: 'All entries must be strings' }),
    );
  });

  it('rejects invalid regex in mode=regex', () => {
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'regex', patterns: ['[invalid('] } },
    });
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'auth.gatedUrls.patterns[0]', message: 'Invalid regex' }),
    );
  });

  it('only validates regex when mode is regex (not prefix)', () => {
    // '[invalid(' is not checked as regex when mode is prefix
    const errors = validateTestConfig({
      auth: { ...validAuth, gatedUrls: { mode: 'prefix', patterns: ['[invalid('] } },
    });
    expect(errors.filter((e) => e.message === 'Invalid regex')).toHaveLength(0);
  });

  it('reports multiple invalid regexes individually', () => {
    const errors = validateTestConfig({
      auth: {
        ...validAuth,
        gatedUrls: { mode: 'regex', patterns: ['[bad1(', 'good', '[bad2('] },
      },
    });
    const regexErrors = errors.filter((e) => e.message === 'Invalid regex');
    expect(regexErrors).toHaveLength(2);
    expect(regexErrors[0].field).toBe('auth.gatedUrls.patterns[0]');
    expect(regexErrors[1].field).toBe('auth.gatedUrls.patterns[2]');
  });
});
