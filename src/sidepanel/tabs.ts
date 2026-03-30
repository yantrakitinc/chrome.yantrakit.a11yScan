/**
 * Tab switching logic for the side panel.
 */

export function initTabs(
  tabsEl: HTMLDivElement,
  tabResults: HTMLDivElement,
  tabManual: HTMLDivElement,
  tabAria: HTMLDivElement
): void {
  tabsEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab') as HTMLButtonElement;
    if (!btn) return;
    const tab = btn.dataset.tab;

    tabsEl.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('text-indigo-950', 'border-indigo-950');
      t.classList.add('text-zinc-500', 'border-transparent');
    });
    btn.classList.remove('text-zinc-500', 'border-transparent');
    btn.classList.add('text-indigo-950', 'border-indigo-950');

    tabResults.hidden = tab !== 'results';
    tabManual.hidden = tab !== 'manual';
    tabAria.hidden = tab !== 'aria';
  });
}
