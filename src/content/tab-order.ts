/**
 * Computes the page's tab order and detects interactive elements
 * that are not reachable via keyboard (focus gaps).
 */

import type { iTabOrderEntry, iFocusGapEntry } from './overlay';

/* ------------------------------------------------------------------ */
/*  Focusable-element selectors                                        */
/* ------------------------------------------------------------------ */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  'details',
  'summary',
].join(',');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the element is effectively hidden from the user.
 */
function isHidden(el: Element): boolean {
  if ((el as HTMLElement).offsetParent === null && getComputedStyle(el).position !== 'fixed') {
    // offsetParent is null for hidden elements (except position:fixed)
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }
  }

  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return true;
  }

  if (el.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  // Walk up to check ancestors for aria-hidden
  let parent = el.parentElement;
  while (parent) {
    if (parent.getAttribute('aria-hidden') === 'true') return true;
    const ps = getComputedStyle(parent);
    if (ps.display === 'none' || ps.visibility === 'hidden') return true;
    parent = parent.parentElement;
  }

  return false;
}

/**
 * Returns true if the element should be excluded from focusable lists.
 */
function isDisabledOrHiddenInput(el: Element): boolean {
  if ((el as HTMLInputElement).disabled) return true;
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') return true;
  return false;
}

/**
 * Builds a CSS selector string that uniquely identifies the element.
 */
function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith('__'))
    .slice(0, 2)
    .map((c) => `.${CSS.escape(c)}`)
    .join('');

  const parent = el.parentElement;
  if (!parent) return tag + classes;

  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (siblings.length > 1) {
    const idx = siblings.indexOf(el) + 1;
    return `${buildSelector(parent)} > ${tag}${classes}:nth-of-type(${idx})`;
  }

  return `${buildSelector(parent)} > ${tag}${classes}`;
}

/**
 * Reads the effective tabindex of an element.
 * Returns 0 for natively focusable elements without an explicit tabindex.
 */
function getTabindex(el: Element): number {
  const attr = el.getAttribute('tabindex');
  if (attr !== null) return parseInt(attr, 10);

  // Natively focusable elements default to 0
  const nativeFocusable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'];
  if (nativeFocusable.includes(el.tagName)) return 0;

  // <details> is not itself focusable (summary inside is)
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Computes the full tab order of the page, following the browser's
 * tab-navigation algorithm (positive tabindex first, then DOM order).
 */
export function computeTabOrder(): iTabOrderEntry[] {
  const all = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR));

  const focusable: { el: Element; tabindex: number }[] = [];
  const negativeTabindex: { el: Element; tabindex: number }[] = [];

  for (const el of all) {
    if (isDisabledOrHiddenInput(el)) continue;
    if (isHidden(el)) continue;

    const ti = getTabindex(el);

    if (ti < 0) {
      negativeTabindex.push({ el, tabindex: ti });
    } else {
      focusable.push({ el, tabindex: ti });
    }
  }

  // Group A: positive tabindex (sorted ascending, DOM order within same value)
  const positive = focusable
    .filter((f) => f.tabindex > 0)
    .sort((a, b) => a.tabindex - b.tabindex);

  // Group B: tabindex=0 or no tabindex (DOM order)
  const zero = focusable.filter((f) => f.tabindex === 0);

  // Combine in tab-navigation order
  const ordered = [...positive, ...zero];

  const result: iTabOrderEntry[] = [];

  // Numbered entries (1-based)
  ordered.forEach((item, i) => {
    result.push({
      element: item.el,
      index: i + 1,
      tabindex: item.tabindex,
      selector: buildSelector(item.el),
      tagName: item.el.tagName.toLowerCase(),
    });
  });

  // Append tabindex="-1" elements (index = -1)
  for (const item of negativeTabindex) {
    result.push({
      element: item.el,
      index: -1,
      tabindex: item.tabindex,
      selector: buildSelector(item.el),
      tagName: item.el.tagName.toLowerCase(),
    });
  }

  return result;
}

/**
 * Detects interactive elements that cannot be reached via keyboard navigation.
 * These are elements that look/act interactive but lack proper focus support.
 */
export function detectFocusGaps(): iFocusGapEntry[] {
  const INTERACTIVE_SELECTOR = [
    '[onclick]',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
  ].join(',');

  const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR));

  // Also check for elements with cursor:pointer
  const allElements = document.querySelectorAll('body *');
  for (const el of allElements) {
    const style = getComputedStyle(el);
    if (style.cursor === 'pointer' && !candidates.includes(el)) {
      candidates.push(el);
    }
  }

  const gaps: iFocusGapEntry[] = [];

  for (const el of candidates) {
    if (isHidden(el)) continue;

    // Check if element is already properly focusable
    if (isNativelyFocusable(el)) continue;

    const tabindexAttr = el.getAttribute('tabindex');
    if (tabindexAttr !== null && parseInt(tabindexAttr, 10) >= 0) continue;

    const reason = buildGapReason(el);
    if (!reason) continue;

    gaps.push({
      element: el,
      reason,
      selector: buildSelector(el),
    });
  }

  return gaps;
}

/**
 * Returns true if the element is natively focusable without a tabindex.
 */
function isNativelyFocusable(el: Element): boolean {
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
    return !(el as HTMLInputElement).disabled;
  }
  if (tag === 'A' && el.hasAttribute('href')) return true;
  if (tag === 'SUMMARY') return true;
  return false;
}

/**
 * Builds a human-readable reason string for why the element is a focus gap.
 */
function buildGapReason(el: Element): string {
  const parts: string[] = [];

  if (el.hasAttribute('onclick')) {
    parts.push('has onclick handler');
  }

  const role = el.getAttribute('role');
  if (role === 'button') parts.push('has role="button"');
  else if (role === 'link') parts.push('has role="link"');
  else if (role === 'tab') parts.push('has role="tab"');
  else if (role === 'menuitem') parts.push('has role="menuitem"');

  const style = getComputedStyle(el);
  if (style.cursor === 'pointer' && parts.length === 0) {
    parts.push('has cursor:pointer');
  }

  if (parts.length === 0) return '';

  return `${parts.join(', ')} but is not keyboard focusable`;
}
