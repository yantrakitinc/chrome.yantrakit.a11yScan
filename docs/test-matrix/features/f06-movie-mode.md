# F06 — Movie mode

## Purpose
Animated walkthrough of tab order: cycle through every focusable element on the page, highlight + scrollIntoView + speech announce. Driven by the Keyboard tab.

## Source of truth
[F06-movie-mode.md](../../legacy/features/F06-movie-mode.md)

## Acceptance criteria

- [ ] movie-play-all button starts movie mode; sends START_MOVIE_MODE
- [ ] Each tick: highlight current element + scrollIntoView + send MOVIE_TICK to sidepanel
- [ ] Sidepanel kb-tab updates "Playing X of N" counter live + scrolls active row
- [ ] movie-pause sends PAUSE_MOVIE_MODE → halts ticks without dropping highlight
- [ ] movie-resume sends RESUME_MOVIE_MODE → resumes from current index
- [ ] movie-stop sends STOP_MOVIE_MODE → clears highlight, resets to idle
- [ ] On movie complete: MOVIE_COMPLETE broadcasts, kb-tab transitions to "complete" then 2s later "idle"
- [ ] SET_MOVIE_SPEED accepts multiplier (1× = 1000ms/element). 0/negative/NaN/Infinity silently ignored
- [ ] Escape key during movie stops it (kb-tab escape handler)
- [ ] After single-page scan with state.movie=true, movie auto-plays via SET_MOVIE_SPEED + START_MOVIE_MODE
- [ ] During crawl with movie_enabled in storage: 5s per page, START + STOP per page

## Verification mechanism
`e2e/verify-feature-f06-movie-mode.ts` — fixture with 5 focusable elements; play, advance ticks, verify highlight position + sidepanel counter; pause/resume/stop; assert state transitions.

## Structural gaps
- Real TTS audio NOT verified (Gap 3 — only utterance.text + .rate captured).
- scrollIntoView({behavior:"smooth"}) timing differs across Chrome versions; harness uses fixed waits.
