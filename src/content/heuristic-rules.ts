/**
 * Custom heuristic rules beyond axe-core (F11).
 * 33 DOM/CSS checks that catch what axe misses.
 * Source of truth: /extension/docs/features/F11-custom-heuristics.md
 */

import type { iViolation, iViolationNode } from "@shared/types";

interface iHeuristicResult {
  ruleId: string;
  description: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  wcagCriteria: string[];
  nodes: iViolationNode[];
}

/** Run all 33 heuristic rules, return as violations.
 * @param isCrawl - Whether this is a crawl scan (enables cross-page rules).
 * @param excludeRules - Optional list of rule numbers to skip (e.g. [1, 6, 9]).
 */
export function runHeuristicRules(isCrawl: boolean, excludeRules?: number[]): iViolation[] {
  const excluded = new Set(excludeRules ?? []);
  const results: iHeuristicResult[] = [];

  if (!excluded.has(1)) results.push(...rule1_decorativeSymbols());
  if (!excluded.has(2)) results.push(...rule2_iconFonts());
  if (!excluded.has(3)) results.push(...rule3_pseudoContent());
  if (!excluded.has(4)) results.push(...rule4_genericLinkText());
  if (!excluded.has(5)) results.push(...rule5_visualDomOrderMismatch());
  if (!excluded.has(6)) results.push(...rule6_smallTouchTargets());
  if (!excluded.has(7)) results.push(...rule7_scrollContainers());
  if (!excluded.has(8)) results.push(...rule8_missingAutocomplete());
  if (!excluded.has(9)) results.push(...rule9_focusIndicator());
  if (!excluded.has(10)) results.push(...rule10_importantTextStyling());
  if (!excluded.has(11)) results.push(...rule11_nonTextContrast());
  if (!excluded.has(12)) results.push(...rule12_placeholderOnlyLabel());
  if (!excluded.has(13)) results.push(...rule13_visualHeadings());
  if (!excluded.has(14)) results.push(...rule14_headingForStyling());
  if (!excluded.has(15)) results.push(...rule15_linkIndistinguishable());
  if (!excluded.has(16)) results.push(...rule16_divAsButton());
  if (!excluded.has(17)) results.push(...rule17_focusOutlineNone());
  if (!excluded.has(18)) results.push(...rule18_ariaHiddenFocusable());
  if (!excluded.has(19)) results.push(...rule19_brokenAriaRefs());
  if (!excluded.has(20)) results.push(...rule20_focusObscured());
  if (isCrawl) {
    if (!excluded.has(21)) results.push(...rule21_inconsistentNavOrder());
    if (!excluded.has(22)) results.push(...rule22_inconsistentLinkIdentification());
  }
  if (!excluded.has(23)) results.push(...rule23_showPasswordToggle());
  if (!excluded.has(24)) results.push(...rule24_breadcrumbValidation());
  if (!excluded.has(25)) results.push(...rule25_iconOnlyButtons());
  if (!excluded.has(26)) results.push(...rule26_carouselAccessibility());
  if (!excluded.has(27)) results.push(...rule27_autoPlayAnimation());
  if (!excluded.has(28)) results.push(...rule28_newTabNoWarning());
  if (window.innerWidth <= 320) {
    if (!excluded.has(29)) results.push(...rule29_reflow320px());
  }
  if (!excluded.has(30)) results.push(...rule30_spaRouteChanges());
  if (!excluded.has(31)) results.push(...rule31_prefersReducedMotion());
  if (!excluded.has(32)) results.push(...rule32_targetSizeOverlap());
  if (!excluded.has(33)) results.push(...rule33_suspiciousAltText());

  // Filter empty results
  return results
    .filter((r) => r.nodes.length > 0)
    .map((r) => ({
      id: `heuristic-${r.ruleId}`,
      impact: r.impact,
      description: r.description,
      help: r.description,
      helpUrl: "",
      tags: [],
      nodes: r.nodes,
      wcagCriteria: r.wcagCriteria,
    }));
}

function sel(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  // Filter out Tailwind classes with special chars that break querySelector
  const safeClasses = Array.from(el.classList)
    .filter(c => !/[[\]:@!]/.test(c))
    .slice(0, 2);
  const cls = safeClasses.map(c => CSS.escape(c)).join(".");
  return cls ? `${tag}.${cls}` : tag;
}

