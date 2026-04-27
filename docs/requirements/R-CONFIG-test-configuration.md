# R-CONFIG — Test Configuration Modal

## Purpose

Allow users to load a JSON test configuration that overrides default extension behavior. The config validates against `00-test-config-schema.md`. Persisted in `chrome.storage.local`.

## UI: Settings (gear) button

Lives in the Scan tab accordion's expanded toggle row, between the WCAG level select and the Reset button.

```
[⚙ Settings]    [Config loaded]   ← amber badge (only when state.testConfig !== null)
```

- Square 28×28 icon button, gear SVG inside
- `aria-label="Test configuration"`
- `aria-expanded` reflects whether the modal is open
- When `state.testConfig` is set, the gear icon is amber (`color: var(--ds-amber-700)`); otherwise gray
- The "Config loaded" badge is a `.ds-badge.ds-badge--info` shown next to the gear

## Modal

Native `<dialog id="config-dialog" class="ds-modal">`.

When user clicks the gear button:

1. Save `document.activeElement` to `state.dialogReturnFocus`.
2. Render the modal body.
3. Call `dialog.showModal()`.
4. Focus the textarea.

### Modal body

```
┌────────────────────────────────────────┐
│ Test Configuration               [✕]   │
├────────────────────────────────────────┤
│ Open Builder ↗                          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ {                                    │ │
│ │   "wcag": { "version": "2.2", ... } │ │
│ │ }                                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [error message — only when invalid]     │
│                                         │
│ [ Apply ]  [ Upload .json ]  [ Clear ]  │
└────────────────────────────────────────┘
```

Elements:
- Heading: "Test Configuration" (`<h2 id="config-dialog-title">`).
- Close button (× icon) — `aria-label="Close"`, top-right.
- Open Builder link to https://a11yscan.yantrakit.com/tools/test-config-builder (opens in new tab).
- Textarea `id="config-textarea"`:
  - Pre-filled with the current `state.testConfig` JSON (or empty).
  - Border amber if config is loaded, gray otherwise.
  - `aria-label="Paste config JSON here"`.
  - Placeholder shows a JSON example.
- Error region `id="config-error"` with `role="alert" aria-live="polite"`. Hidden by default.
- Apply button: primary CTA. `class="ds-btn ds-btn--md ds-btn--primary"`.
- Upload button (label wrapping a hidden file input): secondary. Accepts `.json`.
- Clear Config button: only shown when `state.testConfig !== null`. Destructive.

### Apply behavior

1. Read textarea value, trim.
2. If empty: error "Paste JSON config or upload a .json file first." Show in error region. Don't close.
3. Parse + validate via `validateTestConfig(text)` — see schema doc.
4. On error: error message in red. Don't close.
5. On success: `state.testConfig = parsed`. Persist to `chrome.storage.local` under key `a11yscan_test_config`. Close the dialog.

### Upload behavior

1. User selects a `.json` file.
2. File reader reads as text.
3. Sets the textarea value to the file contents.
4. User must still click Apply to validate and load.

### Clear Config behavior

1. `state.testConfig = null`.
2. Remove from `chrome.storage.local`.
3. Close the dialog.

### Close (× button)

`dialog.close()`. The native `close` event handler restores focus.

### Backdrop click

Clicking outside the dialog (on the backdrop) closes it. Implemented as:

```javascript
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
}, { once: false });  // attached once per dialog open via openConfigDialog
```

To prevent listener stacking on multiple opens, the dialog click + close listeners are attached ONCE at app init, not per `openConfigDialog()` call. They reference the current state (which is updated each time).

### Escape key

Native `<dialog>` handles Escape automatically.

### Close behavior (focus restoration)

On the dialog's `close` event:

1. Restore focus to `state.dialogReturnFocus` (the gear button) if still in DOM.
2. Clear `state.dialogReturnFocus`.

## State

```typescript
state.testConfig: iTestConfig | null;
state.dialogReturnFocus: HTMLElement | null;
```

## Persistence

`chrome.storage.local` key: `a11yscan_test_config` (alongside `a11yscan_test_config_timestamp`).

On panel open: `getSavedTestConfig()` retrieves and applies if present.

## Test config consumption

This feature loads the config but does not consume it itself. Other features consume.

## Test cases

### E2E

1. Click gear icon → modal opens. Textarea is focused.
2. Paste valid JSON, click Apply → modal closes. "Config loaded" badge appears.
3. Paste invalid JSON → error message shown, modal stays open.
4. Click ✕ → modal closes, focus returns to gear button.
5. Click backdrop → modal closes.
6. Press Escape → modal closes.
7. Click Upload .json → file picker opens, selecting a file populates the textarea.
8. With config loaded, click Clear Config → config cleared, badge disappears.
9. Open and close the modal 5 times — listeners do not stack (verified by no duplicate close handlers firing).
10. Reload extension → testConfig persists.

### Unit

1. `validateTestConfig` accepts shape per schema, rejects invalid types.
2. `validateTestConfig` rejects when both `rules.include` and `rules.exclude` present.
3. `validateTestConfig` accepts unknown top-level keys (forward-compat).
