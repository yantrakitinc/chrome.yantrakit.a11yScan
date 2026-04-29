/**
 * Manual Review tab body. Pure — given WCAG version/level + the active scan's
 * pageElements + current review state, returns the full HTML.
 */

import type { iPageElements } from "@shared/types";
import { getManualReviewCriteria } from "@shared/wcag-mapping";

/**
 * Render the Manual Review tab body. Filters criteria by relevantWhen
 * against pageElements, then per-criterion shows pass/fail/na buttons with
 * aria-pressed reflecting current state.
 */
export function renderManualReviewHtml(s: {
  wcagVersion: string;
  wcagLevel: string;
  pageElements: iPageElements | null;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
}): string {
  const criteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const filtered = s.pageElements
    ? criteria.filter((c) => {
        if (!c.relevantWhen) return true;
        return s.pageElements![c.relevantWhen as keyof typeof s.pageElements];
      })
    : criteria;

  const reviewed = Object.values(s.manualReview).filter((v) => v !== null).length;

  return `
    <div class="scan-pane">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:var(--ds-zinc-600);font-weight:600">${filtered.length} criteria need human review</span>
        <span style="font-size:11px;font-weight:700;color:var(--ds-amber-700)">${reviewed} of ${filtered.length} reviewed</span>
      </div>
      ${filtered.map((c) => {
        const status = s.manualReview[c.id] || null;
        return `
          <div style="padding:var(--ds-space-4);border:1px solid var(--ds-zinc-200);border-radius:var(--ds-radius-3);background:#fff;margin-bottom:6px" data-criterion="${c.id}">
            <div style="display:flex;align-items:center;gap:var(--ds-space-4)">
              <span class="f-1" style="font-size:11px;font-weight:700;color:var(--ds-zinc-800);min-width:0">${c.id} ${c.name}</span>
              <div class="fs-0" style="display:flex;gap:var(--ds-space-1)">
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="pass" aria-pressed="${status === "pass"}" aria-label="Mark ${c.id} ${c.name} as Pass" style="padding:var(--ds-space-2) var(--ds-space-4);font-size:11px;font-weight:700;border-radius:var(--ds-radius-3);min-width:24px;border:none;${status === "pass" ? "background:var(--ds-green-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">Pass</button>
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="fail" aria-pressed="${status === "fail"}" aria-label="Mark ${c.id} ${c.name} as Fail" style="padding:var(--ds-space-2) var(--ds-space-4);font-size:11px;font-weight:700;border-radius:var(--ds-radius-3);min-width:24px;border:none;${status === "fail" ? "background:var(--ds-red-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">Fail</button>
                <button class="manual-btn cur-pointer min-h-24" data-id="${c.id}" data-status="na" aria-pressed="${status === "na"}" aria-label="Mark ${c.id} ${c.name} as Not Applicable" style="padding:var(--ds-space-2) var(--ds-space-4);font-size:11px;font-weight:700;border-radius:var(--ds-radius-3);min-width:24px;border:none;${status === "na" ? "background:var(--ds-zinc-700);color:#fff" : "background:var(--ds-zinc-100);color:var(--ds-zinc-600)"}">N/A</button>
              </div>
            </div>
            <div style="font-size:11px;color:var(--ds-zinc-600);line-height:1.5;margin-top:4px">${c.manualCheck}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
