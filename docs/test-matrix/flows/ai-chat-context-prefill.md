# Flow: Click "Explain Further" on a violation → AI tab opens with context pre-filled

## Preconditions
- Extension loaded; sidepanel open
- Chrome AI flag enabled (or test with mocked self.ai)
- Active tab has violations
- Top tab is Scan; Sub-tab is Results

## Steps

1. Scan page, results render.
2. Locate a violation row (e.g., id="color-contrast", impact="serious").
3. Click `.explain-btn[data-rule][data-description]` for that row.
   - Expected: switchTab("ai") fires; top tab swaps to AI Chat.
   - Expected: setTimeout(() => openAiChatWithContext(rule, description), 0).

4. After the deferred call:
   - Expected: chat-input populated with text mentioning the rule id + description.
   - Expected: handleSend triggered automatically.
   - Expected: typing indicator shown; AI response bubble appears.
   - Expected: chat-messages contains both user prompt + AI response.

5. Verify the rule id ("color-contrast") appears in user message bubble.
6. Verify the description appears in user message bubble.
7. Verify a non-empty AI response bubble follows.

## Verification mechanism
`e2e/verify-flow-ai-chat-context-prefill.ts` — pending. Will use stubbed self.ai.

## Status
⚠ Unverified by Puppeteer. Unit tests in ai-tab tests cover openAiChatWithContext.

## Structural gaps
- Real Chrome AI inference NOT verified (Gap 6) — uses deterministic stub.
