/**
 * Pure helpers — speech-text composition, status pill, row HTML, role-to-class
 * map. No DOM access, no shared state.
 */

import type { iScreenReaderElement } from "@shared/types";
import { escHtml } from "@shared/utils";

/**
 * Compose the spoken-text representation of a single screen-reader element:
 * `<role>, <accessibleName>[, <state1>, <state2>, …]`.
 */
export function elementToSpeechText(el: iScreenReaderElement): string {
  return `${el.role}, ${el.accessibleName}${el.states.length > 0 ? ", " + el.states.join(", ") : ""}`;
}

/**
 * Compose the SR status-bar label HTML for the current play state:
 * - idle: "<count> elements in [scope|reading order]"
 * - playing/paused: counter ("Speaking 3" / "Playing 3 of 10") with amber
 * - complete: green "Complete" pill
 */
export function srStatusLabelHtml(s: {
  playState: "idle" | "playing" | "paused" | "complete";
  playIndex: number;
  singleSpeakIndex: number | null;
  elementCount: number;
  scoped: boolean;
}): string {
  const countLabel = s.scoped
    ? `${s.elementCount} elements in scope`
    : `${s.elementCount} elements in reading order`;
  if (s.playState === "complete") return '<span style="color:var(--ds-green-700);font-weight:700">Complete</span>';
  if (s.playState === "playing") {
    const inner = s.singleSpeakIndex !== null
      ? `Speaking element ${s.singleSpeakIndex + 1}`
      : `Playing ${s.playIndex + 1} of ${s.elementCount}`;
    return `<span style="color:var(--ds-amber-800);font-weight:700">${inner}</span>`;
  }
  if (s.playState === "paused") {
    const inner = s.singleSpeakIndex !== null
      ? `Paused element ${s.singleSpeakIndex + 1}`
      : `Paused at ${s.playIndex + 1} of ${s.elementCount}`;
    return `<span style="color:var(--ds-amber-800);font-weight:700">${inner}</span>`;
  }
  return countLabel;
}

/**
 * Compose the spoken text for a container element + its scoped children.
 * The scoped reading order returned by the content script includes the
 * container itself as the first item; we filter it out and join the
 * remaining children with ". " separators. When the container has no
 * children (or only itself), returns the bare container text.
 */
export function composeContainerSpeechText(
  container: iScreenReaderElement,
  scoped: iScreenReaderElement[],
): string {
  const base = elementToSpeechText(container);
  const childTexts = scoped
    .filter((c) => c.selector !== container.selector)
    .map((c) => elementToSpeechText(c));
  if (childTexts.length === 0) return base;
  return `${base}. ${childTexts.join(". ")}.`;
}

/**
 * Render one row of the SR reading-order list. `isHighlighted` is set by
 * the caller based on play / single-speak / click state — keeping it a
 * parameter lets tests exercise both branches without touching state.
 */
export function renderSrRowHtml(el: iScreenReaderElement, isHighlighted: boolean): string {
  const roleClass = roleClassFor(el.role);
  const sourceLabel = el.nameSource === "contents" ? "text" : el.nameSource;
  const rowIdx = el.index - 1;
  const escapedName = escHtml(el.accessibleName);

  return `
    <div class="ds-row sr-row${isHighlighted ? " ds-row--active" : ""}" role="button" tabindex="0" aria-label="Highlight ${escHtml(el.role)}: ${escapedName}" data-selector="${escHtml(el.selector)}" data-index="${rowIdx}">
      <span class="ds-row__index">${el.index}</span>
      <span class="ds-badge ${roleClass} ds-badge--role-min50">${escHtml(el.role)}</span>
      <span class="ds-row__label">${escapedName}</span>
      <span class="ds-badge ds-badge--source">${escHtml(sourceLabel)}</span>
      ${el.states.map((s) => `<span class="ds-badge ds-badge--state">${escHtml(s)}</span>`).join("")}
      <button type="button" class="ds-btn ds-btn--icon ds-btn--ghost sr-speak" data-row-index="${rowIdx}" aria-label="Speak: ${escapedName}">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4.5h2l3-2.5v8L3 7.5H1V4.5z"/><path d="M8.5 3.5c1 .7 1.5 1.8 1.5 2.5s-.5 1.8-1.5 2.5"/></svg>
      </button>
    </div>
  `;
}

/**
 * Map an ARIA role / implicit role to the design-token CSS class for its
 * badge. Landmarks share a single class; everything unmapped uses default.
 */
export function roleClassFor(role: string): string {
  const map: Record<string, string> = {
    link: "ds-badge--role-link",
    button: "ds-badge--role-button",
    heading: "ds-badge--role-heading",
    img: "ds-badge--role-img",
    textbox: "ds-badge--role-textbox",
    navigation: "ds-badge--role-landmark",
    banner: "ds-badge--role-landmark",
    contentinfo: "ds-badge--role-landmark",
    main: "ds-badge--role-landmark",
    region: "ds-badge--role-landmark",
    complementary: "ds-badge--role-landmark",
  };
  return map[role] || "ds-badge--role-default";
}

/** Container roles that get speak-the-whole-subtree treatment. */
export const CONTAINER_ROLES = new Set([
  "navigation", "banner", "contentinfo", "complementary",
  "region", "article", "form", "list", "group", "main",
]);
