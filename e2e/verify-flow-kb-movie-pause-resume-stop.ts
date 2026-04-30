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

    // Step 2 — wait for MOVIE_TICK to advance the index. The "Playing X of N"
    // counter updates after each tick. Resume play first if paused.
    const stillPaused = await ctx.sidepanel.evaluate(() => !!document.getElementById("movie-resume"));
    if (stillPaused) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("movie-resume") as HTMLButtonElement).click());
      await sleep(400);
    }
    // Snapshot the current "Playing X of N" text, sleep ≥ 1.2s (default tick
    // is ~1s), then snapshot again — they should differ.
    function readPlayingCounter(panel: typeof ctx.sidepanel): Promise<string> {
      return panel.evaluate(() => {
        const candidates = ["kb-tab", "panel-kb"].map((id) => document.getElementById(id));
        const text = candidates.map((c) => c?.textContent ?? "").join(" ");
        const m = text.match(/Playing\s+(\d+)\s+of\s+(\d+)/i);
        return m ? `${m[1]}/${m[2]}` : "";
      });
    }
    const tickStart = await readPlayingCounter(ctx.sidepanel);
    await sleep(2500);
    const tickAfter = await readPlayingCounter(ctx.sidepanel);
    if (tickStart !== "" && tickAfter !== "" && tickStart === tickAfter) {
      ctx.fail({ step: "movie tick (step 2)", expected: "'Playing X of N' counter advances after ≥2 ticks", actual: `still ${tickAfter}` });
    }

    // Stop
    if (playing.hasStop) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("movie-stop") as HTMLButtonElement).click());
      await sleep(400);
      const stopped = await ctx.sidepanel.evaluate(() => ({
        hasPlay: !!document.getElementById("movie-play-all"),
        hasPause: !!document.getElementById("movie-pause"),
      }));
      if (!stopped.hasPlay) ctx.fail({ step: "stop (step 6)", expected: "#movie-play-all after stop", actual: "missing" });
      if (stopped.hasPause) ctx.fail({ step: "stop (step 6)", expected: "#movie-pause hidden after stop", actual: "still rendered" });
    }

    // Step 7 — Escape key during movie stops it. Re-start movie, sleep, press
    // Escape, verify state transitions back to idle (Play All visible again).
    await ctx.sidepanel.evaluate(() => (document.getElementById("movie-play-all") as HTMLButtonElement).click());
    await sleep(500);
    const playingForEscape = await ctx.sidepanel.evaluate(() => !!document.getElementById("movie-pause"));
    if (playingForEscape) {
      // Focus the panel-kb so the document keydown listener catches Escape
      await ctx.sidepanel.evaluate(() => (document.getElementById("panel-kb") as HTMLElement | null)?.focus());
      await ctx.sidepanel.keyboard.press("Escape");
      await sleep(500);
      const afterEscape = await ctx.sidepanel.evaluate(() => ({
        hasPlay: !!document.getElementById("movie-play-all"),
        hasPause: !!document.getElementById("movie-pause"),
      }));
      if (!afterEscape.hasPlay) ctx.fail({ step: "Escape stops movie (step 7)", expected: "#movie-play-all after Escape", actual: "missing" });
      if (afterEscape.hasPause) ctx.fail({ step: "Escape stops movie (step 7)", expected: "#movie-pause hidden after Escape", actual: "still rendered" });
    }

    // Step 5 — MOVIE_COMPLETE natural finish. With 5 elements at ~1s each,
    // movie finishes in ~5s. Then a 2s "Complete" pill, then idle reset.
    // Restart the movie and let it complete naturally.
    await ctx.sidepanel.evaluate(() => (document.getElementById("movie-play-all") as HTMLButtonElement).click());
    await sleep(500);
    // Wait long enough for 5 ticks + complete pill + idle reset (~9s total
    // worst case). We don't assert on the "Complete" pill text directly (it's
    // transient and fast); we assert that the movie returns to idle (Play All
    // visible again).
    const completeDeadline = Date.now() + 12000;
    let backToIdle = false;
    while (Date.now() < completeDeadline) {
      const s = await ctx.sidepanel.evaluate(() => ({
        hasPlay: !!document.getElementById("movie-play-all"),
        hasPause: !!document.getElementById("movie-pause"),
      }));
      if (s.hasPlay && !s.hasPause) { backToIdle = true; break; }
      await sleep(300);
    }
    if (!backToIdle) {
      ctx.fail({
        step: "movie complete (step 5)",
        expected: "MOVIE_COMPLETE → 'Complete' pill (2s) → idle (#movie-play-all visible) within 12s",
        actual: "movie did not return to idle in time",
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-kb-movie-pause-resume-stop");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
