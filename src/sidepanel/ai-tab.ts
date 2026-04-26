/**
 * AI Chat tab (F17).
 * Uses Chrome's built-in Gemini Nano for local AI.
 */

/* ═══════════════════════════════════════════════════════════════════
   Data structures
   ═══════════════════════════════════════════════════════════════════ */

interface iChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

interface iChatConversation {
  id: string;
  title: string;
  createdAt: string;
  messages: iChatMessage[];
}

const CHAT_HISTORY_KEY = "chatHistory";
const MAX_CONVERSATIONS = 20;

/* ═══════════════════════════════════════════════════════════════════
   In-memory state
   ═══════════════════════════════════════════════════════════════════ */

/** Messages for the current (active) conversation */
let currentMessages: iChatMessage[] = [];

/** Whether the history drawer is visible */
let historyPanelOpen = false;

/* ═══════════════════════════════════════════════════════════════════
   Markdown renderer (AC11)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Converts a small subset of Markdown to safe HTML.
 * Handles code blocks, inline code, bold, italic, and line breaks.
 */
function renderMarkdown(text: string): string {
  // Escape HTML first, then selectively un-escape for markdown constructs
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#18181b;color:#e4e4e7;border-radius:4px;padding:8px;font-size:11px;font-family:monospace;overflow-x:auto;white-space:pre-wrap;margin:4px 0">$1</pre>')
    .replace(/`([^`]+)`/g, '<code style="background:#e4e4e7;color:#18181b;border-radius:3px;padding:1px 4px;font-size:11px;font-family:monospace">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/* ═══════════════════════════════════════════════════════════════════
   Chrome AI (AC4)
   ═══════════════════════════════════════════════════════════════════ */

async function isChromeAiAvailable(): Promise<boolean> {
  try {
    const ai = (self as unknown as { ai?: { languageModel?: { capabilities?(): Promise<{ available: string }> } } }).ai;
    if (!ai?.languageModel) return false;
    if (ai.languageModel.capabilities) {
      const caps = await ai.languageModel.capabilities();
      return caps.available === "readily" || caps.available === "after-download";
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a message to Chrome's built-in AI and returns the text response.
 * Returns null when Chrome AI is unavailable.
 */
async function sendToAi(userMessage: string): Promise<string | null> {
  const available = await isChromeAiAvailable();
  if (!available) return null;

  try {
    const ai = (self as unknown as { ai: { languageModel: { create(): Promise<{ prompt(msg: string): Promise<string> }> } } }).ai;
    const session = await ai.languageModel.create();
    const response = await session.prompt(userMessage);
    return response;
  } catch (err) {
    return "AI error: " + String(err);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Chat history storage (AC6/7/8)
   ═══════════════════════════════════════════════════════════════════ */

async function loadHistory(): Promise<iChatConversation[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CHAT_HISTORY_KEY, (result) => {
      resolve((result[CHAT_HISTORY_KEY] as iChatConversation[]) || []);
    });
  });
}

async function saveConversation(messages: iChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const history = await loadHistory();
  const title = messages[0].content.slice(0, 60) + (messages[0].content.length > 60 ? "\u2026" : "");
  const conv: iChatConversation = {
    id: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    messages,
  };
  history.unshift(conv);
  if (history.length > MAX_CONVERSATIONS) history.length = MAX_CONVERSATIONS;
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [CHAT_HISTORY_KEY]: history }, resolve);
  });
}

async function deleteConversation(id: string): Promise<void> {
  const history = await loadHistory();
  const updated = history.filter((c) => c.id !== id);
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [CHAT_HISTORY_KEY]: updated }, resolve);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Render
   ═══════════════════════════════════════════════════════════════════ */

export function renderAiChatTab(): void {
  const panel = document.getElementById("panel-ai");
  if (!panel) return;

  // Reset in-conversation state but keep currentMessages across tab re-renders
  historyPanelOpen = false;

  panel.innerHTML = `
    <div style="padding:8px 12px;border-bottom:1px solid #e4e4e7;display:flex;gap:8px;background:#fafafa;flex-shrink:0">
      <button id="new-chat" style="flex:1;padding:6px;font-size:12px;font-weight:700;color:#b45309;border:1px solid #fcd34d;border-radius:4px;background:none;cursor:pointer;min-height:24px">+ New chat</button>
      <button id="chat-history-btn" aria-label="Chat history" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid #d4d4d8;border-radius:4px;background:none;cursor:pointer;color:#71717a">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 3h10M2 7h10M2 11h10"/></svg>
      </button>
    </div>
    <div id="chat-area" style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative">
      <div id="chat-messages" role="log" aria-live="polite" aria-label="Chat conversation" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px">
        <div style="font-size:11px;color:#71717a;text-align:center;font-weight:600">Powered by Chrome AI \u00b7 runs locally \u00b7 private</div>
        <div style="display:flex;gap:8px">
          <img src="icons/icon16.png" alt="" width="16" height="16" style="flex-shrink:0;margin-top:2px">
          <div style="background:#f4f4f5;border-radius:8px;padding:10px;font-size:12px;color:#27272a;line-height:1.5;flex:1">
            Hi! I can help you understand accessibility issues and suggest fixes. Ask me anything, or click "Explain Further" on any violation in the Scan tab.
          </div>
        </div>
      </div>
      <div id="history-panel" style="position:absolute;top:0;right:0;bottom:0;width:100%;background:#fff;border-left:1px solid #e4e4e7;overflow-y:auto;z-index:10;transform:translateX(100%);transition:transform 0.25s ease;pointer-events:none"></div>
    </div>
    <div id="chat-input-area" style="padding:8px 12px;border-top:1px solid #e4e4e7;background:#fff;flex-shrink:0">
      <div style="display:flex;gap:6px">
        <input id="chat-input" type="text" aria-label="Ask about accessibility" placeholder="Ask about accessibility\u2026" style="flex:1;font-size:12px;padding:8px 12px;border:1px solid #d4d4d8;border-radius:4px;min-width:0">
        <button id="chat-send" aria-label="Send message" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#f59e0b;color:#1a1000;border:none;border-radius:4px;cursor:pointer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 7h9M7.5 3.5L11 7l-3.5 3.5"/></svg>
        </button>
      </div>
    </div>
  `;

  attachAiTabListeners();
  checkAiAvailabilityAndShowFallback();
}

/* ═══════════════════════════════════════════════════════════════════
   Fallback check (AC9)
   ═══════════════════════════════════════════════════════════════════ */

async function checkAiAvailabilityAndShowFallback(): Promise<void> {
  const available = await isChromeAiAvailable();
  if (!available) {
    const input = document.getElementById("chat-input") as HTMLInputElement | null;
    const sendBtn = document.getElementById("chat-send") as HTMLButtonElement | null;
    if (input) {
      input.disabled = true;
      input.placeholder = "Chrome AI not available";
    }
    if (sendBtn) sendBtn.disabled = true;

    appendAiMessage(
      'Chrome AI is not available in this browser. To enable it, paste this into your address bar:<br><input type="text" readonly value="chrome://flags/#prompt-api-for-gemini-nano" style="width:100%;font-size:11px;font-family:monospace;padding:4px 6px;border:1px solid #d4d4d8;border-radius:4px;margin-top:4px;background:#fff;color:#27272a;cursor:text" onclick="this.select()">',
      true
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Message rendering helpers
   ═══════════════════════════════════════════════════════════════════ */

function appendUserMessage(content: string): void {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  container.insertAdjacentHTML("beforeend", `
    <div style="display:flex;justify-content:flex-end">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;font-size:12px;color:#27272a;line-height:1.5;max-width:85%">${escapeHtml(content)}</div>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
}

