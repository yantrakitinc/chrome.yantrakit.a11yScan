/**
 * Report export functionality for A11y Scan.
 * Generates JSON, HTML, and PDF (print-friendly) reports client-side.
 */

import { axeRuleToWcag } from '@shared/wcag-mapping';
import { SITE_URL } from '@shared/config';
import { criterionSlug } from '@shared/utils';
import type { iAriaWidgetResult } from '@shared/aria-patterns';
import type { iEnrichedContext } from '@shared/types';

/** Tab order entry included in exports. */
export interface iTabOrderEntry {
  index: number;
  tabindex: number;
  selector: string;
  tagName: string;
}

/** Focus gap entry included in exports. */
export interface iFocusGapEntry {
  selector: string;
  reason: string;
}

/** Tab order data attached to a scan response for export. */
export interface iTabOrderData {
  total: number;
  positiveTabindex: number;
  sequence: iTabOrderEntry[];
}

/**
 * Builds a kebab-case filename from the scanned URL.
 */
function buildFilename(url: string, ext: string): string {
  let site = 'unknown';
  try {
    const parsed = new URL(url);
    site = (parsed.hostname + parsed.pathname)
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .toLowerCase();
  } catch {
    site = url.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'unknown';
  }
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(':', '-');
  return `A11y-Scan-Report-${site}-${date}_${time}.${ext}`;
}

/**
 * Triggers a file download via Blob + object URL.
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * HTML-escapes a string for safe insertion into markup.
 */
function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Truncates a string to a maximum length.
 */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

/**
 * Extracts summary counts from an axe-core response.
 */
function extractCounts(response: any): { violations: number; incomplete: number; passes: number } {
  const violations = Array.isArray(response.violations) ? response.violations.length : 0;
  const incomplete = Array.isArray(response.incomplete) ? response.incomplete.length : 0;
  const passes = Array.isArray(response.passes) ? response.passes.length : 0;
  return { violations, incomplete, passes };
}

/**
 * Generates a fix suggestion based on the axe rule ID.
 */
function fixSuggestion(ruleId: string, helpText: string): string {
  const suggestions: Record<string, string> = {
    'image-alt': 'Add a descriptive alt attribute: alt="[describe the image content]"',
    'button-name': 'Add text content or aria-label to the button',
    'link-name': 'Add descriptive text content to the link',
    'color-contrast': 'Increase contrast ratio. Change text or background color.',
    'label': 'Add a <label> element associated with this input, or use aria-label',
    'heading-order': 'Use sequential heading levels (h1 → h2 → h3)',
    'html-has-lang': 'Add lang attribute to <html> element',
    'document-title': 'Add a descriptive <title> element',
  };
  return suggestions[ruleId] || `Review and fix: ${helpText}`;
}

/**
 * Builds an enriched violation/incomplete item with WCAG criterion mapping.
 */
function enrichItem(item: any, contextMap?: Record<string, iEnrichedContext | null>): any {
  const matchedCriteria = axeRuleToWcag(item.id);
  const wcagCriteria = matchedCriteria.map((c) => c.id);
  const wcagName = matchedCriteria.length > 0 ? matchedCriteria[0].name : '';
  const wcagRef = matchedCriteria.length > 0
    ? `${SITE_URL}/wcag/${criterionSlug(matchedCriteria[0].id, matchedCriteria[0].name)}`
    : '';

  return {
    ruleId: item.id,
    wcagCriteria,
    wcagName,
    impact: item.impact || 'unknown',
    description: item.description || '',
    help: item.help || '',
    helpUrl: item.helpUrl || '',
    wcagRef,
    elements: (item.nodes || []).map((node: any) => {
      const sel = (node.target || []).join(', ');
      const element: Record<string, any> = {
        selector: sel,
        html: node.html || '',
        issue: node.failureSummary || '',
        fix: fixSuggestion(item.id, item.help || ''),
      };
      if (contextMap) {
        const ctx = contextMap[sel];
        if (ctx) element.enrichedContext = ctx;
      }
      return element;
    }),
  };
}

/**
 * Builds the ariaPatterns section from raw ARIA widget results.
 */
