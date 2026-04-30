# Flow: Scan with state.movie=true → movie auto-plays after scan completes

## Preconditions
- Extension loaded; sidepanel open
- Active tab has ≥3 focusable elements
- state.movie=true (Movie mode toggle ON via `.mode-btn[data-mode="movie"]`)
- state.scanPhase=idle

## Steps

1. Click `.mode-btn[data-mode="movie"]` to enable Movie mode.
   - Expected: state.movie=true; aria-pressed=true on `.mode-btn.mode-movie`.
   - Expected: persisted to chrome.storage.local under `movie_enabled`.

2. Click `#scan-btn`. Wait for SCAN_RESULT.
   - Expected: scan completes; state.scanPhase=results.
   - Expected: side panel renders Results sub-tab + toolbar.

3. After scan completes, the scan handler dispatches SET_MOVIE_SPEED + START_MOVIE_MODE
   to the active tab.
   - Expected: content-script `movie-mode.ts` collects focusable elements, paints
     a position:fixed div with `#f59e0b` border + an "N/M" badge over the
     current element, and schedules a 1s tick.

4. After ~1s tick:
   - Expected: the badge text advances to the next index (e.g., 1/4 → 2/4).
   - Expected: the highlight overlay's rect now matches the next focusable
     element's bounding rect.

5. STOP_MOVIE_MODE message removes the overlay (or scan/cleanup unloads it).

## Verification mechanism
`e2e/verify-flow-movie-auto-play-after-scan.ts`.

## Status
⚠ Unverified by Puppeteer until PR #128 lands.

## Structural gaps
- Real TTS audio NOT verified (Gap 3) — only the page-side highlight overlay is asserted.
- The sidepanel KB tab does NOT show movie controls until the user explicitly clicks Analyze. This flow asserts the page-side auto-play, not the sidepanel UI surfacing.
