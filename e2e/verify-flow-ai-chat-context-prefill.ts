/**
 * Verify flow: Click "Explain Further" on a violation → AI tab opens with
 * pre-filled context.
 * Inventory: docs/test-matrix/flows/ai-chat-context-prefill.md
 *
 * The AI tab is permanently disabled in production (Chrome Built-in AI
 * unavailable). The Explain Further button is hidden by default
 * (display:none in render-results.ts). This script verifies the disabled
 * fallback contract:
 *  - .explain-btn elements exist after a scan but are display:none
 *  - Clicking them does not switch top-tab to AI
 *
 * When AI is enabled, this script must be expanded to drive the full flow.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>AI prefill fixture</h1>
  <img src="/x.jpg">
  <button></button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector(".explain-btn", { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: "≥1 .explain-btn after scan", actual: "timeout" }); throw new Error("scan-timeout"); }
    await sleep(400);

    const tabAi = await ctx.sidepanel.evaluate(() => {
      const t = document.getElementById("tab-ai") as HTMLButtonElement | null;
      return { disabled: t?.disabled ?? false, ariaDisabled: t?.getAttribute("aria-disabled") ?? null };
    });

    const explain = await ctx.sidepanel.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".explain-btn"));
      return {
        count: btns.length,
        firstDisplay: btns[0] ? getComputedStyle(btns[0]).display : "no-btn",
      };
    });

    if (tabAi.disabled || tabAi.ariaDisabled === "true") {
      // Disabled-fallback contract: explain buttons should be hidden so users
      // can't click into a non-functional flow.
      if (explain.count === 0) {
        ctx.fail({ step: "explain buttons", expected: "≥1 .explain-btn rendered after scan", actual: "0" });
      } else if (explain.firstDisplay !== "none") {
        ctx.fail({
          step: "explain buttons hidden when AI disabled",
          expected: "display:none on .explain-btn while #tab-ai is disabled",
          actual: explain.firstDisplay,
        });
      }

      // Verify clicking the (hidden) explain button does NOT switch top-tab to ai
      await ctx.sidepanel.evaluate(() => {
        const b = document.querySelector(".explain-btn") as HTMLButtonElement | null;
        b?.click();
      });
      await sleep(300);
      const top = await ctx.sidepanel.evaluate(() =>
        document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? ""
      );
      if (top === "tab-ai") {
        ctx.fail({
          step: "explain click ignored when AI disabled",
          expected: "active top-tab unchanged",
          actual: "switched to tab-ai despite AI being disabled",
        });
      }
    }
    // If AI is enabled (future state), expand this script to drive the full
    // openAiChatWithContext path.
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-ai-chat-context-prefill (limited — AI tab disabled by default)");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