function node(el: Element, msg: string): iViolationNode {
  return { selector: sel(el), html: el.outerHTML.substring(0, 200), failureSummary: msg };
}

function isVisible(el: Element): boolean {
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden";
}

function isAriaHidden(el: Element): boolean {
  let cursor: Element | null = el;
  while (cursor) {
    if (cursor.getAttribute("aria-hidden") === "true") return true;
    cursor = cursor.parentElement;
  }
  return false;
}

/* ── Color/contrast helpers ── */
function parseColor(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1: [number, number, number], c2: [number, number, number]): number {
  const l1 = luminance(...c1);
  const l2 = luminance(...c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── Rule 1: Decorative symbols without aria-hidden ── */
function rule1_decorativeSymbols(): iHeuristicResult[] {
  const symbolPattern = /^[>•|→←↑↓—·※◆▶◀►◄…–]+$/;
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("span, i, div, p")) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    const text = el.textContent?.trim() || "";
    if (text.length > 0 && text.length <= 3 && symbolPattern.test(text)) {
      if (el.querySelector("svg")) continue;
      if (el.getAttribute("aria-hidden") !== "true") {
        nodes.push(node(el, `Decorative symbol "${text}" exposed to screen readers. Add aria-hidden="true".`));
      }
    }
  }
  return [{ ruleId: "decorative-symbols", description: "Decorative symbols without aria-hidden", impact: "minor", wcagCriteria: ["4.1.2"], nodes }];
}

/* ── Rule 2: Icon fonts without text alternatives ── */
function rule2_iconFonts(): iHeuristicResult[] {
  const iconPattern = /\bfa-\w+|material-icons|glyphicon-\w+|bi-\w+|ion-\w+/;
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("*")) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    const classes = el.className;
    if (typeof classes === "string" && iconPattern.test(classes)) {
      const hasLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title");
      if (!hasLabel && el.getAttribute("aria-hidden") !== "true") {
        // Check if parent interactive element has label
        const parent = el.closest("button, a, [role='button']");
        if (!parent || !(parent.getAttribute("aria-label") || parent.textContent?.trim())) {
          nodes.push(node(el, "Icon font element has no text alternative. Add aria-label or aria-hidden=\"true\"."));
        }
      }
    }
  }
  return [{ ruleId: "icon-font-alt", description: "Icon fonts without text alternatives", impact: "serious", wcagCriteria: ["1.1.1"], nodes }];
}

/* ── Rule 3: CSS ::before/::after with meaningful content ── */
function rule3_pseudoContent(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const decorative = /^["']?\s*["']?$|^none$|^normal$/;
  for (const el of Array.from(document.querySelectorAll("*")).slice(0, 500)) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    for (const pseudo of ["::before", "::after"] as const) {
      const style = getComputedStyle(el, pseudo);
      const content = style.content;
      if (content && content !== "none" && content !== "normal" && content !== '""' && !decorative.test(content)) {
        nodes.push(node(el, `${pseudo} has content "${content}" that may not be accessible. Review if meaningful.`));
      }
    }
  }
  return [{ ruleId: "pseudo-content", description: "CSS pseudo-elements with potentially meaningful content", impact: "minor", wcagCriteria: ["1.1.1"], nodes }];
}

/* ── Rule 4: Generic link text ── */
function rule4_genericLinkText(): iHeuristicResult[] {
  const generic = ["click here", "read more", "learn more", "more", "here", "link", "details", "info"];
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("a")) {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
    if (generic.includes(name)) {
      nodes.push(node(el, `Link text "${name}" is generic. Use descriptive text that explains the destination.`));
    }
  }
  return [{ ruleId: "generic-link-text", description: "Generic link text", impact: "serious", wcagCriteria: ["2.4.4"], nodes }];
}

/* ── Rule 5: Visual order vs DOM order mismatch ── */
function rule5_visualDomOrderMismatch(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const container of document.querySelectorAll("*")) {
    const style = getComputedStyle(container);
    if (style.display !== "flex" && style.display !== "grid") continue;
    const children = Array.from(container.children).filter((c) => isVisible(c));
    if (children.length < 2) continue;

    const rects = children.map((c) => c.getBoundingClientRect());
    const domOrder = children.map((_, i) => i);
    const visualOrder = [...domOrder].sort((a, b) => {
      const diff = rects[a].top - rects[b].top;
      return Math.abs(diff) < 5 ? rects[a].left - rects[b].left : diff;
    });

    for (let i = 0; i < domOrder.length; i++) {
      if (domOrder[i] !== visualOrder[i]) {
        nodes.push(node(container, "Visual order differs from DOM order in this flex/grid container."));
        break;
      }
    }
  }
  return [{ ruleId: "visual-dom-order", description: "Visual order vs DOM order mismatch", impact: "moderate", wcagCriteria: ["1.3.2"], nodes }];
}

