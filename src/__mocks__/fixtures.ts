/**
 * Test fixtures for A11y Scan — scan results, violations, ARIA widgets.
 */

import type { iViolation, iViolationNode, iScanResult, iEnrichedContext } from '@shared/types';

export const nodeImageMissingAlt: iViolationNode = {
  target: ['img.hero-image'],
  html: '<img class="hero-image" src="/gandalf.png">',
  failureSummary: 'Fix any of the following:\n  Element does not have an alt attribute',
};

export const nodeLowContrast: iViolationNode = {
  target: ['.sidebar > p.description'],
  html: '<p class="description" style="color: #999; background: #fff;">The One Ring description</p>',
  failureSummary: 'Fix any of the following:\n  Element has insufficient color contrast of 2.85:1 (foreground color: #999999, background color: #ffffff, font size: 12.0pt, font weight: normal). Expected contrast ratio of 4.5:1',
};

export const nodeButtonNoName: iViolationNode = {
  target: ['button.nav-toggle'],
  html: '<button class="nav-toggle"><svg aria-hidden="true"></svg></button>',
  failureSummary: 'Fix any of the following:\n  Element does not have inner text',
};

export const nodeLinkNoText: iViolationNode = {
  target: ['a.card-link'],
  html: '<a href="/mordor" class="card-link"></a>',
  failureSummary: 'Fix any of the following:\n  Element is in tab order and does not have accessible text',
};

export const violationImageAlt: iViolation = {
  id: 'image-alt', impact: 'critical',
  description: 'Ensures <img> elements have alternate text or a role of none or presentation',
  help: 'Images must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
  nodes: [nodeImageMissingAlt],
};

export const violationColorContrast: iViolation = {
  id: 'color-contrast', impact: 'serious',
  description: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
  help: 'Elements must meet minimum color contrast ratio thresholds',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
  tags: ['cat.color', 'wcag2aa', 'wcag143'],
  nodes: [nodeLowContrast],
};

export const violationButtonName: iViolation = {
  id: 'button-name', impact: 'critical',
  description: 'Ensures buttons have discernible text',
  help: 'Buttons must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/button-name',
  tags: ['cat.name-role-value', 'wcag2a', 'wcag412'],
  nodes: [nodeButtonNoName],
};

export const violationLinkName: iViolation = {
  id: 'link-name', impact: 'serious',
  description: 'Ensures links have discernible text',
  help: 'Links must have discernible text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/link-name',
  tags: ['cat.name-role-value', 'wcag2a', 'wcag244'],
  nodes: [nodeLinkNoText],
};

export const scanResultClean: iScanResult = {
  url: 'https://rivendell.example.com/', timestamp: '2026-04-01T12:00:00.000Z',
  violations: [], passes: 42, incomplete: 0, inapplicable: 18,
  summary: { critical: 0, serious: 0, moderate: 0, minor: 0, passes: 42, incomplete: 0, inapplicable: 18 },
};

export const scanResultWithIssues: iScanResult = {
  url: 'https://mordor.example.com/one-ring', timestamp: '2026-04-01T12:05:00.000Z',
  violations: [violationImageAlt, violationColorContrast, violationButtonName, violationLinkName],
  passes: 38, incomplete: 2, inapplicable: 12,
  summary: { critical: 2, serious: 2, moderate: 0, minor: 0, passes: 38, incomplete: 2, inapplicable: 12 },
};

export const rawScanResponse = {
  type: 'SCAN_RESULT',
  violations: [violationImageAlt, violationColorContrast, violationButtonName, violationLinkName],
  passes: [
    { id: 'html-has-lang', impact: null, help: 'html element has a lang attribute', description: 'Ensures every HTML document has a lang attribute', tags: ['cat.language', 'wcag2a', 'wcag311'], nodes: 1 },
    { id: 'document-title', impact: null, help: 'Document has a title element', description: 'Ensures each HTML document contains a non-empty title element', tags: ['cat.text-alternatives', 'wcag2a', 'wcag242'], nodes: 1 },
  ],
  incomplete: [
    { id: 'color-contrast', impact: 'serious', help: 'Needs review: contrast could not be determined', description: '', helpUrl: '', tags: [], nodes: [{ target: ['.dynamic-bg'], html: '<div class="dynamic-bg">Helm\'s Deep</div>', failureSummary: '' }] },
  ],
  pageElements: {
    hasVideo: false, hasAudio: false, hasForms: true, hasImages: true,
    hasLinks: true, hasHeadings: true, hasIframes: false, hasTables: false,
    hasAnimation: false, hasAutoplay: false, hasDragDrop: false, hasTimeLimits: false,
  },
};

export const ariaWidgetTablist = {
  role: 'tablist', selector: '[role="tablist"]',
  checks: [
    { id: 'has-tabs', description: 'Tablist contains tab children', pass: true, message: 'Found 3 tabs' },
    { id: 'tab-selected', description: 'At least one tab has aria-selected', pass: true, message: 'Tab 1 is selected' },
  ],
  passCount: 2, failCount: 0,
};

export const ariaWidgetDialogBroken = {
  role: 'dialog', selector: '[role="dialog"]',
  checks: [
    { id: 'has-label', description: 'Dialog has aria-label or aria-labelledby', pass: false, message: 'Missing accessible name' },
    { id: 'focus-trap', description: 'Dialog traps focus', pass: false, message: 'Focus can escape dialog' },
  ],
  passCount: 0, failCount: 2,
};

export const enrichedContextSample: iEnrichedContext = {
  dom: {
    parentSelector: 'div.hero-section', parentTagName: 'div',
    siblingSelectors: ['h1.hero-title', 'p.hero-subtitle'],
    nearestLandmark: 'main', nearestHeading: 'h1: Welcome to Middle-earth',
  },
  css: {
    color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)',
    fontSize: '16px', display: 'block', visibility: 'visible', position: 'static',
  },
  framework: { detected: 'react', componentName: 'HeroSection', testId: 'hero-image' },
  filePathGuesses: [{ source: 'class="hero-image"', guess: 'components/HeroSection/HeroSection.module.css' }],
};

export const tabOrderEntries = [
  { index: 1, tabindex: 0, selector: 'a.skip-link', tagName: 'A' },
  { index: 2, tabindex: 0, selector: 'a.nav-home', tagName: 'A' },
  { index: 3, tabindex: 0, selector: 'button.nav-toggle', tagName: 'BUTTON' },
  { index: 4, tabindex: 0, selector: 'input#search', tagName: 'INPUT' },
  { index: 5, tabindex: 1, selector: 'a.priority-link', tagName: 'A' },
];

export const focusGaps = [
  { selector: 'div.clickable-card', reason: 'Has click handler but not focusable' },
  { selector: 'span.fake-button', reason: 'Styled as button but no keyboard access' },
];
