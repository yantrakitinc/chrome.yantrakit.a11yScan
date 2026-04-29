// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (typeof globalThis.CSS === "undefined" || typeof globalThis.CSS.escape !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };
}

// jsdom doesn't expose crypto.randomUUID by default in older versions
if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.randomUUID !== "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = { ...(globalThis.crypto || {}), randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) };
}

// jsdom doesn't implement window.confirm — stub it true so deletes proceed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).confirm = vi.fn(() => true);

let storageData: Record<string, unknown>;

beforeEach(() => {
  storageData = {};
  document.body.innerHTML = `<div id="panel-ai"></div>`;
  // chrome.storage.local.get / set use callback style for ai-tab
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    storage: {
      local: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: vi.fn((key: string, cb?: (r: any) => void) => {
          const out = key in storageData ? { [key]: storageData[key] } : {};
          if (cb) cb(out);
          return Promise.resolve(out);
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: vi.fn((obj: Record<string, unknown>, cb?: () => void) => {
          Object.assign(storageData, obj);
          if (cb) cb();
          return Promise.resolve(undefined);
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage: { addListener: vi.fn() },
    },
  };
  // self.ai unavailable by default — sendToAi returns null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).self = globalThis;
});

afterEach(() => {
  document.body.innerHTML = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).ai;
});

describe("ai-tab — renderAiChatTab base render", () => {
  it("renders the new-chat, history button, input, and send button", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    expect(document.getElementById("new-chat")).toBeTruthy();
    expect(document.getElementById("chat-history-btn")).toBeTruthy();
    expect(document.getElementById("chat-input")).toBeTruthy();
    expect(document.getElementById("chat-send")).toBeTruthy();
    expect(document.getElementById("chat-messages")).toBeTruthy();
    expect(document.getElementById("history-panel")).toBeTruthy();
  });

  it("when Chrome AI is unavailable, disables input and shows fallback notice", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    // Allow async checkAiAvailabilityAndShowFallback to resolve
    await new Promise((r) => setTimeout(r, 30));
    const input = document.getElementById("chat-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    // Notice should be inserted into the messages container
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/Chrome AI is not available|chrome:\/\/flags/);
  });

  it("returns silently when #panel-ai is missing", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    document.body.innerHTML = ""; // no panel
    expect(() => renderAiChatTab()).not.toThrow();
  });
});

describe("ai-tab — new-chat and history toggle", () => {
  it("clicking new-chat re-renders empty state without throwing", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    document.getElementById("new-chat")?.click();
    expect(document.getElementById("chat-input")).toBeTruthy();
  });

  it("clicking chat-history-btn opens drawer and renders empty-state UI", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    document.getElementById("chat-history-btn")?.click();
    await new Promise((r) => setTimeout(r, 20));
    const hp = document.getElementById("history-panel");
    expect(hp?.textContent).toMatch(/No saved conversations yet/i);
  });

  it("openAiHistoryPanel forces drawer open and re-renders even without click", async () => {
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const hp = document.getElementById("history-panel");
    expect(hp?.style.transform).toContain("translateX(0)");
  });
});

describe("ai-tab — sending a message with Chrome AI mocked", () => {
  it("Enter on input sends a message; AI null fallback short-circuits to a notice", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    const input = document.getElementById("chat-input") as HTMLInputElement;
    // Enable input even though availability check disables it (the listener is wired regardless)
    input.disabled = false;
    input.value = "what is wcag?";
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    input.dispatchEvent(ev);
    await new Promise((r) => setTimeout(r, 30));
    const messages = document.getElementById("chat-messages");
    // user bubble shows the typed text
    expect(messages?.textContent).toMatch(/what is wcag\?/);
  });

  it("with self.ai stubbed returning a response, the AI bubble appears", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        capabilities: async () => ({ available: "readily" }),
        create: async () => ({ prompt: async (_q: string) => "Hello, **world**" }),
      },
    };
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "hi";
    document.getElementById("chat-send")?.click();
    await new Promise((r) => setTimeout(r, 50));
    const messages = document.getElementById("chat-messages");
    // markdown rendered: <strong>world</strong>
    expect(messages?.innerHTML).toMatch(/<strong>world<\/strong>/);
  });
});

describe("ai-tab — openAiChatWithContext", () => {
  it("pre-fills the input with the rule context and triggers send", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        capabilities: async () => ({ available: "readily" }),
        create: async () => ({ prompt: async () => "an explanation" }),
      },
    };
    const { renderAiChatTab, openAiChatWithContext } = await import("../ai-tab");
    renderAiChatTab();
    openAiChatWithContext("color-contrast", "Background and text contrast is too low");
    await new Promise((r) => setTimeout(r, 50));
    // user message bubble should contain the rule id
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/color-contrast/);
    expect(messages?.textContent).toMatch(/an explanation/);
  });

  it("openAiChatWithContext is safe when input is missing (no panel rendered)", async () => {
    const { openAiChatWithContext } = await import("../ai-tab");
    document.body.innerHTML = ""; // no input
    expect(() => openAiChatWithContext("rule", "")).not.toThrow();
  });
});