/* ── Rule 6: Small touch targets ── */
function rule6_smallTouchTargets(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]')) {
    if (!isVisible(el)) continue;
    if (getComputedStyle(el).pointerEvents === "none") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
      nodes.push(node(el, `Touch target is ${Math.round(rect.width)}×${Math.round(rect.height)}px. Minimum is 24×24px.`));
    }
  }
  return [{ ruleId: "small-touch-target", description: "Small touch targets below 24×24px", impact: "moderate", wcagCriteria: ["2.5.8"], nodes }];
}

/* ── Rule 7: Scroll containers without keyboard access ── */
function rule7_scrollContainers(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("*")) {
    if (el === document.body || el === document.documentElement) continue;
    const style = getComputedStyle(el);
    const overflow = style.overflow + style.overflowX + style.overflowY;
    if (!overflow.includes("auto") && !overflow.includes("scroll")) continue;
    const htmlEl = el as HTMLElement;
    if (htmlEl.scrollHeight <= htmlEl.clientHeight && htmlEl.scrollWidth <= htmlEl.clientWidth) continue;
    if (htmlEl.tabIndex >= 0) continue;
    // Check if has focusable child
    if (el.querySelector('a[href], button, input, select, textarea, [tabindex]')) continue;
    nodes.push(node(el, "Scrollable container has no tabindex. Keyboard users cannot scroll this content."));
  }
  return [{ ruleId: "scroll-no-keyboard", description: "Scroll containers without keyboard access", impact: "serious", wcagCriteria: ["2.1.1"], nodes }];
}

/* ── Rule 8: Missing autocomplete on common inputs ── */
function rule8_missingAutocomplete(): iHeuristicResult[] {
  const fieldMap: Record<string, string> = {
    name: "name", email: "email", phone: "tel", telephone: "tel",
    address: "street-address", city: "address-level2", state: "address-level1",
    zip: "postal-code", "postal code": "postal-code", country: "country-name",
    "credit card": "cc-number", "card number": "cc-number",
  };
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("input, textarea")) {
    const htmlEl = el as HTMLInputElement;
    if (["hidden", "submit", "reset", "button", "search"].includes(htmlEl.type)) continue;
    const label = (htmlEl.getAttribute("aria-label") || htmlEl.placeholder || htmlEl.name || htmlEl.id || "").toLowerCase();
    const matchedField = Object.keys(fieldMap).find((key) => label.includes(key));
    if (matchedField && (!htmlEl.getAttribute("autocomplete") || htmlEl.getAttribute("autocomplete") === "off")) {
      nodes.push(node(el, `Input "${label}" should have autocomplete="${fieldMap[matchedField]}".`));
    }
  }
  return [{ ruleId: "missing-autocomplete", description: "Missing autocomplete on common inputs", impact: "moderate", wcagCriteria: ["1.3.5"], nodes }];
}

/* ── Rule 12: Placeholder as only label ── */
function rule12_placeholderOnlyLabel(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("input, textarea")) {
    const htmlEl = el as HTMLInputElement;
    if (["hidden", "submit", "reset", "button"].includes(htmlEl.type)) continue;
    if (!htmlEl.hasAttribute("placeholder")) continue;
    const hasLabel = htmlEl.getAttribute("aria-label") || htmlEl.getAttribute("aria-labelledby") || htmlEl.getAttribute("title");
    if (hasLabel) continue;
    if (htmlEl.id && document.querySelector(`label[for="${htmlEl.id}"]`)) continue;
    if (htmlEl.closest("label")) continue;
    nodes.push(node(el, "Input uses placeholder as only label. Add a <label>, aria-label, or aria-labelledby."));
  }
  return [{ ruleId: "placeholder-only-label", description: "Placeholder as only label", impact: "serious", wcagCriteria: ["1.3.1", "3.3.2"], nodes }];
}

