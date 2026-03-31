/**
 * Tab Order Movie Mode: animated walkthrough auto-advancing through tabbable elements.
 */

import { computeTabOrder } from './tab-order';
import { createOverlayContainer, destroyOverlay } from './overlay';
import type { iTabOrderEntry } from './overlay';

export interface iMovieState {
  status: 'idle' | 'playing' | 'paused' | 'complete';
  currentIndex: number;
  totalElements: number;
  speed: number;
}

let state: iMovieState = { status: 'idle', currentIndex: 0, totalElements: 0, speed: 1000 };
let entries: iTabOrderEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let highlightEl: HTMLElement | null = null;

function sendProgress() {
  chrome.runtime.sendMessage({ type: 'MOVIE_PROGRESS', state: { ...state } }).catch(() => {});
}

function clearHighlight() {
  if (highlightEl) {
    highlightEl.remove();
    highlightEl = null;
  }
}

function highlightElement(entry: iTabOrderEntry) {
  clearHighlight();
  const el = entry.element;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const ring = document.createElement('div');
  ring.id = '__a11yscan-movie-ring';
  ring.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollX - 4}px;
    top: ${rect.top + scrollY - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    border: 3px solid #f59e0b;
    border-radius: 4px;
    box-shadow: 0 0 0 4px rgba(245,158,11,0.3), 0 0 12px rgba(245,158,11,0.4);
    z-index: 2147483647;
    pointer-events: none;
    animation: __a11yscan-pulse 1s ease-in-out infinite;
  `;
  document.body.appendChild(ring);
  highlightEl = ring;

  if (!document.getElementById('__a11yscan-movie-style')) {
    const style = document.createElement('style');
    style.id = '__a11yscan-movie-style';
    style.textContent = `
      @keyframes __a11yscan-pulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(245,158,11,0.3), 0 0 12px rgba(245,158,11,0.4); }
        50% { box-shadow: 0 0 0 8px rgba(245,158,11,0.15), 0 0 20px rgba(245,158,11,0.25); }
      }
    `;
    document.head.appendChild(style);
  }
}

function advanceToNext() {
  if (state.status !== 'playing') return;

  if (state.currentIndex >= state.totalElements) {
    state.status = 'complete';
    clearHighlight();
    sendProgress();
    return;
  }

  const entry = entries[state.currentIndex];
  if (entry) highlightElement(entry);
  state.currentIndex++;
  sendProgress();

  timer = setTimeout(advanceToNext, state.speed);
}

export function startMovieMode(speed: number): void {
  const computed = computeTabOrder();
  entries = computed.filter((e) => e.index > 0);
  if (entries.length === 0) return;

  createOverlayContainer();

  state = {
    status: 'playing',
    currentIndex: 0,
    totalElements: entries.length,
    speed: speed || 1000,
  };

  advanceToNext();
}

export function pauseMovieMode(): void {
  if (state.status !== 'playing') return;
  state.status = 'paused';
  if (timer) { clearTimeout(timer); timer = null; }
  sendProgress();
}

export function resumeMovieMode(): void {
  if (state.status !== 'paused') return;
  state.status = 'playing';
  advanceToNext();
}

export function stopMovieMode(): void {
  state.status = 'idle';
  state.currentIndex = 0;
  if (timer) { clearTimeout(timer); timer = null; }
  clearHighlight();
  destroyOverlay();
  const style = document.getElementById('__a11yscan-movie-style');
  if (style) style.remove();
  sendProgress();
}

export function setMovieSpeed(speed: number): void {
  state.speed = speed;
}

export function getMovieState(): iMovieState {
  return { ...state };
}

// Escape key stops movie mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (state.status === 'playing' || state.status === 'paused')) {
    stopMovieMode();
  }
});
