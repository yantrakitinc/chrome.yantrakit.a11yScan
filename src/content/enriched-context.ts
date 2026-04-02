/**
 * Collects enriched context for violation nodes — DOM context, CSS styles,
 * framework hints, and file path guesses. Used for AI-agent-ready JSON export.
 */

import type { iEnrichedContext, iDomContext, iCssContext, iFrameworkHints, iFilePathGuess } from '@shared/types';

/**
 * Collects enriched context for an element matched by selector.
 * Returns null if the element cannot be found.
 */
export function collectEnrichedContext(selector: string): iEnrichedContext | null {
  let el: Element | null = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return null;
  }
  if (!el) return null;

  return {
    dom: collectDomContext(el),
    css: collectCssContext(el),
    framework: detectFramework(el),
    filePathGuesses: guessFilePaths(el),
  };
}

/**
 * Collects enriched context for multiple selectors in one call.
 */
export function collectBatchEnrichedContext(selectors: string[]): Record<string, iEnrichedContext | null> {
  const result: Record<string, iEnrichedContext | null> = {};
  for (const selector of selectors) {
    result[selector] = collectEnrichedContext(selector);
  }
  return result;
}

function collectDomContext(el: Element): iDomContext {
  const parent = el.parentElement;

  const siblingSelectors: string[] = [];
  if (parent) {
    for (const child of Array.from(parent.children)) {
      if (child !== el) {
        siblingSelectors.push(buildSimpleSelector(child));
        if (siblingSelectors.length >= 5) break;
      }
    }
  }

  let nearestLandmark = '';
  let current: Element | null = el.parentElement;
  while (current) {
    const role = current.getAttribute('role');
    if (role && ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'].includes(role)) {
      nearestLandmark = `[role="${role}"]`;
      break;
    }
    const tag = current.tagName.toLowerCase();
    if (['header', 'nav', 'main', 'aside', 'footer'].includes(tag)) {
      nearestLandmark = tag;
      break;
    }
    current = current.parentElement;
  }

  let nearestHeading = '';
  current = el;
  while (current) {
    const prev = current.previousElementSibling;
    if (prev && /^H[1-6]$/.test(prev.tagName)) {
      nearestHeading = `${prev.tagName.toLowerCase()}: ${(prev.textContent || '').trim().slice(0, 80)}`;
      break;
    }
    current = current.parentElement;
    if (current && /^H[1-6]$/.test(current.tagName)) {
      nearestHeading = `${current.tagName.toLowerCase()}: ${(current.textContent || '').trim().slice(0, 80)}`;
      break;
    }
  }

  return {
    parentSelector: parent ? buildSimpleSelector(parent) : '',
    parentTagName: parent ? parent.tagName.toLowerCase() : '',
    siblingSelectors,
    nearestLandmark,
    nearestHeading,
  };
}

function collectCssContext(el: Element): iCssContext {
  const computed = window.getComputedStyle(el);
  return {
    color: computed.color,
    backgroundColor: computed.backgroundColor,
    fontSize: computed.fontSize,
    display: computed.display,
    visibility: computed.visibility,
    position: computed.position,
  };
}

function detectFramework(el: Element): iFrameworkHints {
  const reactFiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  const isReact = !!reactFiberKey || document.querySelector('[data-reactroot], [id="__next"]') !== null;
  const isVue = !!(el as any).__vue__ || !!(el as any).__vue_app__ || document.querySelector('[data-v-]') !== null;
  const isAngular = !!document.querySelector('[ng-version], [_nghost]') || Object.keys(el).some((k) => k.startsWith('__ng'));

  let detected: string | null = null;
  if (isReact) detected = 'react';
  else if (isVue) detected = 'vue';
  else if (isAngular) detected = 'angular';

  let componentName: string | null = null;
  if (reactFiberKey) {
    try {
      let fiber = (el as any)[reactFiberKey];
      while (fiber) {
        if (fiber.type && typeof fiber.type === 'function') {
          componentName = fiber.type.displayName || fiber.type.name || null;
          if (componentName) break;
        }
        fiber = fiber.return;
      }
    } catch { /* access denied */ }
  }

  const testId = el.getAttribute('data-testid')
    || el.getAttribute('data-test-id')
    || el.getAttribute('data-cy')
    || el.getAttribute('data-test')
    || null;

  return { detected, componentName, testId };
}

function guessFilePaths(el: Element): iFilePathGuess[] {
  const guesses: iFilePathGuess[] = [];

  const classes = Array.from(el.classList);
  for (const cls of classes) {
    const bemMatch = cls.match(/^([A-Z][a-zA-Z]+)(?:__|--)/);
    if (bemMatch) {
      guesses.push({
        source: `class="${cls}"`,
        guess: `components/${bemMatch[1]}/${bemMatch[1]}.{tsx,jsx,vue}`,
      });
    }
    const moduleMatch = cls.match(/^([A-Z][a-zA-Z]+)_\w+__\w+/);
    if (moduleMatch) {
      guesses.push({
        source: `class="${cls}"`,
        guess: `components/${moduleMatch[1]}/${moduleMatch[1]}.module.{css,scss}`,
      });
    }
  }

  const dataComponent = el.getAttribute('data-component');
  if (dataComponent) {
    guesses.push({
      source: `data-component="${dataComponent}"`,
      guess: `components/${dataComponent}/${dataComponent}.{tsx,jsx,vue}`,
    });
  }

  const id = el.id;
  if (id) {
    const idPascal = id.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
    if (/^[A-Z]/.test(idPascal)) {
      guesses.push({
        source: `id="${id}"`,
        guess: `components/${idPascal}/${idPascal}.{tsx,jsx,vue}`,
      });
    }
  }

  return guesses.slice(0, 5);
}

function buildSimpleSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = Array.from(el.classList).slice(0, 2).join('.');
  if (cls) return `${tag}.${cls}`;
  return tag;
}