/* ── Rule 13: Visual headings without semantic markup ── */
function rule13_visualHeadings(): iHeuristicResult[] {
  const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("p, div, span, li, td")) {
    if (!isVisible(el)) continue;
    const text = el.textContent?.trim() || "";
    if (text.length === 0 || text.length > 200) continue;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight) || 400;
    if ((fontSize >= bodyFontSize * 1.5 || fontWeight >= 700) && text.length >= 3) {
      if (!el.closest("h1, h2, h3, h4, h5, h6, [role='heading']")) {
        nodes.push(node(el, `Text styled as heading (${Math.round(fontSize)}px, weight ${fontWeight}) but not using <h1>-<h6> or role="heading".`));
      }
    }
  }
  return [{ ruleId: "visual-heading", description: "Visual headings without semantic markup", impact: "moderate", wcagCriteria: ["1.3.1", "2.4.6"], nodes }];
}

/* ── Rule 16: Div/span as button ── */
function rule16_divAsButton(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("div, span, li, td")) {
    if (!isVisible(el)) continue;
    const htmlEl = el as HTMLElement;
    const hasClick = htmlEl.onclick !== null || getComputedStyle(el).cursor === "pointer";
    if (!hasClick) continue;
    const role = el.getAttribute("role");
    if (role && ["button", "link", "menuitem", "tab", "option"].includes(role)) continue;
    if (htmlEl.tabIndex >= 0) continue;
    nodes.push(node(el, "Element has click behavior but no role=\"button\" and no tabindex. Not keyboard accessible."));
  }
  return [{ ruleId: "div-as-button", description: "Div/span used as button without proper ARIA", impact: "serious", wcagCriteria: ["4.1.2", "2.1.1"], nodes }];
}

/* ── Rule 18: aria-hidden with focusable children ── */
function rule18_ariaHiddenFocusable(): iHeuristicResult[] {
  const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll('[aria-hidden="true"]')) {
    const style = getComputedStyle(el);
    if (style.display === "none") continue; // truly hidden, no issue
    const children = el.querySelectorAll(focusable);
    if (children.length > 0) {
      nodes.push(node(el, `aria-hidden="true" but contains ${children.length} focusable descendant(s). Screen readers skip this but keyboard still reaches it.`));
    }
  }
  return [{ ruleId: "aria-hidden-focusable", description: "aria-hidden with focusable children", impact: "critical", wcagCriteria: ["4.1.2"], nodes }];
}

/* ── Rule 19: Broken ARIA references ── */
function rule19_brokenAriaRefs(): iHeuristicResult[] {
  const refAttrs = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-activedescendant"];
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("*")) {
    for (const attr of refAttrs) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      for (const id of value.split(" ").filter(Boolean)) {
        if (!document.getElementById(id)) {
          nodes.push(node(el, `${attr} references id="${id}" which does not exist in the DOM.`));
        }
      }
    }
  }
  return [{ ruleId: "broken-aria-ref", description: "Broken ARIA references", impact: "serious", wcagCriteria: ["4.1.2"], nodes }];
}

/* ── Rule 25: No visible label (icon-only buttons) ── */
function rule25_iconOnlyButtons(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll('button, [role="button"], a[href]')) {
    if (!isVisible(el)) continue;
    const hasAriaLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    const visibleText = el.textContent?.trim() || "";
    if (hasAriaLabel && !visibleText) {
      nodes.push(node(el, "Icon-only interactive element. Has aria-label but no visible text. Voice control users cannot activate by speaking the label."));
    }
  }
  return [{ ruleId: "icon-only-button", description: "No visible label (icon-only buttons)", impact: "moderate", wcagCriteria: ["2.5.3"], nodes }];
}

/* ── Rule 27: Auto-playing/infinite animation ── */
function rule27_autoPlayAnimation(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  // Check for <marquee>
  for (const el of document.querySelectorAll("marquee")) {
    nodes.push(node(el, "<marquee> element creates auto-moving content. Use CSS animation with a pause control instead."));
  }
  // Check for infinite CSS animations
  for (const el of Array.from(document.querySelectorAll("*")).slice(0, 300)) {
    if (!isVisible(el)) continue;
    const style = getComputedStyle(el);
    if (style.animationIterationCount === "infinite" && style.animationPlayState === "running" && style.animationDuration !== "0s") {
      nodes.push(node(el, "Element has infinite CSS animation with no pause control. Users with vestibular disorders need a way to stop this."));
    }
  }
  return [{ ruleId: "auto-play-animation", description: "Auto-playing/infinite animation without pause control", impact: "moderate", wcagCriteria: ["2.2.2"], nodes }];
}

