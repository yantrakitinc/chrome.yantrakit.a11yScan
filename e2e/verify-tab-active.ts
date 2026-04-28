/**
 * Visual verification — closes audit item 4.
 *
 * .tab.active drives the top-level tab indicator (Scan / SR / KB / AI).
 * Verify rendered styles differ between active and inactive in real Chrome.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#top-tabs", { timeout: 10000 });

    const styles = await sidepanel.evaluate(() => {
      const host = document.createElement("div");
      host.id = "top-tabs"; // ensure parent rules apply
      host.style.cssText = "position:fixed;left:-9999px;top:-9999px;display:flex";
      const inactive = document.createElement("button");
      inactive.className = "tab";
      inactive.textContent = "Inactive";
      const active = document.createElement("button");
      active.className = "tab active";
      active.textContent = "Active";
      host.appendChild(inactive);
      host.appendChild(active);
      // Append to a fresh wrapper to avoid duplicate id issues with the live
      // #top-tabs in the panel.
      const wrap = document.createElement("div");
      wrap.appendChild(host);
      document.body.appendChild(wrap);
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
      wrap.remove();
      return out;
    });

    console.log("Inactive:", JSON.stringify(styles.inactive));
    console.log("Active:  ", JSON.stringify(styles.active));

    const expectedBorder = "rgb(245, 158, 11)"; // #f59e0b
    const expectedColor = "rgb(120, 53, 15)";    // #78350f
    const expectedBg = "rgb(255, 251, 235)";     // #fffbeb
    if (styles.active.borderBottomColor !== expectedBorder) {
      throw new Error(`Active border mismatch: got ${styles.active.borderBottomColor}, want ${expectedBorder}`);
    }
    if (styles.active.color !== expectedColor) {
      throw new Error(`Active color mismatch: got ${styles.active.color}, want ${expectedColor}`);
    }
    if (styles.active.background !== expectedBg) {
      throw new Error(`Active bg mismatch: got ${styles.active.background}, want ${expectedBg}`);
    }
    if (styles.inactive.background === styles.active.background &&
        styles.inactive.color === styles.active.color) {
      throw new Error("Inactive and active tabs render identically");
    }

    console.log("\n✅ Audit item 4 verified: .tab.active produces a distinct amber underline + amber-tinted bg.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
