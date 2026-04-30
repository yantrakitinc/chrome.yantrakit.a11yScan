/**
 * Verify flow: Open config dialog → paste valid JSON → apply → state synced.
 * Inventory: docs/test-matrix/flows/config-upload-then-apply.md
 *
 * Asserts the textarea-based path (file upload uses native picker which isn't
 * deterministic in headless Chrome — paste path is functionally equivalent).
 *  - settings-btn opens dialog
 *  - Valid JSON Apply closes dialog
 *  - state.viewports synced (visible via vp-edit list after apply)
 *  - config-clear-btn visible on re-open + clears cleanly
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Config-flow fixture</h1></body></html>`;

const VALID_CONFIG = JSON.stringify({
  wcagVersion: "2.1",
  wcagLevel: "AA",
  viewports: [320, 800],
});

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Toggle MV first to make viewport sync visible in the panel UI
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(150);

    // Open dialog
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
    await sleep(300);
    const dialogOpen = await ctx.sidepanel.evaluate(() =>
      (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false
    );
    if (!dialogOpen) ctx.fail({ step: "open dialog", expected: "dialog.open=true", actual: "false" });

    // Paste valid JSON
    await ctx.sidepanel.evaluate((cfg) => {
      const ta = document.getElementById("config-textarea") as HTMLTextAreaElement;
      ta.value = cfg;
    }, VALID_CONFIG);
    await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
    await sleep(500);

    const closed = await ctx.sidepanel.evaluate(() =>
      (document.getElementById("config-dialog") as HTMLDialogElement | null)?.open ?? false
    );
    if (closed) ctx.fail({ step: "apply", expected: "dialog closed after apply", actual: "still open" });

    // After apply, viewports should be [320, 800]. Open the viewport editor +
    // read inputs.
    await ctx.sidepanel.evaluate(() => (document.getElementById("vp-edit") as HTMLButtonElement | null)?.click());
    await sleep(200);
    const vps = await ctx.sidepanel.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>(".vp-input")).map((i) => Number(i.value))
    );
    if (!vps.includes(320) || !vps.includes(800)) {
      ctx.fail({ step: "viewport sync", expected: "viewports include 320 and 800 after apply", actual: JSON.stringify(vps) });
    }
    await ctx.sidepanel.evaluate(() => (document.getElementById("vp-done") as HTMLButtonElement | null)?.click());
    await sleep(150);

    // Re-open settings → config-clear-btn should be visible
    await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
    await sleep(300);
    const reopened = await ctx.sidepanel.evaluate(() => ({
      hasClear: !!document.getElementById("config-clear-btn"),
      taText: (document.getElementById("config-textarea") as HTMLTextAreaElement | null)?.value ?? "",
    }));
    if (!reopened.hasClear) ctx.fail({ step: "re-open dialog", expected: "#config-clear-btn after testConfig set", actual: "missing" });
    if (!reopened.taText.includes("2.1")) {
      ctx.fail({ step: "re-open dialog", expected: "textarea pre-populated with stored config", actual: reopened.taText.slice(0, 100) });
    }

    // Clear
    if (reopened.hasClear) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("config-clear-btn") as HTMLButtonElement).click());
      await sleep(400);
      await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
      await sleep(300);
      const cleared = await ctx.sidepanel.evaluate(() => !!document.getElementById("config-clear-btn"));
      if (cleared) ctx.fail({ step: "clear config", expected: "#config-clear-btn hidden after clear", actual: "still rendered" });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-config-upload-then-apply");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
