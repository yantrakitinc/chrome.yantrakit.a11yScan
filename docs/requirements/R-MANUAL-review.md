# R-MANUAL — Manual Review Checklist

## Purpose

WCAG criteria that cannot be automated (53 at WCAG 2.2 AA) presented as a checklist for human evaluation. User marks each Pass / Fail / N/A.

## Activation

Lives in the **Manual** sub-tab of the Scan tab. Visible after a scan has completed.

## Filtering

Criteria are filtered to those relevant to the current page. Each criterion in `WCAG_CRITERIA` (in `src/shared/wcag-mapping.ts`) optionally has `relevantWhen: (pageElements: iPageElements) => boolean`. If absent, the criterion always applies. If present, filter against `state.lastScanResult.pageElements`.

Examples:
- "1.2.1 Audio-only and Video-only" — only relevant if page has `<audio>` or `<video>`.
- "2.4.3 Focus Order" — always relevant.

The `pageElements` summary is computed in the content script during scan (counts of video, audio, forms, images, iframes, etc.).

## UI

Filtered list of criteria. For each:

```
[Criterion ID] [Title]                                    [Pass] [Fail] [N/A]
1.4.3          Contrast (Minimum)                         [✓]    [✗]    [—]
```

| Cell | Description |
|---|---|
| Criterion ID | "1.4.3" — links to `https://a11yscan.yantrakit.com/wcag/{id}` (opens in new tab) |
| Title | Short title from WCAG_CRITERIA |
| Pass / Fail / N/A buttons | Three buttons. Active: filled background. Inactive: muted gray. |

Each row is a `.ds-row--manual` (a manual-review row variant). Three buttons inline.

Buttons:
- Pass: `class="ds-btn ds-btn--sm ds-btn--manual ds-btn--manual-pass"`. Active state: bg `--ds-green-700`, text white.
- Fail: `class="ds-btn ds-btn--sm ds-btn--manual ds-btn--manual-fail"`. Active state: bg `--ds-red-700`, text white.
- N/A: `class="ds-btn ds-btn--sm ds-btn--manual ds-btn--manual-na"`. Active state: bg `--ds-zinc-700`, text white.

Each button has `aria-pressed` reflecting whether it is the current selection.

### Click behavior

Click Pass → set `state.manualReview[criterionId] = "pass"`. If already "pass", clicking again clears (toggle off). Same for Fail and N/A.

## Persistence

`state.manualReview` is persisted to `chrome.storage.local` under key `manualReview_{origin}_{pathname}` (per-page). When the user re-opens the side panel on the same page, state is restored.

For new pages: `state.manualReview` resets to `{}`.

## State

```typescript
state.manualReview: Record<string, "pass" | "fail" | "na" | null>;
```

## Manual review in exports

Manual review state is included in JSON, HTML, and PDF exports. See R-EXPORT.

## Test config consumption

This feature does NOT consume test config.

## Test cases

### E2E

1. After scan on a page with video + form, the Manual sub-tab shows criteria including "1.2.1 Audio-only and Video-only" and "3.3.2 Labels or Instructions".
2. Click Pass on a criterion → button shows active green; subsequent button click toggles off.
3. Switch top tab away and back → manual review state persists.
4. Reload extension on same page → state restored from storage.
5. Navigate to a different page → state resets.
6. Manual review state appears in JSON export.

### Unit

1. `getManualReviewCriteria(version, level)` returns 53 entries for "2.2" + "AA".
2. Filter by `relevantWhen` correctly: if `pageElements.hasVideo === false`, video-only criterion is excluded.
3. Toggle behavior: setting same status twice clears.
