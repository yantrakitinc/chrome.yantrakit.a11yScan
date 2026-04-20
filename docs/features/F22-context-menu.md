# F22 — Context Menu

## Purpose

Right-click the extension icon to access quick actions without opening the side panel.

## Dependencies

- None

## Behavior

### Menu items

Registered via `chrome.contextMenus` API on extension install:

1. **Open Panel** — opens the side panel (`chrome.sidePanel.open()`)
2. **Settings** — opens the side panel with settings/config view active
3. **Chat History** — opens the side panel with AI Chat tab and history drawer open
4. **Clear All Data** — clears all stored data with confirmation dialog

### Open Panel behavior

If the side panel is **already open** when "Open Panel" is clicked, the action is a no-op — `chrome.sidePanel.open()` is still called, but Chrome handles the already-open case gracefully (no visible change, no error). There is no "bring to front" behavior because the side panel is always attached to the browser window and does not have focus-stealing semantics.

### Settings navigation

"Settings" performs the following sequence after the side panel is open:

1. Open the side panel (same as "Open Panel"). If it is already open, proceed immediately.
2. Navigate to the **Scan** tab (the tab that contains the test configuration controls).
3. Expand the **Settings accordion** section within the Scan tab (if it is not already expanded).
4. Scroll the panel so that the settings gear icon or section header is visible at the top of the panel viewport.

This is coordinated via a message posted to the panel via `chrome.runtime.sendMessage({ action: "navigate", target: "settings" })`. The panel listens for this message and drives the navigation sequence.

### Chat History behavior

"Chat History" performs the following sequence after the side panel is open:

1. Open the side panel. If it is already open, proceed immediately.
2. Navigate to the **AI Chat** tab.
3. Open the **chat history drawer** (the slide-in drawer listing past conversations).

This is coordinated via `chrome.runtime.sendMessage({ action: "navigate", target: "chatHistory" })`. The panel listens and drives the sequence.

### Clear All Data confirmation

Uses a `confirm()` dialog with the following exact text:

> **Delete all A11y Scan data?**
>
> This will permanently delete:
> - Scan results
> - Observer history
> - Chat history
> - Test configuration
> - Crawl state
> - Manual review state
>
> This cannot be undone.

The `confirm()` call is: `confirm("Delete all A11y Scan data?\n\nThis will permanently delete:\n• Scan results\n• Observer history\n• Chat history\n• Test configuration\n• Crawl state\n• Manual review state\n\nThis cannot be undone.")`.

On confirm (`true`), the following data is cleared:

| Data | Storage key | Clear method |
|---|---|---|
| Observer state | `observer_state` | `chrome.storage.local.remove("observer_state")` |
| Observer history | `observer_history` | `chrome.storage.local.remove("observer_history")` |
| Crawl state | `crawlState` | `chrome.storage.local.remove("crawlState")` |
| Config cache | `a11yscan_config` | `chrome.storage.local.remove("a11yscan_config")` |
| Config timestamp | `a11yscan_config_timestamp` | `chrome.storage.local.remove("a11yscan_config_timestamp")` |
| Chat history | `chatHistory` | `chrome.storage.local.remove("chatHistory")` — not yet implemented |
| Manual review state | `manualReviewState` | `chrome.storage.local.remove("manualReviewState")` — not yet implemented |

**Note:** Chat history and manual review state storage keys are not yet implemented in the codebase. The keys listed above are the planned keys. When implemented, they must match these values exactly.

After all keys are removed, `chrome.runtime.sendMessage({ action: "stateCleared" })` is dispatched so the open panel (if any) resets its in-memory state to defaults.

On cancel (`false`), no action is taken.

## Acceptance Criteria

1. Right-clicking extension icon shows 4 menu items.
2. "Open Panel" opens the side panel; if already open, it is a no-op.
3. "Settings" opens the side panel, navigates to the Scan tab, expands the Settings accordion, and scrolls it into view.
4. "Chat History" opens the side panel, navigates to the AI Chat tab, and opens the history drawer.
5. "Clear All Data" shows the exact confirmation text specified above before clearing.
6. On confirm, all six data categories (scan results, observer history, chat history, test config, crawl state, manual review state) are cleared from `chrome.storage.local` and in-memory state is reset.
7. On cancel, no data is cleared.
