import axe from 'axe-core';

if (!(window as any).__a11yscan) {
  (window as any).__a11yscan = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
