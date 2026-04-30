# Flow: Manual review state persists across re-scan + sidepanel reload

## Preconditions
- Extension loaded; sidepanel open
- Active tab on Page A (URL has at least 5 manual-review WCAG criteria)
- state.manualReview = {} (no prior state for this URL)

## Steps

1. Click `#scan-btn`. Wait for results.
2. Click `#subtab-manual`.
   - Expected: Manual sub-tab activates; one row per manual criterion with Pass/Fail/N/A buttons.

3. Click Pass for criterion 1.4.3.
   - Expected: state.manualReview["1.4.3"]="pass"; chrome.storage.local.set fired with key `manualReview_<urlSlug>`.

4. Click Fail for criterion 2.4.7.
   - Expected: state.manualReview["2.4.7"]="fail"; persisted.

5. Click N/A for criterion 3.3.2.
   - Expected: state.manualReview["3.3.2"]="na"; persisted.

6. Click `#scan-btn` to re-scan same URL.
   - Expected: SCAN_REQUEST sent; new SCAN_RESULT.
   - Expected: loadManualReviewFor restores state.manualReview from storage.
   - Expected: prior 3 selections still highlighted on Manual sub-tab.

7. Reload the sidepanel (open/close).
   - Expected: state empty; click Scan Page; manual review restored from storage.

8. Click Pass for criterion 1.4.3 a second time.
   - Expected: state.manualReview["1.4.3"]=null (toggled off); persisted.

9. Click Pass for criterion 2.4.7 (was Fail).
   - Expected: state.manualReview["2.4.7"]="pass" (flip).

## Verification mechanism
`e2e/verify-flow-manual-review-persistence.ts` — pending.

## Status
⚠ Unverified by Puppeteer.
