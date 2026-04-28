/**
 * Visual overlays rendered in Shadow DOM (F05).
 * Violation badges, tab order badges + lines, focus gap markers.
 */

import type { iViolation } from "@shared/types";

const SHADOW_HOST_ID = "a11y-scan-overlay-host";
const Z_INDEX = 2147483646;

const IMPACT_COLORS: Record<string, string> = {
  critical: "#ef4444",
  serious: "#f97316",
  moderate: "#eab308",
  minor: "#3b82f6",
};

/* ═══════════════════════════════════════════════════════════════════
   Shadow DOM Host
   ═══════════════════════════════════════════════════════════════════ */

function getOrCreateHost(): ShadowRoot {
  let host = document.getElementById(SHADOW_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = SHADOW_HOST_ID;
    host.style.cssText = `position:absolute;top:0;left:0;width:0;height:0;z-index:${Z_INDEX};pointer-events:none;`;
    document.body.appendChild(host);
    host.attachShadow({ mode: "open" });
  }
  return host.shadowRoot!;
}

function getContainer(id: string): HTMLDivElement {
  const shadow = getOrCreateHost();
  let container = shadow.getElementById(id) as HTMLDivElement;
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    shadow.appendChild(container);
  }
  return container;
}

function removeContainer(id: string): void {
  const shadow = document.getElementById(SHADOW_HOST_ID)?.shadowRoot;
  const container = shadow?.getElementById(id);
  if (container) container.remove();
}

/* ═══════════════════════════════════════════════════════════════════
   Violation Overlay
   ═══════════════════════════════════════════════════════════════════ */

export function showViolationOverlay(violations: iViolation[]): void {
  hideViolationOverlay();
  const container = getContainer("violation-overlay");

  let badgeIndex = 1;
  for (const v of violations) {
    const color = IMPACT_COLORS[v.impact] || IMPACT_COLORS.minor;
    for (const node of v.nodes) {
      const el = document.querySelector(node.selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      // Outline
      const outline = document.createElement("div");
      outline.style.cssText = `position:absolute;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;border:2px solid ${color};box-shadow:0 0 4px ${color}, inset 0 0 4px ${color};pointer-events:none;z-index:${Z_INDEX};`;
      container.appendChild(outline);

      // Badge — capture the index per-iteration so click handlers don't all
      // close over the final value of badgeIndex (which would make every badge
      // send the same — last — index when clicked).
      const myIndex = badgeIndex - 1;
      const badge = document.createElement("div");
      badge.textContent = String(badgeIndex);
      badge.style.cssText = `position:absolute;top:${rect.top + window.scrollY - 10}px;left:${rect.right + window.scrollX - 10}px;width:20px;height:20px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;z-index:${Z_INDEX + 1};box-shadow:0 1px 3px rgba(0,0,0,0.4);`;
      badge.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "VIOLATION_BADGE_CLICKED", payload: { index: myIndex } });
      });
      container.appendChild(badge);
      badgeIndex++;
    }
  }
}

export function hideViolationOverlay(): void {
  removeContainer("violation-overlay");
}

/* ═══════════════════════════════════════════════════════════════════
   Tab Order Overlay
   ═══════════════════════════════════════════════════════════════════ */

export function showTabOrderOverlay(): void {
  hideTabOrderOverlay();
  const container = getContainer("tab-order-overlay");

  const focusable = getFocusableElements();

  focusable.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    const badge = document.createElement("div");
    badge.textContent = String(i + 1);
    badge.style.cssText = `position:absolute;top:${y - 12}px;left:${x - 12}px;width:24px;height:24px;border-radius:50%;background:#1e1b4b;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:${Z_INDEX};border:2px solid #fff;box-shadow:0 0 0 1px #1e1b4b,0 2px 6px rgba(0,0,0,0.5);`;
    container.appendChild(badge);
  });

}

export function hideTabOrderOverlay(): void {
  removeContainer("tab-order-overlay");
}

