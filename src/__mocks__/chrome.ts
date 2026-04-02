/**
 * Chrome Extension API mocks for vitest.
 * Usage: import { mockChrome, resetChromeMocks } from '@/__mocks__/chrome';
 *        vi.stubGlobal('chrome', mockChrome);
 */

import { vi } from 'vitest';

function createStorageMock() {
  let store: Record<string, unknown> = {};

  return {
    get: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key in store) result[key] = store[key];
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        delete store[key];
      }
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
    _getStore: () => store,
    _setStore: (s: Record<string, unknown>) => { store = s; },
  };
}

const messageListeners: Array<(message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => void | boolean> = [];

export const mockChrome = {
  runtime: {
    sendMessage: vi.fn(async (_message: unknown) => ({})),
    onMessage: {
      addListener: vi.fn((cb: typeof messageListeners[number]) => {
        messageListeners.push(cb);
      }),
      removeListener: vi.fn((cb: typeof messageListeners[number]) => {
        const idx = messageListeners.indexOf(cb);
        if (idx >= 0) messageListeners.splice(idx, 1);
      }),
    },
    lastError: null as { message: string } | null,
  },
  storage: {
    local: createStorageMock(),
  },
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: 'https://example.com', windowId: 1 }]),
    sendMessage: vi.fn(async (_tabId: number, _message: unknown) => ({})),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  scripting: {
    executeScript: vi.fn(async () => []),
  },
  windows: {
    get: vi.fn(async () => ({ width: 1280, height: 800 })),
    update: vi.fn(async () => ({})),
  },
  sidePanel: {
    setPanelBehavior: vi.fn(),
  },
};

export function resetChromeMocks(): void {
  mockChrome.runtime.sendMessage.mockReset().mockResolvedValue({});
  mockChrome.runtime.lastError = null;
  mockChrome.tabs.query.mockReset().mockResolvedValue([{ id: 1, url: 'https://example.com', windowId: 1 }]);
  mockChrome.tabs.sendMessage.mockReset().mockResolvedValue({});
  mockChrome.scripting.executeScript.mockReset().mockResolvedValue([]);
  mockChrome.windows.get.mockReset().mockResolvedValue({ width: 1280, height: 800 });
  mockChrome.windows.update.mockReset().mockResolvedValue({});
  mockChrome.storage.local.clear();
  messageListeners.length = 0;
}

export function simulateMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    for (const listener of messageListeners) {
      const result = listener(message, {}, resolve);
      if (result === true) return;
    }
    resolve(undefined);
  });
}
