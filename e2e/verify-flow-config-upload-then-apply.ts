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
import fs from "fs";
import os from "os";
import path from "path";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Config-flow fixture</h1></body></html>`;

const VALID_CONFIG = JSON.stringify({
  wcagVersion: "2.1",
  wcagLevel: "AA",
  viewports: [320, 800],
});

const VALID_CONFIG_FILE = JSON.stringify({
  wcagVersion: "2.0",
  wcagLevel: "A",
  viewports: [360, 1024],
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

    // Step 2-3 — actual file upload via #config-file-input. Write a temp .json
    // file and use Puppeteer's ElementHandle.uploadFile (the only way to
    // populate <input type=file> in headless Chrome — native picker is not
    // driveable).
    const tmpFile = path.join(os.tmpdir(), `a11y-scan-config-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, VALID_CONFIG_FILE);
    try {
      // Re-open dialog
      await ctx.sidepanel.evaluate(() => (document.getElementById("settings-btn") as HTMLButtonElement | null)?.click());
      await sleep(300);

      const fileInput = await ctx.sidepanel.$("#config-file-input");
      if (!fileInput) {
        ctx.fail({ step: "file upload", expected: "#config-file-input present", actual: "missing" });
      } else {
        await fileInput.uploadFile(tmpFile);
        await sleep(400); // FileReader is async
        const taValue = await ctx.sidepanel.evaluate(() =>
          (document.getElementById("config-textarea") as HTMLTextAreaElement | null)?.value ?? ""
        );
        if (!taValue.includes("2.0")) {
          ctx.fail({ step: "file upload populates textarea", expected: "uploaded file contents in #config-textarea", actual: taValue.slice(0, 200) });
        }

        // Apply the uploaded config
        await ctx.sidepanel.evaluate(() => (document.getElementById("config-apply-btn") as HTMLButtonElement).click());
        await sleep(500);

        // Verify viewports synced to [360, 1024]
        await ctx.sidepanel.evaluate(() => (document.getElementById("vp-edit") as HTMLButtonElement | null)?.click());
        await sleep(200);
        const vps2 = await ctx.sidepanel.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLInputElement>(".vp-input")).map((i) => Number(i.value))
        );
        if (!vps2.includes(360) || !vps2.includes(1024)) {
          ctx.fail({ step: "file upload viewport sync", expected: "[360, 1024] after applied", actual: JSON.stringify(vps2) });
        }
        await ctx.sidepanel.evaluate(() => (document.getElementById("vp-done") as HTMLButtonElement | null)?.click());
        await sleep(150);
      }
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* swallow cleanup errors */ }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-config-upload-then-apply");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