/* ═══════════════════════════════════════════════════════════════════
   Focus Gap Overlay
   ═══════════════════════════════════════════════════════════════════ */

export function showFocusGapOverlay(): void {
  hideFocusGapOverlay();
  const container = getContainer("focus-gap-overlay");

  const interactive = document.querySelectorAll(
    'a[href], button, input, select, textarea, [onclick], [role="button"], [role="link"]'
  );
  const focusable = new Set(getFocusableElements());

  for (const el of Array.from(interactive)) {
    if (focusable.has(el as HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    // Determine reason for focus gap
    const htmlEl = el as HTMLElement;
    let reason = "Not keyboard reachable";
    if (htmlEl.tabIndex === -1) reason = "tabindex=\"-1\" blocks keyboard access";
    else if (getComputedStyle(el).display === "none") reason = "display:none — not in tab order";
    else if (getComputedStyle(el).visibility === "hidden") reason = "visibility:hidden — not in tab order";
    else if (el.getAttribute("disabled") !== null) reason = "disabled attribute";

    const marker = document.createElement("div");
    marker.style.cssText = `position:absolute;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;border:2px dashed #ef4444;pointer-events:none;z-index:${Z_INDEX};`;

    const tooltip = document.createElement("div");
    tooltip.textContent = reason;
    tooltip.style.cssText = `position:absolute;bottom:calc(100% + 4px);left:0;background:#1f2937;color:#fff;font-size:10px;font-family:monospace;white-space:nowrap;padding:2px 6px;border-radius:3px;pointer-events:none;z-index:${Z_INDEX + 1};`;
    marker.appendChild(tooltip);

    container.appendChild(marker);
  }
}

export function hideFocusGapOverlay(): void {
  removeContainer("focus-gap-overlay");
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getFocusableElements(): HTMLElement[] {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const all = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
  return all.filter((el) => {
    // Exclude elements explicitly opted out of the tab order. A native
    // focusable element with tabindex="-1" (e.g. `<button tabindex="-1">`)
    // is matched by the selector above (since the button selector doesn't
    // filter by tabindex) but the user CANNOT keyboard-tab to it. Without
    // this filter the focus-gap detector treats those buttons as reachable
    // and never flags them.
    if (el.getAttribute("tabindex") === "-1") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }).sort((a, b) => {
    const aIdx = a.tabIndex || 0;
    const bIdx = b.tabIndex || 0;
    if (aIdx > 0 && bIdx > 0) return aIdx - bIdx;
    if (aIdx > 0) return -1;
    if (bIdx > 0) return 1;
    return 0; // DOM order preserved by querySelectorAll
  });
}

/** Destroy all overlays */
export function destroyOverlay(): void {
  const host = document.getElementById(SHADOW_HOST_ID);
  if (host) host.remove();
}

/* ═══════════════════════════════════════════════════════════════════
   Scroll-based overlay recalculation (F05-AC7)
   ═══════════════════════════════════════════════════════════════════ */

let scrollRecalcTimer: ReturnType<typeof setTimeout> | null = null;

function onScroll(): void {
  if (scrollRecalcTimer) clearTimeout(scrollRecalcTimer);
  scrollRecalcTimer = setTimeout(() => {
    const shadow = document.getElementById(SHADOW_HOST_ID)?.shadowRoot;
    if (!shadow) return;
    if (shadow.getElementById("tab-order-overlay")) {
      showTabOrderOverlay();
    }
    if (shadow.getElementById("focus-gap-overlay")) {
      showFocusGapOverlay();
    }
    if (shadow.getElementById("violation-overlay")) {
      // Violation overlay uses absolute coords already; rebuild to re-query rects
      // Callers who show violations pass violations array — we cannot rebuild without it here.
      // The violation overlay uses absolute positioning (scrollY offset) so it stays correct.
    }
  }, 150);
}

document.addEventListener("scroll", onScroll, { passive: true });
