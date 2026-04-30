# Screen Reader tab

Reading-order analysis + speech playback. Two states: un-analyzed (Analyze button) and analyzed (rows + controls).

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#sr-analyze` | click | populate srState.elements; srAnalyzed=true | rows render | ANALYZE_READING_ORDER |
| `#sr-analyze` | click (with srState.scopeSelector set) | analyze scope only | rows scoped to selector | ANALYZE_READING_ORDER (with scopeSelector) |
| `#sr-clear` | click | reset elements/scope/srAnalyzed; stop playback | empty state | EXIT_INSPECT_MODE (if active) + CLEAR_HIGHLIGHTS |
| `#sr-inspect` | click | toggle inspectActive | sr-inspect aria-pressed flips | ENTER_INSPECT_MODE / EXIT_INSPECT_MODE |
| `#sr-clear-scope` | click | scopeSelector=null; re-analyze full page | banner removed | ANALYZE_READING_ORDER (no scope) |
| `.sr-row` | click | flash row + highlight on page | .ds-row--active for 3s | HIGHLIGHT_ELEMENT |
| `.sr-row` | keydown Enter / Space | same as click | same | HIGHLIGHT_ELEMENT |
| `.sr-speak[data-row-index]` | click (speechSynthesis available) | speak one element | row gets singleSpeakIndex highlight | (no message; uses SpeechSynthesis directly) |
| `.sr-speak` | click (no speechSynthesis) | no-op | none | none |
| `#sr-play-all` | click | playState=playing; speak all in sequence | toolbar swaps to Pause/Stop | HIGHLIGHT_ELEMENT per element + CLEAR_HIGHLIGHTS at end |
| `#sr-play-all` | click (elements=[]) | no-op | none | none |
| `#sr-pause` | click | speechSynthesis.pause; playState=paused | Resume button replaces Pause | none |
| `#sr-resume` | click | speechSynthesis.resume; playState=playing | Pause button replaces Resume | none |
| `#sr-stop` | click | stopPlayback (cancel speech, clear highlights) | toolbar back to Play All | CLEAR_HIGHLIGHTS |
| document keydown Escape (when sr panel active) | inspectActive=true | exitInspectMode | aria-pressed=false | EXIT_INSPECT_MODE |
| document keydown Escape (when sr panel active) | playState != idle | stopPlayback | toolbar back to Play All | CLEAR_HIGHLIGHTS |

## Source
- Render: `src/sidepanel/sr-tab/render.ts`, sr-tab.ts orchestrator
- Handler: `src/sidepanel/sr-tab/handlers.ts`
- Playback: `src/sidepanel/sr-tab/playback.ts`
- Escape: `src/sidepanel/sr-tab/escape.ts`
