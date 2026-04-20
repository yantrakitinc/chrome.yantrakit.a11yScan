/**
 * Multi-Viewport scanning (F02).
 * Resizes browser to each viewport width and scans at each.
 */

import type { iScanResult, iMultiViewportResult, iViolation, iViewportViolation } from "@shared/types";
import { getConfig } from "@shared/config";

/** Run multi-viewport scan at specified widths */
export async function multiViewportScan(
  viewports: number[],
  sendResponse: (response: unknown) => void
): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) {
    sendResponse({ type: "SCAN_ERROR", payload: { message: "No active tab" } });
    return;
  }

  // Save original window size
  const win = await chrome.windows.get(tab.windowId);
  const originalWidth = win.width || 1280;

  const config = await getConfig();
  const perViewport: Record<number, iScanResult> = {};
  const sorted = [...viewports].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    const width = sorted[i];

    // Report progress
    chrome.runtime.sendMessage({
      type: "MULTI_VIEWPORT_PROGRESS",
      payload: { currentViewport: i + 1, totalViewports: sorted.length },
    });

    // Resize
    await chrome.windows.update(tab.windowId, { width });
    await sleep(500); // Wait for reflow

    // Inject and scan
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const result = await chrome.tabs.sendMessage(tab.id, { type: "RUN_SCAN", payload: { config } });
      if (result?.type === "SCAN_RESULT") {
        perViewport[width] = result.payload as iScanResult;
      }
    } catch (err) {
      // Log error but continue
      console.error(`MV scan failed at ${width}px:`, err);
    }
  }

  // Restore original width
  await chrome.windows.update(tab.windowId, { width: originalWidth });

  // Diff results
  const { shared, viewportSpecific } = diffResults(perViewport, sorted);

  const mvResult: iMultiViewportResult = {
    viewports: sorted,
    perViewport,
    shared,
    viewportSpecific,
  };

  sendResponse({ type: "MULTI_VIEWPORT_RESULT", payload: mvResult });
}

/** Diff violations across viewports into shared vs viewport-specific */
function diffResults(
  perViewport: Record<number, iScanResult>,
  viewports: number[]
): { shared: iViolation[]; viewportSpecific: iViewportViolation[] } {
  // Collect all unique violation rule IDs
  const allRuleIds = new Set<string>();
  for (const result of Object.values(perViewport)) {
    for (const v of result.violations) {
      allRuleIds.add(v.id);
    }
  }

  const shared: iViolation[] = [];
  const viewportSpecific: iViewportViolation[] = [];

  for (const ruleId of allRuleIds) {
    const presentIn: number[] = [];
    let firstViolation: iViolation | null = null;

    for (const width of viewports) {
      const result = perViewport[width];
      if (!result) continue;
      const match = result.violations.find((v) => v.id === ruleId);
      if (match) {
        presentIn.push(width);
        if (!firstViolation) firstViolation = match;
      }
    }

    if (!firstViolation) continue;

    if (presentIn.length === viewports.length) {
      shared.push(firstViolation);
    } else {
      viewportSpecific.push({ ...firstViolation, viewports: presentIn });
    }
  }

  return { shared, viewportSpecific };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
