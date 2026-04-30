/**
 * Mock API interception — isolated-world bridge (F14).
 *
 * The actual fetch / XHR patches must run in the inspected page's MAIN world
 * (the content script's `window` is a different binding from the page's). To
 * achieve that, we inject `mock-interceptor-page.js` as a <script src> tag
 * exposed via `web_accessible_resources`; that file installs CustomEvent
 * listeners and patches the page-side fetch / XHR.
 *
 * activateMocks / deactivateMocks just dispatch CustomEvents to the page-side
 * listeners. CustomEvents on `document` cross the isolated/main world boundary
 * (the DOM is shared).
 *
 * findMatchIn is preserved as a pure function for unit tests.
 */

import type { iMockEndpoint } from "@shared/types";

const ACTIVATE_EVENT = "__a11y-scan-mocks-activate";
const DEACTIVATE_EVENT = "__a11y-scan-mocks-deactivate";
const SCRIPT_FILENAME = "mock-interceptor-page.js";
const SCRIPT_FLAG_ATTR = "data-a11y-scan-mock-interceptor";
const READY_FLAG = "__a11yScanMockInterceptor_v1";

let pageScriptLoaded: Promise<void> | null = null;

/**
 * Ensure the MAIN-world page script is injected (idempotent). Returns a
 * Promise that resolves once the IIFE has installed its document listeners.
 *
 * In a real extension page the chrome.runtime.getURL call resolves to a
 * web-accessible chrome-extension:// URL; under jsdom the test harness
 * imports `mock-interceptor-page.ts` directly so the IIFE is already
 * installed by the time any test calls activateMocks. We detect that case
 * via the page-script's idempotency flag on `window`.
 */
function ensurePageScriptLoaded(): Promise<void> {
  if (pageScriptLoaded) return pageScriptLoaded;

  pageScriptLoaded = new Promise<void>((resolve) => {
    // Already loaded (test harness imported the page module directly, or a
    // prior call injected the script tag and it has finished running).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any)[READY_FLAG]) { resolve(); return; }
    if (document.querySelector(`script[${SCRIPT_FLAG_ATTR}]`)) {
      // Tag exists but flag not set — wait briefly for the IIFE to run.
      const start = Date.now();
      const poll = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any)[READY_FLAG] || Date.now() - start > 500) {
          clearInterval(poll);
          resolve();
        }
      }, 10);
      return;
    }

    let src: string;
    try {
      src = chrome.runtime.getURL(SCRIPT_FILENAME);
    } catch {
      // chrome.runtime is unavailable (jsdom). Resolve immediately; the test
      // harness has already imported the page module so the IIFE is set up.
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.setAttribute(SCRIPT_FLAG_ATTR, "true");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => resolve(), { once: true }); // best-effort
    (document.head || document.documentElement).appendChild(script);
  });

  return pageScriptLoaded;
}

/**
 * Activate mock endpoints — bridges to the MAIN-world script that patches
 * the page's fetch + XHR. Idempotent.
 */
export async function activateMocks(mocks: iMockEndpoint[]): Promise<void> {
  await ensurePageScriptLoaded();
  document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: { mocks } }));
}

/** Deactivate mocks — restore the page's original fetch + XHR. */
export function deactivateMocks(): void {
  document.dispatchEvent(new CustomEvent(DEACTIVATE_EVENT));
}

/**
 * Find the first mock that matches the given URL + method.
 * Pure — exported for unit testing. URL pattern is treated as a regex if it
 * both starts and ends with `/` (literal slashes, like `/users\\/\\d+/`);
 * otherwise it's a substring match. A malformed regex falls back to substring
 * matching instead of throwing — a typo'd pattern shouldn't break the page's
 * request.
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