/**
 * Appends an AI message bubble. When rawHtml is true the content is
 * inserted as-is (already rendered markdown or a fallback notice).
 */
function appendAiMessage(content: string, rawHtml = false): void {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  const body = rawHtml ? content : renderMarkdown(content);
  container.insertAdjacentHTML("beforeend", `
    <div style="display:flex;gap:8px">
      <img src="icons/icon16.png" alt="" width="16" height="16" style="flex-shrink:0;margin-top:2px">
      <div style="background:#f4f4f5;border-radius:8px;padding:10px;font-size:12px;color:#27272a;line-height:1.5;flex:1">${body}</div>
    </div>
  `);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator(): HTMLElement {
  const container = document.getElementById("chat-messages");
  const el = document.createElement("div");
  el.id = "typing-indicator";
  el.style.cssText = "display:flex;gap:8px";
  el.innerHTML = `
    <img src="icons/icon16.png" alt="" width="16" height="16" style="flex-shrink:0;margin-top:2px">
    <div style="background:#f4f4f5;border-radius:8px;padding:10px;font-size:12px;color:#71717a;line-height:1.5;flex:1">Thinking\u2026</div>
  `;
  container?.appendChild(el);
  container && (container.scrollTop = container.scrollHeight);
  return el;
}

/* ═══════════════════════════════════════════════════════════════════
   History drawer (AC6/7/8)
   ═══════════════════════════════════════════════════════════════════ */

async function renderHistoryPanel(): Promise<void> {
  const panel = document.getElementById("history-panel");
  if (!panel) return;

  const history = await loadHistory();

  if (history.length === 0) {
    panel.innerHTML = `
      <div style="padding:12px;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;font-weight:700;color:#27272a">Chat History</span>
        <button id="close-history" aria-label="Close history" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;color:#71717a">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
        </button>
      </div>
      <div style="padding:16px;font-size:11px;color:#71717a;text-align:center">No saved conversations yet.</div>
    `;
  } else {
    const items = history.map((conv) => `
      <div style="padding:10px 12px;border-bottom:1px solid #f4f4f5;display:flex;align-items:flex-start;gap:8px">
        <div role="button" tabindex="0" aria-label="Load conversation: ${escapeHtml(conv.title)}" style="flex:1;min-width:0;cursor:pointer" class="history-load" data-id="${conv.id}">
          <div style="font-size:12px;font-weight:600;color:#27272a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(conv.title)}</div>
          <div style="font-size:10px;color:#71717a;margin-top:2px">${new Date(conv.createdAt).toLocaleString()}</div>
        </div>
        <button class="history-delete" data-id="${conv.id}" aria-label="Delete conversation" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca;border-radius:4px;background:none;cursor:pointer;color:#dc2626;flex-shrink:0">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
        </button>
      </div>
    `).join("");

    panel.innerHTML = `
      <div style="padding:10px 12px;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:12px;font-weight:700;color:#27272a">Chat History</span>
        <button id="close-history" aria-label="Close history" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:none;background:none;cursor:pointer;color:#71717a">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
        </button>
      </div>
      ${items}
    `;
  }

  // Attach listeners for history items
  panel.querySelectorAll<HTMLElement>(".history-load").forEach((el) => {
    const activate = async () => {
      const id = el.dataset.id || "";
      const history = await loadHistory();
      const conv = history.find((c) => c.id === id);
      if (!conv) return;
      currentMessages = conv.messages.slice();
      historyPanelOpen = false;
      renderAiChatTab();
      // Re-render stored messages
      conv.messages.forEach((msg) => {
        if (msg.role === "user") {
          appendUserMessage(msg.content);
        } else {
          appendAiMessage(msg.content);
        }
      });
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  panel.querySelectorAll<HTMLButtonElement>(".history-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id || "";
      if (!confirm("Delete this conversation?")) return;
      deleteConversation(id).then(() => renderHistoryPanel());
    });
  });

  document.getElementById("close-history")?.addEventListener("click", () => {
    historyPanelOpen = false;
    setHistoryPanelVisible(false);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   History panel visibility (F17-AC7)
   ═══════════════════════════════════════════════════════════════════ */

function setHistoryPanelVisible(visible: boolean): void {
  const hp = document.getElementById("history-panel");
  if (!hp) return;
  if (visible) {
    hp.style.transform = "translateX(0)";
    hp.style.pointerEvents = "auto";
  } else {
    hp.style.transform = "translateX(100%)";
    hp.style.pointerEvents = "none";
  }
}

/**
 * Opens the AI chat history drawer from outside this module (F22-AC4).
 * Safe to call even before the panel has been rendered — renders it first.
 */
export async function openAiHistoryPanel(): Promise<void> {
  historyPanelOpen = true;
  setHistoryPanelVisible(true);
  await renderHistoryPanel();
}

/* ═══════════════════════════════════════════════════════════════════
   Event listeners
   ═══════════════════════════════════════════════════════════════════ */

function attachAiTabListeners(): void {
  // New chat (AC3)
  document.getElementById("new-chat")?.addEventListener("click", () => {
    if (currentMessages.length > 0) {
      saveConversation(currentMessages);
    }
    currentMessages = [];
    historyPanelOpen = false;
    renderAiChatTab();
  });

  // History toggle (AC7)
  document.getElementById("chat-history-btn")?.addEventListener("click", async () => {
    historyPanelOpen = !historyPanelOpen;
    setHistoryPanelVisible(historyPanelOpen);
    if (historyPanelOpen) {
      await renderHistoryPanel();
    }
  });

  // Send (AC4)
  document.getElementById("chat-send")?.addEventListener("click", handleSend);

  // Enter key
  document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

async function handleSend(): Promise<void> {
  const input = document.getElementById("chat-input") as HTMLInputElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  appendUserMessage(text);

  const userMsg: iChatMessage = { role: "user", content: text, timestamp: new Date().toISOString() };
  currentMessages.push(userMsg);

  const typingEl = showTypingIndicator();

  const response = await sendToAi(text);
  typingEl.remove();

  if (response === null) {
    // Chrome AI not available — don't repeat the full message, just a short note
    appendAiMessage("I can't respond right now — Chrome AI is not enabled. See the setup instructions above.", false);
  } else {
    appendAiMessage(response);
    const aiMsg: iChatMessage = { role: "ai", content: response, timestamp: new Date().toISOString() };
    currentMessages.push(aiMsg);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Entry point for "Explain Further" (AC2)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Pre-fills the AI chat with violation context and triggers a send.
 * Called from scan-tab.ts when "Explain Further →" is clicked.
 */
export function openAiChatWithContext(ruleId: string, description: string): void {
  const input = document.getElementById("chat-input") as HTMLInputElement | null;
  if (!input) return;

  const prompt = description
    ? `Explain this accessibility violation in plain language and suggest how to fix it.\n\nRule: ${ruleId}\nDescription: ${description}`
    : `Explain the accessibility violation "${ruleId}" in plain language and suggest how to fix it.`;

  input.value = prompt;
  handleSend();
}

/* ═══════════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════════ */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
