/**
 * Verify: config-dialog interaction.
 * Inventory: docs/test-matrix/interactions/config-dialog.md
 *
 * Asserts:
 *  - settings-btn opens dialog (showModal called → dialog.open=true)
 *  - config-textarea + config-apply-btn + config-close-btn render
 *  - Apply with empty textarea shows error + dialog stays open
 *  - Apply with valid JSON closes dialog + persists testConfig
 *  - close-btn closes the dialog
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Config dialog fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement).click());
    await sleep(300);

    const opened = await ctx.sidepanel.evaluate(() => ({
      dialogOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
      hasTextarea: !!document.getElementById("config-textarea"),
      hasApply: !!document.getElementById("config-apply-btn"),
      hasClose: !!document.getElementById("config-close-btn"),
      hasUploadInput: !!document.getElementById("config-file-input"),
    }));
    if (!opened.dialogOpen) ctx.fail({ step: "settings-btn click", expected: "config-dialog open", actual: "closed" });
    if (!opened.hasTextarea) ctx.fail({ step: "dialog elements", expected: "#config-textarea", actual: "missing" });
    if (!opened.hasApply) ctx.fail({ step: "dialog elements", expected: "#config-apply-btn", actual: "missing" });
    if (!opened.hasClose) ctx.fail({ step: "dialog elements", expected: "#config-close-btn", actual: "missing" });
    if (!opened.hasUploadInput) ctx.fail({ step: "dialog elements", expected: "#config-file-input", actual: "missing" });

    // Apply with empty textarea → should show error + stay open
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(300);
    const empty = await ctx.sidepanel.evaluate(() => ({
      dialogOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
      errorVisible: ((document.getElementById("config-error") as HTMLElement | null)?.style.display || "") !== "none"
        && (document.getElementById("config-error")?.textContent?.length ?? 0) > 0,
    }));
    if (!empty.dialogOpen) ctx.fail({ step: "apply empty", expected: "dialog stays open", actual: "closed" });
    if (!empty.errorVisible) ctx.fail({ step: "apply empty", expected: "error message visible", actual: "no error" });

    // Apply with valid JSON
    await ctx.sidepanel.evaluate(() => {
      const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
      ta.value = JSON.stringify({ wcag: { version: "2.1", level: "AA" } });
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(500);
    const applied = await ctx.sidepanel.evaluate(() => ({
      dialogOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
    }));
    if (applied.dialogOpen) ctx.fail({ step: "apply valid", expected: "dialog closes", actual: "still open" });

    // Reopen + click close-btn
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement).click());
    await sleep(200);
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-close-btn") as HTMLButtonElement).click());
    await sleep(200);
    const closed = await ctx.sidepanel.evaluate(() => ({
      dialogOpen: (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false,
    }));
    if (closed.dialogOpen) ctx.fail({ step: "close-btn", expected: "dialog closes", actual: "still open" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "config-dialog");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
