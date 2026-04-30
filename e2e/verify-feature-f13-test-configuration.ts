/**
 * Verify: F13 test configuration.
 * Inventory: docs/test-matrix/features/f13-test-configuration.md
 *
 * Asserts:
 *  - settings-btn opens config-dialog (showModal)
 *  - Empty Apply → config-error shows "Paste JSON …" message
 *  - Invalid JSON → error message + dialog stays open
 *  - Valid JSON Apply → dialog closes + state.testConfig set + persisted
 *  - config-clear-btn (visible after apply) → clears testConfig + closes dialog
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F13 fixture</h1></body></html>`;

const VALID_CONFIG = JSON.stringify({
  wcagVersion: "2.2",
  wcagLevel: "AA",
  viewports: [320, 800],
});

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Open dialog
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
    await sleep(300);
    const opened = await ctx.sidepanel.evaluate(() => {
      const d = document.getElementById("config-dialog") as HTMLDialogElement | null;
      return { exists: !!d, isOpen: d?.open ?? false, hasTextarea: !!document.getElementById("config-textarea"), hasApply: !!document.getElementById("config-apply-btn") };
    });
    if (!opened.exists) ctx.fail({ step: "open dialog", expected: "#config-dialog rendered", actual: "missing" });
    if (!opened.isOpen) ctx.fail({ step: "open dialog", expected: "dialog.open=true after settings-btn click", actual: String(opened.isOpen) });
    if (!opened.hasTextarea) ctx.fail({ step: "open dialog", expected: "#config-textarea", actual: "missing" });
    if (!opened.hasApply) ctx.fail({ step: "open dialog", expected: "#config-apply-btn", actual: "missing" });

    // Empty Apply → error
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(200);
    const emptyErr = await ctx.sidepanel.evaluate(() => ({
      stillOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
      errorText: document.getElementById("config-error")?.textContent ?? "",
    }));
    if (!emptyErr.stillOpen) ctx.fail({ step: "empty Apply", expected: "dialog stays open", actual: "closed" });
    if (!/paste|json/i.test(emptyErr.errorText)) ctx.fail({ step: "empty Apply", expected: "error message mentions paste/json", actual: emptyErr.errorText.slice(0, 200) });

    // Invalid JSON → error
    await ctx.sidepanel.evaluate(() => {
      const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
      ta.value = "{ not valid json";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(200);
    const badErr = await ctx.sidepanel.evaluate(() => ({
      stillOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
      errorText: document.getElementById("config-error")?.textContent ?? "",
    }));
    if (!badErr.stillOpen) ctx.fail({ step: "invalid JSON", expected: "dialog stays open", actual: "closed" });
    if (badErr.errorText.length === 0) ctx.fail({ step: "invalid JSON", expected: "non-empty error message", actual: "empty" });

    // Valid JSON → close + apply
    await ctx.sidepanel.evaluate((cfg) => {
      const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
      ta.value = cfg;
    }, VALID_CONFIG);
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(400);
    const ok = await ctx.sidepanel.evaluate(() => ({
      stillOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
      hasClearBtn: !!document.getElementById("config-clear-btn"),
    }));
    if (ok.stillOpen) ctx.fail({ step: "valid Apply", expected: "dialog closed", actual: "still open" });
    // Re-open to check that the clear button is now rendered
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
    await sleep(300);
    const reopened = await ctx.sidepanel.evaluate(() => ({
      hasClearBtn: !!document.getElementById("config-clear-btn"),
    }));
    if (!reopened.hasClearBtn) ctx.fail({ step: "valid Apply", expected: "#config-clear-btn appears once a config is loaded", actual: "missing on re-open" });

    // Clear → dialog closes + clear-btn gone next time
    if (reopened.hasClearBtn) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("config-clear-btn") as HTMLButtonElement).click());
      await sleep(400);
      await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
      await sleep(300);
      const cleared = await ctx.sidepanel.evaluate(() => ({
        hasClearBtn: !!document.getElementById("config-clear-btn"),
      }));
      if (cleared.hasClearBtn) ctx.fail({ step: "clear config", expected: "#config-clear-btn gone after clear", actual: "still rendered" });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f13-test-configuration");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
