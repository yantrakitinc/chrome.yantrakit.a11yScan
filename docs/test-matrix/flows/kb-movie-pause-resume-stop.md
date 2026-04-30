# Flow: Movie mode play → pause → resume → stop full lifecycle

## Preconditions
- Extension loaded; sidepanel open
- Active tab has at least 5 focusable elements (e.g., 5 buttons)
- KB tab activated; kbState analyzed

## Steps

1. Click `#movie-play-all`.
   - Expected: START_MOVIE_MODE sent.
   - Expected: kbState.moviePlayState="playing"; movieIndex=0.
   - Expected: toolbar swaps to Pause + Stop; "Playing 1 of 5" counter visible.
   - Expected: first focusable element highlighted on page.

2. Wait 1 second.
   - Expected: MOVIE_TICK with currentIndex=1 received → onMovieTick → movieIndex=1; "Playing 2 of 5".
   - Expected: row 2 in kb-tab gets active highlight.
   - Expected: row 2 scrollIntoView (smooth/nearest).

3. Click `#movie-pause`.
   - Expected: PAUSE_MOVIE_MODE sent; kbState.moviePlayState="paused".
   - Expected: toolbar swaps Pause→Resume; current highlight stays.
   - Expected: no further MOVIE_TICK messages until resume.

4. Click `#movie-resume`.
   - Expected: RESUME_MOVIE_MODE sent; kbState.moviePlayState="playing".
   - Expected: toolbar swaps Resume→Pause; tick chain restarts.

5. Wait until movie completes (5 elements total).
   - Expected: MOVIE_COMPLETE message → onMovieComplete → kbState.moviePlayState="complete".
   - Expected: "Complete" pill shows for 2s.
   - Expected: after 2s, kbState.moviePlayState="idle"; movieIndex=0.
   - Expected: toolbar back to Play All.

6. Re-test: click Play All again → click Stop early.
   - Expected: STOP_MOVIE_MODE sent; kbState.moviePlayState="idle" immediately.
   - Expected: highlight cleared; toolbar back to Play All.

7. Click Play All → press Escape on document while movie active.
   - Expected: KB-tab escape handler fires; STOP_MOVIE_MODE sent.

## Verification mechanism
`e2e/verify-flow-kb-movie-pause-resume-stop.ts` — pending.

## Status
⚠ Unverified by Puppeteer. Unit tests in kb-tab + movie-mode tests cover state transitions.
