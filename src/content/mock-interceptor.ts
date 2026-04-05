/**
 * Mock interceptor — intercepts fetch requests matching configured mock endpoints.
 * Injects into the page context via a script element to override the page's native fetch.
 * Returns canned responses for deterministic, repeatable scan results.
 */

export interface iMockEndpointConfig {
  urlPattern: string;
  method: string;
  status: number;
  responseBody: unknown;
  responseHeaders?: Record<string, string>;
}

/**
 * Activates mock interception by injecting a fetch override into the page.
 * Must run in the content script context.
 */
export function activateMocks(mocks: iMockEndpointConfig[]): void {
  if (mocks.length === 0) return;

  const script = document.createElement('script');
  script.setAttribute('data-a11yscan-mocks', 'true');
  script.textContent = `
    (function() {
      const __a11yscanMocks = ${JSON.stringify(mocks)};
      const __originalFetch = window.fetch;

      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        const method = (init?.method || 'GET').toUpperCase();

        for (const mock of __a11yscanMocks) {
          try {
            if ((url.includes(mock.urlPattern) || new RegExp(mock.urlPattern).test(url)) && method === mock.method) {
              console.log('[A11y Scan Mock]', method, url, '→', mock.status);
              return Promise.resolve(new Response(
                JSON.stringify(mock.responseBody),
                {
                  status: mock.status,
                  statusText: mock.status === 200 ? 'OK' : 'Mocked',
                  headers: new Headers({
                    'Content-Type': 'application/json',
                    ...(mock.responseHeaders || {}),
                  }),
                }
              ));
            }
          } catch (e) {
            // Regex error — try simple includes match
            if (url.includes(mock.urlPattern) && method === mock.method) {
              return Promise.resolve(new Response(
                JSON.stringify(mock.responseBody),
                { status: mock.status, headers: new Headers({ 'Content-Type': 'application/json' }) }
              ));
            }
          }
        }

        return __originalFetch.apply(this, arguments);
      };

      // Also intercept XMLHttpRequest
      const __originalXHROpen = XMLHttpRequest.prototype.open;
      const __originalXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this.__a11yscanMethod = method.toUpperCase();
        this.__a11yscanUrl = typeof url === 'string' ? url : String(url);
        return __originalXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function() {
        for (const mock of __a11yscanMocks) {
          try {
            if ((this.__a11yscanUrl.includes(mock.urlPattern) || new RegExp(mock.urlPattern).test(this.__a11yscanUrl)) && this.__a11yscanMethod === mock.method) {
              console.log('[A11y Scan Mock XHR]', this.__a11yscanMethod, this.__a11yscanUrl, '→', mock.status);
              Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
              Object.defineProperty(this, 'status', { writable: true, value: mock.status });
              Object.defineProperty(this, 'responseText', { writable: true, value: JSON.stringify(mock.responseBody) });
              Object.defineProperty(this, 'response', { writable: true, value: JSON.stringify(mock.responseBody) });
              setTimeout(() => {
                this.dispatchEvent(new Event('readystatechange'));
                this.dispatchEvent(new Event('load'));
                this.dispatchEvent(new Event('loadend'));
              }, 10);
              return;
            }
          } catch {}
        }
        return __originalXHRSend.apply(this, arguments);
      };
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

/**
 * Removes mock interception. Restoring original fetch/XHR is not possible
 * after injection, so this just removes the marker.
 */
export function deactivateMocks(): void {
  // The overrides persist until page reload — no way to restore original fetch
  // after injection into the page context. Page reload clears everything.
}
