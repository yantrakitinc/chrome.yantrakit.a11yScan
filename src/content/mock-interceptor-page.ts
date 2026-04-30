/**
 * Mock API interception — MAIN-world page-side script (F14).
 *
 * This file is bundled as a standalone webpack entry and exposed via
 * web_accessible_resources. The content script (isolated world) injects it as
 * a `<script src="...">` tag, which causes the browser to execute it in the
 * inspected page's MAIN world. From there it can patch `window.fetch` and
 * `XMLHttpRequest.prototype.open` so the page's own network calls hit our
 * canned mock responses — something the isolated-world content script cannot
 * do (its `window.fetch` is a different binding from the page's).
 *
 * Communication isolated-world → main-world is via CustomEvents on
 * `document`. The DOM is shared between worlds, so listeners attached here
 * fire when the content script dispatches on the document.
 *
 * Events:
 *   - `__a11y-scan-mocks-activate`   detail: { mocks: iMockEndpoint[] }
 *   - `__a11y-scan-mocks-deactivate` (no detail)
 */

interface iMockEndpoint {
  urlPattern: string;
  method?: string;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

(function pageMockInterceptor(): void {
  // Guard against double-injection (script tag may be appended more than once
  // during the extension's lifetime; we only want one set of patches).
  const flag = "__a11yScanMockInterceptor_v1";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any)[flag]) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any)[flag] = true;

  let active = false;
  let mocks: iMockEndpoint[] = [];
  let originalFetch: typeof fetch | null = null;
  let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;

  function findMatch(url: string, method: string): iMockEndpoint | undefined {
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

  function activate(nextMocks: iMockEndpoint[]): void {
    deactivate();
    mocks = nextMocks;
    active = true;

    originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || "GET";
      const mock = findMatch(url, method);
      if (mock) {
        return new Response(JSON.stringify(mock.body), {
          status: mock.status ?? 200,
          headers: { "Content-Type": "application/json", ...(mock.headers || {}) },
        });
      }
      return originalFetch!(input, init);
    };

    originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      const urlStr = typeof url === "string" ? url : url.href;
      const mock = findMatch(urlStr, method);
      if (mock) {
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

  function deactivate(): void {
    if (!active) return;
    if (originalFetch) {
      window.fetch = originalFetch;
      originalFetch = null;
    }
    if (originalXhrOpen) {
      XMLHttpRequest.prototype.open = originalXhrOpen;
      originalXhrOpen = null;
    }
    mocks = [];
    active = false;
  }

  document.addEventListener("__a11y-scan-mocks-activate", (e) => {
    const ce = e as CustomEvent<{ mocks: iMockEndpoint[] }>;
    activate(ce.detail?.mocks ?? []);
  });
  document.addEventListener("__a11y-scan-mocks-deactivate", () => {
    deactivate();
  });

  // Notify the isolated-world content script that we are ready, so it can
  // safely dispatch the activate event without losing it (a dispatch sent
  // before this listener wires up would be dropped).
  document.dispatchEvent(new CustomEvent("__a11y-scan-mocks-ready"));
})();

// Marker so TS treats this file as a module — required for `import` from tests.
export {};
