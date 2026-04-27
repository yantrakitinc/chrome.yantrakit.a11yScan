/**
 * Screen Reader reading order analysis (F15).
 * Walks the DOM in the order a screen reader encounters elements.
 */

import type { iScreenReaderElement, iNameSource } from "@shared/types";

/** Analyze reading order, optionally scoped to a subtree */
export function analyzeReadingOrder(scopeSelector?: string): iScreenReaderElement[] {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
  if (!root) return [];

  const elements: iScreenReaderElement[] = [];
  let index = 0;

  walkDOM(root, (el) => {
    // Skip hidden elements
    if (el instanceof HTMLElement) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false; // skip subtree
      if (el.getAttribute("aria-hidden") === "true") return false; // skip subtree
    }

    // Only process elements with semantic meaning
    if (el instanceof HTMLElement && hasSemanticRole(el)) {
      index++;
      const { name, source } = getAccessibleNameWithSource(el);
      elements.push({
        index,
        selector: getSelector(el),
        accessibleName: name,
        nameSource: source,
        role: getRole(el),
        states: getStates(el),
        level: getHeadingLevel(el),
      });
    }

    return true; // continue to children
  });

  return elements;
}

/** Walk DOM tree in reading order, respecting aria-owns */
function walkDOM(node: Element | Node, callback: (el: Element) => boolean): void {
  const children = node instanceof Element ? getOrderedChildren(node) : Array.from(node.childNodes);

  for (const child of children) {
    if (!(child instanceof Element)) continue;
    const shouldContinue = callback(child);
    if (shouldContinue) {
      walkDOM(child, callback);
    }
  }
}

/** Get children in reading order, respecting aria-owns */
function getOrderedChildren(el: Element): Element[] {
  const children = Array.from(el.children);
  const ariaOwns = el.getAttribute("aria-owns");
  if (!ariaOwns) return children;

  const ownedIds = ariaOwns.split(" ").filter(Boolean);
  const ownedEls = ownedIds.map((id) => document.getElementById(id)).filter(Boolean) as Element[];
  return [...children, ...ownedEls];
}

/** Check if element has a role worth announcing */
function hasSemanticRole(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");

  // Explicit ARIA roles
  if (role) return true;

  // Semantic HTML elements
  const semantic = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "button", "input", "select", "textarea",
    "img", "video", "audio", "table", "form",
    "nav", "main", "header", "footer", "aside", "section", "article",
    "ul", "ol", "li", "dl", "dt", "dd",
    "figure", "figcaption", "details", "summary",
  ];
  if (semantic.includes(tag)) return true;

  // Text-only elements with content
  if (["p", "span", "div", "label"].includes(tag)) {
    const text = el.textContent?.trim();
    if (text && text.length > 0 && el.children.length === 0) return true;
  }

  return false;
}

function getRole(el: HTMLElement): string {
  const role = el.getAttribute("role");
  if (role) return role;

  const tag = el.tagName.toLowerCase();
  const implicitRoles: Record<string, string> = {
    a: "link", button: "button", input: getInputRole(el), select: "combobox",
    textarea: "textbox", img: "img", nav: "navigation", main: "main",
    header: "banner", footer: "contentinfo", aside: "complementary",
    section: "region", article: "article", form: "form",
    h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
    ul: "list", ol: "list", li: "listitem", table: "table",
    details: "group", summary: "button",
  };
  return implicitRoles[tag] || "text";
}

function getInputRole(el: HTMLElement): string {
  const type = (el as HTMLInputElement).type;
  const roles: Record<string, string> = {
    text: "textbox", email: "textbox", password: "textbox", search: "searchbox",
    tel: "textbox", url: "textbox", number: "spinbutton",
    checkbox: "checkbox", radio: "radio", range: "slider",
    button: "button", submit: "button", reset: "button",
  };
  return roles[type] || "textbox";
}

function getAccessibleNameWithSource(el: HTMLElement): { name: string; source: iNameSource } {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return { name: ariaLabel, source: "aria-label" };

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const texts = labelledBy.split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (texts.length > 0) return { name: texts.join(" "), source: "aria-labelledby" };
  }

  if (el instanceof HTMLImageElement && el.alt) return { name: el.alt, source: "alt" };

  if (el instanceof HTMLInputElement && el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return { name: label.textContent?.trim() || "", source: "label" };
  }

  const title = el.getAttribute("title");
  if (title) return { name: title, source: "title" };

  // Check for sr-only / visually hidden text
  const srOnlyEl = el.querySelector('.sr-only, .visually-hidden, [class*="sr-only"], [class*="visually-hidden"]');
  if (srOnlyEl && srOnlyEl.textContent?.trim()) {
    return { name: srOnlyEl.textContent.trim().substring(0, 100), source: "sr-only" };
  }

  // Check for clip/clip-path hidden children
  for (const child of el.children) {
    if (child instanceof HTMLElement) {
      const style = getComputedStyle(child);
      if (
        (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") &&
        style.position === "absolute" &&
        child.textContent?.trim()
      ) {
        return { name: child.textContent.trim().substring(0, 100), source: "sr-only" };
      }
    }
  }

  return { name: el.textContent?.trim().substring(0, 100) || "", source: "contents" };
}

function getStates(el: HTMLElement): string[] {
  const states: string[] = [];
  if (el.getAttribute("aria-expanded") === "true") states.push("expanded");
  if (el.getAttribute("aria-expanded") === "false") states.push("collapsed");
  if (el.getAttribute("aria-checked") === "true") states.push("checked");
  if (el.getAttribute("aria-selected") === "true") states.push("selected");
  if (el.getAttribute("aria-pressed") === "true") states.push("pressed");
  if (el.getAttribute("aria-required") === "true" || el.hasAttribute("required")) states.push("required");
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") states.push("disabled");
  if (el.getAttribute("aria-current")) states.push("current");
  return states;
}

function getHeadingLevel(el: HTMLElement): number | undefined {
  const tag = el.tagName.toLowerCase();
  if (tag.match(/^h[1-6]$/)) return parseInt(tag[1]);
  const level = el.getAttribute("aria-level");
  if (level) return parseInt(level);
  return undefined;
}

function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let depth = 0; cur && cur !== document.body && depth < 4; depth++) {
    const tag = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const par: Element | null = cur.parentElement;
    if (par) {
      const sameTag = Array.from(par.children) as Element[];
      const sibs = sameTag.filter((c) => c.tagName === cur!.tagName);
      if (sibs.length > 1) {
        const idx = sibs.indexOf(cur!) + 1;
        parts.unshift(`${tag}:nth-of-type(${idx})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }
    cur = par;
  }
  return parts.join(" > ");
}
