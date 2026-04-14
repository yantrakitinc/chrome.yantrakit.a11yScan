import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OBSERVER_SETTINGS,
  DEFAULT_OBSERVER_STATE,
  OBSERVER_STORAGE_KEYS,
} from '../observer-types';

describe('DEFAULT_OBSERVER_SETTINGS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_OBSERVER_SETTINGS.includeDomains).toEqual([]);
    expect(DEFAULT_OBSERVER_SETTINGS.excludeDomains).toEqual([]);
    expect(DEFAULT_OBSERVER_SETTINGS.throttleSeconds).toBe(30);
    expect(DEFAULT_OBSERVER_SETTINGS.wcagVersion).toBe('2.2');
    expect(DEFAULT_OBSERVER_SETTINGS.wcagLevel).toBe('AA');
    expect(DEFAULT_OBSERVER_SETTINGS.maxHistoryEntries).toBe(500);
  });

  it('throttleSeconds is a positive number', () => {
    expect(DEFAULT_OBSERVER_SETTINGS.throttleSeconds).toBeGreaterThan(0);
  });

  it('maxHistoryEntries is a positive number', () => {
    expect(DEFAULT_OBSERVER_SETTINGS.maxHistoryEntries).toBeGreaterThan(0);
  });
});

describe('DEFAULT_OBSERVER_STATE', () => {
  it('observer is disabled by default', () => {
    expect(DEFAULT_OBSERVER_STATE.enabled).toBe(false);
  });

  it('consent is not given by default', () => {
    expect(DEFAULT_OBSERVER_STATE.consentGiven).toBe(false);
  });

  it('settings are a copy of DEFAULT_OBSERVER_SETTINGS', () => {
    expect(DEFAULT_OBSERVER_STATE.settings).toEqual(DEFAULT_OBSERVER_SETTINGS);
  });

  it('settings object is a separate copy (not a reference)', () => {
    expect(DEFAULT_OBSERVER_STATE.settings).not.toBe(DEFAULT_OBSERVER_SETTINGS);
  });
});

describe('OBSERVER_STORAGE_KEYS', () => {
  it('has expected storage key names', () => {
    expect(OBSERVER_STORAGE_KEYS.state).toBe('observer_state');
    expect(OBSERVER_STORAGE_KEYS.history).toBe('observer_history');
  });
});
