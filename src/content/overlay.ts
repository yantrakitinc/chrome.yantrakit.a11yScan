/**
 * Overlay infrastructure for rendering visual badges, outlines, and
 * connecting lines on the inspected page. Everything lives inside a
 * Shadow DOM so host-page styles cannot interfere.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface iTabOrderEntry {
  element: Element;
  /** 1-based position in tab order, or -1 for tabindex="-1" */
  index: number;
  /** Actual tabindex attribute value */
  tabindex: number;
  selector: string;
  tagName: string;
}

export interface iViolationOverlayEntry {
  element: Element;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  ruleId: string;
  description: string;
  selector: string;
}

export interface iFocusGapEntry {
  element: Element;
  reason: string;
  selector: string;
}

/* ------------------------------------------------------------------ */
/*  Module state                                                       */
/* ------------------------------------------------------------------ */

let overlayHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

/** Stored references so `updatePositions` can recalculate. */
let storedTabEntries: { entry: iTabOrderEntry; badge: HTMLDivElement }[] = [];
let storedViolationEntries: { entry: iViolationOverlayEntry; outline: HTMLDivElement; badge: HTMLDivElement }[] = [];
let storedFocusGapEntries: { entry: iFocusGapEntry; outline: HTMLDivElement }[] = [];
let svgElement: SVGSVGElement | null = null;

/* ------------------------------------------------------------------ */
/*  Styles injected into the Shadow DOM                                */
/* ------------------------------------------------------------------ */

const OVERLAY_STYLES = `
  :host, * { box-sizing: border-box; }

  .a11y-badge {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: #fff;
    font-weight: 700;
    font-size: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    pointer-events: none;
    line-height: 1;
  }

  .a11y-badge--tab {
    background: #1e1b4b; /* indigo-950 */
  }

  .a11y-badge--neg {
    background: #9ca3af; /* gray-400 */
  }

  .a11y-badge--violation {
    pointer-events: auto;
    cursor: pointer;
  }

  .a11y-outline {
    position: absolute;
    pointer-events: none;
    z-index: 2147483646;
  }

  .a11y-outline--critical { outline: 3px solid #ef4444; outline-offset: 2px; }
  .a11y-outline--serious  { outline: 3px solid #f97316; outline-offset: 2px; }
  .a11y-outline--moderate { outline: 3px solid #eab308; outline-offset: 2px; }
  .a11y-outline--minor    { outline: 3px solid #3b82f6; outline-offset: 2px; }

  .a11y-outline--gap {
    outline: 3px dashed #ef4444;
    outline-offset: 2px;
  }

  .a11y-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483646;
    overflow: visible;
  }

  .a11y-tooltip {
    position: absolute;
    background: #1e1b4b;
    color: #fff;
    font-size: 11px;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 4px 8px;
    border-radius: 4px;
    z-index: 2147483647;
    pointer-events: none;
    white-space: nowrap;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Computes smart badge position for an element's bounding rect.
 * For small elements (< 40px) the badge is placed above.
 * Near viewport edges it shifts inward.
 */
function badgePosition(rect: DOMRect): { top: number; left: number } {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let top = rect.top + scrollY - 10;
  let left = rect.right + scrollX - 10;

  if (rect.width < 40 || rect.height < 40) {
    top = rect.top + scrollY - 22;
    left = rect.right + scrollX - 10;
  }

  // Keep within viewport horizontally
  if (left + 20 > scrollX + window.innerWidth) {
    left = rect.right + scrollX - 24;
  }
  if (left < scrollX) {
    left = rect.left + scrollX;
  }

  // Keep badge from going above page
  if (top < scrollY) {
    top = rect.top + scrollY;
  }

  return { top, left };
}

/**
 * Returns the center point of a badge element (absolute coords).
 */
function badgeCenter(badge: HTMLDivElement): { x: number; y: number } {
  const left = parseFloat(badge.style.left) || 0;
  const top = parseFloat(badge.style.top) || 0;
  return { x: left + 10, y: top + 10 };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Creates (or returns existing) overlay container with Shadow DOM.
 */
export function createOverlayContainer(): ShadowRoot {
  if (shadowRoot && overlayHost && document.body.contains(overlayHost)) {
    return shadowRoot;
  }

  overlayHost = document.createElement('div');
  overlayHost.id = '__a11yscan-overlay';
  overlayHost.setAttribute('aria-hidden', 'true');
  overlayHost.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647;';

  shadowRoot = overlayHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = OVERLAY_STYLES;
  shadowRoot.appendChild(style);

  document.body.appendChild(overlayHost);

  // Attach position-updating listeners
  window.addEventListener('scroll', handlePositionUpdate, { passive: true });
  window.addEventListener('resize', handlePositionUpdate, { passive: true });

  return shadowRoot;
}

/**
 * Removes the overlay container and all visual elements.
 */
export function destroyOverlay(): void {
  window.removeEventListener('scroll', handlePositionUpdate);
  window.removeEventListener('resize', handlePositionUpdate);

  if (overlayHost && overlayHost.parentNode) {
    overlayHost.parentNode.removeChild(overlayHost);
  }

  overlayHost = null;
  shadowRoot = null;
  svgElement = null;
  storedTabEntries = [];
  storedViolationEntries = [];
  storedFocusGapEntries = [];
}

/**
 * Renders numbered badges on each focusable element and connecting SVG lines.
 */
export function renderTabOrderBadges(elements: iTabOrderEntry[]): void {
  const root = createOverlayContainer();

  // Clear previous tab-order content
  storedTabEntries = [];
  if (svgElement) {
    svgElement.remove();
    svgElement = null;
  }

  // Create SVG for connecting lines
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.classList.add('a11y-svg');
  svg.setAttribute('width', String(document.documentElement.scrollWidth));
  svg.setAttribute('height', String(document.documentElement.scrollHeight));
  root.appendChild(svg);
  svgElement = svg;

  let prevBadge: HTMLDivElement | null = null;

  for (const entry of elements) {
    const rect = entry.element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const pos = badgePosition(rect);

    const badge = document.createElement('div');
    badge.classList.add('a11y-badge');

    if (entry.index === -1) {
      badge.classList.add('a11y-badge--neg');
      badge.textContent = '\u2212'; // minus sign
    } else {
      badge.classList.add('a11y-badge--tab');
      badge.textContent = String(entry.index);
    }

    badge.style.top = `${pos.top}px`;
    badge.style.left = `${pos.left}px`;
    root.appendChild(badge);

    storedTabEntries.push({ entry, badge });

    // Draw connecting line from previous numbered badge
    if (entry.index > 0 && prevBadge) {
      const from = badgeCenter(prevBadge);
      const to = badgeCenter(badge);
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('stroke', '#1e1b4b');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.5');
      svg.appendChild(line);
    }

    if (entry.index > 0) {
      prevBadge = badge;
    }
  }
}

/**
 * Renders outlines and numbered badges around elements with violations.
 */
export function renderViolationOverlay(violations: iViolationOverlayEntry[]): void {
  const root = createOverlayContainer();

  storedViolationEntries = [];

  violations.forEach((entry, i) => {
    const rect = entry.element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Outline div
    const outline = document.createElement('div');
    outline.classList.add('a11y-outline', `a11y-outline--${entry.impact}`);
    outline.style.top = `${rect.top + scrollY}px`;
    outline.style.left = `${rect.left + scrollX}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
    root.appendChild(outline);

    // Badge
    const badge = document.createElement('div');
    badge.classList.add('a11y-badge', 'a11y-badge--violation');
    badge.style.background = impactColor(entry.impact);
    badge.textContent = String(i + 1);

    const pos = badgePosition(rect);
    badge.style.top = `${pos.top}px`;
    badge.style.left = `${pos.left}px`;
    root.appendChild(badge);

    // Click dispatches custom event for side panel communication
    badge.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('a11yscan:violation-click', {
        detail: { selector: entry.selector, ruleId: entry.ruleId },
      }));
    });

    storedViolationEntries.push({ entry, outline, badge });
  });
}

