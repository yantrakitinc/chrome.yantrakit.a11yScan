/**
 * Content script — injected into every scanned page.
 * Handles: axe-core scanning, overlays, movie mode, CVD simulation,
 * element highlighting, ARIA scanning, enriched context, mock interception.
 *
 * Source of truth: F01, F05, F06, F07, F08, F10, F14
 */

import type { iMessage } from "@shared/messages";
import type { iScanResult, iScanSummary, iPageElements, iViolation, iPass, iIncomplete } from "@shared/types";
import { buildWcagTags } from "@shared/config";
import { setLastScanViolations } from "./scan-state";
import axe from "axe-core";
import { scanAriaPatterns } from "./aria-scanner";
import { showViolationOverlay, hideViolationOverlay, showTabOrderOverlay, hideTabOrderOverlay, showFocusGapOverlay, hideFocusGapOverlay } from "./overlay";
import { startMovie, pauseMovie, resumeMovie, stopMovie, setSpeed } from "./movie-mode";
import { collectEnrichedContext } from "./enriched-context";
import { activateMocks, deactivateMocks } from "./mock-interceptor";
import { analyzeReadingOrder } from "./reading-order";
import { getTabOrder, getFocusGaps, detectFocusIndicators, detectKeyboardTraps, detectSkipLinks } from "./tab-order";
import { enterInspectMode, exitInspectMode } from "./inspector";
import { runHeuristicRules } from "./heuristic-rules";

/* ═══════════════════════════════════════════════════════════════════
   Message Listener — guarded against double-registration
   ═══════════════════════════════════════════════════════════════════ */

