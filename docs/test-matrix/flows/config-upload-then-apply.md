# Flow: Open config dialog → upload .json → apply → state synced + persisted

## Preconditions
- Extension loaded; sidepanel open
- state.testConfig=null
- Local .json file with valid config (e.g., `{ "wcag": { "version": "2.1", "level": "AA" }, "viewports": [320, 768] }`)

## Steps

1. Click `#settings-btn`.
   - Expected: scanTabState.configPanelOpen=true; openConfigDialog called.
   - Expected: HTMLDialogElement.showModal; #config-textarea focused.

2. Click `#config-upload-label` (label wrapping `#config-file-input`).
   - Expected: native file picker opens.

3. Select the .json file from disk.
   - Expected: change event fires on #config-file-input.
   - Expected: FileReader.readAsText → onload → #config-textarea.value populated.

4. Click `#config-apply-btn`.
   - Expected: validateTestConfig called; succeeds.
   - Expected: state.testConfig = parsed config.
   - Expected: state.viewports synced to [320, 768] (sorted ascending).
   - Expected: chrome.storage.local.set with TEST_CONFIG_STORAGE_KEY + TEST_CONFIG_TIMESTAMP_KEY.
   - Expected: dialog.close().

5. Verify UI reflects loaded config.
   - Expected: testConfig indicator visible in accordion (if applicable).
   - Expected: WCAG dropdown displays "2.1 AA".
   - Expected: viewports list reflects [320, 768].

6. Click `#settings-btn` again.
   - Expected: dialog opens with existing config in textarea.
   - Expected: `#config-clear-btn` visible (because state.testConfig set).

7. Click `#config-clear-btn`.
   - Expected: state.testConfig=null.
   - Expected: chrome.storage.local.remove([TEST_CONFIG_STORAGE_KEY, TEST_CONFIG_TIMESTAMP_KEY]).
   - Expected: dialog closes.

## Verification mechanism
`e2e/verify-flow-config-upload-then-apply.ts` — pending. Will use Puppeteer page.upload to set file input.

## Status
⚠ Unverified by Puppeteer. Unit tests cover validateTestConfig + apply path.