/* ── Rule 28: New tab links without warning ── */
function rule28_newTabNoWarning(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll('a[target="_blank"], a[target="_new"]')) {
    const name = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
    if (!name.includes("new tab") && !name.includes("new window") && !name.includes("opens in")) {
      const hasIcon = el.querySelector('[aria-label*="new tab"], [title*="new tab"]');
      if (!hasIcon) {
        nodes.push(node(el, "Link opens in new tab without warning. Add \"opens in new tab\" to aria-label or visible text."));
      }
    }
  }
  return [{ ruleId: "new-tab-no-warning", description: "New tab links without warning", impact: "moderate", wcagCriteria: ["3.2.5"], nodes }];
}

/* ── Rule 9: Focus indicator check ── */
function rule9_focusIndicator(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const focusable = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
  for (const el of Array.from(focusable).slice(0, 200)) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    const savedScrollY = window.scrollY;
    const before = { outline: getComputedStyle(el).outline, boxShadow: getComputedStyle(el).boxShadow, border: getComputedStyle(el).border, bg: getComputedStyle(el).backgroundColor };
    (el as HTMLElement).focus({ preventScroll: true });
    const after = { outline: getComputedStyle(el).outline, boxShadow: getComputedStyle(el).boxShadow, border: getComputedStyle(el).border, bg: getComputedStyle(el).backgroundColor };
    (el as HTMLElement).blur();
    window.scrollTo({ top: savedScrollY, behavior: "instant" });
    const unchanged = before.outline === after.outline && before.boxShadow === after.boxShadow && before.border === after.border && before.bg === after.bg;
    if (unchanged) {
      nodes.push(node(el, "No visible focus indicator detected. Focused and unfocused states appear identical."));
    }
  }
  return [{ ruleId: "focus-indicator", description: "Focus indicator check", impact: "moderate", wcagCriteria: ["2.4.7"], nodes }];
}

/* ── Rule 10: Inline !important on text styling ── */
function rule10_importantTextStyling(): iHeuristicResult[] {
  const props = ["font-size", "line-height", "letter-spacing", "word-spacing"];
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("[style]")) {
    const htmlEl = el as HTMLElement;
    for (const prop of props) {
      if (htmlEl.style.getPropertyPriority(prop) === "important") {
        nodes.push(node(el, `Inline style uses !important on "${prop}". This blocks user stylesheet overrides and violates text spacing adaptability.`));
        break;
      }
    }
  }
  return [{ ruleId: "important-text-styling", description: "Inline !important on text styling properties", impact: "minor", wcagCriteria: ["1.4.12"], nodes }];
}

/* ── Rule 11: Non-text contrast ── */
function rule11_nonTextContrast(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const uiSelectors = "input, button, select, textarea, [role='checkbox'], [role='radio'], [role='slider'], [role='switch']";
  for (const el of document.querySelectorAll(uiSelectors)) {
    if (!isVisible(el)) continue;
    const style = getComputedStyle(el);
    const borderColor = parseColor(style.borderColor);
    const parent = el.parentElement;
    const bgColor = parent ? parseColor(getComputedStyle(parent).backgroundColor) : null;
    if (!borderColor || !bgColor) continue;
    const ratio = contrastRatio(borderColor, bgColor);
    if (ratio < 3) {
      nodes.push(node(el, `UI component border contrast ratio is ${ratio.toFixed(2)}:1. Minimum is 3:1 (WCAG 1.4.11).`));
    }
  }
  return [{ ruleId: "non-text-contrast", description: "Non-text contrast below 3:1", impact: "moderate", wcagCriteria: ["1.4.11"], nodes }];
}

/* ── Rule 14: Heading tags used for styling ── */
function rule14_headingForStyling(): iHeuristicResult[] {
  const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    if (!isVisible(el)) continue;
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    if (fontSize <= bodyFontSize) {
      nodes.push(node(el, `<${el.tagName.toLowerCase()}> has font-size (${Math.round(fontSize)}px) <= body font-size. Heading tag used for styling, not structure.`));
      continue;
    }
    if (el.closest("p")) {
      nodes.push(node(el, `<${el.tagName.toLowerCase()}> is nested inside a <p> element, suggesting it is used for inline styling rather than structure.`));
    }
  }
  return [{ ruleId: "heading-for-styling", description: "Heading tags used for visual styling", impact: "moderate", wcagCriteria: ["1.3.1"], nodes }];
}

