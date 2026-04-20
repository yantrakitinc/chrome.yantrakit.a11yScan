# F17 — AI Chat Tab

## Purpose

A chat interface powered by Chrome's built-in Gemini Nano AI. Explains violations, suggests fixes, generates action plans, and answers accessibility questions — all locally, no API key, no cost, no data leaving the browser.

## Dependencies

- F01 (Single Page Scan) — violations provide context for "Explain Further"

## Behavior

### Tab location

Fourth top-level tab: Scan | Screen Reader | Keyboard | **AI Chat**.

**Always accessible** — never disabled, even during scanning/crawling (per PHASE_MODE_CHART.md Chart 2).

### Chrome AI integration

Uses Chrome's built-in AI APIs (Gemini Nano):
- `self.ai.languageModel.create()` for chat sessions.
- Runs entirely on-device.
- No internet connection required after model download.
- No API key or billing.

### Chat interface

**Layout** (top to bottom):
1. **Header bar**: "+ New chat" button + history menu icon (☰)
2. **Message area** (scrollable): alternating user and AI messages
3. **Input area** (bottom, fixed): text input + send button

**Messages**:
- AI messages: left-aligned, gray background, with logo icon
- User messages: right-aligned, amber background
- Messages support markdown rendering (bold, code, lists)

### Entry points

1. **"Explain Further →"** on any violation element in Scan results:
   - Opens AI Chat tab.
   - Pre-loads the violation details as context.
   - AI automatically explains the violation.

2. **"+ New chat"** button:
   - Starts a freeform conversation.
   - No pre-loaded context.

### AI capabilities

1. Explain violations in plain language
2. Suggest alt text for images based on page context
3. Suggest better link text for generic "click here" links
4. Generate prioritized action plan after a scan
5. Help with manual review criteria — explain what to look for
6. Describe the screen reader experience

### Chat history

- Last **20 conversations** stored in `chrome.storage.local`.
- **Hard limit**: oldest deleted when 20 is exceeded.
- Each chat stores: timestamp, auto-generated title, full message history.

**History drawer**:
- Slides in from the right, opened by ☰ icon.
- Shows 20 chats as a list: title + timestamp.
- Click to load a chat.
- Each chat has a delete button (trash icon).

**Chat management**:
- Single delete per chat.
- Checkbox selection for bulk delete.
- "Select all" / "Delete selected" for batch operations.
- Confirmation dialog before deletion.

### Data structures

```typescript
interface iChatConversation {
  id: string;
  title: string;             // auto-generated from first message or violation name
  createdAt: string;         // ISO 8601
  messages: iChatMessage[];
}

interface iChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}
```

### Fallback

If Chrome AI is not available (older Chrome version, or model not downloaded):
- Show message: "Chrome AI is not available in this browser. Please update Chrome or enable the AI feature flag."
- Chat input is disabled.

## Acceptance Criteria

1. AI Chat tab is always accessible (never disabled).
2. "Explain Further" on violations opens AI Chat with context.
3. "+ New chat" starts a freeform conversation.
4. Chat uses Chrome's built-in Gemini Nano (local, private).
5. Messages alternate between user and AI with appropriate styling.
6. Chat history stores up to 20 conversations.
7. History drawer slides in from the right.
8. Individual and bulk delete work with confirmation.
9. Fallback message shows when Chrome AI is unavailable.
10. Input area stays fixed at bottom.
11. Messages support markdown formatting.
12. All UI fits within 360px.
13. Send button meets 24px target size.