/**
 * Renders dashed red outlines on elements that are interactive but not focusable.
 */
export function renderFocusGapOverlay(gaps: iFocusGapEntry[]): void {
  const root = createOverlayContainer();

  storedFocusGapEntries = [];

  for (const entry of gaps) {
    const rect = entry.element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const outline = document.createElement('div');
    outline.classList.add('a11y-outline', 'a11y-outline--gap');
    outline.style.top = `${rect.top + scrollY}px`;
    outline.style.left = `${rect.left + scrollX}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
    root.appendChild(outline);

    storedFocusGapEntries.push({ entry, outline });
  }
}

/**
 * Recalculates all badge and outline positions from stored element references.
 */
export function updatePositions(): void {
  if (!shadowRoot) return;

  const svgNs = 'http://www.w3.org/2000/svg';

  // Update tab-order badges
  let prevBadge: HTMLDivElement | null = null;

  // Remove old SVG lines and recreate
  if (svgElement) {
    while (svgElement.firstChild) {
      svgElement.removeChild(svgElement.firstChild);
    }
    svgElement.setAttribute('width', String(document.documentElement.scrollWidth));
    svgElement.setAttribute('height', String(document.documentElement.scrollHeight));
  }

  for (const { entry, badge } of storedTabEntries) {
    const rect = entry.element.getBoundingClientRect();
    const pos = badgePosition(rect);
    badge.style.top = `${pos.top}px`;
    badge.style.left = `${pos.left}px`;

    // Redraw connecting lines
    if (entry.index > 0 && prevBadge && svgElement) {
      const from = badgeCenter(prevBadge);
      const to = badgeCenter(badge);
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('stroke', '#1e1b4b');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.5');
      svgElement.appendChild(line);
    }

    if (entry.index > 0) {
      prevBadge = badge;
    }
  }

  // Update violation outlines and badges
  for (const { entry, outline, badge } of storedViolationEntries) {
    const rect = entry.element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    outline.style.top = `${rect.top + scrollY}px`;
    outline.style.left = `${rect.left + scrollX}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;

    const pos = badgePosition(rect);
    badge.style.top = `${pos.top}px`;
    badge.style.left = `${pos.left}px`;
  }

  // Update focus gap outlines
  for (const { entry, outline } of storedFocusGapEntries) {
    const rect = entry.element.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    outline.style.top = `${rect.top + scrollY}px`;
    outline.style.left = `${rect.left + scrollX}px`;
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function handlePositionUpdate(): void {
  updatePositions();
}

/**
 * Maps impact level to a hex color for violation badges.
 */
function impactColor(impact: string): string {
  switch (impact) {
    case 'critical': return '#ef4444';
    case 'serious':  return '#f97316';
    case 'moderate': return '#eab308';
    case 'minor':    return '#3b82f6';
    default:         return '#6b7280';
  }
}
