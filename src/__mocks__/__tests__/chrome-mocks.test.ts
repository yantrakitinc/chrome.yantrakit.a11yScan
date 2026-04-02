import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockChrome, resetChromeMocks, simulateMessage } from '../chrome';
import {
  scanResultClean, scanResultWithIssues, rawScanResponse,
  ariaWidgetTablist, ariaWidgetDialogBroken, enrichedContextSample,
  tabOrderEntries, focusGaps,
} from '../fixtures';

vi.stubGlobal('chrome', mockChrome);

beforeEach(() => { resetChromeMocks(); });

describe('Chrome API mocks', () => {
  describe('chrome.storage.local', () => {
    it('stores and retrieves data', async () => {
      await chrome.storage.local.set({ key: 'value' });
      const result = await chrome.storage.local.get('key');
      expect(result).toEqual({ key: 'value' });
    });
    it('removes data', async () => {
      await chrome.storage.local.set({ key: 'value' });
      await chrome.storage.local.remove('key');
      const result = await chrome.storage.local.get('key');
      expect(result).toEqual({});
    });
    it('clears all data', async () => {
      await chrome.storage.local.set({ a: 1, b: 2 });
      await chrome.storage.local.clear();
      const result = await chrome.storage.local.get(['a', 'b']);
      expect(result).toEqual({});
    });
  });
  describe('chrome.runtime.sendMessage', () => {
    it('resolves with default empty object', async () => {
      const result = await chrome.runtime.sendMessage({ type: 'TEST' });
      expect(result).toEqual({});
    });
    it('can be mocked to return specific values', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValueOnce({ type: 'SCAN_RESULT', violations: [] });
      const result = await chrome.runtime.sendMessage({ type: 'SCAN_REQUEST' });
      expect(result).toEqual({ type: 'SCAN_RESULT', violations: [] });
    });
  });
  describe('chrome.tabs', () => {
    it('returns default tab from query', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      expect(tab.id).toBe(1);
      expect(tab.url).toBe('https://example.com');
    });
  });
  describe('simulateMessage', () => {
    it('dispatches to registered listeners', async () => {
      const handler = vi.fn((_msg, _sender, sendResponse) => { sendResponse({ ok: true }); return true; });
      chrome.runtime.onMessage.addListener(handler);
      const result = await simulateMessage({ type: 'TEST' });
      expect(handler).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true });
    });
  });
});

describe('Test fixtures', () => {
  it('scanResultClean has zero violations', () => {
    expect(scanResultClean.violations).toHaveLength(0);
    expect(scanResultClean.summary.critical).toBe(0);
    expect(scanResultClean.passes).toBe(42);
  });
  it('scanResultWithIssues has 4 violations', () => {
    expect(scanResultWithIssues.violations).toHaveLength(4);
    expect(scanResultWithIssues.summary.critical).toBe(2);
    expect(scanResultWithIssues.summary.serious).toBe(2);
  });
  it('rawScanResponse matches content script output shape', () => {
    expect(rawScanResponse.type).toBe('SCAN_RESULT');
    expect(rawScanResponse.violations).toHaveLength(4);
    expect(rawScanResponse.passes).toHaveLength(2);
    expect(rawScanResponse.incomplete).toHaveLength(1);
    expect(rawScanResponse.pageElements.hasForms).toBe(true);
    expect(rawScanResponse.pageElements.hasVideo).toBe(false);
  });
  it('ariaWidgetTablist is compliant', () => {
    expect(ariaWidgetTablist.failCount).toBe(0);
    expect(ariaWidgetTablist.passCount).toBe(2);
  });
  it('ariaWidgetDialogBroken has issues', () => {
    expect(ariaWidgetDialogBroken.failCount).toBe(2);
    expect(ariaWidgetDialogBroken.passCount).toBe(0);
  });
  it('enrichedContextSample has all sections', () => {
    expect(enrichedContextSample.dom.nearestLandmark).toBe('main');
    expect(enrichedContextSample.css.fontSize).toBe('16px');
    expect(enrichedContextSample.framework.detected).toBe('react');
    expect(enrichedContextSample.framework.componentName).toBe('HeroSection');
    expect(enrichedContextSample.filePathGuesses).toHaveLength(1);
  });
  it('tabOrderEntries has 5 items', () => {
    expect(tabOrderEntries).toHaveLength(5);
    expect(tabOrderEntries[4].tabindex).toBe(1);
  });
  it('focusGaps has 2 items', () => {
    expect(focusGaps).toHaveLength(2);
    expect(focusGaps[0].reason).toContain('click handler');
  });
});