// Prevent duplicate listener if script injected twice
if (!(globalThis as Record<string, unknown>).__a11yScanLoaded) {
(globalThis as Record<string, unknown>).__a11yScanLoaded = true;

chrome.runtime.onMessage.addListener(
  (msg: iMessage, _sender, sendResponse) => {
    switch (msg.type) {
      case "RUN_SCAN":
        runScan(msg.payload.config, msg.payload.isCrawl)
          .then((result) => sendResponse({ type: "SCAN_RESULT", payload: result }))
          .catch((err) => sendResponse({ type: "SCAN_ERROR", payload: { message: String(err) } }));
        return true;

      case "RUN_ARIA_SCAN":
        sendResponse({ type: "ARIA_SCAN_RESULT", payload: scanAriaPatterns() });
        return true;

      case "HIGHLIGHT_ELEMENT": {
        const found = highlightElement(msg.payload.selector);
        sendResponse({ type: "HIGHLIGHT_RESULT", payload: { found } });
        return true;
      }

      case "CLEAR_HIGHLIGHTS":
        clearAllHighlights();
        break;

      case "APPLY_CVD_FILTER":
        applyCvdFilter(msg.payload.matrix);
        break;

      case "SHOW_VIOLATION_OVERLAY":
        showViolationOverlay(msg.payload.violations);
        break;

      case "HIDE_VIOLATION_OVERLAY":
        hideViolationOverlay();
        break;

      case "SHOW_TAB_ORDER":
        showTabOrderOverlay();
        break;

      case "HIDE_TAB_ORDER":
        hideTabOrderOverlay();
        break;

      case "SHOW_FOCUS_GAPS":
        showFocusGapOverlay();
        break;

      case "HIDE_FOCUS_GAPS":
        hideFocusGapOverlay();
        break;

      case "START_MOVIE_MODE":
        startMovie();
        break;

      case "PAUSE_MOVIE_MODE":
        pauseMovie();
        break;

      case "RESUME_MOVIE_MODE":
        resumeMovie();
        break;

      case "STOP_MOVIE_MODE":
        stopMovie();
        break;

      case "SET_MOVIE_SPEED":
        setSpeed(msg.payload.speed);
        break;

      case "COLLECT_ENRICHED_CONTEXT":
        sendResponse({ type: "ENRICHED_CONTEXT_RESULT", payload: collectEnrichedContext(msg.payload.selectors) });
        return true;

      case "ACTIVATE_MOCKS":
        activateMocks(msg.payload.mocks);
        break;

      case "DEACTIVATE_MOCKS":
        deactivateMocks();
        break;

      case "ANALYZE_READING_ORDER":
        sendResponse({ type: "READING_ORDER_RESULT", payload: analyzeReadingOrder(msg.payload.scopeSelector) });
        return true;

      case "GET_TAB_ORDER":
        sendResponse({ type: "TAB_ORDER_RESULT", payload: getTabOrder() });
        return true;

      case "GET_FOCUS_GAPS":
        sendResponse({ type: "FOCUS_GAPS_RESULT", payload: getFocusGaps() });
        return true;

      case "GET_FOCUS_INDICATORS":
        sendResponse({ type: "FOCUS_INDICATORS_RESULT", payload: detectFocusIndicators() });
        return true;

      case "GET_KEYBOARD_TRAPS":
        sendResponse({ type: "KEYBOARD_TRAPS_RESULT", payload: detectKeyboardTraps() });
        return true;

      case "GET_SKIP_LINKS":
        sendResponse({ type: "SKIP_LINKS_RESULT", payload: detectSkipLinks() });
        return true;

      case "ENTER_INSPECT_MODE":
        enterInspectMode();
        break;

      case "EXIT_INSPECT_MODE":
        exitInspectMode();
        break;
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════
   Scan Engine (F01)
   ═══════════════════════════════════════════════════════════════════ */

async function runScan(config: import("@shared/types").iRemoteConfig, isCrawl = false): Promise<iScanResult> {
  const startTime = performance.now();

  // Build run options — handle missing scanOptions gracefully
  const tags = buildWcagTags(config.wcagVersion || "2.2", config.wcagLevel || "AA");
  const resultTypes = config.scanOptions?.resultTypes || ["violations", "passes", "incomplete", "inapplicable"];
  const runOptions: axe.RunOptions = {
    resultTypes: resultTypes as ("violations" | "passes" | "incomplete" | "inapplicable")[],
    runOnly: { type: "tag", values: tags },
  };

  // Apply rule include/exclude from config
  if (config.rules && Object.keys(config.rules).length > 0) {
    const rules: Record<string, { enabled: boolean }> = {};
    for (const [id, rule] of Object.entries(config.rules)) {
      rules[id] = { enabled: rule.enabled };
    }
    runOptions.rules = rules;
  }

  const results = await axe.run(document, runOptions);

  // Map violations
  const violations: iViolation[] = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact as iViolation["impact"],
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.tags,
    nodes: v.nodes.map((n) => ({
      selector: Array.isArray(n.target) ? n.target.join(" > ") : String(n.target),
      html: n.html.substring(0, 200),
      failureSummary: n.failureSummary || "",
    })),
    wcagCriteria: mapAxeTagsToWcag(v.tags),
  }));

  // Map passes
  const passes: iPass[] = results.passes.map((p) => ({
    id: p.id,
    description: p.description,
    tags: p.tags,
    nodes: p.nodes.map((n) => ({
      selector: Array.isArray(n.target) ? n.target.join(" > ") : String(n.target),
      html: n.html.substring(0, 200),
    })),
    wcagCriteria: mapAxeTagsToWcag(p.tags),
  }));

  // Map incomplete
  const incomplete: iIncomplete[] = (results.incomplete || []).map((i) => ({
    id: i.id,
    description: i.description,
    tags: i.tags,
    nodes: i.nodes.map((n) => ({
      selector: Array.isArray(n.target) ? n.target.join(" > ") : String(n.target),
      html: n.html.substring(0, 200),
      message: n.failureSummary || "",
    })),
    wcagCriteria: mapAxeTagsToWcag(i.tags),
  }));

  // Summary
  const summary: iScanSummary = {
    critical: violations.filter((v) => v.impact === "critical").length,
    serious: violations.filter((v) => v.impact === "serious").length,
    moderate: violations.filter((v) => v.impact === "moderate").length,
    minor: violations.filter((v) => v.impact === "minor").length,
    passes: passes.length,
    incomplete: incomplete.length,
  };

  // Page elements detection
  const pageElements = detectPageElements();

  const scanDurationMs = Math.round(performance.now() - startTime);

  // Run custom heuristic rules (F11) after axe-core
  try {
    const heuristicViolations = runHeuristicRules(isCrawl, config.heuristics?.exclude);
    violations.push(...heuristicViolations);
    // Update summary counts with heuristic results
    for (const v of heuristicViolations) {
      if (v.impact === "critical") summary.critical += v.nodes.length;
      else if (v.impact === "serious") summary.serious += v.nodes.length;
      else if (v.impact === "moderate") summary.moderate += v.nodes.length;
      else summary.minor += v.nodes.length;
    }
  } catch {
    // Heuristic rules failed — continue with axe results only
  }

  // Store violations for inspector (F20-AC3/AC10)
  setLastScanViolations(violations);

  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    violations,
    passes,
    incomplete,
    summary,
    pageElements,
    scanDurationMs: Math.round(performance.now() - startTime),
  };
}

/** Detect what types of elements exist on the page (for manual review filtering) */
function detectPageElements(): iPageElements {
  const q = (sel: string) => document.querySelector(sel) !== null;
  return {
    hasVideo: q("video"),
    hasAudio: q("audio"),
    hasForms: q("form, input, select, textarea"),
    hasImages: q("img, picture, svg[role='img']"),
    hasLinks: q("a[href]"),
    hasHeadings: q("h1, h2, h3, h4, h5, h6, [role='heading']"),
    hasIframes: q("iframe"),
    hasTables: q("table"),
    hasAnimation: q("[style*='animation'], marquee") || checkCssAnimations(),
    hasAutoplay: q("video[autoplay], audio[autoplay]"),
    hasDragDrop: q("[draggable='true']"),
    hasTimeLimited: q("meta[http-equiv='refresh']"),
  };
}

function checkCssAnimations(): boolean {
  const all = document.querySelectorAll("*");
  for (const el of Array.from(all).slice(0, 200)) {
    const style = getComputedStyle(el);
    if (style.animationName !== "none" && style.animationDuration !== "0s") return true;
  }
  return false;
}