function buildAriaPatterns(ariaWidgets: iAriaWidgetResult[]): any {
  const compliant = ariaWidgets.filter((w) => w.failCount === 0).length;
  const withIssues = ariaWidgets.filter((w) => w.failCount > 0).length;
  return {
    widgetsDetected: ariaWidgets.length,
    compliant,
    withIssues,
    widgets: ariaWidgets.map((w) => ({
      role: w.role,
      selector: w.selector,
      checks: w.checks.map((c) => ({
        id: c.id,
        description: c.description,
        pass: c.pass,
        message: c.message,
      })),
      passCount: w.passCount,
      failCount: w.failCount,
    })),
  };
}

/**
 * Builds an enriched pass item with WCAG criterion mapping.
 */
function enrichPassItem(item: any): any {
  const matchedCriteria = axeRuleToWcag(item.id);
  const wcagCriteria = matchedCriteria.map((c) => c.id);
  return {
    ruleId: item.id,
    wcagCriteria,
    description: item.description || '',
    elementsChecked: (item.nodes || []).length,
  };
}

/**
 * Fetches enriched context for a list of selectors from the content script.
 */
async function fetchEnrichedContexts(selectors: string[], enrichmentFlags?: Record<string, boolean>): Promise<Record<string, iEnrichedContext | null>> {
  if (selectors.length === 0) return {};
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'COLLECT_ENRICHED_CONTEXT',
      selectors,
      enrichmentFlags,
    });
    return response?.contexts || {};
  } catch {
    return {};
  }
}

/**
 * Extracts all unique selectors from violations and incomplete items.
 */
function extractSelectors(items: any[]): string[] {
  const selectors = new Set<string>();
  for (const item of items) {
    for (const node of item.nodes || []) {
      const sel = (node.target || []).join(', ');
      if (sel) selectors.add(sel);
    }
  }
  return Array.from(selectors);
}

/**
 * Exports scan results as an enriched JSON file with WCAG mappings and fix suggestions.
 */
export async function exportJSON(
  response: any,
  version: string,
  level: string,
  url: string,
  tabOrder?: iTabOrderData | null,
  focusGaps?: iFocusGapEntry[] | null,
  enrichmentFlags?: Record<string, boolean>,
): Promise<void> {
  const counts = extractCounts(response);
  const violations = Array.isArray(response.violations) ? response.violations : [];
  const incomplete = Array.isArray(response.incomplete) ? response.incomplete : [];
  const passes = Array.isArray(response.passes) ? response.passes : [];

  const ariaWidgets: iAriaWidgetResult[] = Array.isArray(response._ariaWidgets) ? response._ariaWidgets : [];

  // Collect enriched context for all violation/incomplete selectors
  const allSelectors = extractSelectors([...violations, ...incomplete]);
  const contextMap = await fetchEnrichedContexts(allSelectors, enrichmentFlags);

  const report: Record<string, any> = {
    tool: 'A11y Scan',
    toolVersion: '1.0.0',
    url,
    scanDate: new Date().toISOString(),
    wcagVersion: version,
    wcagLevel: level,
    summary: {
      violations: counts.violations,
      needsReview: counts.incomplete,
      passes: counts.passes,
    },
    violations: violations.map((v: any) => enrichItem(v, contextMap)),
    needsReview: incomplete.map((v: any) => enrichItem(v, contextMap)),
    passes: passes.map(enrichPassItem),
  };

  if (ariaWidgets.length > 0) {
    report.ariaPatterns = buildAriaPatterns(ariaWidgets);
  }

  if (tabOrder) {
    report.tabOrder = {
      total: tabOrder.total,
      positiveTabindex: tabOrder.positiveTabindex,
      sequence: tabOrder.sequence.map((e) => ({
        index: e.index,
        selector: e.selector,
        tagName: e.tagName,
      })),
    };
  }

  if (focusGaps && focusGaps.length > 0) {
    report.focusGaps = focusGaps.map((g) => ({
      selector: g.selector,
      reason: g.reason,
    }));
  }

  const json = JSON.stringify(report, null, 2);
  const filename = buildFilename(url, 'json');
  triggerDownload(json, filename, 'application/json');
}

/**
 * Builds the inline CSS for HTML/PDF reports.
 */
function reportCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e1b4b; line-height: 1.5; max-width: 960px; margin: 0 auto; padding: 24px; }
    header { border-bottom: 3px solid #1e1b4b; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 24px; color: #1e1b4b; }
    .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .summary-card { padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 140px; }
    .summary-card .count { font-size: 28px; font-weight: 700; }
    .summary-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-violations { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .card-incomplete { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
    .card-passes { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
    h2 { font-size: 18px; margin: 24px 0 12px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
    h2.violations { color: #dc2626; }
    h2.incomplete { color: #d97706; }
    h2.passes { color: #16a34a; }
    .rule { margin-bottom: 16px; border-left: 4px solid #dc2626; padding: 12px; background: #fef2f2; border-radius: 0 6px 6px 0; }
    .rule.warning { border-left-color: #d97706; background: #fffbeb; }
    .rule.pass { border-left-color: #16a34a; background: #f0fdf4; }
    .rule-header { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .rule-help { font-size: 13px; color: #475569; margin-bottom: 8px; }
    .impact { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase; }
    .impact-critical { background: #991b1b; color: #fff; }
    .impact-serious { background: #dc2626; color: #fff; }
    .impact-moderate { background: #d97706; color: #fff; }
    .impact-minor { background: #64748b; color: #fff; }
    .node { background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin: 6px 0; font-size: 12px; }
    .node-target { font-weight: 600; color: #1e1b4b; font-family: monospace; font-size: 11px; }
    .node-html { color: #64748b; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin: 4px 0; }
    .node-failure { color: #dc2626; font-size: 11px; }
    h2.aria { color: #7c3aed; }
    .card-aria { background: #f5f3ff; border: 1px solid #c4b5fd; color: #5b21b6; }
    .rule.aria { border-left-color: #7c3aed; background: #f5f3ff; }
    .rule.aria-issue { border-left-color: #dc2626; background: #fef2f2; }
    .check-list { list-style: none; margin: 6px 0 0; padding: 0; }
    .check-list li { font-size: 12px; padding: 2px 0; }
    .check-pass { color: #16a34a; }
    .check-fail { color: #dc2626; }
    h2.tab-order { color: #4338ca; }
    .card-tab-order { background: #eef2ff; border: 1px solid #a5b4fc; color: #3730a3; }
    h2.focus-gaps { color: #d97706; }
    .card-focus-gaps { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
    .tab-seq-item { font-size: 12px; padding: 4px 8px; margin: 3px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-family: monospace; }
    .tab-seq-index { display: inline-block; width: 28px; font-weight: 700; color: #4338ca; }
    .gap-item { font-size: 12px; padding: 6px 8px; margin: 3px 0; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; }
    .gap-selector { font-family: monospace; font-weight: 600; color: #1e1b4b; }
    .gap-reason { color: #92400e; font-size: 11px; }
    .warning-pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: #d97706; color: #fff; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 12px; } .summary-card { min-width: 100px; } }
  `;
}

/**
 * Generates a self-contained HTML report string.
 */
function buildHTMLReport(response: any, version: string, level: string, url: string, tabOrder?: iTabOrderData | null, focusGaps?: iFocusGapEntry[] | null): string {
  const counts = extractCounts(response);
  const violations = Array.isArray(response.violations) ? response.violations : [];
  const incomplete = Array.isArray(response.incomplete) ? response.incomplete : [];
  const passes = Array.isArray(response.passes) ? response.passes : [];
  const ariaWidgets: iAriaWidgetResult[] = Array.isArray(response._ariaWidgets) ? response._ariaWidgets : [];
  const scanDate = new Date().toLocaleString();

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A11y Scan Report — ${esc(url)}</title>
<style>${reportCSS()}</style>
</head>
<body>
<header>
  <h1>A11y Scan Report</h1>
  <div class="meta">
    <div><strong>URL:</strong> ${esc(url)}</div>
    <div><strong>Date:</strong> ${esc(scanDate)}</div>
    <div><strong>Standard:</strong> WCAG ${esc(version)} Level ${esc(level)}</div>
  </div>
</header>

<div class="summary">
  <div class="summary-card card-violations">
    <div class="count">${counts.violations}</div>
    <div class="label">Violations</div>
  </div>
  <div class="summary-card card-incomplete">
    <div class="count">${counts.incomplete}</div>
    <div class="label">Needs Review</div>
  </div>
  <div class="summary-card card-passes">
    <div class="count">${counts.passes}</div>
    <div class="label">Passed</div>
  </div>${ariaWidgets.length > 0 ? `
  <div class="summary-card card-aria">
    <div class="count">${ariaWidgets.length}</div>
    <div class="label">ARIA Widgets</div>
  </div>` : ''}
</div>`;

  // Violations section
  html += `<h2 class="violations">Violations (${violations.length})</h2>`;
  if (violations.length === 0) {
    html += `<p style="color:#64748b;font-size:13px;">No automated violations found.</p>`;
  }
  for (const v of violations) {
    html += `<div class="rule">`;
    html += `<div class="rule-header">${esc(v.id)} — ${esc(v.help || '')}</div>`;
    html += `<div class="rule-help">${esc(v.description || '')} <span class="impact impact-${v.impact || 'minor'}">${esc(v.impact || 'unknown')}</span></div>`;
    if (v.helpUrl) {
      html += `<div style="font-size:12px;margin-bottom:6px;"><a href="${esc(v.helpUrl)}" style="color:#4f46e5;">Reference</a></div>`;
    }
    for (const node of (v.nodes || [])) {
      html += `<div class="node">`;
      html += `<div class="node-target">${esc((node.target || []).join(', '))}</div>`;
      html += `<div class="node-html">${esc(truncate(node.html || '', 300))}</div>`;
      if (node.failureSummary) {
        html += `<div class="node-failure">${esc(node.failureSummary)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Incomplete section
  html += `<h2 class="incomplete">Needs Review (${incomplete.length})</h2>`;
  if (incomplete.length === 0) {
    html += `<p style="color:#64748b;font-size:13px;">No items need manual verification.</p>`;
  }
  for (const v of incomplete) {
    html += `<div class="rule warning">`;
    html += `<div class="rule-header">${esc(v.id)} — ${esc(v.help || '')}</div>`;
    html += `<div class="rule-help">${esc(v.description || '')}</div>`;
    for (const node of (v.nodes || [])) {
      html += `<div class="node">`;
      html += `<div class="node-target">${esc((node.target || []).join(', '))}</div>`;
      html += `<div class="node-html">${esc(truncate(node.html || '', 300))}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Passes section
  html += `<h2 class="passes">Passed (${passes.length})</h2>`;
  if (passes.length === 0) {
    html += `<p style="color:#64748b;font-size:13px;">No passing rules recorded.</p>`;
  }
  for (const p of passes) {
    html += `<div class="rule pass">`;
    html += `<div class="rule-header">${esc(p.id)} — ${esc(p.help || '')}</div>`;
    html += `<div class="rule-help">${esc(p.description || '')}</div>`;
    html += `</div>`;
  }

  // ARIA Patterns section
  if (ariaWidgets.length > 0) {
    const compliant = ariaWidgets.filter((w) => w.failCount === 0).length;
    const withIssues = ariaWidgets.filter((w) => w.failCount > 0).length;
    html += `<h2 class="aria">ARIA Patterns (${ariaWidgets.length} widgets — ${compliant} compliant, ${withIssues} with issues)</h2>`;
    for (const w of ariaWidgets) {
      const ruleClass = w.failCount > 0 ? 'aria-issue' : 'aria';
      html += `<div class="rule ${ruleClass}">`;
      html += `<div class="rule-header">${esc(w.role)} — ${esc(w.selector)}</div>`;
      html += `<div class="rule-help">${esc(w.passCount.toString())} passed, ${esc(w.failCount.toString())} failed</div>`;
      html += `<ul class="check-list">`;
      for (const c of w.checks) {
        const cls = c.pass ? 'check-pass' : 'check-fail';
        const icon = c.pass ? '\u2713' : '\u2717';
        html += `<li class="${cls}">${icon} ${esc(c.description)} — ${esc(c.message)}</li>`;
      }
      html += `</ul>`;
      html += `</div>`;
    }
  }

  // Tab Order section
  if (tabOrder && tabOrder.total > 0) {
    html += `<h2>Tab Order Analysis (${tabOrder.total} elements)</h2>`;
    if (tabOrder.positiveTabindex > 0) {
      html += `<div class="rule" style="border-left-color:#d97706;background:#fffbeb;"><div class="rule-header" style="color:#92400e;">Warning: ${tabOrder.positiveTabindex} element(s) use positive tabindex</div><div class="rule-help">Positive tabindex values create confusing tab order. Use tabindex="0" instead.</div></div>`;
    }
    html += `<div class="rule pass"><div class="rule-header">Tab Order Sequence</div><ol style="margin:8px 0 0 20px;font-size:12px;">`;
    for (const e of tabOrder.sequence) {
      if (e.index > 0) {
        html += `<li style="margin:2px 0;"><code>${esc(e.selector)}</code> <span style="color:#64748b;">(${esc(e.tagName)}${e.tabindex > 0 ? `, tabindex="${e.tabindex}"` : ''})</span></li>`;
      }
    }
    html += `</ol></div>`;
  }

  // Focus Gaps section
  if (focusGaps && focusGaps.length > 0) {
    html += `<h2 style="color:#dc2626;">Focus Gaps (${focusGaps.length})</h2>`;
    for (const g of focusGaps) {
      html += `<div class="rule" style="border-left-color:#dc2626;background:#fef2f2;">`;
      html += `<div class="rule-header">${esc(g.selector)}</div>`;
      html += `<div class="rule-help">${esc(g.reason)}</div>`;
      html += `</div>`;
    }
  }

  html += `
<footer>Generated by A11y Scan — ${esc(scanDate)}</footer>
</body>
</html>`;

  return html;
}

/**
 * Exports scan results as a self-contained HTML file.
 */
export function exportHTML(response: any, version: string, level: string, url: string, tabOrder?: iTabOrderData | null, focusGaps?: iFocusGapEntry[] | null): void {
  const html = buildHTMLReport(response, version, level, url, tabOrder, focusGaps);
  const filename = buildFilename(url, 'html');
  triggerDownload(html, filename, 'text/html');
}

/**
 * Exports scan results as a PDF by opening a print-friendly HTML page.
 * Uses the browser's built-in Print → Save as PDF since jsPDF is not bundled.
 */
export function exportPDF(response: any, version: string, level: string, url: string, tabOrder?: iTabOrderData | null, focusGaps?: iFocusGapEntry[] | null): void {
  import('jspdf').then(({ jsPDF }) => {
    const violations = response.violations as any[];
    const incomplete = (Array.isArray(response.incomplete) ? response.incomplete : []) as any[];
    const passes = (Array.isArray(response.passes) ? response.passes : []) as any[];
    const filename = buildFilename(url, 'pdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text('A11y Scan Report', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`URL: ${url}`, margin, y); y += 4;
    doc.text(`Scanned: ${new Date().toLocaleString()}`, margin, y); y += 4;
    doc.text(`WCAG ${version} Level ${level}`, margin, y); y += 8;

    // Summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 75);
    doc.text(`Violations: ${violations.length}    Needs Review: ${incomplete.length}    Passed: ${passes.length}`, margin, y);
    y += 10;

    // Violations
    if (violations.length > 0) {
      checkPage(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 0, 0);
      doc.text('Violations', margin, y); y += 6;

      for (const v of violations) {
        checkPage(15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 27, 75);
        const criteriaText = axeRuleToWcag(v.id).map((c: any) => c.id).join(', ') || '';
        doc.text(`${v.id} (${v.impact}) — ${v.help}${criteriaText ? ` [${criteriaText}]` : ''}`, margin, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        for (const node of v.nodes) {
          checkPage(8);
          const lines = doc.splitTextToSize(`${node.target.join(', ')}: ${node.html.slice(0, 100)}`, contentWidth);
          doc.setFontSize(7);
          doc.text(lines, margin + 3, y);
          y += lines.length * 3 + 2;
        }
        y += 3;
      }
    }

    // Needs Review
    if (incomplete.length > 0) {
      checkPage(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 120, 0);
      doc.text('Needs Review', margin, y); y += 6;

      for (const v of incomplete) {
        checkPage(10);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 27, 75);
        doc.text(`${v.id} (${v.impact}) — ${v.help} [${v.nodes.length} elements]`, margin, y);
        y += 5;
      }
      y += 3;
    }

    // Passed
    if (passes.length > 0) {
      checkPage(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 120, 0);
      doc.text(`Passed (${passes.length} rules)`, margin, y); y += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      for (const p of passes) {
        checkPage(5);
        doc.text(`${p.id} — ${p.help}`, margin + 3, y);
        y += 3.5;
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('Generated by A11y Scan', margin, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 8);
    }

    doc.save(filename);
  });
}
