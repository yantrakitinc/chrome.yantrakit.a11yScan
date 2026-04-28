/**
 * Structured logger for the extension. Every extension log line carries
 * the same prefix so DevTools console filtering ("[A11y Scan]") catches
 * every event. Three levels:
 *
 * - `error` — something the user cares about went wrong (scan failed,
 *   crawl page errored, ARIA scan rejected, content-script injection
 *   failed on a page where it should have worked).
 * - `warn`  — something unusual that recovered (page-rule regex parse
 *   failed → fell back to substring match, etc.).
 * - `debug` — chatty diagnostics that are silent in production:
 *   "already injected", "sidepanel closed during broadcast",
 *   navigation interceptor declined a same-origin link, etc.
 *
 * Always pass `where: string` (the file/feature) so a user submitting a
 * bug report can paste the console line and we know where it came from.
 */

const PREFIX = "[A11y Scan]";

/** Real errors the user (or a bug-report reader) needs to see. */
export function logError(where: string, message: string, err?: unknown): void {
  if (err === undefined) {
    console.error(`${PREFIX} ${where}: ${message}`);
  } else {
    console.error(`${PREFIX} ${where}: ${message}`, err);
  }
}

/** Recoverable anomaly worth surfacing but not an error. */
export function logWarn(where: string, message: string, err?: unknown): void {
  if (err === undefined) {
    console.warn(`${PREFIX} ${where}: ${message}`);
  } else {
    console.warn(`${PREFIX} ${where}: ${message}`, err);
  }
}

/**
 * Diagnostic chatter for expected race conditions (sidepanel closed during
 * broadcast, content script already injected, etc). Uses `console.debug`
 * which Chrome hides by default — visible only when the user toggles the
 * "Verbose" log level. Keeps the extension quiet in normal use while
 * preserving the breadcrumb trail for support diagnosis.
 */
export function logDebug(where: string, message: string, err?: unknown): void {
  if (err === undefined) {
    console.debug(`${PREFIX} ${where}: ${message}`);
  } else {
    console.debug(`${PREFIX} ${where}: ${message}`, err);
  }
}
