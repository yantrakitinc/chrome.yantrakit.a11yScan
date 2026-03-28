/**
 * Manual review checklist with Pass/Fail/N/A toggles and animated N/A transitions.
 */

import { filterCriteria, isCriterionRelevant, type iWcagCriterion } from '@shared/wcag-mapping';
import { getManualState, setManualItem, getPageElements } from './state';

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

let manualListEl: HTMLDivElement;
let manualBadgeEl: HTMLSpanElement;
let versionSelect: HTMLSelectElement;
let levelSelect: HTMLSelectElement;

export function initManualReview(
  listEl: HTMLDivElement,
  badgeEl: HTMLSpanElement,
  versionEl: HTMLSelectElement,
  levelEl: HTMLSelectElement
): void {
  manualListEl = listEl;
  manualBadgeEl = badgeEl;
  versionSelect = versionEl;
  levelSelect = levelEl;
}

export function renderManualTab(): void {
  const version = versionSelect.value as '2.0' | '2.1' | '2.2';
  const level = levelSelect.value as 'A' | 'AA' | 'AAA';
  const criteria = filterCriteria(version, level);
  const manualCriteria = criteria.filter((c) => c.automation === 'manual');
  const manualState = getManualState();
  const pageElements = getPageElements();

  const relevant: iWcagCriterion[] = [];
  const mayNotApply: iWcagCriterion[] = [];
  const na: iWcagCriterion[] = [];

  for (const c of manualCriteria) {
    if (manualState[c.id] === 'na') {
      na.push(c);
    } else if (isCriterionRelevant(c, pageElements)) {
      relevant.push(c);
    } else {
      mayNotApply.push(c);
    }
  }

  let reviewed = 0;
  for (const c of manualCriteria) {
    if (manualState[c.id]) reviewed++;
  }
  manualBadgeEl.textContent = `${reviewed}/${manualCriteria.length}`;

  let html = '';

  if (relevant.length > 0) {
    html += `<h3 class="text-xs font-bold text-zinc-900 mb-2">Likely Relevant (${relevant.length})</h3>`;
    for (const c of relevant) {
      html += buildManualItem(c, manualState[c.id] || null);
    }
  }

  if (mayNotApply.length > 0) {
    html += `<details class="mt-3"><summary class="text-xs text-zinc-500 cursor-pointer py-1">May not apply (${mayNotApply.length}) — no matching elements detected</summary><div class="mt-1 opacity-70">`;
    for (const c of mayNotApply) {
      html += buildManualItem(c, manualState[c.id] || null);
    }
    html += `</div></details>`;
  }

  if (na.length > 0) {
    html += `<div class="mt-4 pt-3 border-t border-zinc-200">`;
    html += `<h3 class="text-xs font-semibold text-zinc-400 mb-1">Not Applicable (${na.length})</h3>`;
    for (const c of na) {
      html += buildNaItem(c);
    }
    html += `</div>`;
  }

  manualListEl.innerHTML = html;
  attachListeners();
}

function buildManualItem(c: iWcagCriterion, state: string | null): string {
  let html = `<div class="manual-item flex items-start gap-2 py-2 border-b border-zinc-100 transition-all duration-300" data-criterion-id="${c.id}">`;
  html += `<div class="flex-1 min-w-0">`;
  html += `<strong class="text-xs block">${c.id} ${esc(c.name)} <span class="text-zinc-500">(${c.level})</span></strong>`;
  html += `<p class="text-[11px] text-zinc-600 mt-0.5">${esc(c.manualCheck)}</p>`;
  html += `</div>`;
  html += `<div class="flex gap-0.5 shrink-0">`;

  const passClass = state === 'pass' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-zinc-300 text-zinc-600';
  const failClass = state === 'fail' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-zinc-300 text-zinc-600';

  html += `<button class="manual-toggle-btn px-2 py-0.5 text-[10px] font-semibold border rounded ${passClass}" data-criterion="${c.id}" data-value="pass">Pass</button>`;
  html += `<button class="manual-toggle-btn px-2 py-0.5 text-[10px] font-semibold border rounded ${failClass}" data-criterion="${c.id}" data-value="fail">Fail</button>`;
  html += `<button class="manual-toggle-btn px-2 py-0.5 text-[10px] font-semibold border rounded bg-white border-zinc-300 text-zinc-600" data-criterion="${c.id}" data-value="na">N/A</button>`;
  html += `</div></div>`;
  return html;
}

function buildNaItem(c: iWcagCriterion): string {
  let html = `<div class="flex items-center justify-between py-1.5 text-zinc-400">`;
  html += `<span class="text-xs line-through">${c.id} ${esc(c.name)}</span>`;
  html += `<button class="restore-btn text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 border border-indigo-200 rounded hover:bg-indigo-50" data-criterion="${c.id}">Restore</button>`;
  html += `</div>`;
  return html;
}

function attachListeners(): void {
  manualListEl.querySelectorAll('.manual-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.target as HTMLButtonElement;
      const criterionId = el.dataset.criterion!;
      const value = el.dataset.value!;

      if (value === 'na') {
        handleNaClick(criterionId);
        return;
      }

      const currentState = getManualState()[criterionId];
      if (currentState === value) {
        setManualItem(criterionId, null);
      } else {
        setManualItem(criterionId, value);
      }
      renderManualTab();
    });
  });

  manualListEl.querySelectorAll('.restore-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.target as HTMLButtonElement;
      const criterionId = el.dataset.criterion!;
      setManualItem(criterionId, null);
      renderManualTab();
    });
  });
}

/**
 * Animates an item being marked as N/A:
 * 1. Strikethrough + fade the item in place
 * 2. Collapse the height
 * 3. Re-render with item in N/A section
 */
function handleNaClick(criterionId: string): void {
  const item = manualListEl.querySelector(`[data-criterion-id="${criterionId}"]`) as HTMLDivElement;
  if (!item) {
    setManualItem(criterionId, 'na');
    renderManualTab();
    return;
  }

  // Step 1: Strikethrough + fade
  item.style.opacity = '0.4';
  item.style.textDecoration = 'line-through';
  item.style.textDecorationColor = '#a1a1aa';

  // Step 2: After short delay, collapse height
  setTimeout(() => {
    const height = item.offsetHeight;
    item.style.height = `${height}px`;
    item.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      item.style.height = '0px';
      item.style.paddingTop = '0px';
      item.style.paddingBottom = '0px';
      item.style.marginTop = '0px';
      item.style.marginBottom = '0px';
      item.style.borderWidth = '0px';
    });

    // Step 3: After collapse animation, re-render
    setTimeout(() => {
      setManualItem(criterionId, 'na');
      renderManualTab();
    }, 300);
  }, 400);
}
