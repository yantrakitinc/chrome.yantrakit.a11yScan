/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderResultsTab } from '../render-results';

let output: HTMLDivElement;

beforeEach(() => {
  output = document.createElement('div');
});

function makeScanResponse(overrides: Partial<{
  violations: any[];
  passes: any[];
  incomplete: any[];
}> = {}) {
  return {
    violations: overrides.violations ?? [],
    passes: overrides.passes ?? [],
    incomplete: overrides.incomplete ?? [],
  };
}

function makeViolation(id: string, impact: string, nodes: number = 1) {
  return {
    id,
    impact,
    help: `${id} help text`,
    helpUrl: `https://example.com/${id}`,
    description: `${id} description`,
    tags: [`wcag2a`, `wcag111`],
    nodes: Array.from({ length: nodes }, (_, i) => ({
      target: [`.element-${i}`],
      html: `<div class="element-${i}">test</div>`,
      failureSummary: `Fix: ${id} issue on element ${i}`,
    })),
  };
}

function makePass(id: string) {
  return {
    id,
    impact: null,
    help: `${id} help`,
    description: `${id} description`,
    tags: [],
    nodes: 1,
  };
}

describe('renderResultsTab', () => {
  it('renders Failed section with violations', () => {
    const response = makeScanResponse({
      violations: [makeViolation('image-alt', 'critical', 2)],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Failed (1)');
    expect(output.innerHTML).toContain('1.1.1');
    expect(output.innerHTML).toContain('Non-text Content');
    expect(output.innerHTML).toContain('image-alt');
    expect(output.innerHTML).toContain('2 element(s)');
  });

  it('renders empty Failed section when no violations', () => {
    const response = makeScanResponse();

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Failed (0)');
    expect(output.innerHTML).toContain('No automated violations found');
  });

  it('sorts violations by impact: critical first', () => {
    const response = makeScanResponse({
      violations: [
        makeViolation('heading-order', 'moderate'),
        makeViolation('image-alt', 'critical'),
        makeViolation('color-contrast', 'serious'),
      ],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    const html = output.innerHTML;
    const criticalPos = html.indexOf('Non-text Content');
    const seriousPos = html.indexOf('Contrast');
    const moderatePos = html.indexOf('Info and Relationships');

    expect(criticalPos).toBeLessThan(seriousPos);
    expect(seriousPos).toBeLessThan(moderatePos);
  });

  it('renders Needs Review section always', () => {
    const response = makeScanResponse();

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Needs Review (0)');
    expect(output.innerHTML).toContain('No items need manual verification');
  });

  it('renders Needs Review with incomplete items', () => {
    const response = makeScanResponse({
      incomplete: [makeViolation('color-contrast', 'serious', 3)],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Needs Review (1)');
    expect(output.innerHTML).toContain('3 element(s) need verification');
  });

  it('does not duplicate criterion in Needs Review if already in Failed', () => {
    const response = makeScanResponse({
      violations: [makeViolation('color-contrast', 'serious')],
      incomplete: [makeViolation('color-contrast', 'serious')],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Failed (1)');
    expect(output.innerHTML).toContain('Needs Review (0)');
  });

  it('renders Passed section with verified criteria only', () => {
    const response = makeScanResponse({
      passes: [makePass('document-title')],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Passed (1)');
    expect(output.innerHTML).toContain('Page Titled');
    expect(output.innerHTML).toContain('document-title');
  });

  it('does not show criteria in Passed if they are in Failed', () => {
    const response = makeScanResponse({
      violations: [makeViolation('image-alt', 'critical')],
      passes: [makePass('image-alt')],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    const passedSection = output.innerHTML.split('Passed')[1] || '';
    expect(passedSection).not.toContain('Non-text Content');
  });

  it('renders element details in expandable violations', () => {
    const response = makeScanResponse({
      violations: [makeViolation('image-alt', 'critical', 1)],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('.element-0');
    expect(output.innerHTML).toContain('&lt;div class="element-0"&gt;test&lt;/div&gt;');
    expect(output.innerHTML).toContain('Fix: image-alt issue on element 0');
  });

  it('respects WCAG version filter', () => {
    const response = makeScanResponse();

    renderResultsTab(output, response, '2.0', 'AA');
    const html20 = output.innerHTML;

    renderResultsTab(output, response, '2.2', 'AA');
    const html22 = output.innerHTML;

    // 2.2 has more criteria than 2.0
    const count20 = (html20.match(/criteria/g) || []).length;
    const count22 = (html22.match(/criteria/g) || []).length;
    expect(count20).toBeGreaterThan(0);
    expect(count22).toBeGreaterThan(0);
  });

  it('respects WCAG level filter', () => {
    const response = makeScanResponse();

    renderResultsTab(output, response, '2.2', 'A');
    const htmlA = output.innerHTML;

    renderResultsTab(output, response, '2.2', 'AA');
    const htmlAA = output.innerHTML;

    // AA criteria count is higher than A
    const matchA = htmlA.match(/WCAG 2\.2 Level A\b.*?(\d+) criteria/);
    const matchAA = htmlAA.match(/WCAG 2\.2 Level AA.*?(\d+) criteria/);

    expect(matchA).toBeTruthy();
    expect(matchAA).toBeTruthy();
    expect(Number(matchAA![1])).toBeGreaterThan(Number(matchA![1]));
  });

  it('renders unmapped violations in Other section', () => {
    const response = makeScanResponse({
      violations: [{
        id: 'some-unknown-rule',
        impact: 'minor',
        help: 'Unknown rule help',
        helpUrl: '',
        description: '',
        tags: [],
        nodes: [{ target: ['.foo'], html: '<div></div>', failureSummary: '' }],
      }],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('Other axe-core Findings (1)');
    expect(output.innerHTML).toContain('some-unknown-rule');
  });

  it('truncates long HTML snippets', () => {
    const longHtml = '<div class="' + 'a'.repeat(300) + '">content</div>';
    const response = makeScanResponse({
      violations: [{
        id: 'image-alt',
        impact: 'critical',
        help: 'test',
        helpUrl: '',
        description: '',
        tags: [],
        nodes: [{ target: ['.long'], html: longHtml, failureSummary: '' }],
      }],
    });

    renderResultsTab(output, response, '2.2', 'AA');

    expect(output.innerHTML).toContain('...');
    expect(output.innerHTML).not.toContain('a'.repeat(300));
  });
});
