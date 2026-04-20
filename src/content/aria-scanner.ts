/**
 * ARIA widget pattern validation (F10).
 * Detects ARIA widgets and validates against WAI-ARIA spec.
 */

import { ARIA_PATTERNS } from "@shared/aria-patterns";
import type { iAriaWidget } from "@shared/types";

/** Scan the DOM for ARIA widgets and validate each */
export function scanAriaPatterns(): iAriaWidget[] {
  const widgets: iAriaWidget[] = [];

  for (const pattern of ARIA_PATTERNS) {
    const elements = document.querySelectorAll(pattern.selector);

    for (const el of Array.from(elements)) {
      const checks = pattern.checks.map((check) => {
        const result = check.validate(el);
        return { name: check.name, pass: result.pass, message: result.message };
      });

      const passCount = checks.filter((c) => c.pass).length;
      const failCount = checks.filter((c) => !c.pass).length;

      widgets.push({
        role: pattern.role,
        selector: getSelector(el),
        label: getLabel(el),
        html: el.outerHTML.substring(0, 200),
        checks,
        passCount,
        failCount,
      });
    }
  }

  return widgets;
}

function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  if (role) return `${tag}[role="${role}"]`;
  const classes = Array.from(el.classList).filter(c => !/[[\]:@!]/.test(c)).slice(0, 2).map(c => CSS.escape(c)).join(".");
  return classes ? `${tag}.${classes}` : tag;
}

function getLabel(el: Element): string {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.textContent?.trim() || "";
  }
  return el.textContent?.trim().substring(0, 50) || "";
}
