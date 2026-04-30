# F13 — Test configuration

## Purpose
Modal dialog for pasting/uploading a JSON config that overrides WCAG settings, viewports, page rules, auth, mocks, rule include/exclude, timing, and selectors. Persists in chrome.storage.local.

## Source of truth
[F13-test-configuration.md](../../legacy/features/F13-test-configuration.md)

## Acceptance criteria

- [ ] settings-btn opens config-dialog modal (HTMLDialogElement.showModal)
- [ ] config-textarea accepts pasted JSON
- [ ] config-file-input accepts .json upload via FileReader
- [ ] config-apply-btn validates JSON via validateTestConfig + sets state.testConfig + persists to storage + closes dialog
- [ ] Invalid JSON: config-error shows message; dialog stays open
- [ ] Empty textarea on Apply: error "Paste JSON config or upload a .json file first."
- [ ] Apply with config.viewports: state.viewports synced (sorted ascending)
- [ ] config-clear-btn (visible when testConfig set): clears state.testConfig + removes from storage + closes dialog
- [ ] config-close-btn or backdrop click: closes dialog without saving
- [ ] Focus restoration: closes dialog → returns focus to settings-btn (or prior focus if still in DOM)
- [ ] testConfig persists across sidepanel reload (loaded from storage on init)
- [ ] Reset button (R-MV) clears testConfig + removes from storage

## Verification mechanism
`e2e/verify-feature-f13-test-configuration.ts` — paste valid + invalid JSON, upload .json file, verify viewports sync, clear, close.

## Structural gaps
- HTMLDialogElement showModal/close require polyfill in jsdom unit tests; real Chrome dialog focus-trap behavior verified by Puppeteer e2e.
