/**
 * Manual review checklist with Pass/Fail/N/A toggles and animated N/A transitions.
 */

import { WCAG_CRITERIA, filterCriteria, isCriterionRelevant, type iWcagCriterion } from '@shared/wcag-mapping';
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
    html += `<div class="mt-4 pt-3 border-t border-zinc-200 transition-colors duration-500 rounded" data-na-section>`;
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
  let html = `<div class="flex items-start gap-2 py-2 border-b border-zinc-100 rounded px-1 opacity-60" data-na-id="${c.id}">`;
  html += `<div class="flex-1 min-w-0">`;
  html += `<strong class="text-xs block text-zinc-500">${c.id} ${esc(c.name)} <span class="text-zinc-400">(${c.level})</span></strong>`;
  html += `<p class="text-[11px] text-zinc-400 mt-0.5">${esc(c.manualCheck)}</p>`;
  html += `</div>`;
  html += `<button class="restore-btn shrink-0 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 border border-indigo-200 rounded hover:bg-indigo-50" data-criterion="${c.id}">Restore</button>`;
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
      handleRestoreClick(criterionId);
    });
  });
}

/**
 * Animates an item being marked as N/A:
 * 1. Create a flying pill that travels from the item to the N/A section
 * 2. Collapse the item in place
 * 3. Re-render with item in N/A section, flash it
 */
function handleNaClick(criterionId: string): void {
  const item = manualListEl.querySelector(`[data-criterion-id="${criterionId}"]`) as HTMLDivElement;
  if (!item) {
    setManualItem(criterionId, 'na');
    renderManualTab();
    return;
  }

  // Get the criterion name for the flying pill
  const criterion = WCAG_CRITERIA.find((c) => c.id === criterionId);
  const label = criterion ? `${criterion.id} ${criterion.name}` : criterionId;

  // Get positions
  const itemRect = item.getBoundingClientRect();

  // Fade the original item
  item.style.transition = 'opacity 0.2s';
  item.style.opacity = '0.2';

  // Create the flying pill
  const pill = document.createElement('div');
  pill.textContent = label;
  pill.style.cssText = `
    position: fixed;
    left: ${itemRect.left}px;
    top: ${itemRect.top}px;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    color: #92400e;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    z-index: 99999;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    max-width: 200px;
    text-overflow: ellipsis;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(pill);

  // Figure out where the N/A section is (or where it will be — bottom of the list)
  const listRect = manualListEl.getBoundingClientRect();
  const targetY = listRect.bottom - 20;
  const targetX = listRect.left + 12;

  // Animate the pill flying down
  requestAnimationFrame(() => {
    pill.style.left = `${targetX}px`;
    pill.style.top = `${targetY}px`;
    pill.style.opacity = '0.7';
    pill.style.transform = 'scale(0.8)';
  });

  // After pill arrives, collapse the original item and re-render
  setTimeout(() => {
    // Collapse original item
    const height = item.offsetHeight;
    item.style.transition = 'all 0.25s ease-out';
    item.style.height = `${height}px`;
    item.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      item.style.height = '0px';
      item.style.padding = '0px';
      item.style.margin = '0px';
      item.style.borderWidth = '0px';
    });

    // Remove pill and re-render
    setTimeout(() => {
      pill.remove();
      setManualItem(criterionId, 'na');
      renderManualTab();

      // Flash the newly added N/A item
      const naItem = manualListEl.querySelector(`[data-na-id="${criterionId}"]`) as HTMLDivElement;
      if (naItem) {
        naItem.style.transition = 'background-color 0.5s';
        naItem.style.backgroundColor = '#fef3c7';
        setTimeout(() => {
          naItem.style.backgroundColor = 'transparent';
        }, 600);
      }
    }, 250);
  }, 500);
}

/**
 * Animates restoring an item from N/A back to the review list:
 * 1. Create a flying pill from the N/A item position
 * 2. Fly it up toward the top of the review list
 * 3. Collapse the N/A item
 * 4. Re-render with item back in review, flash it
 */
function handleRestoreClick(criterionId: string): void {
  const naItem = manualListEl.querySelector(`[data-na-id="${criterionId}"]`) as HTMLDivElement;
  if (!naItem) {
    setManualItem(criterionId, null);
    renderManualTab();
    return;
  }

  const criterion = WCAG_CRITERIA.find((c) => c.id === criterionId);
  const label = criterion ? `${criterion.id} ${criterion.name}` : criterionId;

  const naRect = naItem.getBoundingClientRect();

  // Fade the N/A item
  naItem.style.transition = 'opacity 0.2s';
  naItem.style.opacity = '0.2';

  // Create the flying pill
  const pill = document.createElement('div');
  pill.textContent = label;
  pill.style.cssText = `
    position: fixed;
    left: ${naRect.left}px;
    top: ${naRect.top}px;
    background: #dcfce7;
    border: 1px solid #86efac;
    color: #166534;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 12px;
    z-index: 99999;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    max-width: 200px;
    text-overflow: ellipsis;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(pill);

  // Target: top of the review list
  const listRect = manualListEl.getBoundingClientRect();
  const targetY = listRect.top + 30;
  const targetX = listRect.left + 12;

  // Animate the pill flying up
  requestAnimationFrame(() => {
    pill.style.left = `${targetX}px`;
    pill.style.top = `${targetY}px`;
    pill.style.opacity = '0.7';
    pill.style.transform = 'scale(0.8)';
  });

  // After pill arrives, collapse the N/A item and re-render
  setTimeout(() => {
    const height = naItem.offsetHeight;
    naItem.style.transition = 'all 0.25s ease-out';
    naItem.style.height = `${height}px`;
    naItem.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      naItem.style.height = '0px';
      naItem.style.padding = '0px';
      naItem.style.margin = '0px';
    });

    setTimeout(() => {
      pill.remove();
      setManualItem(criterionId, null);
      renderManualTab();

      // Flash the restored item in the review list
      const restoredItem = manualListEl.querySelector(`[data-criterion-id="${criterionId}"]`) as HTMLDivElement;
      if (restoredItem) {
        restoredItem.style.transition = 'background-color 0.5s';
        restoredItem.style.backgroundColor = '#dcfce7';
        setTimeout(() => {
          restoredItem.style.backgroundColor = 'transparent';
        }, 600);
      }
    }, 250);
  }, 500);
}
