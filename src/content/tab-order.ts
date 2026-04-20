/**
 * Tab order analysis and focus gap detection (F16).
 */

import type { iTabOrderElement, iFocusGap, iFocusIndicator, iKeyboardTrap, iSkipLink } from "@shared/types";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
const INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, [onclick], [role="button"], [role="link"], [role="menuitem"]';

/** Get all focusable elements in tab order */
export function getTabOrder(): iTabOrderElement[] {
  const all = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  const visible = all.filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });

  // Sort: positive tabindex first (ascending), then natural DOM order (tabindex 0 or unset)
  const positive = visible.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  const natural = visible.filter((el) => el.tabIndex <= 0 && el.tabIndex !== -1);
  const ordered = [...positive, ...natural];

  return ordered.map((el, i) => ({
    index: i + 1,
    selector: getSelector(el),
    role: el.getAttribute("role") || el.tagName.toLowerCase(),
    accessibleName: getAccessibleName(el),
    tabindex: el.hasAttribute("tabindex") ? el.tabIndex : null,
    hasFocusIndicator: checkFocusIndicator(el),
  }));
}

/** Get interactive elements not in the tab order */
export function getFocusGaps(): iFocusGap[] {
  const interactive = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR)) as HTMLElement[];
  const focusableSet = new Set(
    Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && (el as HTMLElement).tabIndex !== -1;
    })
  );

  const gaps: iFocusGap[] = [];
  for (const el of interactive) {
    if (focusableSet.has(el)) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    let reason = "Not focusable";
    if (el.hasAttribute("disabled")) reason = "Element is disabled";
    else if (el.getAttribute("aria-hidden") === "true") reason = "aria-hidden=\"true\" on element or ancestor";
    else if (el.tabIndex === -1) reason = "tabindex=\"-1\" removes from tab order";
    else if (!el.hasAttribute("tabindex") && el.tagName === "DIV") reason = "div with onclick handler but no role=\"button\" and no tabindex";
    else if (!el.hasAttribute("tabindex") && el.tagName === "SPAN") reason = "Click handler on span with no keyboard equivalent";

    gaps.push({
      selector: getSelector(el),
      role: el.getAttribute("role") || el.tagName.toLowerCase(),
      reason,
    });
  }
  return gaps;
}

/** Check if an element has a visible focus indicator */
function checkFocusIndicator(el: HTMLElement): boolean {
  try {
    const blurOutline = getComputedStyle(el).outline;
    const blurBoxShadow = getComputedStyle(el).boxShadow;
    const blurBorder = getComputedStyle(el).border;

    el.focus();
    const focusOutline = getComputedStyle(el).outline;
    const focusBoxShadow = getComputedStyle(el).boxShadow;
    const focusBorder = getComputedStyle(el).border;
    el.blur();

    return (
      focusOutline !== blurOutline ||
      focusBoxShadow !== blurBoxShadow ||
      focusBorder !== blurBorder
    );
  } catch {
    return true; // assume yes if we can't check
  }
}

/** Build a CSS selector for an element */
function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(c => !/[[\]:@!]/.test(c)).slice(0, 2).map(c => CSS.escape(c)).join(".");
  return classes ? `${tag}.${classes}` : tag;
}

/** Compute accessible name (simplified) */
function getAccessibleName(el: HTMLElement): string {
  // aria-label takes priority
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(" ");
    const texts = ids.map((id) => document.getElementById(id)?.textContent?.trim() || "").filter(Boolean);
    if (texts.length > 0) return texts.join(" ");
  }

  // <label> for inputs
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || "";
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.textContent?.trim() || "";
  }

  // alt for images
  if (el instanceof HTMLImageElement) return el.alt || "";

  // title
  const title = el.getAttribute("title");
  if (title) return title;

  // Text content
  return el.textContent?.trim().substring(0, 100) || "";
}

/** Detect focus indicators — per-element check for visible :focus styles */
export function detectFocusIndicators(): iFocusIndicator[] {
  const all = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  const visible = all.filter((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  });

  return visible.map((el) => {
    try {
      const blurOutline = getComputedStyle(el).outline;
      const blurBoxShadow = getComputedStyle(el).boxShadow;
      const blurBorder = getComputedStyle(el).border;
      const blurBg = getComputedStyle(el).backgroundColor;

      el.focus();
      const focusOutline = getComputedStyle(el).outline;
      const focusBoxShadow = getComputedStyle(el).boxShadow;
      const focusBorder = getComputedStyle(el).border;
      const focusBg = getComputedStyle(el).backgroundColor;
      el.blur();

      let indicatorType: string | undefined;
      if (focusOutline !== blurOutline) indicatorType = "outline";
      else if (focusBoxShadow !== blurBoxShadow) indicatorType = "box-shadow";
      else if (focusBorder !== blurBorder) indicatorType = "border";
      else if (focusBg !== blurBg) indicatorType = "background";

      return {
        selector: getSelector(el),
        hasIndicator: !!indicatorType,
        indicatorType,
      };
    } catch {
      return { selector: getSelector(el), hasIndicator: true };
    }
  });
}

/** Detect keyboard traps — elements where Tab cannot move focus away */
export function detectKeyboardTraps(): iKeyboardTrap[] {
  const traps: iKeyboardTrap[] = [];
  const all = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  const visible = all.filter((el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && el.tabIndex !== -1;
  });

  for (const el of visible) {
    try {
      el.focus();
      if (document.activeElement !== el) continue;
      // Simulate Tab by dispatching keydown
      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      const prevented = !el.dispatchEvent(event);
      // If the event was prevented AND focus didn't move, it's a trap
      if (prevented && document.activeElement === el) {
        traps.push({
          selector: getSelector(el),
          description: "Focus trapped — Tab key is prevented from moving focus away from this element.",
        });
      }
      el.blur();
    } catch {
      // Skip elements that can't be focused
    }
  }
  return traps;
}

/** Detect skip links — checks for skip-to-content navigation patterns */
export function detectSkipLinks(): iSkipLink[] {
  const links: iSkipLink[] = [];
  const candidates = document.querySelectorAll('a[href^="#"]');

  for (const el of candidates) {
    const text = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase().trim();
    const href = el.getAttribute("href") || "";
    const isSkipPattern = text.includes("skip") || text.includes("jump to") || text.includes("go to main");

    if (isSkipPattern && href.startsWith("#") && href.length > 1) {
      const targetId = href.substring(1);
      const targetEl = document.getElementById(targetId);
      links.push({
        selector: getSelector(el),
        target: href,
        targetExists: targetEl !== null,
      });
    }
  }

  // If no skip links found, check if page has a main landmark (implicit skip target)
  if (links.length === 0) {
    const hasMain = document.querySelector('main, [role="main"]');
    if (hasMain) {
      // Page has main landmark but no skip link — not necessarily an issue but useful data
    }
  }

  return links;
}
