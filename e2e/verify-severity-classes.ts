/**
 * Visual verification — closes audit item 7.
 *
 * .severity-{critical,serious,moderate,minor} drives the left border +
 * pale tint on every violation/details row in scan results. Verify all
 * four impact levels render visibly distinct from each other.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      const impacts = ["critical", "serious", "moderate", "minor"];
      const result: Record<string, { background: string; borderLeftColor: string; borderLeftWidth: string }> = {};
      impacts.forEach((impact) => {
        const el = document.createElement("details");
        el.className = `severity-${impact}`;
        el.textContent = impact;
        host.appendChild(el);
      });
      document.body.appendChild(host);
      Array.from(host.children).forEach((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        const impact = (el as HTMLElement).className.replace("severity-", "");
        result[impact] = {
          background: cs.backgroundColor,
          borderLeftColor: cs.borderLeftColor,
          borderLeftWidth: cs.borderLeftWidth,
        };
      });
      host.remove();
      return result;
    });

    console.log(JSON.stringify(styles, null, 2));

    const expected: Record<string, { bg: string; border: string }> = {
      critical: { bg: "rgb(254, 242, 242)", border: "rgb(239, 68, 68)" },
      serious: { bg: "rgb(255, 247, 237)", border: "rgb(249, 115, 22)" },
      moderate: { bg: "rgb(254, 252, 232)", border: "rgb(234, 179, 8)" },
      minor: { bg: "rgb(239, 246, 255)", border: "rgb(59, 130, 246)" },
    };

    for (const [impact, want] of Object.entries(expected)) {
      const got = styles[impact];
      if (!got) throw new Error(`severity-${impact} returned no style`);
      if (got.background !== want.bg) throw new Error(`severity-${impact} background mismatch: got ${got.background}, want ${want.bg}`);
      if (got.borderLeftColor !== want.border) throw new Error(`severity-${impact} border mismatch: got ${got.borderLeftColor}, want ${want.border}`);
      if (got.borderLeftWidth !== "3px") throw new Error(`severity-${impact} border width mismatch: got ${got.borderLeftWidth}, want 3px`);
    }

    // All four backgrounds must differ from each other.
    const bgSet = new Set(Object.values(styles).map((s) => s.background));
    if (bgSet.size !== 4) throw new Error(`Severity backgrounds collide: ${JSON.stringify(Array.from(bgSet))}`);
    const borderSet = new Set(Object.values(styles).map((s) => s.borderLeftColor));
    if (borderSet.size !== 4) throw new Error(`Severity borders collide: ${JSON.stringify(Array.from(borderSet))}`);

    console.log("\n✅ Audit item 7 verified: all 4 severity classes render visibly distinct.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
