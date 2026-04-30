# F15 — Screen Reader tab

## Purpose
Render the page's reading order as a list with role + accessible name + states for each element. Play All speaks the entire reading order via SpeechSynthesis; per-row speak buttons speak one element.

## Source of truth
[F15-screen-reader-tab.md](../../legacy/features/F15-screen-reader-tab.md)

## Acceptance criteria

- [ ] sr-analyze button sends ANALYZE_READING_ORDER; populates srState.elements
- [ ] sr-clear resets elements + scope + state, returns to un-analyzed empty state
- [ ] sr-inspect toggles inspect mode (sends ENTER_INSPECT_MODE / EXIT_INSPECT_MODE); pick element on page sets sr scope
- [ ] sr-clear-scope clears scope + re-analyzes whole page
- [ ] Each row shows index + role badge + accessible name + states (expanded/collapsed/checked/required/disabled/etc.)
- [ ] Row click sends HIGHLIGHT_ELEMENT for the row's selector
- [ ] Enter key on row triggers same path
- [ ] sr-speak button (per row) speaks one element via SpeechSynthesis
- [ ] sr-play-all speaks all elements in sequence with row-by-row highlight + scrollIntoView
- [ ] sr-pause / sr-resume / sr-stop control playback (speechSynthesis.pause/resume/cancel)
- [ ] On finish: 2-second "Complete" pill, then revert to idle
- [ ] Escape key during inspect → exits inspect; during playback → stops
- [ ] Container roles (navigation/region) speak their scoped subtree, not just the container's own text
- [ ] testConfig.timing.movieSpeed scales utterance.rate (1× default)

## Verification mechanism
`e2e/verify-feature-f15-screen-reader-tab.ts` — fixture with mixed roles; analyze, capture rows, drive play-all via onend invocation, assert state transitions + sent CLEAR_HIGHLIGHTS at end.

## Structural gaps
- Real TTS audio NOT verified (Gap 3) — only utterance text + rate captured.
