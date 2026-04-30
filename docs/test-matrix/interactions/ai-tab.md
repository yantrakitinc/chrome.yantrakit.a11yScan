# AI Chat tab

Local Chrome AI chat with conversation history.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#chat-input` | render (Chrome AI unavailable) | disabled + fallback notice in chat-messages | input greyed out | none |
| `#chat-input` | render (Chrome AI available) | enabled | input ready | none |
| `#chat-input` | keydown Enter | handleSend | typing indicator → AI bubble | self.ai.languageModel.create + .prompt |
| `#chat-send` | click | handleSend | same | same |
| `#chat-input` | empty/whitespace + send | no-op (early return) | none | none |
| AI prompt throws | catch path | bubble shows "AI error: <msg>" | red-ish bubble | none |
| `#new-chat` | click (currentMessages non-empty) | save to history + clear | empty chat + history persisted | chrome.storage.local.set chatHistory |
| `#new-chat` | click (currentMessages empty) | clear (no save) | empty chat | none |
| `#chat-history-btn` | click | toggle drawer; if opening → renderHistoryPanel | translateX(0) ↔ translateX(100%) | none |
| openAiHistoryPanel() (external call) | invoke | force-open drawer + render | translateX(0) | none |
| `.history-load[data-id]` | click | load conversation into chat-messages | drawer closes; messages populated | none |
| `.history-load` | keydown Enter / Space | same as click | same | none |
| `.history-delete[data-id]` | click | confirm() → deleteConversation + re-render drawer | row removed | chrome.storage.local.set chatHistory |
| `.history-delete` | click + confirm=false | no-op | none | none |
| `#close-history` | click | hide drawer | translateX(100%) | none |
| openAiChatWithContext(rule, desc) | external call (Explain Further button) | pre-fill input + handleSend | input populated; bubble appears | self.ai prompt |

## Source
- Module: `src/sidepanel/ai-tab.ts` (single file — uses local interfaces)
