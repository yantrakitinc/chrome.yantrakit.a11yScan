/**
 * Mock API interception (F14).
 * Patches fetch and XMLHttpRequest to return canned responses.
 */

import type { iMockEndpoint } from "@shared/types";

let originalFetch: typeof fetch | null = null;
let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
let activeMocks: iMockEndpoint[] = [];

/** Activate mock endpoints — patches fetch and XHR */
export function activateMocks(mocks: iMockEndpoint[]): void {
  deactivateMocks(); // clean up any existing
  activeMocks = mocks;

  // Patch fetch
  originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || "GET";
    const mock = findMatch(url, method);
    if (mock) {
      // Schema default for mocks[].status is 200 when omitted.
      return new Response(JSON.stringify(mock.body), {
        status: mock.status ?? 200,
        headers: { "Content-Type": "application/json", ...(mock.headers || {}) },
      });
    }
    return originalFetch!(input, init);
  };

  // Patch XHR
  originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    const urlStr = typeof url === "string" ? url : url.href;
    const mock = findMatch(urlStr, method);
    if (mock) {
      // Override send to return mock response
      const originalSend = this.send;
      this.send = function (): void {
        Object.defineProperty(this, "status", { value: mock.status ?? 200, writable: false });
        Object.defineProperty(this, "responseText", { value: JSON.stringify(mock.body), writable: false });
        Object.defineProperty(this, "readyState", { value: 4, writable: false });
        this.dispatchEvent(new Event("readystatechange"));
        this.dispatchEvent(new Event("load"));
      };
    }
    originalXhrOpen!.call(this, method, url, ...(rest as [boolean, string?, string?]));
  };
}

/** Remove all mocks and restore original fetch/XHR */
export function deactivateMocks(): void {
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
  if (originalXhrOpen) {
    XMLHttpRequest.prototype.open = originalXhrOpen;
    originalXhrOpen = null;
  }
  activeMocks = [];
}

function findMatch(url: string, method: string): iMockEndpoint | undefined {
  return findMatchIn(activeMocks, url, method);
}

/**
 * Find the first mock that matches the given URL + method.
 * Exported for unit testing. URL pattern is treated as a regex if it both
 * starts and ends with `/` (literal slashes, like `/users\\/\\d+/`); otherwise
 * it's a substring match. A malformed regex falls back to substring matching
 * instead of throwing — a typo'd pattern shouldn't break the page's request.
 */
export function findMatchIn(
  mocks: iMockEndpoint[],
  url: string,
  method: string,
): iMockEndpoint | undefined {
  return mocks.find((mock) => {
    let urlMatch = false;
    if (mock.urlPattern.length >= 2 && mock.urlPattern.startsWith("/") && mock.urlPattern.endsWith("/")) {
      try {
        urlMatch = new RegExp(mock.urlPattern.slice(1, -1)).test(url);
      } catch {
        urlMatch = url.includes(mock.urlPattern);
      }
    } else {
      urlMatch = url.includes(mock.urlPattern);
    }
    if (!urlMatch) return false;
    if (mock.method && mock.method.toUpperCase() !== method.toUpperCase()) return false;
    return true;
  });
}
