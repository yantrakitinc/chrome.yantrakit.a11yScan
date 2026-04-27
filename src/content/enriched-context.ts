/**
 * Enriched context collection for violation nodes (F12).
 * Gathers DOM context, CSS context, framework hints, and file path guesses.
 */

import type { iEnrichedContext, iDomContext, iCssContext, iFrameworkHints, iFilePathGuess } from "@shared/types";

/** Collect enriched context for a list of CSS selectors */
export function collectEnrichedContext(selectors: string[]): Record<string, iEnrichedContext> {
  const result: Record<string, iEnrichedContext> = {};

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;

    result[selector] = {
      dom: getDomContext(el),
      css: getCssContext(el),
      framework: getFrameworkHints(el),
      filePathGuesses: getFilePathGuesses(el),
    };
  }

  return result;
}

function getDomContext(el: Element): iDomContext {
  const parent = el.parentElement;
  const siblings = parent
    ? Array.from(parent.children).slice(0, 5).map((s) => getSelector(s))
    : [];

  // Find nearest landmark
  let nearestLandmark = "";
  const landmarks = ["main", "nav", "header", "footer", "aside", "section", "article"];
  let cursor: Element | null = el;
  while (cursor) {
    if (landmarks.includes(cursor.tagName.toLowerCase()) || cursor.getAttribute("role")) {
      nearestLandmark = cursor.getAttribute("role") || cursor.tagName.toLowerCase();
      break;
    }
    cursor = cursor.parentElement;
  }

  // Find nearest heading
  let nearestHeading = "";
  const headingEl = el.closest("section, article, main, div")?.querySelector("h1, h2, h3, h4, h5, h6");
  if (headingEl) nearestHeading = headingEl.textContent?.trim().substring(0, 100) || "";

  return {
    parentSelector: parent ? getSelector(parent) : "",
    parentTagName: parent?.tagName.toLowerCase() || "",
    siblingSelectors: siblings,
    nearestLandmark,
    nearestHeading,
  };
}

function getCssContext(el: Element): iCssContext {
  const style = getComputedStyle(el);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontSize: style.fontSize,
    display: style.display,
    visibility: style.visibility,
    position: style.position,
  };
}

function getFrameworkHints(el: Element): iFrameworkHints {
  // React
  const reactFiber = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
  // Vue
  const vue = (el as unknown as Record<string, unknown>).__vue__;
  // Angular
  const ngAttr = Array.from(el.attributes).find((a) => a.name.startsWith("_ng") || a.name.startsWith("ng-"));

  const detected = reactFiber ? "React" : vue ? "Vue" : ngAttr ? "Angular" : null;

  // Component name
  let componentName: string | null = null;
  if (reactFiber) {
    const fiber = (el as unknown as Record<string, unknown>)[reactFiber] as Record<string, unknown> | undefined;
    if (fiber?.type && typeof fiber.type === "function") {
      componentName = (fiber.type as { name?: string }).name || null;
    }
  }

  // Test ID
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-test-id") || el.getAttribute("data-cy") || null;

  return { detected, componentName, testId };
}

function getFilePathGuesses(el: Element): iFilePathGuess[] {
  const guesses: iFilePathGuess[] = [];

  // Class-based guess
  const classes = Array.from(el.classList);
  for (const cls of classes) {
    if (cls.includes("__") || cls.includes("--")) {
      // BEM pattern → component name
      const component = cls.split("__")[0].split("--")[0];
      guesses.push({ source: `class: ${cls}`, guess: `components/${component}` });
      break;
    }
  }

  // data-component
  const dataComponent = el.getAttribute("data-component");
  if (dataComponent) {
    guesses.push({ source: `data-component: ${dataComponent}`, guess: `components/${dataComponent}` });
  }

  return guesses;
}

function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(c => !/[[\]:@!]/.test(c)).slice(0, 2).map(c => CSS.escape(c)).join(".");
  return classes ? `${tag}.${classes}` : tag;
}
