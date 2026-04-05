import axe from 'axe-core';
import { scanAriaPatterns } from './aria-scanner';
import { collectBatchEnrichedContext } from './enriched-context';
import { activateMocks } from './mock-interceptor';
import {
  createOverlayContainer,
  destroyOverlay,
  renderTabOrderBadges,
  renderViolationOverlay,
  renderFocusGapOverlay,
  removeTabOrderOverlay,
  removeViolationOverlay,
  removeFocusGapOverlay,
} from './overlay';
import type { iViolationOverlayEntry } from './overlay';
import { computeTabOrder, detectFocusGaps } from './tab-order';
import { startMovieMode, pauseMovieMode, resumeMovieMode, stopMovieMode, setMovieSpeed, getMovieState } from './movie-mode';

if (!(window as any).__a11yscan) {
  (window as any).__a11yscan = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'APPLY_CVD_FILTER') {
      const matrix = message.matrix as number[] | null;
      const existingSvg = document.getElementById('__a11yscan-cvd-svg');
      if (existingSvg) existingSvg.remove();
      if (!matrix) {
        document.documentElement.style.filter = '';
        sendResponse({ ok: true });
        return;
      }
      const svgNs = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNs, 'svg');
      svg.setAttribute('id', '__a11yscan-cvd-svg');
      svg.setAttribute('style', 'position:absolute;width:0;height:0;');
      svg.setAttribute('aria-hidden', 'true');
      const defs = document.createElementNS(svgNs, 'defs');
      const filter = document.createElementNS(svgNs, 'filter');
      filter.setAttribute('id', '__a11yscan-cvd-filter');
      const feColorMatrix = document.createElementNS(svgNs, 'feColorMatrix');
      feColorMatrix.setAttribute('type', 'matrix');
      const [m0,m1,m2,m3,m4,m5,m6,m7,m8] = matrix;
      feColorMatrix.setAttribute('values', `${m0} ${m1} ${m2} 0 0 ${m3} ${m4} ${m5} 0 0 ${m6} ${m7} ${m8} 0 0 0 0 0 1 0`);
      filter.appendChild(feColorMatrix);
      defs.appendChild(filter);
      svg.appendChild(defs);
      document.body.appendChild(svg);
      document.documentElement.style.filter = 'url(#__a11yscan-cvd-filter)';
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'HIGHLIGHT_ELEMENT') {
      const selector = message.selector as string;
      try {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const prev = (el as HTMLElement).style.cssText;
          (el as HTMLElement).style.cssText += ';outline: 3px solid #f59e0b !important; outline-offset: 2px !important; box-shadow: 0 0 0 6px rgba(245,158,11,0.3) !important; transition: outline 0.3s, box-shadow 0.3s !important;';
          setTimeout(() => {
            (el as HTMLElement).style.cssText = prev;
          }, 3000);
        }
      } catch { /* invalid selector */ }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'ACTIVATE_MOCKS') {
      activateMocks(message.mocks || []);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'COLLECT_ENRICHED_CONTEXT') {
      const selectors = (message.selectors || []) as string[];
      const results = collectBatchEnrichedContext(selectors);
      sendResponse({ type: 'ENRICHED_CONTEXT_RESULT', contexts: results });
      return;
    }

    if (message.type === 'RUN_ARIA_SCAN') {
      const results = scanAriaPatterns();
      sendResponse({ type: 'ARIA_SCAN_RESULT', widgets: results });
      return;
    }

    if (message.type === 'SHOW_TAB_ORDER') {
      const entries = computeTabOrder();
      createOverlayContainer();
      renderTabOrderBadges(entries);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'HIDE_TAB_ORDER') {
      removeTabOrderOverlay();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'SHOW_VIOLATION_OVERLAY') {
      const violations = (message.violations || []) as iViolationOverlayEntry[];
      // Resolve selectors to live elements
      const resolved: iViolationOverlayEntry[] = [];
      for (const v of violations) {
        try {
          const el = document.querySelector(v.selector);
          if (el) {
            resolved.push({ ...v, element: el });
          }
        } catch { /* invalid selector */ }
      }
      createOverlayContainer();
      renderViolationOverlay(resolved);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'HIDE_VIOLATION_OVERLAY') {
      removeViolationOverlay();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'SHOW_FOCUS_GAPS') {
      const gaps = detectFocusGaps();
      createOverlayContainer();
      renderFocusGapOverlay(gaps);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'HIDE_FOCUS_GAPS') {
      removeFocusGapOverlay();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'GET_TAB_ORDER') {
      const entries = computeTabOrder();
      // Strip element references (not serializable) before sending
      const data = entries.map(({ index, tabindex, selector, tagName }) => ({
        index,
        tabindex,
        selector,
        tagName,
      }));
      sendResponse({ type: 'TAB_ORDER_RESULT', entries: data });
      return;
    }

    if (message.type === 'GET_FOCUS_GAPS') {
      const gaps = detectFocusGaps();
      const data = gaps.map(({ reason, selector }) => ({ reason, selector }));
      sendResponse({ type: 'FOCUS_GAPS_RESULT', gaps: data });
      return;
    }

    if (message.type === 'START_MOVIE_MODE') {
      startMovieMode(message.speed || 1000);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'PAUSE_MOVIE_MODE') {
      pauseMovieMode();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'RESUME_MOVIE_MODE') {
      resumeMovieMode();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'STOP_MOVIE_MODE') {
      stopMovieMode();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === 'SET_MOVIE_SPEED') {
      setMovieSpeed(message.speed || 1000);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'RUN_SCAN') {
      axe.run(document).then((results) => {
        sendResponse({
          type: 'SCAN_RESULT',
          violations: results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            description: v.description,
            tags: v.tags,
            nodes: v.nodes.map((n) => ({
              target: n.target.map(String),
              html: n.html,
              failureSummary: n.failureSummary ?? '',
            })),
          })),
          passes: results.passes.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            description: v.description,
            tags: v.tags,
            nodes: v.nodes.length,
          })),
          incomplete: results.incomplete.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            description: v.description,
            tags: v.tags,
            nodes: v.nodes.map((n) => ({
              target: n.target.map(String),
              html: n.html,
              failureSummary: n.failureSummary ?? '',
            })),
          })),
          pageElements: detectPageElements(),
        });
      }).catch((err) => {
        sendResponse({ type: 'SCAN_ERROR', message: String(err) });
      });
      return true;
    }
  });
}

/**
 * Detects what types of elements exist on the page to determine
 * which manual review criteria are likely relevant.
 */
function detectPageElements(): Record<string, boolean> {
  return {
    hasVideo: document.querySelectorAll('video, [data-video], iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
    hasAudio: document.querySelectorAll('audio, [data-audio]').length > 0,
    hasForms: document.querySelectorAll('form, input, select, textarea').length > 0,
    hasImages: document.querySelectorAll('img, svg, [role="img"], canvas').length > 0,
    hasLinks: document.querySelectorAll('a[href]').length > 0,
    hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
    hasIframes: document.querySelectorAll('iframe').length > 0,
    hasTables: document.querySelectorAll('table').length > 0,
    hasAnimation: document.querySelectorAll('[class*="animate"], marquee, blink').length > 0 || document.getAnimations().length > 0,
    hasAutoplay: document.querySelectorAll('video[autoplay], audio[autoplay]').length > 0,
    hasDragDrop: document.querySelectorAll('[draggable="true"]').length > 0,
    hasTimeLimits: document.querySelectorAll('meta[http-equiv="refresh"]').length > 0,
  };
}
