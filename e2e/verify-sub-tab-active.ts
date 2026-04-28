/**
 * Visual verification — closes audit item 3.
 *
 * .sub-tab.active drives the active sub-tab indicator inside the Scan tab
 * (Results / Manual / ARIA / Observe). Verify two siblings rendered with
 * vs without .active produce visibly different border-bottom-color, text
 * color, and background.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px;display:flex";
      const inactive = document.createElement("button");
      inactive.className = "sub-tab";
      inactive.textContent = "Manual";
      const active = document.createElement("button");
      active.className = "sub-tab active";
      active.textContent = "Results";
      host.appendChild(inactive);
      host.appendChild(active);
      document.body.appendChild(host);
      const ic = getComputedStyle(inactive);
      const ac = getComputedStyle(active);
      const out = {
        inactive: {
          background: ic.backgroundColor,
          color: ic.color,
          borderBottomColor: ic.borderBottomColor,
        },
        active: {
          background: ac.backgroundColor,
          color: ac.color,
          borderBottomColor: ac.borderBottomColor,
        },
      };
      host.remove();
      return out;
    });

    console.log("Inactive:", JSON.stringify(styles.inactive));
    console.log("Active:  ", JSON.stringify(styles.active));

    // Active expectations: amber-500 underline, near-black text, white bg.
    const expectedBorder = "rgb(245, 158, 11)";  // #f59e0b
    const expectedColor = "rgb(24, 24, 27)";     // #18181b
    const expectedBg = "rgb(255, 255, 255)";     // #fff

    if (styles.active.borderBottomColor !== expectedBorder) {
      throw new Error(`Active border mismatch: got ${styles.active.borderBottomColor}, want ${expectedBorder}`);
    }
    if (styles.active.color !== expectedColor) {
      throw new Error(`Active color mismatch: got ${styles.active.color}, want ${expectedColor}`);
    }
    if (styles.active.background !== expectedBg) {
      throw new Error(`Active bg mismatch: got ${styles.active.background}, want ${expectedBg}`);
    }
    if (styles.inactive.borderBottomColor === styles.active.borderBottomColor &&
        styles.inactive.color === styles.active.color) {
      throw new Error("Inactive and active sub-tabs render identically");
    }

    console.log("\n✅ Audit item 3 verified: .sub-tab.active produces a distinct amber underline + darker text.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
