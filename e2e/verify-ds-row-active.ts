/**
 * Visual verification — closes audit item 5.
 *
 * .ds-row--active is added by sr-tab and kb-tab render templates when a
 * row is currently being highlighted (Movie Mode active, Speak active,
 * recently-clicked). The CSS rule sets background to var(--ds-amber-100).
 * Verify it differs from the inactive baseline.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      const inactive = document.createElement("div");
      inactive.className = "ds-row";
      inactive.textContent = "row";
      const active = document.createElement("div");
      active.className = "ds-row ds-row--active";
      active.textContent = "row active";
      host.appendChild(inactive);
      host.appendChild(active);
      document.body.appendChild(host);
      const ic = getComputedStyle(inactive);
      const ac = getComputedStyle(active);
      const out = {
        inactive: { background: ic.backgroundColor },
        active: { background: ac.backgroundColor },
      };
      host.remove();
      return out;
    });

    console.log("Inactive:", JSON.stringify(styles.inactive));
    console.log("Active:  ", JSON.stringify(styles.active));

    const expectedActiveBg = "rgb(254, 243, 199)"; // --ds-amber-100 → #fef3c7
    if (styles.active.background !== expectedActiveBg) {
      throw new Error(`Active background mismatch: got ${styles.active.background}, want ${expectedActiveBg}`);
    }
    if (styles.inactive.background === styles.active.background) {
      throw new Error(`Inactive and active rows render identically: ${styles.active.background}`);
    }

    console.log("\n✅ Audit item 5 verified: .ds-row--active produces a distinct amber-tinted background.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
