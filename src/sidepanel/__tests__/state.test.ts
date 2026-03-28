import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getManualState,
  setManualState,
  setManualItem,
  getPageElements,
  setPageElements,
  getLastScanResponse,
  setLastScanResponse,
  resetState,
} from '../state';

// Mock chrome API
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: vi.fn(),
  },
});

beforeEach(() => {
  resetState();
  vi.clearAllMocks();
});

describe('state management', () => {
  describe('manual state', () => {
    it('starts empty', () => {
      expect(getManualState()).toEqual({});
    });

    it('sets and gets manual state', () => {
      setManualState({ '1.1.1': 'pass', '1.2.1': 'na' });
      expect(getManualState()).toEqual({ '1.1.1': 'pass', '1.2.1': 'na' });
    });

    it('sets individual manual item', () => {
      setManualItem('1.1.1', 'fail');
      expect(getManualState()['1.1.1']).toBe('fail');
    });

    it('sends message to chrome when setting manual item', () => {
      setManualItem('1.1.1', 'pass');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'SAVE_MANUAL_STATE',
        payload: { '1.1.1': 'pass' },
      });
    });

    it('clears individual manual item with null', () => {
      setManualItem('1.1.1', 'pass');
      setManualItem('1.1.1', null);
      expect(getManualState()['1.1.1']).toBeNull();
    });
  });

  describe('page elements', () => {
    it('starts empty', () => {
      expect(getPageElements()).toEqual({});
    });

    it('sets and gets page elements', () => {
      setPageElements({ hasVideo: true, hasForms: false });
      expect(getPageElements()).toEqual({ hasVideo: true, hasForms: false });
    });
  });

  describe('last scan response', () => {
    it('starts null', () => {
      expect(getLastScanResponse()).toBeNull();
    });

    it('sets and gets last scan response', () => {
      const response = { type: 'SCAN_RESULT', violations: [] };
      setLastScanResponse(response);
      expect(getLastScanResponse()).toEqual(response);
    });
  });

  describe('resetState', () => {
    it('clears all state', () => {
      setManualState({ '1.1.1': 'pass' });
      setPageElements({ hasVideo: true });
      setLastScanResponse({ type: 'SCAN_RESULT' });

      resetState();

      expect(getManualState()).toEqual({});
      expect(getPageElements()).toEqual({});
      expect(getLastScanResponse()).toBeNull();
    });
  });
});