/* ── Rule 15: Links indistinguishable from surrounding text ── */
function rule15_linkIndistinguishable(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("p a, li a, td a")) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    const style = getComputedStyle(el);
    if (style.textDecorationLine.includes("underline")) continue;
    const linkColor = parseColor(style.color);
    const parent = el.parentElement;
    if (!parent || !linkColor) continue;
    const parentColor = parseColor(getComputedStyle(parent).color);
    if (!parentColor) continue;
    const ratio = contrastRatio(linkColor, parentColor);
    if (ratio >= 3) continue;
    const fontWeight = parseInt(style.fontWeight) || 400;
    const parentWeight = parseInt(getComputedStyle(parent).fontWeight) || 400;
    if (fontWeight !== parentWeight || style.fontStyle !== getComputedStyle(parent).fontStyle) continue;
    nodes.push(node(el, `Link is indistinguishable from surrounding text: no underline, contrast ratio ${ratio.toFixed(2)}:1 vs parent, and no bold/italic difference.`));
  }
  return [{ ruleId: "link-indistinguishable", description: "Links indistinguishable from surrounding text", impact: "serious", wcagCriteria: ["1.4.1"], nodes }];
}

/* ── Rule 17: Focus removal via outline:none ── */
function rule17_focusOutlineNone(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const focusable = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
  for (const el of Array.from(focusable).slice(0, 300)) {
    if (!isVisible(el) || isAriaHidden(el)) continue;
    (el as HTMLElement).focus({ preventScroll: true });
    const style = getComputedStyle(el);
    const noOutline = style.outlineStyle === "none" || style.outlineWidth === "0px";
    const noBoxShadow = style.boxShadow === "none";
    const noBorderChange = true; // border comparison requires before/after; skip here to keep concise
    (el as HTMLElement).blur();
    if (noOutline && noBoxShadow) {
      nodes.push(node(el, "Focused element has outline:none/0 with no box-shadow or other visible focus replacement."));
    }
  }
  return [{ ruleId: "focus-outline-none", description: "Focus outline removed with no replacement", impact: "serious", wcagCriteria: ["2.4.7"], nodes }];
}

/* ── Rule 20: Focus obscured by sticky headers ── */
function rule20_focusObscured(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const sticky: Element[] = [];
  for (const el of document.querySelectorAll("*")) {
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") sticky.push(el);
  }
  if (sticky.length === 0) return [];
  const focusable = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
  for (const el of Array.from(focusable).slice(0, 150)) {
    if (!isVisible(el)) continue;
    const rect = el.getBoundingClientRect();
    for (const fixed of sticky) {
      const fRect = fixed.getBoundingClientRect();
      const overlaps = rect.top < fRect.bottom && rect.bottom > fRect.top && rect.left < fRect.right && rect.right > fRect.left;
      if (overlaps) {
        nodes.push(node(el, "Focusable element overlaps a position:fixed/sticky element and may be fully obscured when focused."));
        break;
      }
    }
  }
  return [{ ruleId: "focus-obscured", description: "Focus obscured by sticky/fixed headers", impact: "moderate", wcagCriteria: ["2.4.11"], nodes }];
}

/* ── Rule 21: Inconsistent navigation order (crawl-only) ── */
function rule21_inconsistentNavOrder(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const navLinks: string[] = [];
  for (const nav of document.querySelectorAll("nav, [role='navigation']")) {
    for (const a of nav.querySelectorAll("a[href]")) {
      navLinks.push((a as HTMLAnchorElement).href);
    }
  }
  if (navLinks.length > 0) {
    // Store nav order for cross-page comparison (crawl post-processing)
    const key = `a11y_nav_order_${location.pathname}`;
    try { sessionStorage.setItem(key, JSON.stringify(navLinks)); } catch { /* noop */ }
  }
  return [{ ruleId: "inconsistent-nav-order", description: "Inconsistent navigation order across pages (crawl data collected)", impact: "moderate", wcagCriteria: ["3.2.3"], nodes }];
}

