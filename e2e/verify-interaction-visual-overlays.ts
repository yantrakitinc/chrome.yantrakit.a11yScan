/**
 * Verify: visual-overlays interaction (page-side, in shadow DOM).
 * Inventory: docs/test-matrix/interactions/visual-overlays.md
 *
 * Asserts:
 *  - After scan + toggle-violations ON → page has #a11y-scan-overlay-host with
 *    #violation-overlay container in its shadowRoot, with ≥1 outline + badge.
 *  - Each violation badge's textContent is a sequential 1-based index
 *    (1, 2, 3, … — proves the bug fix #41 captures myIndex per iteration).
 *  - Clicking the SECOND badge sends VIOLATION_BADGE_CLICKED with payload.index=1
 *    (NOT the loop's final value — proves PR #41 closure fix works in real Chrome).
 *    Verified via the sidepanel's observable side effect: after a badge click the
 *    sidepanel switches to scan tab + sub-tab=results.
 *  - Toggling violations OFF removes the #violation-overlay container (host stays).
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

// Fixture with multiple guaranteed violations so we get ≥2 badges:
//   - <img> without alt
//   - <button> with empty accessible name
//   - <a> with empty accessible name
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head><title>Overlay fixture</title></head>
<body>
  <h1>Overlay fixture</h1>
  <img src="/x.jpg" id="bad-img">
  <button id="bad-btn"></button>
  <a href="#" id="bad-link"></a>
</body>
</html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Trigger scan
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector("#toggle-violations", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "wait-for-toolbar", expected: "#toggle-violations rendered after scan", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // Toggle violations ON → sends SHOW_VIOLATION_OVERLAY to content script
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await sleep(700);

    // Refocus the page tab to make sure overlay paint completes
    await ctx.page.bringToFront();
    await sleep(200);

    // Read overlay state from inside the page (shadow DOM is open so we can pierce it).
    const overlay = await ctx.page.evaluate(() => {
      const host = document.getElementById("a11y-scan-overlay-host");
      if (!host || !host.shadowRoot) return { hostExists: !!host, hasShadow: false };
      const shadow = host.shadowRoot;
      const violation = shadow.getElementById("violation-overlay");
      if (!violation) return { hostExists: true, hasShadow: true, hasContainer: false };
      const children = Array.from(violation.children) as HTMLElement[];
      const badgeEls = children.filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      const outlineEls = children.filter((c) => !c.textContent || !/^\d+$/.test(c.textContent.trim()));
      const badgeNumbers = badgeEls.map((b) => Number(b.textContent!.trim()));
      return {
        hostExists: true,
        hasShadow: true,
        hasContainer: true,
        badgeCount: badgeEls.length,
        outlineCount: outlineEls.length,
        badgeNumbers,
        // pointer-events:auto on badges so clicks reach them (outlines are
        // pointer-events:none — important for the badge-click verification)
        firstBadgePointerEvents: badgeEls[0]?.style.pointerEvents,
      };
    });

    if (!overlay.hostExists) ctx.fail({ step: "shadow host", expected: "#a11y-scan-overlay-host appended", actual: "missing" });
    if (!overlay.hasShadow) ctx.fail({ step: "shadow root", expected: "shadow root attached", actual: "missing" });
    if (!overlay.hasContainer) ctx.fail({ step: "violation container", expected: "shadow > #violation-overlay", actual: "missing" });
    if ((overlay.badgeCount ?? 0) < 2) ctx.fail({ step: "badges rendered", expected: "≥2 badges (need ≥2 to test indexing)", actual: String(overlay.badgeCount ?? 0) });
    if (overlay.outlineCount === 0) ctx.fail({ step: "outlines rendered", expected: "≥1 outline div per badge", actual: "0" });

    // Sequential 1..N indexing — proves per-iteration capture (PR #41 closure fix)
    if (overlay.badgeNumbers && overlay.badgeNumbers.length >= 2) {
      const expected = overlay.badgeNumbers.map((_, i) => i + 1);
      const ok = overlay.badgeNumbers.every((n, i) => n === expected[i]);
      if (!ok) ctx.fail({ step: "badge numbering", expected: JSON.stringify(expected), actual: JSON.stringify(overlay.badgeNumbers) });
    }

    if (overlay.firstBadgePointerEvents !== "auto") {
      ctx.fail({ step: "badge pointer-events", expected: "auto (clickable)", actual: String(overlay.firstBadgePointerEvents) });
    }

    // ── Badge click → VIOLATION_BADGE_CLICKED with correct index ──
    // Move the sidepanel away from the scan tab so the click's tab-switch
    // side effect is observable. Switch to SR top-tab first.
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(300);

    const beforeClickTopTab = await ctx.sidepanel.evaluate(() => {
      const sel = document.querySelector('[role="tab"][aria-selected="true"]');
      return sel?.id ?? "";
    });

    // Click the second badge (index 1 in payload) inside shadow DOM
    await ctx.page.evaluate(() => {
      const host = document.getElementById("a11y-scan-overlay-host")!;
      const shadow = host.shadowRoot!;
      const violation = shadow.getElementById("violation-overlay")!;
      const children = Array.from(violation.children) as HTMLElement[];
      const badges = children.filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      // Click badge with textContent "2" (zero-based index 1 in payload)
      const target = badges.find((b) => b.textContent!.trim() === "2");
      if (!target) throw new Error("badge#2 not found");
      target.click();
    });
    await sleep(700);

    // Sidepanel should have switched to scan tab + scan sub-tab=results
    const afterClick = await ctx.sidepanel.evaluate(() => {
      const topActive = document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? "";
      const subResults = document.querySelector('[data-subtab="results"]')?.getAttribute("aria-selected") ?? "";
      return { topActive, subResults };
    });

    if (beforeClickTopTab === "tab-scan") {
      ctx.fail({ step: "pre-click setup", expected: "sidepanel parked on non-scan top-tab", actual: `still on ${beforeClickTopTab}` });
    }
    if (afterClick.topActive !== "tab-scan") {
      ctx.fail({ step: "badge#2 click → top-tab", expected: "tab-scan aria-selected=true (proves VIOLATION_BADGE_CLICKED reached sidepanel)", actual: afterClick.topActive });
    }
    if (afterClick.subResults !== "true") {
      ctx.fail({ step: "badge#2 click → sub-tab", expected: "results sub-tab aria-selected=true", actual: afterClick.subResults });
    }

    // ── Toggle OFF → HIDE_VIOLATION_OVERLAY removes container ──
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await sleep(500);

    const afterHide = await ctx.page.evaluate(() => {
      const host = document.getElementById("a11y-scan-overlay-host");
      const shadow = host?.shadowRoot;
      return {
        hostStays: !!host,
        containerGone: !shadow?.getElementById("violation-overlay"),
      };
    });
    if (!afterHide.hostStays) ctx.fail({ step: "toggle off", expected: "shadow host preserved", actual: "host removed" });
    if (!afterHide.containerGone) ctx.fail({ step: "toggle off", expected: "#violation-overlay container removed", actual: "still present" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "visual-overlays");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
