/**
 * Scans the current page for WAI-ARIA widget patterns and validates
 * their structure against expected ARIA authoring practices.
 */

import {
  ARIA_PATTERN_RULES,
  type iAriaPatternRule,
  type iAriaWidgetResult,
} from '../shared/aria-patterns';

/**
 * Builds a CSS-selector-like string for an element (tag + id + first class).
 */
function buildSelector(el: Element): string {
  let sel = el.tagName.toLowerCase();
  if (el.id) {
    sel += `#${el.id}`;
  } else {
    const role = el.getAttribute('role');
    if (role) {
      sel += `[role="${role}"]`;
    } else if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass) sel += `.${firstClass}`;
    }
  }
  return sel;
}

/**
 * Truncates an HTML string to the given max length.
 */
function truncateHtml(el: Element, maxLen = 200): string {
  const html = el.outerHTML;
  return html.length > maxLen ? html.slice(0, maxLen) + '...' : html;
}

/**
 * Runs checks from a pattern rule against a DOM element and returns a result.
 */
function runPatternChecks(el: Element, rule: iAriaPatternRule): iAriaWidgetResult {
  const checks = rule.checks.map((c) => {
    const result = c.check(el);
    return {
      id: c.id,
      description: c.description,
      pass: result.pass,
      message: result.message,
    };
  });

  return {
    role: rule.role,
    label: rule.label,
    selector: buildSelector(el),
    html: truncateHtml(el),
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
}

/**
 * Detects accordion-like containers: parent elements that contain
 * two or more sibling disclosure buttons with aria-expanded.
 */
function detectAccordions(): Element[] {
  const expandedButtons = document.querySelectorAll(
    'button[aria-expanded], [role="button"][aria-expanded]',
  );

  const parentCounts = new Map<Element, number>();
  expandedButtons.forEach((btn) => {
    const parent = btn.parentElement;
    if (parent) {
      parentCounts.set(parent, (parentCounts.get(parent) ?? 0) + 1);
    }
  });

  const accordions: Element[] = [];
  parentCounts.forEach((count, parent) => {
    if (count >= 2) {
      accordions.push(parent);
    }
  });

  return accordions;
}

/** Map of role attribute value to its pattern rule. */
const rulesByRole = new Map<string, iAriaPatternRule>();
for (const rule of ARIA_PATTERN_RULES) {
  if (rule.role !== 'accordion') {
    rulesByRole.set(rule.role, rule);
  }
}

const accordionRule = ARIA_PATTERN_RULES.find((r) => r.role === 'accordion')!;

/**
 * Scans the DOM for WAI-ARIA widget patterns and validates each one.
 * Returns an array of results, one per detected widget instance.
 */
export function scanAriaPatterns(): iAriaWidgetResult[] {
  const results: iAriaWidgetResult[] = [];

  // Query for all explicit role-based widgets
  const roleSelector = [
    '[role="tablist"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="combobox"]',
    '[role="slider"]',
    '[role="tree"]',
    '[role="radiogroup"]',
    '[role="checkbox"]',
    '[role="switch"]',
  ].join(', ');

  const elements = document.querySelectorAll(roleSelector);

  elements.forEach((el) => {
    const role = el.getAttribute('role');
    if (!role) return;

    const rule = rulesByRole.get(role);
    if (!rule) return;

    results.push(runPatternChecks(el, rule));
  });

  // Detect accordion patterns (not role-based, heuristic-based)
  const accordions = detectAccordions();
  for (const el of accordions) {
    results.push(runPatternChecks(el, accordionRule));
  }

  return results;
}
