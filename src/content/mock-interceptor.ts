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
      return new Response(JSON.stringify(mock.body), {
        status: mock.status,
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
        Object.defineProperty(this, "status", { value: mock.status, writable: false });
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
  return activeMocks.find((mock) => {
    // URL match: regex or substring
    let urlMatch = false;
    if (mock.urlPattern.startsWith("/") && mock.urlPattern.endsWith("/")) {
      const regex = new RegExp(mock.urlPattern.slice(1, -1));
      urlMatch = regex.test(url);
    } else {
      urlMatch = url.includes(mock.urlPattern);
    }
    if (!urlMatch) return false;
    // Method match (optional)
    if (mock.method && mock.method.toUpperCase() !== method.toUpperCase()) return false;
    return true;
  });
}
