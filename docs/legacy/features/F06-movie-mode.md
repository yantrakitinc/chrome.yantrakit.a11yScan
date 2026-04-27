# F06 — Movie Mode

## Purpose

Animated walkthrough of the keyboard tab order. Steps through each focusable element one at a time — scrolls to it, highlights it, pauses, then moves to the next. Helps users visualize how keyboard-only users navigate the page.

## Who needs it

Consultants demonstrating keyboard issues to clients, QA verifying tab order makes sense, developers seeing their tab order in action, stakeholders understanding a11y in visual terms.

## Dependencies

- F01 (Single Page Scan) — scan must complete before movie plays
- F05 (Visual Overlays) — uses the same overlay infrastructure

## Behavior

### Activation

Movie Mode controls live in the **Keyboard tab**, at the top of the Tab Order section — same UX pattern as the Screen Reader tab's Play All. Available after Keyboard tab Analyze completes.

Controls (icon-only buttons with aria-labels):
- **Play All** (▶) — starts the animated walkthrough
- **Pause** (⏸) — appears during playback
- **Stop** (⏹) — appears during playback
- Progress text: "Playing X of Y" or "Paused at X of Y"

Movie Mode is a post-analyze action — click Play All to start animating through the tab order.

### Movie speed

Speed is set via Test Config (not the UI). Configurable via Test Config Builder under Timing options. Default speed: 1× (1 second per element).
- 0.5× (2 seconds per element)
- 1× (1 second per element) — default
- 2× (0.5 seconds per element)
- 4× (0.25 seconds per element)

Movie speed dropdown is always enabled, even during scanning (per PHASE_MODE_CHART.md Chart 2).

### Playback

State machine:

```
Idle → Playing → Paused → Playing → ... → Complete → Idle
                    ↓
                  Stopped → Idle
```

For each focusable element (in tab order):
1. Scroll element into view (smooth scroll).
2. Highlight element with animated border ring (pulsing amber outline).
3. Show overlay badge with current index / total (e.g., "5/23").
4. Wait for the speed-determined duration.
5. Remove highlight, advance to next element.

### Controls

Movie Mode controls live in the **Keyboard tab** (F16) — that's its natural home. The Keyboard tab has a Play button that starts the walkthrough.

In the Scan tab, Movie Mode is a toggle that enables/disables automatic playback after scans. There is no play/pause button in the Scan tab.

### Interaction with other modes

- **Movie + Crawl**: after each page is scanned, movie plays through the tab order, then crawl advances to next page.
- **Movie + Observer**: after each auto-scan, movie plays on that page.
- **Movie + Crawl + Observer**: movie plays after each crawl page scan; during crawl pause with observer active, movie plays after manual scans.

### Escape key

Pressing Escape during movie playback stops the movie immediately and removes the highlight overlay.

### Data structures

```typescript
type iMovieState = "idle" | "playing" | "paused" | "complete";

interface iMovieConfig {
  speed: 0.5 | 1 | 2 | 4;  // multiplier, 1× = 1s per element
}
```

## Acceptance Criteria

1. Movie toggle enables/disables auto-play after scans.
2. Movie speed dropdown shows 0.5×, 1×, 2×, 4× options.
3. Movie speed dropdown defaults to 1×.
4. Movie speed can be changed during scanning (always enabled).
5. After scan completes with Movie on, animated walkthrough plays automatically.
6. Each element is scrolled into view, highlighted with animated ring, and has index badge.
7. Playback advances at the configured speed.
8. Escape key stops playback immediately.
9. Movie plays on each page during crawl before advancing.
10. Movie highlight uses overlay infrastructure (Shadow DOM).
11. Movie does not change the results content (visual walkthrough only, on the page).