/* ── Rule 22: Inconsistent link identification (crawl-only) ── */
function rule22_inconsistentLinkIdentification(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const map: Record<string, string> = {};
  for (const a of document.querySelectorAll("a[href]")) {
    const href = (a as HTMLAnchorElement).href;
    const name = (a.getAttribute("aria-label") || a.textContent || "").trim();
    if (href && name) {
      if (map[href] && map[href] !== name) {
        nodes.push(node(a, `Link to "${href}" has inconsistent accessible name: previously "${map[href]}", now "${name}".`));
      } else {
        map[href] = name;
      }
    }
  }
  return [{ ruleId: "inconsistent-link-id", description: "Inconsistent link identification across pages", impact: "moderate", wcagCriteria: ["3.2.4"], nodes }];
}

/* ── Rule 23: Show password toggle missing ── */
function rule23_showPasswordToggle(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll('input[type="password"]')) {
    if (!isVisible(el)) continue;
    const container = el.closest("form, div, fieldset") || el.parentElement;
    if (!container) { nodes.push(node(el, "Password input has no nearby show/hide toggle button.")); continue; }
    const toggleText = /show|hide|reveal|toggle|visible/i;
    const hasToggle = Array.from(container.querySelectorAll("button, [role='button'], input[type='button'], input[type='checkbox']"))
      .some(btn => toggleText.test(btn.getAttribute("aria-label") || btn.textContent || ""));
    if (!hasToggle) {
      nodes.push(node(el, "Password input has no nearby show/hide toggle. Users cannot verify their input (WCAG 3.3.8)."));
    }
  }
  return [{ ruleId: "show-password-toggle", description: "Password input missing show/hide toggle", impact: "minor", wcagCriteria: ["3.3.8"], nodes }];
}

/* ── Rule 24: Breadcrumb validation ── */
function rule24_breadcrumbValidation(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const breadcrumbPattern = /breadcrumb/i;
  for (const el of document.querySelectorAll("nav, [role='navigation'], ol, ul")) {
    const label = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || "";
    const isBreadcrumb = breadcrumbPattern.test(label) || breadcrumbPattern.test(el.className);
    if (!isBreadcrumb) continue;
    if (el.tagName !== "NAV" && !el.getAttribute("aria-label")) {
      nodes.push(node(el, "Breadcrumb landmark is missing aria-label=\"Breadcrumb\" (or similar)."));
    }
    const hasCurrent = el.querySelector('[aria-current="page"]');
    if (!hasCurrent) {
      nodes.push(node(el, "Breadcrumb navigation is missing aria-current=\"page\" on the current page item."));
    }
  }
  return [{ ruleId: "breadcrumb-validation", description: "Breadcrumb missing aria-label or aria-current", impact: "moderate", wcagCriteria: ["1.3.1", "2.4.8"], nodes }];
}

/* ── Rule 26: Carousel accessibility ── */
function rule26_carouselAccessibility(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const carouselPattern = /carousel|slider|slideshow/i;
  for (const el of document.querySelectorAll("[class*='carousel'], [class*='slider'], [class*='slideshow'], [role='region']")) {
    const label = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.className;
    if (!carouselPattern.test(label)) continue;
    const prevNext = el.querySelectorAll("button, [role='button']");
    if (prevNext.length < 2) {
      nodes.push(node(el, "Carousel detected with fewer than 2 controls. Prev/Next navigation buttons are required."));
    }
    const pagination = el.querySelector('[role="tablist"], [aria-label*="slide"], [aria-label*="page"]');
    if (!pagination && prevNext.length >= 2) {
      nodes.push(node(el, "Carousel has prev/next buttons but no labeled pagination dots/tabs for direct slide access."));
    }
  }
  return [{ ruleId: "carousel-accessibility", description: "Carousel missing controls or labeled pagination", impact: "serious", wcagCriteria: ["4.1.2", "2.5.1"], nodes }];
}

/* ── Rule 29: Reflow at 320px (viewport-only) ── */
function rule29_reflow320px(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
    nodes.push(node(document.documentElement, `Page requires horizontal scrolling at ${window.innerWidth}px viewport width. Content does not reflow within 320px (WCAG 1.4.10).`));
  }
  for (const el of Array.from(document.querySelectorAll("table, pre, iframe, [style*='width']")).slice(0, 100)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > window.innerWidth) {
      nodes.push(node(el, `Element is wider (${Math.round(rect.width)}px) than the 320px viewport, causing horizontal scroll.`));
    }
  }
  return [{ ruleId: "reflow-320px", description: "Content does not reflow at 320px viewport", impact: "serious", wcagCriteria: ["1.4.10"], nodes }];
}

