# Keyboard tab

Tab order + focus gaps + focus indicators + keyboard traps + skip links + movie mode controls.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#kb-analyze` | click | parallel: GET_TAB_ORDER + GET_FOCUS_GAPS + GET_FOCUS_INDICATORS + GET_KEYBOARD_TRAPS + GET_SKIP_LINKS | rows + sections render | 5 GET_* messages |
| `#kb-clear` | click | reset all kbState; un-analyzed empty state | empty | none |
| `.kb-row` | click | highlight that element on page; flash row | .ds-row--active 3s | HIGHLIGHT_ELEMENT |
| `.kb-row` | keydown Enter | same as click | same | HIGHLIGHT_ELEMENT |
| `.kb-gap` | click | highlight gap selector + flash | .ds-flash-active 3s | HIGHLIGHT_ELEMENT |
| `.kb-fi` | click | highlight focus-indicator selector + flash | .ds-flash-active 3s | HIGHLIGHT_ELEMENT |
| `.kb-trap` | click | highlight trap selector + flash | .ds-flash-active 3s | HIGHLIGHT_ELEMENT |
| `#movie-play-all` | click | START_MOVIE_MODE | toolbar swaps to Pause/Stop; "Playing 1 of N" counter | START_MOVIE_MODE |
| `#movie-pause` | click | PAUSE_MOVIE_MODE | Resume button replaces Pause | PAUSE_MOVIE_MODE |
| `#movie-resume` | click | RESUME_MOVIE_MODE | Pause button replaces Resume | RESUME_MOVIE_MODE |
| `#movie-stop` | click | STOP_MOVIE_MODE | toolbar back to Play All | STOP_MOVIE_MODE |
| `#toggle-tab-order` | change (on) | tabOrderOverlayOn=true | checkbox checked | SHOW_TAB_ORDER |
| `#toggle-tab-order` | change (off) | tabOrderOverlayOn=false | checkbox unchecked | HIDE_TAB_ORDER |
| `#toggle-focus-gaps` | change (on) | focusGapsOverlayOn=true | checkbox checked | SHOW_FOCUS_GAPS |
| `#toggle-focus-gaps` | change (off) | focusGapsOverlayOn=false | checkbox unchecked | HIDE_FOCUS_GAPS |
| document keydown Escape (when kb panel active + movie playing) | stop movie | toolbar back to idle | STOP_MOVIE_MODE |
| MOVIE_TICK message | runtime onMessage | onMovieTick(currentIndex) → update counter + scroll active row | "Playing X of N" updated | none |
| MOVIE_COMPLETE message | runtime onMessage | onMovieComplete → "Complete" pill 2s → idle | toolbar back | none |

## Source
- Render: `src/sidepanel/kb-tab/render.ts`, kb-tab.ts orchestrator
- Handler: `src/sidepanel/kb-tab/handlers.ts`
- Movie: `src/sidepanel/kb-tab/movie.ts`
- Escape: `src/sidepanel/kb-tab/escape.ts`
