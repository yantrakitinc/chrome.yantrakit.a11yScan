/**
 * Verify flow: KB movie play → pause → resume → stop lifecycle.
 * Inventory: docs/test-matrix/flows/kb-movie-pause-resume-stop.md
 *
 * Drives KB tab analyze → play-all → pause → resume → stop, asserting that
 * each control transition is observable in the UI (button swap from
 * Play→Pause→Resume→Play). Real TTS audio is unverifiable (Gap 3); the unit
 * suite covers movie-mode state machine.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <button id="b1">B1</button>
  <button id="b2">B2</button>
  <button id="b3">B3</button>
  <button id="b4">B4</button>
  <button id="b5">B5</button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-kb") as HTMLButtonElement).click());
    await sleep(300);

    // Try to find an analyze button (id varies by build)
    const analyzed = await ctx.sidepanel.evaluate(() => {
      for (const id of ["kb-analyze", "analyze-tab-order", "kb-scan"]) {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (el) { el.click(); return id; }
      }
      return null;
    });
    if (!analyzed) {
      ctx.fail({ step: "kb analyze", expected: "analyze button (kb-analyze / analyze-tab-order / kb-scan)", actual: "none found" });
      return;
    }
    await sleep(2500);

    // Wait for movie-play-all
    const hasPlay = await ctx.sidepanel.evaluate(() => !!document.getElementById("movie-play-all"));
    if (!hasPlay) {
      ctx.fail({ step: "movie controls", expected: "#movie-play-all after analyze", actual: "missing" });
      return;
    }

    // Play
    await ctx.sidepanel.evaluate(() => (document.getElementById("movie-play-all") as HTMLButtonElement).click());
    await sleep(600);
    const playing = await ctx.sidepanel.evaluate(() => ({
      hasPause: !!document.getElementById("movie-pause"),
      hasStop: !!document.getElementById("movie-stop"),
    }));
    if (!playing.hasPause) ctx.fail({ step: "play", expected: "#movie-pause after play-all", actual: "missing" });
    if (!playing.hasStop) ctx.fail({ step: "play", expected: "#movie-stop after play-all", actual: "missing" });

    // Pause
    if (playing.hasPause) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("movie-pause") as HTMLButtonElement).click());
      await sleep(400);
      const paused = await ctx.sidepanel.evaluate(() => ({
        hasResume: !!document.getElementById("movie-resume"),
        hasPause: !!document.getElementById("movie-pause"),
      }));
      if (!paused.hasResume) ctx.fail({ step: "pause", expected: "#movie-resume after pause", actual: "missing" });
      if (paused.hasPause) ctx.fail({ step: "pause", expected: "#movie-pause hidden after pause", actual: "still rendered" });

      // Resume
      if (paused.hasResume) {
        await ctx.sidepanel.evaluate(() => (document.getElementById("movie-resume") as HTMLButtonElement).click());
        await sleep(400);
        const resumed = await ctx.sidepanel.evaluate(() => ({
          hasPause: !!document.getElementById("movie-pause"),
        }));
        if (!resumed.hasPause) ctx.fail({ step: "resume", expected: "#movie-pause after resume", actual: "missing" });
      }
    }

    // Stop
    if (playing.hasStop) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("movie-stop") as HTMLButtonElement).click());
      await sleep(400);
      const stopped = await ctx.sidepanel.evaluate(() => ({
        hasPlay: !!document.getElementById("movie-play-all"),
        hasPause: !!document.getElementById("movie-pause"),
      }));
      if (!stopped.hasPlay) ctx.fail({ step: "stop", expected: "#movie-play-all after stop", actual: "missing" });
      if (stopped.hasPause) ctx.fail({ step: "stop", expected: "#movie-pause hidden after stop", actual: "still rendered" });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-kb-movie-pause-resume-stop");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