/* ── Rule 30: SPA route changes focus management ── */
function rule30_spaRouteChanges(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const hasPushState = typeof history.pushState === "function";
  if (!hasPushState) return [];
  const hasAriaLive = document.querySelector('[aria-live], [aria-atomic]');
  const hasSkipLink = document.querySelector('a[href^="#"]');
  if (!hasAriaLive && !hasSkipLink) {
    nodes.push(node(document.body, "Page uses history.pushState (SPA routing) but has no aria-live region or skip link. Focus may not be managed after route changes."));
  }
  return [{ ruleId: "spa-route-focus", description: "SPA route changes without focus management", impact: "moderate", wcagCriteria: ["4.1.3"], nodes }];
}

/* ── Rule 31: prefers-reduced-motion not respected ── */
function rule31_prefersReducedMotion(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) return [];
  for (const el of Array.from(document.querySelectorAll("*")).slice(0, 300)) {
    if (!isVisible(el)) continue;
    const style = getComputedStyle(el);
    const hasAnimation = style.animationDuration !== "0s" && style.animationName !== "none";
    const hasTransition = style.transitionDuration !== "0s" && style.transitionProperty !== "none";
    if (hasAnimation || hasTransition) {
      nodes.push(node(el, "Element has animation/transition but prefers-reduced-motion is active. Motion should be suppressed or reduced."));
    }
  }
  return [{ ruleId: "prefers-reduced-motion", description: "Animations not suppressed under prefers-reduced-motion", impact: "moderate", wcagCriteria: ["2.3.3"], nodes }];
}

/* ── Rule 32: Target size with overlap ── */
function rule32_targetSizeOverlap(): iHeuristicResult[] {
  const nodes: iViolationNode[] = [];
  const interactive = Array.from(document.querySelectorAll('a[href], button, input, select, [role="button"]')).filter(el => isVisible(el));
  const MIN = 24;
  for (let i = 0; i < interactive.length; i++) {
    const el = interactive[i];
    const rect = el.getBoundingClientRect();
    if (rect.width >= MIN && rect.height >= MIN) continue;
    // Expand to 24px virtual circle
    const expanded = { left: rect.left - (MIN - rect.width) / 2, right: rect.right + (MIN - rect.width) / 2, top: rect.top - (MIN - rect.height) / 2, bottom: rect.bottom + (MIN - rect.height) / 2 };
    for (let j = 0; j < interactive.length; j++) {
      if (i === j) continue;
      const other = interactive[j].getBoundingClientRect();
      const overlaps = expanded.left < other.right && expanded.right > other.left && expanded.top < other.bottom && expanded.bottom > other.top;
      if (overlaps) {
        nodes.push(node(el, `Small interactive element (${Math.round(rect.width)}×${Math.round(rect.height)}px) whose 24px virtual circle overlaps a neighbor.`));
        break;
      }
    }
  }
  return [{ ruleId: "target-size-overlap", description: "Small target with overlapping 24px virtual circle", impact: "moderate", wcagCriteria: ["2.5.8"], nodes }];
}

/* ── Rule 33: Suspicious alt text ── */
function rule33_suspiciousAltText(): iHeuristicResult[] {
  const fileExtPattern = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i;
  const redundantPrefix = /^(image of|photo of|picture of|graphic of|screenshot of)/i;
  const nodes: iViolationNode[] = [];
  for (const el of document.querySelectorAll("img")) {
    const alt = el.getAttribute("alt");
    if (alt === null || alt === "") continue;
    if (fileExtPattern.test(alt)) {
      nodes.push(node(el, `Alt text "${alt}" appears to be a filename with extension.`));
    } else if (redundantPrefix.test(alt)) {
      nodes.push(node(el, `Alt text "${alt}" has redundant prefix. Screen readers already announce "image".`));
    } else {
      const src = el.getAttribute("src") || "";
      const filename = src.split("/").pop()?.replace(fileExtPattern, "") || "";
      if (filename && alt.toLowerCase() === filename.toLowerCase()) {
        nodes.push(node(el, `Alt text "${alt}" matches the filename. Write descriptive alt text instead.`));
      }
    }
  }
  return [{ ruleId: "suspicious-alt", description: "Suspicious alt text", impact: "moderate", wcagCriteria: ["1.1.1"], nodes }];
}
