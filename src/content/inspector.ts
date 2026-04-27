/**
 * Accessibility Inspector — hover to inspect (F20).
 * Shows a floating tooltip with a11y properties for the hovered element.
 */

import type { iInspectorData } from "@shared/types";
import { escHtml, buildElementSelector } from "@shared/utils";
import { lastScanViolations } from "./scan-state";

let active = false;
let tooltip: HTMLElement | null = null;
let pinned = false;
let pinnedElement: Element | null = null;
let currentHighlight: HTMLElement | null = null;

const TOOLTIP_STYLES = `
  position: fixed;
  z-index: 2147483647;
  max-width: 320px;
  padding: 10px 14px;
  background: #1e1e2e;
  color: #e8e8f0;
  border: 1px solid #3a3a5c;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.45);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  pointer-events: none;
`;

export function enterInspectMode(): void {
  if (active) return;
  active = true;
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown);
}

export function exitInspectMode(): void {
  active = false;
  pinned = false;
  pinnedElement = null;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown);
  removeTooltip();
  removeHighlight();
}

function onMouseMove(e: MouseEvent): void {
  if (pinned) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el === tooltip) return;

  showHighlight(el);
  const data = collectInspectorData(el);
  showTooltip(data, el);
}

function onClick(e: MouseEvent): void {
  if (!active) return;
  e.preventDefault();
  e.stopPropagation();

  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;

  if (pinned && pinnedElement === el) {
    // Unpin
    pinned = false;
    pinnedElement = null;
    removeTooltip();
    removeHighlight();
  } else {
    // Pin
    pinned = true;
    pinnedElement = el;
    if (tooltip) {
      tooltip.style.border = "2px solid #6c6cff";
      tooltip.style.pointerEvents = "auto";
    }
    // Notify side panel of the pick so the SR tab (when active) can set its
    // scope to the picked element. Side panel handler gates on state.topTab.
    try {
      const data = collectInspectorData(el);
      chrome.runtime.sendMessage({ type: "INSPECT_ELEMENT", payload: data });
    } catch { /* sidepanel may be closed; harmless */ }
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") exitInspectMode();
}

function collectInspectorData(el: Element): iInspectorData {
  const ariaAttrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("aria-")) {
      ariaAttrs[attr.name] = attr.value;
    }
  }

  const selector = getSelector(el);
  const matchingViolations: { ruleId: string; impact: string; message: string }[] = [];
  for (const v of lastScanViolations) {
    for (const node of v.nodes) {
      if (node.selector === selector) {
        matchingViolations.push({ ruleId: v.id, impact: v.impact, message: node.failureSummary });
        break;
      }
    }
  }

  return {
    selector,
    role: el.getAttribute("role") || el.tagName.toLowerCase(),
    accessibleName: getAccessibleName(el as HTMLElement),
    ariaAttributes: ariaAttrs,
    tabindex: el.hasAttribute("tabindex") ? (el as HTMLElement).tabIndex : null,
    isFocusable: isFocusable(el as HTMLElement),
    violations: matchingViolations,
  };
}

function showTooltip(data: iInspectorData, targetEl: Element): void {
  removeTooltip();

  tooltip = document.createElement("div");
  tooltip.style.cssText = TOOLTIP_STYLES;

  // All page-controlled fields (role, accessibleName, ARIA attr names/values)
  // are escaped before they hit innerHTML — a hostile page can put `<script>`
  // or quote characters in aria-label, and we render that content here.
  let html = `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8888aa;margin-bottom:4px">Role</div>`;
  html += `<div style="margin-bottom:8px">${escHtml(data.role)}</div>`;
  html += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8888aa;margin-bottom:4px">Name</div>`;
  html += `<div style="margin-bottom:8px">${data.accessibleName ? escHtml(data.accessibleName) : "&lt;none&gt;"}</div>`;

  if (Object.keys(data.ariaAttributes).length > 0) {
    html += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8888aa;margin-bottom:4px">ARIA</div>`;
    for (const [k, v] of Object.entries(data.ariaAttributes)) {
      html += `<div style="font-size:12px;margin-bottom:2px">${escHtml(k)}="${escHtml(v)}"</div>`;
    }
  }

  if (data.tabindex !== null) {
    html += `<div style="margin-top:6px;font-size:11px;color:#8888aa">tabindex: ${data.tabindex}</div>`;
  }

  html += `<div style="margin-top:4px;font-size:11px;color:${data.isFocusable ? "#4ade80" : "#f87171"}">${data.isFocusable ? "Focusable" : "Not focusable"}</div>`;

  tooltip.innerHTML = html;

  // Position relative to element bounding rect — prefer above, fallback to below, right, left
  // 8px margin clamping from viewport edges (AC4)
  const MARGIN = 8;
  const tooltipWidth = 320;
  const tooltipHeight = 200; // estimate
  const rect = targetEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left: number;
  let top: number;

  // Try above
  if (rect.top - tooltipHeight - MARGIN >= MARGIN) {
    top = rect.top - tooltipHeight - MARGIN;
    left = rect.left;
  // Try below
  } else if (rect.bottom + tooltipHeight + MARGIN <= vh - MARGIN) {
    top = rect.bottom + MARGIN;
    left = rect.left;
  // Try right
  } else if (rect.right + tooltipWidth + MARGIN <= vw - MARGIN) {
    top = rect.top;
    left = rect.right + MARGIN;
  // Fallback: left
  } else {
    top = rect.top;
    left = rect.left - tooltipWidth - MARGIN;
  }

  // Clamp within viewport
  left = Math.max(MARGIN, Math.min(left, vw - tooltipWidth - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - tooltipHeight - MARGIN));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  document.body.appendChild(tooltip);
}

function removeTooltip(): void {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

function showHighlight(el: Element): void {
  removeHighlight();
  const rect = el.getBoundingClientRect();
  currentHighlight = document.createElement("div");
  currentHighlight.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;border:2px dashed #6c6cff;pointer-events:none;z-index:2147483646;`;
  document.body.appendChild(currentHighlight);
}

function removeHighlight(): void {
  if (currentHighlight) {
    currentHighlight.remove();
    currentHighlight = null;
  }
}

function getAccessibleName(el: HTMLElement): string {
  return el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent?.trim().substring(0, 80) || "";
}

function isFocusable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (["a", "button", "input", "select", "textarea"].includes(tag)) return !el.hasAttribute("disabled");
  return el.tabIndex >= 0;
}

const getSelector = buildElementSelector;