/** Map axe tags to WCAG criterion IDs */
function mapAxeTagsToWcag(tags: string[]): string[] {
  const wcagPattern = /^wcag(\d)(\d)(\d+)$/;
  const criteria: string[] = [];
  for (const tag of tags) {
    const match = tag.match(wcagPattern);
    if (match) {
      criteria.push(`${match[1]}.${match[2]}.${match[3]}`);
    }
  }
  return [...new Set(criteria)];
}


/* ═══════════════════════════════════════════════════════════════════
   Element Highlighting (F07)
   ═══════════════════════════════════════════════════════════════════ */

function highlightElement(selector: string): boolean {
  let el: HTMLElement | null = null;
  try {
    el = document.querySelector(selector) as HTMLElement | null;
  } catch {
    // Invalid selector (e.g., Tailwind classes with special chars)
    return false;
  }
  if (!el) return false;

  // Find visible element — walk up ancestors if hidden (F07)
  let targetEl = el;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    let parent = el.parentElement;
    while (parent) {
      const ps = getComputedStyle(parent);
      if (ps.display !== "none" && ps.visibility !== "hidden") {
        targetEl = parent;
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Scroll ancestor scroll containers before calling scrollIntoView (F07-AC4)
  let ancestor = targetEl.parentElement;
  while (ancestor && ancestor !== document.body) {
    const as = getComputedStyle(ancestor);
    const overflow = as.overflow + as.overflowX + as.overflowY;
    if (overflow.includes("auto") || overflow.includes("scroll")) {
      const rect = targetEl.getBoundingClientRect();
      const aRect = ancestor.getBoundingClientRect();
      if (rect.top < aRect.top || rect.bottom > aRect.bottom) {
        ancestor.scrollTop += rect.top - aRect.top - aRect.height / 2 + rect.height / 2;
      }
    }
    ancestor = ancestor.parentElement;
  }

  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

  // Inject pulse keyframes if not already present
  const KEYFRAME_ID = "a11y-highlight-keyframes";
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement("style");
    style.id = KEYFRAME_ID;
    style.textContent = `@keyframes a11y-highlight-pulse { from { box-shadow: 0 0 12px 4px rgba(245,158,11,0.6); } to { box-shadow: 0 0 20px 8px rgba(245,158,11,0.15); } }`;
    document.head.appendChild(style);
  }

  // Apply amber glow with pulse animation
  const originalOutline = targetEl.style.outline;
  const originalBoxShadow = targetEl.style.boxShadow;
  const originalAnimation = targetEl.style.animation;
  targetEl.style.outline = "3px solid #f59e0b";
  targetEl.style.boxShadow = "0 0 12px 4px rgba(245, 158, 11, 0.5)";
  targetEl.style.animation = "a11y-highlight-pulse 0.8s ease-in-out infinite alternate";

  // Track for forced cleanup
  activeHighlights.push({ el: targetEl, originalOutline, originalBoxShadow, originalAnimation });

  const timer = setTimeout(() => {
    targetEl.style.outline = originalOutline;
    targetEl.style.boxShadow = originalBoxShadow;
    targetEl.style.animation = originalAnimation;
    activeHighlights = activeHighlights.filter((h) => h.el !== targetEl);
  }, 3000);
  activeHighlightTimers.push(timer);

  return true;
}

// Track active highlights for forced removal
let activeHighlights: { el: HTMLElement; originalOutline: string; originalBoxShadow: string; originalAnimation: string }[] = [];
let activeHighlightTimers: ReturnType<typeof setTimeout>[] = [];

function clearAllHighlights(): void {
  for (const timer of activeHighlightTimers) clearTimeout(timer);
  activeHighlightTimers = [];
  for (const h of activeHighlights) {
    h.el.style.outline = h.originalOutline;
    h.el.style.boxShadow = h.originalBoxShadow;
    h.el.style.animation = h.originalAnimation;
  }
  activeHighlights = [];
}

/* ═══════════════════════════════════════════════════════════════════
   CVD Simulation (F08)
   ═══════════════════════════════════════════════════════════════════ */

const CVD_FILTER_ID = "a11y-scan-cvd-filter";

function applyCvdFilter(matrix: number[] | null): void {
  // Remove existing filter
  const existing = document.getElementById(CVD_FILTER_ID);
  if (existing) existing.remove();
  document.documentElement.style.removeProperty("filter");

  if (!matrix) return;

  // Build SVG filter from 9-element matrix → 20-value feColorMatrix
  const m = matrix;
  const values = `${m[0]} ${m[1]} ${m[2]} 0 0 ${m[3]} ${m[4]} ${m[5]} 0 0 ${m[6]} ${m[7]} ${m[8]} 0 0 0 0 0 1 0`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", CVD_FILTER_ID);
  svg.setAttribute("style", "position:absolute;width:0;height:0;");
  svg.innerHTML = `<filter id="a11y-cvd"><feColorMatrix type="matrix" values="${values}"/></filter>`;
  document.body.appendChild(svg);

  document.documentElement.style.filter = "url(#a11y-cvd)";
}

} // end of __a11yScanLoaded guard
