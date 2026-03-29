/**
 * Report export functionality for A11y Scan.
 * Generates JSON, HTML, and PDF (print-friendly) reports client-side.
 */

import { axeRuleToWcag } from '@shared/wcag-mapping';
import { SITE_URL } from '@shared/config';
import { criterionSlug } from '@shared/utils';

/**
 * Builds a kebab-case filename from the scanned URL.
 */
function buildFilename(url: string, ext: string): string {
  const parsed = new URL(url);
  const site = (parsed.hostname + parsed.pathname)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
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
function enrichItem(item: any): any {
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
    elements: (item.nodes || []).map((node: any) => ({
      selector: (node.target || []).join(', '),
      html: node.html || '',
      issue: node.failureSummary || '',
      fix: fixSuggestion(item.id, item.help || ''),
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
 * Exports scan results as an enriched JSON file with WCAG mappings and fix suggestions.
 */
export function exportJSON(response: any, version: string, level: string, url: string): void {
  const counts = extractCounts(response);
  const violations = Array.isArray(response.violations) ? response.violations : [];
  const incomplete = Array.isArray(response.incomplete) ? response.incomplete : [];
  const passes = Array.isArray(response.passes) ? response.passes : [];

  const report = {
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
    violations: violations.map(enrichItem),
    needsReview: incomplete.map(enrichItem),
    passes: passes.map(enrichPassItem),
  };

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
    footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 12px; } .summary-card { min-width: 100px; } }
  `;
}

/**
 * Generates a self-contained HTML report string.
 */
function buildHTMLReport(response: any, version: string, level: string, url: string): string {
  const counts = extractCounts(response);
  const violations = Array.isArray(response.violations) ? response.violations : [];
  const incomplete = Array.isArray(response.incomplete) ? response.incomplete : [];
  const passes = Array.isArray(response.passes) ? response.passes : [];
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
  </div>
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

  html += `
<footer>Generated by A11y Scan — ${esc(scanDate)}</footer>
</body>
</html>`;

  return html;
}

/**
 * Exports scan results as a self-contained HTML file.
 */
export function exportHTML(response: any, version: string, level: string, url: string): void {
  const html = buildHTMLReport(response, version, level, url);
  const filename = buildFilename(url, 'html');
  triggerDownload(html, filename, 'text/html');
}

/**
 * Exports scan results as a PDF by opening a print-friendly HTML page.
 * Uses the browser's built-in Print → Save as PDF since jsPDF is not bundled.
 */
export function exportPDF(response: any, version: string, level: string, url: string): void {
  const html = buildHTMLReport(response, version, level, url);
  const printHTML = html.replace(
    '</footer>',
    `</footer>
<script>
  window.onload = function() {
    var note = document.createElement('div');
    note.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1e1b4b;color:#fff;text-align:center;padding:8px;font-size:13px;z-index:9999;';
    note.innerHTML = 'Use your browser\\'s <strong>Print → Save as PDF</strong> to export this report. <button onclick="this.parentElement.remove();window.print();" style="margin-left:12px;background:#f59e0b;color:#1e1b4b;border:none;padding:4px 12px;border-radius:4px;font-weight:600;cursor:pointer;">Print Now</button>';
    document.body.prepend(note);
  };
</script>`
  );

  const blob = new Blob([printHTML], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}