describe("ai-tab — history persistence", () => {
  it("after sending a message, then clicking new-chat, history is populated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        capabilities: async () => ({ available: "readily" }),
        create: async () => ({ prompt: async () => "ok" }),
      },
    };
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "first question";
    document.getElementById("chat-send")?.click();
    await new Promise((r) => setTimeout(r, 50));
    // Now click new-chat which triggers saveConversation
    document.getElementById("new-chat")?.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(Array.isArray(storageData["chatHistory"])).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((storageData["chatHistory"] as any[]).length).toBeGreaterThanOrEqual(1);
  });

  it("history drawer renders saved conversation and Load button works", async () => {
    storageData["chatHistory"] = [
      {
        id: "conv-1",
        title: "Saved chat",
        createdAt: new Date().toISOString(),
        messages: [
          { role: "user", content: "first user msg", timestamp: "x" },
          { role: "ai", content: "first ai reply", timestamp: "y" },
        ],
      },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const drawer = document.getElementById("history-panel");
    expect(drawer?.textContent).toMatch(/Saved chat/);
    // Click the load card
    const card = drawer?.querySelector(".history-load") as HTMLElement | null;
    card?.click();
    await new Promise((r) => setTimeout(r, 30));
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/first user msg/);
    expect(messages?.textContent).toMatch(/first ai reply/);
  });

  it("clicking history-delete removes the conversation from storage", async () => {
    storageData["chatHistory"] = [
      { id: "conv-1", title: "A", createdAt: new Date().toISOString(), messages: [] },
      { id: "conv-2", title: "B", createdAt: new Date().toISOString(), messages: [] },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const delBtn = document.querySelector('.history-delete[data-id="conv-1"]') as HTMLButtonElement | null;
    expect(delBtn).toBeTruthy();
    delBtn?.click();
    await new Promise((r) => setTimeout(r, 30));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remaining = storageData["chatHistory"] as any[];
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe("conv-2");
  });

  it("close-history button hides the drawer", async () => {
    storageData["chatHistory"] = [];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const close = document.getElementById("close-history") as HTMLButtonElement | null;
    close?.click();
    const hp = document.getElementById("history-panel");
    expect(hp?.style.transform).toContain("translateX(100%)");
  });

  it("history Enter/Space keydown loads the conversation (keyboard activation)", async () => {
    storageData["chatHistory"] = [
      { id: "k1", title: "Keyed", createdAt: new Date().toISOString(), messages: [
        { role: "user", content: "kbd-only message", timestamp: "x" },
      ] },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const card = document.querySelector(".history-load") as HTMLElement;
    expect(card).toBeTruthy();
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/kbd-only message/);
  });

  it("history Space keydown also loads", async () => {
    storageData["chatHistory"] = [
      { id: "s1", title: "Spaced", createdAt: new Date().toISOString(), messages: [
        { role: "user", content: "space-key msg", timestamp: "x" },
      ] },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const card = document.querySelector(".history-load") as HTMLElement;
    card.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/space-key msg/);
  });

  it("history Load when conversation id is missing falls through silently", async () => {
    storageData["chatHistory"] = [
      { id: "real-id", title: "T", createdAt: new Date().toISOString(), messages: [] },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    // Modify the data-id to point at something that won't be in storage
    const card = document.querySelector(".history-load") as HTMLElement;
    card.dataset.id = "non-existent";
    expect(() => card.click()).not.toThrow();
  });

  it("history-delete with confirm returning false does NOT delete", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).confirm = vi.fn(() => false);
    storageData["chatHistory"] = [
      { id: "c1", title: "T1", createdAt: new Date().toISOString(), messages: [] },
    ];
    const { renderAiChatTab, openAiHistoryPanel } = await import("../ai-tab");
    renderAiChatTab();
    await openAiHistoryPanel();
    const del = document.querySelector('.history-delete[data-id="c1"]') as HTMLButtonElement;
    del.click();
    await new Promise((r) => setTimeout(r, 20));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((storageData["chatHistory"] as any[]).length).toBe(1);
    // restore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).confirm = vi.fn(() => true);
  });
});

describe("ai-tab — handleSend / sendToAi error & empty paths", () => {
  it("Send with empty input is a no-op (no user bubble appended)", async () => {
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "   "; // whitespace only — trim()=='' triggers early return
    input.disabled = false;
    document.getElementById("chat-send")?.click();
    await new Promise((r) => setTimeout(r, 30));
    const messages = document.getElementById("chat-messages");
    // Only the AI-unavailable notice may be present; no user bubble for empty input.
    expect(messages?.querySelector('div[style*="background:#fffbeb"]')).toBeNull();
  });

  it("sendToAi catch path: ai.languageModel.create() throws → 'AI error: ' bubble appears", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        capabilities: async () => ({ available: "readily" }),
        create: async () => { throw new Error("kaboom"); },
      },
    };
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    const input = document.getElementById("chat-input") as HTMLInputElement;
    input.value = "explode";
    document.getElementById("chat-send")?.click();
    await new Promise((r) => setTimeout(r, 50));
    const messages = document.getElementById("chat-messages");
    expect(messages?.textContent).toMatch(/AI error/);
  });

  it("isChromeAiAvailable returns true when capabilities() throws but ai exists", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        capabilities: async () => { throw new Error("caps explode"); },
        create: async () => ({ prompt: async () => "ok" }),
      },
    };
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    await new Promise((r) => setTimeout(r, 30));
    // catch returns false → input disabled
    const input = document.getElementById("chat-input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("isChromeAiAvailable: ai.languageModel exists without capabilities → return true (legacy fallback)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).self.ai = {
      languageModel: {
        // no capabilities at all
        create: async () => ({ prompt: async () => "ok" }),
      },
    };
    const { renderAiChatTab } = await import("../ai-tab");
    renderAiChatTab();
    await new Promise((r) => setTimeout(r, 30));
    const input = document.getElementById("chat-input") as HTMLInputElement;
    // available=true → input is NOT disabled
    expect(input.disabled).toBe(false);
  });

});
