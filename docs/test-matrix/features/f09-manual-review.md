# F09 — Manual review

## Purpose
Manual sub-tab lists every WCAG 2.2 AA criterion that requires human judgment with Pass / Fail / N/A toggle buttons. State persists per-page-URL via chrome.storage.local.

## Source of truth
[F09-manual-review.md](../../legacy/features/F09-manual-review.md)

## Acceptance criteria

- [ ] Manual sub-tab renders one row per manual-review WCAG criterion
- [ ] Each row has 3 toggle buttons: Pass / Fail / N/A
- [ ] Click Pass → state.manualReview[criterion] = "pass"; visual highlight on Pass button
- [ ] Click same button again → toggles to null (deselected)
- [ ] Click Pass then Fail → flips to "fail"
- [ ] State persists in chrome.storage.local under key `manualReview_<url-slug>`
- [ ] Re-scanning the same URL restores prior manual review
- [ ] Different URLs have independent manual review state
- [ ] Manual review state included in JSON / HTML / PDF export reports
- [ ] Clear button wipes manual review for the current scan

## Verification mechanism
`e2e/verify-feature-f09-manual-review.ts` — scan fixture, set 3 different statuses, reload sidepanel, re-scan same URL, verify state restored.

## Structural gaps
- chrome.storage.local persistence verified via storage spy in test harness — real persistence across browser restart NOT verified by automated tests.
