/**
 * Shared scan state for the content script.
 * Decouples index.ts from inspector.ts to avoid circular imports (F20-AC3/AC10).
 */

import type { iViolation } from "@shared/types";

/** Violations from the most recent scan run. Updated by index.ts after each scan. */
export let lastScanViolations: iViolation[] = [];

/** Set the violations from the latest scan. Also exposes them as a page-level global for the DevTools panel (F20-AC12/AC13). */
export function setLastScanViolations(violations: iViolation[]): void {
  lastScanViolations = violations;
  (window as unknown as Record<string, unknown>).__a11yScanViolations = violations;
}
