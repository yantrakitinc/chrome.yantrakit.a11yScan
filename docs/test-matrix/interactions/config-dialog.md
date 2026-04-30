# Config dialog (test configuration modal)

HTMLDialogElement modal opened via the Settings (gear) button.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#settings-btn` | click | scanTabState.configPanelOpen=true; openConfigDialog | dialog showModal | none |
| `#config-textarea` | input | accept JSON paste | textarea value | none |
| `#config-file-input` (label `#config-upload-label`) | change | FileReader.readAsText → write to textarea | textarea populated | none |
| `#config-file-input` | change (no file) | no-op | none | none |
| `#config-apply-btn` | click (valid JSON) | validateTestConfig + state.testConfig=parsed + persist + close | dialog closes; rerender | chrome.storage.local.set |
| `#config-apply-btn` | click (config has viewports) | sync state.viewports = sorted ascending | viewports updated | chrome.storage.local.set |
| `#config-apply-btn` | click (invalid JSON) | config-error visible with message | dialog stays open | none |
| `#config-apply-btn` | click (empty textarea) | error "Paste JSON config or upload a .json file first." | dialog stays open | none |
| `#config-clear-btn` | click (visible when testConfig set) | state.testConfig=null + remove from storage + close | dialog closes; rerender | chrome.storage.local.remove |
| `#config-close-btn` | click | dialog.close() | dialog closes | none |
| dialog backdrop (click on dialog itself) | click | close (e.target === dialog check) | dialog closes | none |
| dialog | close event | onClose callback (set configPanelOpen=false) + restore focus to settings-btn (or prior focus if still in DOM) | rerender | none |

## Source
- Module: `src/sidepanel/scan-tab/config-dialog.ts`
- Settings + Reset buttons handler: `src/sidepanel/scan-tab/handlers/scan-button.ts`
