/**
 * Multi-viewport scanning: resize window to 3 widths, run axe-core at each, diff results.
 */

export interface iViewportResult {
  width: number;
  label: string;
  violations: any[];
  passes: any[];
  incomplete: any[];
}

export interface iMultiViewportResult {
  viewports: iViewportResult[];
  allViewports: any[];
  viewportSpecific: { width: number; label: string; violations: any[] }[];
}

const DEFAULT_VIEWPORTS = [
  { width: 375, label: 'Mobile' },
  { width: 768, label: 'Tablet' },
  { width: 1280, label: 'Desktop' },
];

function violationKey(v: any, node: any): string {
  return `${v.id}|||${(node.target || []).join(',')}`;
}

function diffResults(viewports: iViewportResult[]): { allViewports: any[]; viewportSpecific: { width: number; label: string; violations: any[] }[] } {
  const violationsByViewport = viewports.map((vp) => {
    const keys = new Set<string>();
    for (const v of vp.violations) {
      for (const node of v.nodes) {
        keys.add(violationKey(v, node));
      }
    }
    return { ...vp, keys };
  });

  const allKeys = violationsByViewport[0]?.keys ?? new Set();
  const commonKeys = new Set<string>();
  for (const key of allKeys) {
    if (violationsByViewport.every((vp) => vp.keys.has(key))) {
      commonKeys.add(key);
    }
  }

  const allViewports: any[] = [];
  const seen = new Set<string>();
  for (const vp of viewports) {
    for (const v of vp.violations) {
      for (const node of v.nodes) {
        const key = violationKey(v, node);
        if (commonKeys.has(key) && !seen.has(key)) {
          seen.add(key);
          allViewports.push({ ...v, nodes: [node] });
        }
      }
    }
  }

  const viewportSpecific = violationsByViewport.map((vp) => {
    const uniqueViolations: any[] = [];
    for (const v of vp.violations) {
      const uniqueNodes = v.nodes.filter((node: any) => {
        const key = violationKey(v, node);
        return !commonKeys.has(key);
      });
      if (uniqueNodes.length > 0) {
        uniqueViolations.push({ ...v, nodes: uniqueNodes });
      }
    }
    return { width: vp.width, label: vp.label, violations: uniqueViolations };
  });

  return { allViewports, viewportSpecific };
}

export async function runMultiViewportScan(customViewports?: { label: string; width: number }[], scanTimeout?: number, wcagTags?: string[], rulesMode?: string, ruleIds?: string[]): Promise<iMultiViewportResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) throw new Error('No active tab');

  const win = await chrome.windows.get(tab.windowId);
  const originalWidth = win.width!;
  const originalHeight = win.height!;

  const viewportResults: iViewportResult[] = [];
  const viewports = customViewports && customViewports.length > 0 ? customViewports : DEFAULT_VIEWPORTS;

  for (const vp of viewports) {
    await chrome.windows.update(tab.windowId, { width: vp.width, height: originalHeight });
    await new Promise((r) => setTimeout(r, 600));

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'RUN_SCAN', scanTimeout: scanTimeout || 0, wcagTags, rulesMode, ruleIds });

    viewportResults.push({
      width: vp.width,
      label: vp.label,
      violations: response?.violations || [],
      passes: response?.passes || [],
      incomplete: response?.incomplete || [],
    });
  }

  await chrome.windows.update(tab.windowId, { width: originalWidth, height: originalHeight });

  const { allViewports, viewportSpecific } = diffResults(viewportResults);

  return { viewports: viewportResults, allViewports, viewportSpecific };
}
