# F17 — AI chat tab

## Purpose
Local AI chat using Chrome Built-in Gemini Nano (self.ai.languageModel). Conversation history persists per-conversation in chrome.storage.local; user can load + delete past conversations.

## Source of truth
[F17-ai-chat-tab.md](../../legacy/features/F17-ai-chat-tab.md)

## Acceptance criteria

- [ ] When Chrome AI unavailable: input disabled + fallback notice in chat
- [ ] When available: input enabled
- [ ] Send message via Enter on input OR chat-send button
- [ ] User message bubble appended to chat-messages
- [ ] Typing indicator shown while AI processes
- [ ] AI response bubble appended; markdown rendered
- [ ] AI error: bubble shows "AI error: <reason>" (catch path)
- [ ] new-chat button: saves current conversation to history (if non-empty), starts fresh
- [ ] chat-history-btn opens history drawer (transform: translateX(0))
- [ ] history-drawer shows list of conversations with title (first 60 chars of first message) + createdAt
- [ ] Click history card OR Enter/Space loads conversation into chat-messages
- [ ] history-delete button + confirm() dialog removes conversation
- [ ] close-history button hides drawer (translateX(100%))
- [ ] openAiChatWithContext (from Explain Further button on a violation): pre-fills input + sends
- [ ] Empty/whitespace input: send is no-op

## Verification mechanism
`e2e/verify-feature-f17-ai-chat-tab.ts` — stub self.ai.languageModel with deterministic mock; send message, verify bubble + history persistence, load + delete from history.

## Structural gaps
- Real Chrome AI inference NOT verified (Gap 6) — uses mock that returns deterministic strings.
- Markdown renderer correctness NOT exhaustively tested.
